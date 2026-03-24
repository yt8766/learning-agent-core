import {
  AgentMessage,
  AppendChatMessageDto,
  ChatThinkState,
  ChatThoughtChainItem,
  ApprovalDecision,
  ChatCheckpointRecord,
  ChatEventRecord,
  ChatMessageRecord,
  ChatSessionRecord,
  CreateChatSessionDto,
  LearningConfirmationDto,
  SessionCancelDto,
  SessionApprovalDto,
  TaskRecord,
  TaskStatus,
  UpdateChatSessionDto
} from '@agent/shared';
import { RuntimeStateRepository } from '@agent/memory';

import { LlmProvider } from '../adapters/llm/llm-provider';
import { createLearningGraph } from '../graphs/learning.graph';
import { AgentOrchestrator } from '../graphs/main.graph';
import { TASK_MESSAGE_EVENT_MAP, TRACE_EVENT_MAP } from '../shared/event-maps';

const RECENT_MESSAGES_TO_KEEP = 8;
const CONTEXT_MESSAGE_WINDOW = 10;
const COMPRESSION_TRIGGER_COUNT = 16;
const COMPRESSION_TRIGGER_CHAR_COUNT = 3600;
const MAX_SUMMARY_CHARS = 1200;
const CHAT_VISIBLE_MESSAGE_TYPES = new Set<AgentMessage['type']>(['summary']);
const PROGRESS_STREAM_MESSAGE_PREFIX = 'progress_stream_';

export class SessionCoordinator {
  private readonly sessions = new Map<string, ChatSessionRecord>();
  private readonly messages = new Map<string, ChatMessageRecord[]>();
  private readonly events = new Map<string, ChatEventRecord[]>();
  private readonly checkpoints = new Map<string, ChatCheckpointRecord>();
  private readonly llm: LlmProvider;
  private readonly subscribers = new Map<string, Set<(event: ChatEventRecord) => void>>();
  private initializationPromise?: Promise<void>;
  private taskSubscriptionBound = false;

  constructor(
    private readonly orchestrator: AgentOrchestrator,
    private readonly runtimeStateRepository: RuntimeStateRepository,
    llmProvider: LlmProvider
  ) {
    this.llm = llmProvider;
  }

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
    const initialMessage = dto.message?.trim() ?? '';
    const session: ChatSessionRecord = {
      id: `session_${Date.now()}`,
      title: dto.title?.trim() || initialMessage.slice(0, 48) || '\u65b0\u4f1a\u8bdd',
      status: 'idle',
      createdAt: now,
      updatedAt: now
    };

    this.sessions.set(session.id, session);
    this.messages.set(session.id, []);
    this.events.set(session.id, []);

    this.addEvent(session.id, 'session_started', { title: session.title });
    await this.persistRuntimeState();

    if (initialMessage) {
      const message = this.addMessage(session.id, 'user', initialMessage);
      this.addEvent(session.id, 'user_message', { messageId: message.id, content: message.content });
      await this.persistRuntimeState();
      void this.runTurn(session.id, initialMessage);
    }

    return session;
  }

  async updateSession(sessionId: string, dto: UpdateChatSessionDto): Promise<ChatSessionRecord> {
    await this.initialize();
    const session = this.requireSession(sessionId);
    const nextTitle = dto.title.trim();

    if (!nextTitle) {
      throw new Error('会话标题不能为空');
    }

    session.title = nextTitle;
    session.updatedAt = new Date().toISOString();
    await this.persistRuntimeState();
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
    this.addEvent(sessionId, 'approval_resolved', {
      taskId,
      decision: 'approved',
      intent: dto.intent,
      feedback: dto.feedback
    });
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
    this.addEvent(sessionId, dto.feedback ? 'approval_rejected_with_feedback' : 'approval_resolved', {
      taskId,
      decision: 'rejected',
      intent: dto.intent,
      feedback: dto.feedback
    });
    await this.persistRuntimeState();
    return this.requireSession(sessionId);
  }

  async confirmLearning(sessionId: string, dto: LearningConfirmationDto): Promise<ChatSessionRecord> {
    await this.initialize();
    const session = this.requireSession(sessionId);
    const taskId = this.requireTaskId(session);
    const task = this.orchestrator.getTask(taskId);
    if (task) {
      await this.runLearningConfirmation(sessionId, task, dto.candidateIds, false);
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

  async cancel(sessionId: string, dto?: SessionCancelDto): Promise<ChatSessionRecord> {
    await this.initialize();
    const session = this.requireSession(sessionId);
    const taskId = this.requireTaskId(session);
    const task = await this.orchestrator.cancelTask(taskId, dto?.reason);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    this.syncTask(sessionId, task);
    this.addMessage(
      sessionId,
      'system',
      dto?.reason ? `已终止当前执行：${dto.reason}` : '已手动终止当前执行。',
      undefined
    );
    await this.persistRuntimeState();
    return this.requireSession(sessionId);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.initialize();
    this.requireSession(sessionId);

    await this.orchestrator.deleteSessionState(sessionId);
    this.sessions.delete(sessionId);
    this.messages.delete(sessionId);
    this.events.delete(sessionId);
    this.checkpoints.delete(sessionId);
    this.subscribers.delete(sessionId);
    await this.persistRuntimeState();
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
      this.orchestrator.ensureLearningCandidates(task);
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
        const progressMessageId = `${PROGRESS_STREAM_MESSAGE_PREFIX}${task.id}`;
        this.appendStreamingMessage(
          sessionId,
          progressMessageId,
          taskMessage.content,
          taskMessage.from,
          taskMessage.createdAt
        );
        this.addEvent(sessionId, 'assistant_token', {
          taskId: task.id,
          messageId: progressMessageId,
          content: taskMessage.content,
          from: taskMessage.from,
          summary: taskMessage.content
        });
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
      const pendingApproval =
        approval.decision === 'pending' && task.pendingApproval?.intent === approval.intent
          ? task.pendingApproval
          : task.pendingAction?.intent === approval.intent
            ? task.pendingAction
            : undefined;
      this.addEvent(sessionId, approval.decision === 'pending' ? 'approval_required' : 'approval_resolved', {
        taskId: task.id,
        intent: approval.intent,
        decision: approval.decision,
        reason: approval.reason,
        actor: approval.actor,
        riskLevel: pendingApproval?.riskLevel,
        requestedBy: pendingApproval?.requestedBy,
        toolName: pendingApproval?.toolName
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
    checkpoint.runId = task.runId;
    checkpoint.skillId = task.skillId;
    checkpoint.skillStage = task.skillStage;
    checkpoint.resolvedWorkflow = task.resolvedWorkflow;
    checkpoint.currentNode = task.currentNode;
    checkpoint.currentMinistry = task.currentMinistry;
    checkpoint.currentWorker = task.currentWorker;
    checkpoint.pendingAction = task.pendingAction;
    checkpoint.pendingApproval = task.pendingApproval;
    checkpoint.approvalFeedback = task.approvalFeedback;
    checkpoint.modelRoute = task.modelRoute;
    checkpoint.externalSources = task.externalSources;
    checkpoint.reusedMemories = task.reusedMemories;
    checkpoint.reusedRules = task.reusedRules;
    checkpoint.reusedSkills = task.reusedSkills;
    checkpoint.learningEvaluation = task.learningEvaluation;
    checkpoint.budgetState = task.budgetState;
    checkpoint.llmUsage = task.llmUsage;
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
    checkpoint.thoughtChain = this.buildThoughtChain(task);
    checkpoint.thinkState = this.buildThinkState(task);
    checkpoint.updatedAt = new Date().toISOString();
    this.checkpoints.set(sessionId, checkpoint);

    if (task.status === TaskStatus.WAITING_APPROVAL) {
      session.status = 'waiting_approval';
      return;
    }

    if (task.status === TaskStatus.CANCELLED) {
      session.status = 'cancelled';
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

  private buildThoughtChain(task: TaskRecord): ChatThoughtChainItem[] {
    return task.trace.map((trace, index) => {
      const isLast = index === task.trace.length - 1;
      const detail = this.buildThoughtDetail(task, trace.node, trace.summary, isLast);
      const rawData = trace.data && Object.keys(trace.data).length > 0 ? JSON.stringify(trace.data, null, 2) : '';
      return {
        key: `${task.id}_${index}_${trace.node}`,
        title: this.getThoughtTitle(trace.node),
        description: detail.summary,
        content: [detail.content, rawData].filter(Boolean).join('\n\n'),
        footer: new Date(trace.at).toLocaleString(),
        status: this.getThoughtStatus(trace.node, task.status, isLast),
        collapsible: Boolean(detail.content || rawData),
        blink: isLast && task.status === TaskStatus.RUNNING
      };
    });
  }

  private buildThinkState(task: TaskRecord): ChatThinkState | undefined {
    const latestTrace = task.trace.at(-1);
    if (!latestTrace) {
      return undefined;
    }

    return {
      title: this.getThinkTitle(task),
      content: this.buildThinkContent(task, latestTrace.summary),
      loading: task.status === TaskStatus.RUNNING,
      blink: task.status === TaskStatus.RUNNING
    };
  }

  private buildThinkContent(task: TaskRecord, latestSummary: string): string {
    if (task.status === TaskStatus.WAITING_APPROVAL && task.pendingApproval) {
      const risk = task.pendingApproval.riskLevel ? `，风险等级为 ${task.pendingApproval.riskLevel}` : '';
      return [
        `我已经把任务推进到需要人工拍板的动作：${task.pendingApproval.intent}${risk}。`,
        task.pendingApproval.reason ?? '这个动作会影响外部环境，所以我先暂停执行，等待你的决定。',
        '你一旦批准，我会从当前上下文继续；如果你打回并附批注，我会按你的意见重规划。'
      ].join('\n');
    }

    if (task.currentMinistry) {
      return this.buildMinistryThinkContent(task, latestSummary);
    }

    const route = task.modelRoute?.at(-1);
    const workerLine = '当前仍由首辅统一协调全局。';
    const routeLine = route ? `本轮选用模型 ${route.selectedModel}，因为 ${route.reason}。` : '';
    const planLine = task.plan?.steps?.length
      ? `整体计划共 ${task.plan.steps.length} 步，当前阶段是 ${task.currentStep ?? '处理中'}。`
      : task.currentStep
        ? `当前阶段是 ${task.currentStep}。`
        : '';
    const latestLine = latestSummary ? `最新进展：${latestSummary}` : '';

    const nextLine = this.buildNextActionHint(task);

    return [workerLine, routeLine, planLine, latestLine, nextLine].filter(Boolean).join('\n');
  }

  private buildMinistryThinkContent(task: TaskRecord, latestSummary: string): string {
    const ministry = task.currentMinistry ?? '';
    const workerLine = task.currentWorker
      ? `当前由 ${this.getMinistryLabel(ministry)} 的 ${task.currentWorker} 具体推进。`
      : `当前由 ${this.getMinistryLabel(ministry)} 负责处理。`;
    const route = task.modelRoute?.find(item => item.ministry === ministry) ?? task.modelRoute?.at(-1);
    const routeLine = route ? `吏部为这一部选择了 ${route.selectedModel}，原因是 ${route.reason}。` : '';
    const planLine = task.plan?.steps?.length
      ? `这轮总计划共 ${task.plan.steps.length} 步，我当前承接的是 ${task.currentStep ?? '处理中'} 这一段。`
      : task.currentStep
        ? `我当前处理的阶段是 ${task.currentStep}。`
        : '';
    const latestLine = latestSummary ? `我这边的最新进展是：${latestSummary}` : '';
    const nextLine = this.buildMinistryNextActionHint(task, ministry);

    return [workerLine, routeLine, planLine, latestLine, nextLine].filter(Boolean).join('\n');
  }

  private buildThoughtDetail(
    task: TaskRecord,
    node: string,
    summary: string,
    isLast: boolean
  ): { summary: string; content?: string } {
    const ministry = task.currentMinistry;

    switch (node) {
      case 'decree_received':
        return {
          summary: '首辅已接旨，开始判断任务目标与整体协作方式。',
          content: `首辅视角：我先确认你的目标边界，再决定是直接回复，还是进入多部协作流程。\n原始记录：${summary}`
        };
      case 'skill_resolved':
        return {
          summary: '首辅已选定本轮流程模板，准备按既定治理路径推进。',
          content: `首辅视角：这一步决定了本轮默认会调动哪些尚书、允许哪些能力，以及哪些动作需要审批。\n原始记录：${summary}`
        };
      case 'supervisor_planned':
      case 'manager_plan':
      case 'manager_replan':
        return {
          summary: '首辅已经完成拆解，并把任务转成可执行步骤。',
          content: `首辅视角：我在这里把大目标拆成更稳定的小步骤，这样后续每一部都知道该接什么任务。\n原始记录：${summary}`
        };
      case 'libu_routed':
        return {
          summary: '吏部已完成路由和选模，正在把任务发往合适的尚书。',
          content: `吏部视角：这一步会平衡任务难度、风险和成本，决定由谁处理，以及用哪个模型最合适。\n原始记录：${summary}`
        };
      case 'dispatch':
        return {
          summary: '首辅已经发出调令，相关尚书开始接令。',
          content: `首辅视角：我把每个子任务明确交给具体执行方，避免多部同时做重复工作。\n原始记录：${summary}`
        };
      case 'research':
        return {
          summary: '户部正在补齐资料和上下文，给后续执行提供依据。',
          content: `户部视角：我负责把外部资料、内部记忆和相关规范整理成可执行上下文，减少后续拍脑袋决策。\n原始记录：${summary}`
        };
      case 'execute':
        return {
          summary:
            ministry === 'bingbu-ops' ? '兵部正在推进命令、测试或发布动作。' : '工部正在实现方案并推进具体执行。',
          content:
            ministry === 'bingbu-ops'
              ? `兵部视角：我负责跑终端、测试和受控发布；一旦发现高风险动作，会先停下来等你拍板。\n原始记录：${summary}`
              : `工部视角：我负责把方案落成代码或执行结果；如果动作可能改写环境，我会先走审批。\n原始记录：${summary}`
        };
      case 'review':
        return {
          summary:
            ministry === 'libu-docs' ? '礼部正在整理交付说明与最终文档。' : '刑部正在审查质量、安全和是否需要打回。',
          content:
            ministry === 'libu-docs'
              ? `礼部视角：我会把当前结果整理成更适合交付的说明、规范或 README。\n原始记录：${summary}`
              : `刑部视角：我会重点关注质量风险、安全问题和是否需要返工，而不是只看“能不能跑”。\n原始记录：${summary}`
        };
      case 'approval_gate':
        return {
          summary: isLast ? '系统已暂停在审批门前，等待皇帝批阅。' : '这一步曾进入审批门。',
          content: `审批视角：这里表示系统检测到了高风险动作，所以流程被主动挂起，直到你批准或打回。\n原始记录：${summary}`
        };
      case 'run_resumed':
        return {
          summary: '皇帝已批示，流程正在从原位置恢复。',
          content: `恢复视角：系统会尽量沿用已有上下文继续推进，而不是从头再跑一遍。\n原始记录：${summary}`
        };
      case 'finish':
      case 'final_response_completed':
        return {
          summary: '首辅已经汇总完毕，准备向你呈递最终答复。',
          content: `首辅视角：前面的检索、执行、审查结果已经被汇总成最终可读的回复。\n原始记录：${summary}`
        };
      default:
        return {
          summary,
          content: summary
        };
    }
  }

  private buildNextActionHint(task: TaskRecord): string {
    switch (task.currentStep) {
      case 'goal_intake':
        return '我接下来会先判断该走哪条流程模板，再决定需要调动哪些尚书。';
      case 'route':
        return '我接下来会完成吏部路由，把任务分派到最合适的尚书与模型。';
      case 'manager_plan':
        return '我接下来会把目标拆解成可执行步骤，并安排各部协同。';
      case 'dispatch':
        return '我接下来会正式下发子任务，让相关尚书开始行动。';
      case 'research':
        return '我接下来会整合检索结果，把关键上下文喂给执行阶段。';
      case 'execute':
        return '我接下来会继续执行方案，并在必要时把高风险动作提交给你审批。';
      case 'review':
        return '我接下来会审查结果并整理成最终可交付的答复。';
      case 'finish':
        return '我接下来会结束当前流程并稳定输出最终结论。';
      default:
        return task.status === TaskStatus.COMPLETED
          ? '这一轮已经完成，我已准备好进入下一轮对话。'
          : task.status === TaskStatus.FAILED || task.status === TaskStatus.BLOCKED
            ? '当前流程已中断，我需要根据你的恢复或打回意见决定下一步。'
            : '我会继续沿着当前流程推进，并在有关键进展时及时同步给你。';
    }
  }

  private buildMinistryNextActionHint(task: TaskRecord, ministry: string): string {
    switch (ministry) {
      case 'libu-router':
        return '我接下来会继续平衡任务目标、成本和风险，决定该把任务交给哪一部和尚书。';
      case 'hubu-search':
        return '我接下来会继续检索外部资料、内部记忆和相关规范，把可用上下文整理给后续执行阶段。';
      case 'libu-docs':
        return task.currentStep === 'review'
          ? '我接下来会把已有结果整理成交付说明、接口规范或 README。'
          : '我接下来会先补齐规范、结构和文档要求，确保最终输出可交付。';
      case 'bingbu-ops':
        return '我接下来会继续执行终端、测试或发布链路；如果动作有风险，我会先提交奏折等待审批。';
      case 'xingbu-review':
        return '我接下来会审查当前产出，重点盯住质量风险、安全问题和是否需要打回重做。';
      case 'gongbu-code':
        return '我接下来会继续实现或重构代码，并把需要高风险落地的动作交由审批环节确认。';
      default:
        return this.buildNextActionHint(task);
    }
  }

  private getThinkTitle(task: TaskRecord): string {
    if (task.status === TaskStatus.WAITING_APPROVAL) {
      return '等待皇帝批阅';
    }
    if (task.currentMinistry) {
      return `${this.getMinistryLabel(task.currentMinistry)}正在汇报`;
    }
    if (task.currentStep) {
      return `当前阶段：${task.currentStep}`;
    }
    return '首辅思考中';
  }

  private getThoughtTitle(node: string): string {
    switch (node) {
      case 'decree_received':
        return '接收圣旨';
      case 'skill_resolved':
        return '解析流程模板';
      case 'skill_stage_started':
        return '流程阶段开始';
      case 'skill_stage_completed':
        return '流程阶段完成';
      case 'supervisor_planned':
      case 'manager_plan':
      case 'manager_replan':
        return '首辅规划';
      case 'libu_routed':
        return '吏部路由';
      case 'dispatch':
        return '分派尚书';
      case 'research':
        return '户部检索';
      case 'execute':
        return '工部/兵部执行';
      case 'review':
        return '刑部/礼部审查';
      case 'approval_gate':
        return '奏折审批';
      case 'run_resumed':
        return '恢复执行';
      case 'finish':
      case 'final_response_completed':
        return '汇总答复';
      default:
        return node;
    }
  }

  private getThoughtStatus(node: string, taskStatus: TaskStatus, isLast: boolean): ChatThoughtChainItem['status'] {
    if (node === 'finish' || node === 'final_response_completed' || taskStatus === TaskStatus.COMPLETED) {
      return isLast ? 'success' : 'success';
    }
    if (taskStatus === TaskStatus.FAILED || taskStatus === TaskStatus.BLOCKED) {
      return isLast ? 'error' : 'success';
    }
    if (taskStatus === TaskStatus.CANCELLED) {
      return isLast ? 'abort' : 'success';
    }
    if (node === 'approval_gate' && taskStatus === TaskStatus.WAITING_APPROVAL) {
      return 'abort';
    }
    return isLast ? 'loading' : 'success';
  }

  private getMinistryLabel(ministry: string): string {
    switch (ministry) {
      case 'libu-router':
        return '吏部';
      case 'hubu-search':
        return '户部';
      case 'libu-docs':
        return '礼部';
      case 'bingbu-ops':
        return '兵部';
      case 'xingbu-review':
        return '刑部';
      case 'gongbu-code':
        return '工部';
      default:
        return ministry;
    }
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
    const preferredCandidateIds = task.learningEvaluation?.autoConfirmCandidateIds;
    const pendingCandidateIds =
      task.learningCandidates
        ?.filter(candidate => candidate.status === 'pending_confirmation')
        .map(candidate => candidate.id) ?? [];

    const selectedCandidateIds =
      preferredCandidateIds?.filter(candidateId => pendingCandidateIds.includes(candidateId)) ?? pendingCandidateIds;

    if (!selectedCandidateIds.length) {
      return;
    }

    await this.runLearningConfirmation(sessionId, task, selectedCandidateIds, true);
  }

  private async runLearningConfirmation(
    sessionId: string,
    task: TaskRecord,
    candidateIds?: string[],
    autoConfirmed = false
  ): Promise<void> {
    const selectedIds = candidateIds ?? task.learningCandidates?.map(candidate => candidate.id);
    if (!selectedIds?.length) {
      return;
    }

    const graph = createLearningGraph({
      confirm: async state => {
        const confirmedTask = await this.orchestrator.confirmLearning(task.id, state.candidateIds);
        if (confirmedTask) {
          task.learningCandidates = confirmedTask.learningCandidates;
          task.updatedAt = confirmedTask.updatedAt;
        }
        return {
          ...state,
          confirmedCandidates:
            task.learningCandidates?.filter(
              candidate => state.candidateIds.includes(candidate.id) && candidate.status === 'confirmed'
            ) ?? []
        };
      }
    }).compile();

    await graph.invoke({
      taskId: task.id,
      candidateIds: selectedIds,
      autoConfirmed,
      confirmedCandidates: []
    });

    const session = this.requireSession(sessionId);
    session.status = task.status === TaskStatus.FAILED ? 'failed' : 'completed';
    session.updatedAt = new Date().toISOString();
    this.addEvent(sessionId, 'learning_confirmed', {
      taskId: task.id,
      candidateIds: selectedIds,
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
