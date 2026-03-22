import {
  AgentMessage,
  AppendChatMessageDto,
  ApprovalDecision,
  ChatCheckpointRecord,
  ChatEventRecord,
  ChatMessageRecord,
  ChatSessionRecord,
  CreateChatSessionDto,
  LearningCandidateRecord,
  LearningConfirmationDto,
  SessionApprovalDto,
  TaskRecord,
  TaskStatus
} from '@agent/shared';
import { FileRuleRepository, MemoryRepository, RuntimeStateRepository } from '@agent/memory';
import { SkillRegistry } from '@agent/skills';

import { ZhipuLlmProvider } from '../adapters/llm/zhipu-provider';
import { AgentOrchestrator } from '../graphs/main.graph';
import { TASK_MESSAGE_EVENT_MAP, TRACE_EVENT_MAP } from '../shared/event-maps';

const RECENT_MESSAGES_TO_KEEP = 8;
const CONTEXT_MESSAGE_WINDOW = 10;
const COMPRESSION_TRIGGER_COUNT = 16;
const COMPRESSION_TRIGGER_CHAR_COUNT = 3600;
const MAX_SUMMARY_CHARS = 1200;
const CHAT_VISIBLE_MESSAGE_TYPES = new Set<AgentMessage['type']>(['summary']);

export class SessionCoordinator {
  private readonly sessions = new Map<string, ChatSessionRecord>();
  private readonly ruleRepository = new FileRuleRepository();
  private readonly messages = new Map<string, ChatMessageRecord[]>();
  private readonly events = new Map<string, ChatEventRecord[]>();
  private readonly checkpoints = new Map<string, ChatCheckpointRecord>();
  private readonly llm = new ZhipuLlmProvider();
  private readonly subscribers = new Map<string, Set<(event: ChatEventRecord) => void>>();
  private initializationPromise?: Promise<void>;
  private taskSubscriptionBound = false;

  constructor(
    private readonly orchestrator: AgentOrchestrator,
    private readonly runtimeStateRepository: RuntimeStateRepository,
    private readonly memoryRepository: MemoryRepository,
    private readonly skillRegistry: SkillRegistry
  ) {}

  async initialize(): Promise<void> {
    if (!this.initializationPromise) {
      this.initializationPromise = this.hydrate();
    }
    await this.initializationPromise;

    if (!this.taskSubscriptionBound) {
      this.bindTaskUpdates();
      this.taskSubscriptionBound = true;
    }
  }

  listSessions(): ChatSessionRecord[] {
    return [...this.sessions.values()].sort((left, right) => {
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
  }

  getSession(sessionId: string): ChatSessionRecord | undefined {
    return this.sessions.get(sessionId);
  }

  getMessages(sessionId: string): ChatMessageRecord[] {
    return this.messages.get(sessionId) ?? [];
  }

  getEvents(sessionId: string): ChatEventRecord[] {
    return this.events.get(sessionId) ?? [];
  }

  getCheckpoint(sessionId: string): ChatCheckpointRecord | undefined {
    return this.checkpoints.get(sessionId);
  }

  subscribe(sessionId: string, listener: (event: ChatEventRecord) => void): () => void {
    const listeners = this.subscribers.get(sessionId) ?? new Set<(event: ChatEventRecord) => void>();
    listeners.add(listener);
    this.subscribers.set(sessionId, listeners);
    return () => {
      const next = this.subscribers.get(sessionId);
      next?.delete(listener);
      if (next && next.size === 0) {
        this.subscribers.delete(sessionId);
      }
    };
  }

  async createSession(dto: CreateChatSessionDto): Promise<ChatSessionRecord> {
    await this.initialize();
    const now = new Date().toISOString();
    const session: ChatSessionRecord = {
      id: `session_${Date.now()}`,
      title: dto.title?.trim() || dto.message.trim().slice(0, 48) || '\u65b0\u4f1a\u8bdd',
      status: 'idle',
      createdAt: now,
      updatedAt: now
    };

    this.sessions.set(session.id, session);
    this.messages.set(session.id, []);
    this.events.set(session.id, []);

    const message = this.addMessage(session.id, 'user', dto.message);
    this.addEvent(session.id, 'session_started', { title: session.title });
    this.addEvent(session.id, 'user_message', { messageId: message.id, content: message.content });
    await this.persistRuntimeState();
    void this.runTurn(session.id, dto.message);
    return session;
  }

  async appendMessage(sessionId: string, dto: AppendChatMessageDto): Promise<ChatMessageRecord> {
    await this.initialize();
    const session = this.requireSession(sessionId);
    const message = this.addMessage(sessionId, 'user', dto.message);
    session.updatedAt = new Date().toISOString();
    session.status = 'idle';
    this.addEvent(sessionId, 'user_message', { messageId: message.id, content: message.content });
    await this.persistRuntimeState();
    void this.runTurn(sessionId, dto.message);
    return message;
  }

  async approve(sessionId: string, dto: SessionApprovalDto): Promise<ChatSessionRecord> {
    await this.initialize();
    const session = this.requireSession(sessionId);
    const taskId = this.requireTaskId(session);
    const task = await this.orchestrator.applyApproval(taskId, dto, ApprovalDecision.APPROVED);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    this.syncTask(sessionId, task);
    this.addEvent(sessionId, 'approval_resolved', { taskId, decision: 'approved', intent: dto.intent });
    await this.persistRuntimeState();
    return this.requireSession(sessionId);
  }

  async reject(sessionId: string, dto: SessionApprovalDto): Promise<ChatSessionRecord> {
    await this.initialize();
    const session = this.requireSession(sessionId);
    const taskId = this.requireTaskId(session);
    const task = await this.orchestrator.applyApproval(taskId, dto, ApprovalDecision.REJECTED);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    this.syncTask(sessionId, task);
    this.addEvent(sessionId, 'approval_resolved', { taskId, decision: 'rejected', intent: dto.intent });
    await this.persistRuntimeState();
    return this.requireSession(sessionId);
  }

  async confirmLearning(sessionId: string, dto: LearningConfirmationDto): Promise<ChatSessionRecord> {
    await this.initialize();
    const session = this.requireSession(sessionId);
    const taskId = this.requireTaskId(session);
    const task = this.orchestrator.getTask(taskId);
    if (task) {
      await this.confirmLearningCandidates(sessionId, task, dto.candidateIds, false);
    }
    return session;
  }

  async recover(sessionId: string): Promise<ChatSessionRecord> {
    await this.initialize();
    const session = this.requireSession(sessionId);
    const taskId = this.requireTaskId(session);
    const task = this.orchestrator.getTask(taskId);
    if (task) {
      this.syncTask(sessionId, task);
    }
    this.addEvent(sessionId, 'session_started', { recovered: true, taskId });
    await this.persistRuntimeState();
    return session;
  }

  private bindTaskUpdates(): void {
    this.orchestrator.subscribe(task => {
      if (!task.sessionId || !this.sessions.has(task.sessionId)) {
        return;
      }
      this.syncTask(task.sessionId, task);
      void this.persistRuntimeState();
    });

    this.orchestrator.subscribeTokens(tokenEvent => {
      const task = this.orchestrator.getTask(tokenEvent.taskId);
      if (!task?.sessionId || !this.sessions.has(task.sessionId)) {
        return;
      }

      this.appendStreamingMessage(
        task.sessionId,
        tokenEvent.messageId,
        tokenEvent.token,
        tokenEvent.role,
        tokenEvent.createdAt
      );
      this.addEvent(task.sessionId, 'assistant_token', {
        taskId: tokenEvent.taskId,
        messageId: tokenEvent.messageId,
        content: tokenEvent.token,
        from: tokenEvent.role,
        model: tokenEvent.model,
        summary: tokenEvent.token
      });
      void this.persistRuntimeState();
    });
  }

  private async runTurn(sessionId: string, input: string): Promise<void> {
    const session = this.requireSession(sessionId);
    session.status = 'running';
    session.updatedAt = new Date().toISOString();
    await this.persistRuntimeState();

    try {
      await this.compressConversationIfNeeded(sessionId);
      const task = await this.orchestrator.createTask({
        goal: input,
        context: this.buildConversationContext(sessionId),
        constraints: [],
        sessionId
      });
      this.syncTask(sessionId, task);
      await this.persistRuntimeState();
    } catch (error) {
      session.status = 'failed';
      session.updatedAt = new Date().toISOString();
      this.addEvent(sessionId, 'session_failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      await this.persistRuntimeState();
    }
  }

  private syncTask(sessionId: string, task: TaskRecord): void {
    const session = this.requireSession(sessionId);
    if ((!task.learningCandidates || task.learningCandidates.length === 0) && task.review) {
      task.learningCandidates = this.createLearningCandidates(task);
    }

    session.currentTaskId = task.id;
    session.updatedAt = new Date().toISOString();

    const checkpoint = this.checkpoints.get(sessionId) ?? this.createCheckpoint(sessionId, task.id);
    const sessionMessages = this.messages.get(sessionId) ?? [];

    for (const trace of task.trace.slice(checkpoint.traceCursor)) {
      const type = TRACE_EVENT_MAP[trace.node];
      if (!type) {
        continue;
      }
      this.addEvent(sessionId, type, {
        taskId: task.id,
        node: trace.node,
        summary: trace.summary,
        data: trace.data ?? {}
      });
    }

    for (const taskMessage of task.messages.slice(checkpoint.messageCursor)) {
      if (taskMessage.type === 'summary_delta') {
        continue;
      }

      this.addEvent(sessionId, TASK_MESSAGE_EVENT_MAP[taskMessage.type], {
        taskId: task.id,
        messageType: taskMessage.type,
        from: taskMessage.from,
        to: taskMessage.to,
        content: taskMessage.content,
        summary: taskMessage.content
      });

      if (!CHAT_VISIBLE_MESSAGE_TYPES.has(taskMessage.type)) {
        continue;
      }

      const hasExistingSummary = sessionMessages.some(
        message => message.role === 'assistant' && message.content === taskMessage.content
      );

      if (!hasExistingSummary) {
        this.addMessage(sessionId, 'assistant', taskMessage.content, taskMessage.from);
      }
    }

    for (const approval of task.approvals.slice(checkpoint.approvalCursor)) {
      this.addEvent(sessionId, approval.decision === 'pending' ? 'approval_required' : 'approval_resolved', {
        taskId: task.id,
        intent: approval.intent,
        decision: approval.decision,
        reason: approval.reason,
        actor: approval.actor
      });
    }

    const hasAssistantResult = sessionMessages.some(
      message => message.role === 'assistant' && message.content === task.result
    );
    if (task.result && !hasAssistantResult) {
      const assistantMessage = this.addMessage(sessionId, 'assistant', task.result);
      this.addEvent(sessionId, 'assistant_message', {
        taskId: task.id,
        messageId: assistantMessage.id,
        content: assistantMessage.content,
        summary: assistantMessage.content
      });
    }

    checkpoint.taskId = task.id;
    checkpoint.traceCursor = task.trace.length;
    checkpoint.messageCursor = task.messages.length;
    checkpoint.approvalCursor = task.approvals.length;
    checkpoint.learningCursor = task.learningCandidates?.length ?? 0;
    checkpoint.graphState = {
      status: task.status,
      currentStep: task.currentStep,
      retryCount: task.retryCount,
      maxRetries: task.maxRetries
    };
    checkpoint.pendingApprovals = task.approvals.filter(approval => approval.decision === 'pending');
    checkpoint.agentStates = task.agentStates;
    checkpoint.updatedAt = new Date().toISOString();
    this.checkpoints.set(sessionId, checkpoint);

    if (task.status === TaskStatus.WAITING_APPROVAL) {
      session.status = 'waiting_approval';
      return;
    }

    if (task.status === TaskStatus.FAILED || task.status === TaskStatus.BLOCKED) {
      session.status = 'failed';
      return;
    }

    if (task.status === TaskStatus.COMPLETED) {
      session.status = 'completed';
      void this.autoConfirmLearningIfNeeded(sessionId, task);
      return;
    }

    session.status = 'running';
  }

  private addMessage(
    sessionId: string,
    role: ChatMessageRecord['role'],
    content: string,
    linkedAgent?: ChatMessageRecord['linkedAgent']
  ): ChatMessageRecord {
    const message: ChatMessageRecord = {
      id: `chat_msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sessionId,
      role,
      content,
      linkedAgent,
      createdAt: new Date().toISOString()
    };

    const items = this.messages.get(sessionId) ?? [];
    items.push(message);
    this.messages.set(sessionId, items);
    return message;
  }

  private appendStreamingMessage(
    sessionId: string,
    messageId: string,
    token: string,
    linkedAgent: ChatMessageRecord['linkedAgent'],
    createdAt: string
  ): ChatMessageRecord {
    const items = this.messages.get(sessionId) ?? [];
    const existing = items.find(message => message.id === messageId);
    if (existing) {
      existing.content += token;
      existing.linkedAgent = linkedAgent;
      return existing;
    }

    const message: ChatMessageRecord = {
      id: messageId,
      sessionId,
      role: 'assistant',
      content: token,
      linkedAgent,
      createdAt
    };
    items.push(message);
    this.messages.set(sessionId, items);
    return message;
  }

  private addEvent(
    sessionId: string,
    type: ChatEventRecord['type'],
    payload: Record<string, unknown>
  ): ChatEventRecord {
    const event: ChatEventRecord = {
      id: `chat_evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sessionId,
      type,
      at: new Date().toISOString(),
      payload
    };

    const items = this.events.get(sessionId) ?? [];
    items.push(event);
    this.events.set(sessionId, items);
    this.subscribers.get(sessionId)?.forEach(listener => listener(event));
    return event;
  }

  private createCheckpoint(sessionId: string, taskId: string): ChatCheckpointRecord {
    const now = new Date().toISOString();
    const checkpoint: ChatCheckpointRecord = {
      sessionId,
      taskId,
      traceCursor: 0,
      messageCursor: 0,
      approvalCursor: 0,
      learningCursor: 0,
      graphState: {
        status: TaskStatus.QUEUED
      },
      pendingApprovals: [],
      agentStates: [],
      createdAt: now,
      updatedAt: now
    };
    this.checkpoints.set(sessionId, checkpoint);
    return checkpoint;
  }

  private createLearningCandidates(task: TaskRecord): LearningCandidateRecord[] {
    const now = new Date().toISOString();
    return [
      {
        id: `learn_mem_${Date.now()}`,
        taskId: task.id,
        type: 'memory',
        summary: '\u6c89\u6dc0\u672c\u8f6e\u591a Agent \u6267\u884c\u7ecf\u9a8c',
        status: 'pending_confirmation',
        payload: {
          id: `mem_candidate_${Date.now()}`,
          type: task.status === TaskStatus.COMPLETED ? 'success_case' : 'failure_case',
          taskId: task.id,
          summary: `\u56f4\u7ed5 ${task.goal} \u7684\u591a Agent \u7ecf\u9a8c\u603b\u7ed3`,
          content: task.result ?? '',
          tags: ['chat-session', 'multi-agent'],
          createdAt: now
        },
        createdAt: now
      },
      {
        id: `learn_rule_${Date.now()}`,
        taskId: task.id,
        type: 'rule',
        summary: '\u6c89\u6dc0\u53ef\u590d\u7528\u7684\u6267\u884c\u7ea6\u675f',
        status: 'pending_confirmation',
        payload: {
          id: `rule_candidate_${Date.now()}`,
          name: 'Chat Session Rule Candidate',
          summary: '\u5f53\u7c7b\u4f3c\u76ee\u6807\u518d\u6b21\u51fa\u73b0\u65f6\u590d\u7528\u8fd9\u6761\u89c4\u5219',
          conditions: [`taskId=${task.id}`],
          action: task.result ?? 'review task result',
          sourceTaskId: task.id,
          createdAt: now
        },
        createdAt: now
      },
      {
        id: `learn_skill_${Date.now()}`,
        taskId: task.id,
        type: 'skill',
        summary: '\u5c06\u672c\u8f6e\u6267\u884c\u62bd\u53d6\u4e3a\u6280\u80fd\u5019\u9009\u5e76\u8fdb\u5165 lab',
        status: 'pending_confirmation',
        payload: {
          id: `skill_candidate_${Date.now()}`,
          name: 'Chat Session Skill Candidate',
          description:
            '\u4ece\u4e3b Agent \u4e0e\u5b50 Agent \u534f\u4f5c\u8fc7\u7a0b\u4e2d\u63d0\u70bc\u51fa\u7684\u53ef\u590d\u7528\u6280\u80fd\u3002',
          applicableGoals: [task.goal],
          requiredTools: ['search_memory', 'read_local_file'],
          steps:
            task.plan?.steps.map((step, index) => ({
              title: `Step ${index + 1}`,
              instruction: step,
              toolNames: ['search_memory']
            })) ?? [],
          constraints: ['\u9ad8\u98ce\u9669\u52a8\u4f5c\u5fc5\u987b\u4eba\u5de5\u786e\u8ba4'],
          successSignals: ['\u4efb\u52a1\u6210\u529f\u5b8c\u6210', 'review \u7ed9\u51fa approved \u7ed3\u8bba'],
          riskLevel: 'medium',
          source: 'execution',
          status: 'lab',
          createdAt: now,
          updatedAt: now
        },
        createdAt: now
      }
    ];
  }

  private buildConversationContext(sessionId: string): string {
    const session = this.requireSession(sessionId);
    const messages = this.getMessages(sessionId);
    const recentMessages = messages.slice(-CONTEXT_MESSAGE_WINDOW);
    const summaryBlock = session.compression?.summary
      ? [
          '\u4ee5\u4e0b\u662f\u8f83\u65e9\u804a\u5929\u8bb0\u5f55\u7684\u538b\u7f29\u6458\u8981\uff1a',
          session.compression.summary,
          '\u4ee5\u4e0b\u662f\u6700\u8fd1\u7684\u539f\u59cb\u6d88\u606f\uff1a'
        ].join('\n')
      : '';
    const messageBlock = recentMessages.map(message => `${message.role}: ${message.content}`).join('\n');
    return [summaryBlock, messageBlock].filter(Boolean).join('\n');
  }

  private async compressConversationIfNeeded(sessionId: string): Promise<void> {
    const session = this.requireSession(sessionId);
    const messages = this.getMessages(sessionId);
    const condensedCount = session.compression?.condensedMessageCount ?? 0;
    const nextCondensedCount = messages.length - RECENT_MESSAGES_TO_KEEP;
    const totalCharacterCount = messages.reduce((sum, message) => sum + message.content.length, 0);

    if (nextCondensedCount <= condensedCount) {
      return;
    }

    const trigger =
      messages.length >= COMPRESSION_TRIGGER_COUNT
        ? 'message_count'
        : totalCharacterCount >= COMPRESSION_TRIGGER_CHAR_COUNT
          ? 'character_count'
          : undefined;

    if (!trigger) {
      return;
    }

    const messagesToCondense = messages.slice(0, nextCondensedCount);
    const condensedCharacterCount = messagesToCondense.reduce((sum, message) => sum + message.content.length, 0);
    const compressed = await this.createConversationSummary(messagesToCondense);
    session.compression = {
      summary: compressed.summary,
      condensedMessageCount: nextCondensedCount,
      condensedCharacterCount,
      totalCharacterCount,
      trigger,
      source: compressed.source,
      updatedAt: new Date().toISOString()
    };
    session.updatedAt = new Date().toISOString();
    this.addEvent(sessionId, 'conversation_compacted', {
      condensedMessageCount: nextCondensedCount,
      condensedCharacterCount,
      totalCharacterCount,
      recentMessageCount: RECENT_MESSAGES_TO_KEEP,
      trigger,
      summary: compressed.summary,
      source: compressed.source
    });
    await this.persistRuntimeState();
  }

  private async createConversationSummary(
    messages: ChatMessageRecord[]
  ): Promise<{ summary: string; source: 'heuristic' | 'llm' }> {
    const heuristicSummary = this.createHeuristicConversationSummary(messages);

    if (!this.llm.isConfigured()) {
      return {
        summary: heuristicSummary,
        source: 'heuristic'
      };
    }

    try {
      const summary = await this.llm.generateText(
        [
          {
            role: 'system',
            content:
              '\u4f60\u662f\u4f1a\u8bdd\u538b\u7f29\u52a9\u624b\u3002\u8bf7\u7528\u4e2d\u6587\u628a\u8f83\u65e9\u804a\u5929\u8bb0\u5f55\u538b\u7f29\u6210\u77ed\u6458\u8981\uff0c\u4fdd\u7559\u7528\u6237\u610f\u56fe\u3001\u5173\u952e\u504f\u597d\u3001\u91cd\u8981\u7ed3\u8bba\u548c\u672a\u5b8c\u6210\u4e8b\u9879\u3002\u4e0d\u8981\u4f7f\u7528 markdown\uff0c\u4e0d\u8981\u7f16\u9020\u4e0d\u5b58\u5728\u7684\u4fe1\u606f\u3002'
          },
          {
            role: 'user',
            content: messages.map(message => `${message.role}: ${message.content}`).join('\n')
          }
        ],
        {
          role: 'manager',
          temperature: 0.1,
          maxTokens: 400,
          thinking: false
        }
      );

      const normalized = summary.trim();
      if (!normalized) {
        return {
          summary: heuristicSummary,
          source: 'heuristic'
        };
      }

      return {
        summary: normalized.length > MAX_SUMMARY_CHARS ? `${normalized.slice(0, MAX_SUMMARY_CHARS)}...` : normalized,
        source: 'llm'
      };
    } catch {
      return {
        summary: heuristicSummary,
        source: 'heuristic'
      };
    }
  }

  private createHeuristicConversationSummary(messages: ChatMessageRecord[]): string {
    const recentUserGoals = messages
      .filter(message => message.role === 'user')
      .slice(-4)
      .map(message => this.normalizeMessageSnippet(message.content));
    const recentAssistantReplies = messages
      .filter(message => message.role === 'assistant')
      .slice(-4)
      .map(message => this.normalizeMessageSnippet(message.content));
    const systemNotes = messages
      .filter(message => message.role === 'system')
      .slice(-3)
      .map(message => this.normalizeMessageSnippet(message.content));

    const sections = [
      recentUserGoals.length ? `\u7528\u6237\u8fd1\u671f\u5173\u6ce8\uff1a${recentUserGoals.join('?')}` : '',
      recentAssistantReplies.length
        ? `\u7cfb\u7edf\u5df2\u7ed9\u51fa\u7684\u5173\u952e\u56de\u590d\uff1a${recentAssistantReplies.join('?')}`
        : '',
      systemNotes.length ? `\u7cfb\u7edf\u8bf4\u660e\u4e0e\u4e2d\u95f4\u7ed3\u8bba\uff1a${systemNotes.join('?')}` : ''
    ].filter(Boolean);

    const summary = sections.join('\n');
    return summary.length > MAX_SUMMARY_CHARS ? `${summary.slice(0, MAX_SUMMARY_CHARS)}...` : summary;
  }

  private normalizeMessageSnippet(content: string): string {
    const normalized = content.replace(/\s+/g, ' ').trim();
    return normalized.length > 120 ? `${normalized.slice(0, 120)}...` : normalized;
  }

  private async autoConfirmLearningIfNeeded(sessionId: string, task: TaskRecord): Promise<void> {
    const pendingCandidateIds =
      task.learningCandidates
        ?.filter(candidate => candidate.status === 'pending_confirmation')
        .map(candidate => candidate.id) ?? [];

    if (!pendingCandidateIds.length) {
      return;
    }

    await this.confirmLearningCandidates(sessionId, task, pendingCandidateIds, true);
  }

  private async confirmLearningCandidates(
    sessionId: string,
    task: TaskRecord,
    candidateIds?: string[],
    autoConfirmed = false
  ): Promise<void> {
    if (!task.learningCandidates?.length) {
      return;
    }

    const selected = new Set(candidateIds ?? task.learningCandidates.map(candidate => candidate.id));
    for (const candidate of task.learningCandidates) {
      if (!selected.has(candidate.id)) {
        continue;
      }
      if (candidate.type === 'memory') {
        await this.memoryRepository.append(candidate.payload as never);
      } else if (candidate.type === 'rule') {
        await this.ruleRepository.append(candidate.payload as never);
      } else if (candidate.type === 'skill') {
        await this.skillRegistry.publishToLab(candidate.payload as never);
      }
    }

    task.learningCandidates = task.learningCandidates.map(candidate =>
      selected.has(candidate.id)
        ? { ...candidate, status: 'confirmed', confirmedAt: new Date().toISOString() }
        : candidate
    );

    const session = this.requireSession(sessionId);
    session.status = task.status === TaskStatus.FAILED ? 'failed' : 'completed';
    session.updatedAt = new Date().toISOString();
    this.addEvent(sessionId, 'learning_confirmed', {
      taskId: task.id,
      candidateIds: [...selected],
      autoConfirmed
    });
    await this.persistRuntimeState();
  }

  private requireSession(sessionId: string): ChatSessionRecord {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return session;
  }

  private requireTaskId(session: ChatSessionRecord): string {
    if (!session.currentTaskId) {
      throw new Error(`Session ${session.id} has no active task`);
    }
    return session.currentTaskId;
  }

  private async hydrate(): Promise<void> {
    await this.orchestrator.initialize();
    const snapshot = await this.runtimeStateRepository.load();
    this.sessions.clear();
    this.messages.clear();
    this.events.clear();
    this.checkpoints.clear();

    for (const session of snapshot.chatSessions) {
      this.sessions.set(session.id, session);
    }

    for (const message of snapshot.chatMessages) {
      const items = this.messages.get(message.sessionId) ?? [];
      items.push(message);
      this.messages.set(message.sessionId, items);
    }

    for (const event of snapshot.chatEvents) {
      const items = this.events.get(event.sessionId) ?? [];
      items.push(event);
      this.events.set(event.sessionId, items);
    }

    for (const checkpoint of snapshot.chatCheckpoints) {
      this.checkpoints.set(checkpoint.sessionId, checkpoint);
    }
  }

  private async persistRuntimeState(): Promise<void> {
    const snapshot = await this.runtimeStateRepository.load();
    await this.runtimeStateRepository.save({
      ...snapshot,
      chatSessions: [...this.sessions.values()],
      chatMessages: [...this.messages.values()].flat(),
      chatEvents: [...this.events.values()].flat(),
      chatCheckpoints: [...this.checkpoints.values()]
    });
  }
}
