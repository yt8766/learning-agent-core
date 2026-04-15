import {
  AppendChatMessageDto,
  ApprovalDecision,
  ApprovalScopePolicyRecord,
  CapabilityAttachmentRecord,
  CapabilityAugmentationRecord,
  ChatCheckpointRecord,
  ChatEventRecord,
  ChatMessageRecord,
  ChatSessionRecord,
  CreateChatSessionDto,
  LearningConfirmationDto,
  RecoverToCheckpointDto,
  SessionCancelDto,
  SessionApprovalDto,
  TaskRecord,
  TaskStatus,
  UpdateChatSessionDto,
  buildApprovalScopeMatchKey,
  matchesApprovalScopePolicy
} from '@agent/shared';
import { ContextStrategy } from '@agent/config';
import { RuntimeStateRepository, MemorySearchService } from '@agent/memory';

import { LlmProvider } from '../adapters/llm/llm-provider';
import { AgentOrchestrator } from '../graphs/main/main.graph';
import { autoConfirmLearningIfNeeded, runLearningConfirmation } from './session-coordinator-learning';
import {
  cancelSessionRun,
  deleteSessionState,
  recoverSession,
  recoverSessionToCheckpoint,
  syncSessionTask
} from './session-coordinator-session-ops';
import { SessionCoordinatorStore } from './session-coordinator-store';
import { SessionCoordinatorThinking } from './session-coordinator-thinking';
import {
  buildTaskContextHints,
  compressConversationIfNeeded,
  deriveSessionTitle,
  runSessionTurn,
  shouldDeriveSessionTitle
} from './session-coordinator-turns';

export class SessionCoordinator {
  private readonly store: SessionCoordinatorStore;
  private readonly thinking: SessionCoordinatorThinking;
  private initializationPromise?: Promise<void>;
  private taskSubscriptionBound = false;
  private readonly autoApprovingTaskIds = new Set<string>();

  constructor(
    private readonly orchestrator: AgentOrchestrator,
    private readonly runtimeStateRepository: RuntimeStateRepository,
    llmProvider: LlmProvider,
    private readonly contextStrategy?: ContextStrategy,
    private readonly memorySearchService?: MemorySearchService
  ) {
    this.store = new SessionCoordinatorStore(runtimeStateRepository);
    this.thinking = new SessionCoordinatorThinking(llmProvider, contextStrategy, memorySearchService);
  }

  async initialize(): Promise<void> {
    if (!this.initializationPromise) {
      this.initializationPromise = this.hydrateCoordinator();
    }
    await this.initializationPromise;

    if (!this.taskSubscriptionBound) {
      this.bindTaskUpdates();
      this.taskSubscriptionBound = true;
    }
  }

  listSessions(): ChatSessionRecord[] {
    return this.store.listSessions();
  }

  getSession(sessionId: string): ChatSessionRecord | undefined {
    return this.store.getSession(sessionId);
  }

  getMessages(sessionId: string): ChatMessageRecord[] {
    return this.store.getMessages(sessionId);
  }

  getEvents(sessionId: string): ChatEventRecord[] {
    return this.store.getEvents(sessionId);
  }

  getCheckpoint(sessionId: string): ChatCheckpointRecord | undefined {
    return this.store.getCheckpoint(sessionId);
  }

  async attachSessionCapabilities(
    sessionId: string,
    params: {
      attachments?: CapabilityAttachmentRecord[];
      augmentations?: CapabilityAugmentationRecord[];
      usedInstalledSkills?: string[];
    }
  ): Promise<ChatCheckpointRecord> {
    await this.initialize();
    const session = this.store.requireSession(sessionId);
    const checkpoint =
      this.store.getCheckpoint(sessionId) ??
      this.store.createCheckpoint(sessionId, session.currentTaskId ?? `session:${sessionId}`);

    checkpoint.capabilityAttachments = dedupeById([
      ...(checkpoint.capabilityAttachments ?? []),
      ...(params.attachments ?? [])
    ]);
    checkpoint.capabilityAugmentations = dedupeById([
      ...(checkpoint.capabilityAugmentations ?? []),
      ...(params.augmentations ?? [])
    ]);
    checkpoint.usedInstalledSkills = Array.from(
      new Set([...(checkpoint.usedInstalledSkills ?? []), ...(params.usedInstalledSkills ?? [])])
    );
    checkpoint.updatedAt = new Date().toISOString();
    session.updatedAt = checkpoint.updatedAt;
    await this.store.persistRuntimeState();
    return checkpoint;
  }

  subscribe(sessionId: string, listener: (event: ChatEventRecord) => void): () => void {
    return this.store.subscribe(sessionId, listener);
  }

  async createSession(dto: CreateChatSessionDto): Promise<ChatSessionRecord> {
    await this.initialize();
    const now = new Date().toISOString();
    const initialMessage = dto.message?.trim() ?? '';
    const derivedTitle = deriveSessionTitle(initialMessage);
    const session: ChatSessionRecord = {
      id: `session_${Date.now()}`,
      title: dto.title?.trim() || derivedTitle || '\u65b0\u4f1a\u8bdd',
      status: 'idle',
      channelIdentity: dto.channelIdentity,
      createdAt: now,
      updatedAt: now
    };

    this.store.sessions.set(session.id, session);
    this.store.messages.set(session.id, []);
    this.store.events.set(session.id, []);

    this.store.addEvent(session.id, 'session_started', { title: session.title });
    await this.store.persistRuntimeState();

    if (initialMessage) {
      const message = this.store.addMessage(session.id, 'user', initialMessage);
      this.store.addEvent(session.id, 'user_message', {
        messageId: message.id,
        content: message.content,
        title: session.title
      });
      await this.store.persistRuntimeState();
      void this.runTurn(session.id, initialMessage);
    }

    return session;
  }

  async updateSession(sessionId: string, dto: UpdateChatSessionDto): Promise<ChatSessionRecord> {
    await this.initialize();
    const session = this.store.requireSession(sessionId);
    const nextTitle = dto.title.trim();

    if (!nextTitle) {
      throw new Error('会话标题不能为空');
    }

    session.title = nextTitle;
    session.updatedAt = new Date().toISOString();
    await this.store.persistRuntimeState();
    return session;
  }

  async appendMessage(sessionId: string, dto: AppendChatMessageDto): Promise<ChatMessageRecord> {
    await this.initialize();
    const session = this.store.requireSession(sessionId);
    if (dto.channelIdentity) {
      session.channelIdentity = dto.channelIdentity;
    }
    if (shouldDeriveSessionTitle(session.title)) {
      const derivedTitle = deriveSessionTitle(dto.message);
      if (derivedTitle) {
        session.title = derivedTitle;
      }
    }
    const message = this.store.addMessage(sessionId, 'user', dto.message);
    session.updatedAt = new Date().toISOString();
    session.status = 'idle';
    this.store.addEvent(sessionId, 'user_message', {
      messageId: message.id,
      content: message.content,
      title: session.title
    });
    await this.store.persistRuntimeState();
    void this.runTurn(sessionId, dto.message);
    return message;
  }

  async appendInlineCapabilityResponse(
    sessionId: string,
    dto: AppendChatMessageDto,
    response: {
      role?: ChatMessageRecord['role'];
      content: string;
      card?: ChatMessageRecord['card'];
    }
  ): Promise<ChatMessageRecord> {
    await this.initialize();
    const session = this.store.requireSession(sessionId);
    if (dto.channelIdentity) {
      session.channelIdentity = dto.channelIdentity;
    }
    if (shouldDeriveSessionTitle(session.title)) {
      const derivedTitle = deriveSessionTitle(dto.message);
      if (derivedTitle) {
        session.title = derivedTitle;
      }
    }

    const userMessage = this.store.addMessage(sessionId, 'user', dto.message);
    const responseMessage = this.store.addMessage(
      sessionId,
      response.role ?? 'assistant',
      response.content,
      undefined,
      response.card
    );
    const completedAt = new Date().toISOString();
    session.updatedAt = completedAt;
    session.status = 'completed';
    const checkpoint =
      this.store.getCheckpoint(sessionId) ??
      this.store.createCheckpoint(sessionId, session.currentTaskId ?? `inline-capability:${sessionId}`);
    checkpoint.updatedAt = completedAt;
    checkpoint.graphState = {
      ...(checkpoint.graphState ?? {}),
      status: 'completed'
    } as never;
    checkpoint.thinkState = checkpoint.thinkState
      ? {
          ...checkpoint.thinkState,
          loading: false,
          blink: false
        }
      : undefined;
    checkpoint.pendingApproval = undefined;
    checkpoint.pendingApprovals = [];
    checkpoint.activeInterrupt = undefined;
    checkpoint.pendingAction = undefined;
    checkpoint.streamStatus = undefined;
    this.store.addEvent(sessionId, 'user_message', {
      messageId: userMessage.id,
      content: userMessage.content,
      title: session.title
    });
    this.store.addEvent(sessionId, 'assistant_message', {
      messageId: responseMessage.id,
      content: responseMessage.content,
      role: responseMessage.role,
      card: responseMessage.card,
      title: session.title,
      summary: responseMessage.content
    });
    this.store.addEvent(sessionId, 'final_response_completed', {
      messageId: responseMessage.id,
      content: responseMessage.content,
      title: session.title,
      taskId: checkpoint.taskId
    });
    await this.store.persistRuntimeState();
    return userMessage;
  }

  async approve(sessionId: string, dto: SessionApprovalDto): Promise<ChatSessionRecord> {
    await this.initialize();
    const session = this.store.requireSession(sessionId);
    const taskId = this.store.requireTaskId(session);
    const currentTask = this.orchestrator.getTask(taskId);
    // currentTask.activeInterrupt is the persisted 司礼监 / InterruptController projection.
    const resolutionEventType =
      dto.interrupt?.action === 'abort' || currentTask?.status === TaskStatus.CANCELLED
        ? 'run_cancelled'
        : currentTask?.activeInterrupt
          ? 'interrupt_resumed'
          : 'approval_resolved';
    const task = await this.orchestrator.applyApproval(taskId, dto, ApprovalDecision.APPROVED);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    if (dto.approvalScope === 'session' || dto.approvalScope === 'always') {
      await this.persistApprovalScopePolicy(session, currentTask, dto);
    }
    this.syncTask(sessionId, task);
    this.store.addEvent(sessionId, resolutionEventType, {
      taskId,
      decision: 'approved',
      intent: dto.intent,
      feedback: dto.feedback,
      interactionKind:
        task.activeInterrupt?.payload && typeof task.activeInterrupt.payload === 'object'
          ? (task.activeInterrupt.payload as { interactionKind?: unknown }).interactionKind
          : dto.interrupt?.payload && typeof dto.interrupt.payload === 'object'
            ? (dto.interrupt.payload as { interactionKind?: unknown }).interactionKind
            : undefined
    });
    await this.store.persistRuntimeState();
    return this.store.requireSession(sessionId);
  }

  async reject(sessionId: string, dto: SessionApprovalDto): Promise<ChatSessionRecord> {
    await this.initialize();
    const session = this.store.requireSession(sessionId);
    const taskId = this.store.requireTaskId(session);
    const currentTask = this.orchestrator.getTask(taskId);
    // currentTask.activeInterrupt is the persisted 司礼监 / InterruptController projection.
    const rejectionEventType =
      dto.interrupt?.action === 'abort'
        ? 'run_cancelled'
        : currentTask?.activeInterrupt && dto.feedback
          ? 'interrupt_rejected_with_feedback'
          : dto.feedback
            ? 'approval_rejected_with_feedback'
            : currentTask?.activeInterrupt
              ? 'interrupt_resumed'
              : 'approval_resolved';
    const task = await this.orchestrator.applyApproval(taskId, dto, ApprovalDecision.REJECTED);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    this.syncTask(sessionId, task);
    this.store.addEvent(sessionId, rejectionEventType, {
      taskId,
      decision: 'rejected',
      intent: dto.intent,
      feedback: dto.feedback,
      interactionKind:
        task.activeInterrupt?.payload && typeof task.activeInterrupt.payload === 'object'
          ? (task.activeInterrupt.payload as { interactionKind?: unknown }).interactionKind
          : dto.interrupt?.payload && typeof dto.interrupt.payload === 'object'
            ? (dto.interrupt.payload as { interactionKind?: unknown }).interactionKind
            : undefined
    });
    await this.store.persistRuntimeState();
    return this.store.requireSession(sessionId);
  }

  async confirmLearning(sessionId: string, dto: LearningConfirmationDto): Promise<ChatSessionRecord> {
    await this.initialize();
    const session = this.store.requireSession(sessionId);
    const taskId = this.store.requireTaskId(session);
    const task = this.orchestrator.getTask(taskId);
    if (task) {
      await runLearningConfirmation(this.orchestrator, this.store, sessionId, task, dto.candidateIds, false);
    }
    return session;
  }

  async recover(sessionId: string): Promise<ChatSessionRecord> {
    await this.initialize();
    return recoverSession({ orchestrator: this.orchestrator, store: this.store, thinking: this.thinking }, sessionId);
  }

  async recoverToCheckpoint(sessionId: string, dto: RecoverToCheckpointDto): Promise<ChatSessionRecord> {
    await this.initialize();
    return recoverSessionToCheckpoint({ store: this.store }, sessionId, dto);
  }

  async cancel(sessionId: string, dto?: SessionCancelDto): Promise<ChatSessionRecord> {
    await this.initialize();
    return cancelSessionRun(
      { orchestrator: this.orchestrator, store: this.store, thinking: this.thinking },
      sessionId,
      dto
    );
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.initialize();
    await deleteSessionState({ orchestrator: this.orchestrator, store: this.store }, sessionId);
  }

  private bindTaskUpdates(): void {
    this.orchestrator.subscribe(task => {
      if (!task.sessionId || !this.store.sessions.has(task.sessionId)) {
        return;
      }
      void (async () => {
        const session = this.store.getSession(task.sessionId!);
        const autoApprovalPolicy = session ? await this.resolveAutoApprovalPolicy(session, task) : undefined;
        if (session && autoApprovalPolicy && !this.autoApprovingTaskIds.has(task.id)) {
          this.autoApprovingTaskIds.add(task.id);
          try {
            const approvedTask = await this.orchestrator.applyApproval(
              task.id,
              {
                intent: task.pendingApproval!.intent,
                actor: autoApprovalPolicy.actor,
                reason: autoApprovalPolicy.reason
              },
              ApprovalDecision.APPROVED
            );
            if (autoApprovalPolicy.policyRecord) {
              await this.recordPolicyAutoAllow(session, autoApprovalPolicy.policyRecord, task);
            }
            if (approvedTask?.sessionId) {
              this.syncTask(approvedTask.sessionId, approvedTask);
              await this.store.persistRuntimeState();
              return;
            }
          } finally {
            this.autoApprovingTaskIds.delete(task.id);
          }
        }

        this.syncTask(task.sessionId!, task);
        await this.store.persistRuntimeState();
      })();
    });

    this.orchestrator.subscribeTokens(tokenEvent => {
      const task = this.orchestrator.getTask(tokenEvent.taskId);
      if (!task?.sessionId || !this.store.sessions.has(task.sessionId)) {
        return;
      }

      this.store.appendStreamingMessage(
        task.sessionId,
        tokenEvent.messageId,
        tokenEvent.token,
        tokenEvent.role,
        tokenEvent.createdAt
      );
      this.store.addEvent(task.sessionId, 'assistant_token', {
        taskId: tokenEvent.taskId,
        messageId: tokenEvent.messageId,
        content: tokenEvent.token,
        from: tokenEvent.role,
        model: tokenEvent.model,
        summary: tokenEvent.token
      });
      void this.store.persistRuntimeState();
    });
  }

  private async runTurn(sessionId: string, input: string): Promise<void> {
    await runSessionTurn(
      {
        orchestrator: this.orchestrator,
        store: this.store,
        thinking: this.thinking,
        syncTask: (nextSessionId, task) => this.syncTask(nextSessionId, task)
      },
      sessionId,
      input
    );
  }

  private async buildConversationContext(sessionId: string, query: string): Promise<string> {
    return this.thinking.buildConversationContext(
      this.store.requireSession(sessionId),
      this.store.getCheckpoint(sessionId),
      this.store.getMessages(sessionId),
      query
    );
  }

  private syncTask(sessionId: string, task: TaskRecord): void {
    syncSessionTask({ orchestrator: this.orchestrator, store: this.store, thinking: this.thinking }, sessionId, task);
  }

  private async hydrateCoordinator(): Promise<void> {
    await this.orchestrator.initialize();
    await this.store.hydrate();
  }

  private async resolveAutoApprovalPolicy(session: ChatSessionRecord, task: TaskRecord) {
    if (task.status !== TaskStatus.WAITING_APPROVAL || !task.pendingApproval?.intent) {
      return undefined;
    }

    const sessionPolicy = (session.approvalPolicies?.sessionAllowRules ?? []).find(policy =>
      matchesApprovalScopePolicy(policy, buildApprovalScopeMatchInput(task))
    );
    if (sessionPolicy) {
      return {
        actor: 'agent-chat-session-policy',
        reason: 'session approval scope policy auto allow',
        policyRecord: sessionPolicy,
        source: 'session' as const
      };
    }

    const runtimePolicy = await this.findRuntimeApprovalScopePolicy(task);
    if (runtimePolicy) {
      return {
        actor: 'agent-runtime-approval-policy',
        reason: 'runtime approval scope policy auto allow',
        policyRecord: runtimePolicy,
        source: 'always' as const
      };
    }

    if (!session.channelIdentity) {
      return {
        actor: 'agent-chat-auto-approve',
        reason: 'agent-chat default auto approval'
      };
    }

    return undefined;
  }

  private async findRuntimeApprovalScopePolicy(task: TaskRecord) {
    const snapshot = await this.runtimeStateRepository.load();
    const policies = snapshot.governance?.approvalScopePolicies ?? [];
    return policies.find(policy => matchesApprovalScopePolicy(policy, buildApprovalScopeMatchInput(task)));
  }

  private async recordPolicyAutoAllow(session: ChatSessionRecord, policy: ApprovalScopePolicyRecord, task: TaskRecord) {
    const snapshot = await this.runtimeStateRepository.load();
    snapshot.governanceAudit = [
      {
        id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        at: new Date().toISOString(),
        actor: policy.scope === 'session' ? 'agent-chat-session-policy' : 'agent-runtime-approval-policy',
        action: 'approval-policy.auto-allowed',
        scope: 'approval-policy' as const,
        targetId: policy.id,
        outcome: 'success' as const,
        reason: `${policy.scope}:${task.pendingApproval?.intent ?? task.activeInterrupt?.intent ?? ''}`
      },
      ...(snapshot.governanceAudit ?? [])
    ].slice(0, 50);
    if (policy.scope === 'always') {
      snapshot.governance = {
        ...(snapshot.governance ?? {}),
        approvalScopePolicies: (snapshot.governance?.approvalScopePolicies ?? []).map(item =>
          item.id === policy.id
            ? {
                ...item,
                lastMatchedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                matchCount: (item.matchCount ?? 0) + 1
              }
            : item
        )
      };
    } else {
      session.approvalPolicies = {
        sessionAllowRules: (session.approvalPolicies?.sessionAllowRules ?? []).map(item =>
          item.id === policy.id
            ? {
                ...item,
                lastMatchedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                matchCount: (item.matchCount ?? 0) + 1
              }
            : item
        )
      };
    }
    await this.runtimeStateRepository.save(snapshot);
  }

  private async persistApprovalScopePolicy(
    session: ChatSessionRecord,
    task: TaskRecord | undefined,
    dto: SessionApprovalDto
  ) {
    const scope = dto.approvalScope;
    if (!task || !scope || scope === 'once') {
      return;
    }
    const matchInput = buildApprovalScopeMatchInput(task);
    const now = new Date().toISOString();
    const policy: ApprovalScopePolicyRecord = {
      id: `approval_policy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      scope,
      status: 'active',
      actor: dto.actor,
      sourceDomain: task.currentMinistry ?? task.currentWorker,
      approvalScope: scope,
      matchKey: buildApprovalScopeMatchKey(matchInput),
      intent: matchInput.intent,
      toolName: matchInput.toolName,
      riskCode: matchInput.riskCode,
      requestedBy: matchInput.requestedBy,
      commandPreview: matchInput.commandPreview,
      createdAt: now,
      updatedAt: now,
      matchCount: 0
    };

    if (scope === 'session') {
      session.approvalPolicies = {
        sessionAllowRules: upsertSessionApprovalPolicy(session.approvalPolicies?.sessionAllowRules ?? [], policy)
      };
      return;
    }

    const snapshot = await this.runtimeStateRepository.load();
    snapshot.governance = {
      ...(snapshot.governance ?? {}),
      approvalScopePolicies: upsertRuntimeApprovalPolicy(snapshot.governance?.approvalScopePolicies ?? [], policy)
    };
    snapshot.governanceAudit = [
      {
        id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        at: now,
        actor: dto.actor ?? 'agent-chat-user',
        action: 'approval-policy.created',
        scope: 'approval-policy' as const,
        targetId: policy.id,
        outcome: 'success' as const,
        reason: `${policy.scope}:${policy.intent ?? ''}`
      },
      ...(snapshot.governanceAudit ?? [])
    ].slice(0, 50);
    await this.runtimeStateRepository.save(snapshot);
  }
}

function dedupeById<T extends { id: string }>(items: T[]) {
  const deduped = new Map<string, T>();
  for (const item of items) {
    deduped.set(item.id, item);
  }
  return Array.from(deduped.values());
}

function buildApprovalScopeMatchInput(task: TaskRecord) {
  const interruptPayload =
    task.activeInterrupt?.payload && typeof task.activeInterrupt.payload === 'object'
      ? task.activeInterrupt.payload
      : {};
  return {
    intent: task.pendingApproval?.intent ?? task.activeInterrupt?.intent,
    toolName: task.pendingApproval?.toolName ?? task.activeInterrupt?.toolName,
    riskCode:
      (typeof (interruptPayload as Record<string, unknown>).riskCode === 'string'
        ? ((interruptPayload as Record<string, unknown>).riskCode as string)
        : undefined) ?? task.pendingApproval?.reasonCode,
    requestedBy: task.pendingApproval?.requestedBy ?? task.activeInterrupt?.requestedBy ?? task.currentMinistry,
    commandPreview:
      typeof (interruptPayload as Record<string, unknown>).commandPreview === 'string'
        ? ((interruptPayload as Record<string, unknown>).commandPreview as string)
        : undefined
  };
}

function upsertSessionApprovalPolicy(policies: ApprovalScopePolicyRecord[], policy: ApprovalScopePolicyRecord) {
  const existingIndex = policies.findIndex(
    item => item.status === 'active' && item.scope === policy.scope && item.matchKey === policy.matchKey
  );
  if (existingIndex < 0) {
    return [policy, ...policies].slice(0, 50);
  }
  return policies.map((item, index) => (index === existingIndex ? { ...item, ...policy, id: item.id } : item));
}

function upsertRuntimeApprovalPolicy(policies: ApprovalScopePolicyRecord[], policy: ApprovalScopePolicyRecord) {
  const existingIndex = policies.findIndex(
    item => item.status === 'active' && item.scope === policy.scope && item.matchKey === policy.matchKey
  );
  if (existingIndex < 0) {
    return [policy, ...policies].slice(0, 200);
  }
  return policies.map((item, index) => (index === existingIndex ? { ...item, ...policy, id: item.id } : item));
}
