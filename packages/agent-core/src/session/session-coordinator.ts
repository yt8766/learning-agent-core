import {
  AppendChatMessageDto,
  ApprovalDecision,
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
  UpdateChatSessionDto
} from '@agent/shared';
import { ContextStrategy } from '@agent/config';
import { MemorySearchService, RuntimeStateRepository } from '@agent/memory';

import { LlmProvider } from '../adapters/llm/llm-provider';
import { AgentOrchestrator } from '../graphs/main.graph';
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
    session.updatedAt = new Date().toISOString();
    session.status = 'idle';
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
        if (
          session &&
          !session.channelIdentity &&
          task.status === TaskStatus.WAITING_APPROVAL &&
          task.pendingApproval?.intent &&
          !this.autoApprovingTaskIds.has(task.id)
        ) {
          this.autoApprovingTaskIds.add(task.id);
          try {
            const approvedTask = await this.orchestrator.applyApproval(
              task.id,
              {
                intent: task.pendingApproval.intent,
                actor: 'agent-chat-auto-approve',
                reason: 'agent-chat default auto approval'
              },
              ApprovalDecision.APPROVED
            );
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
}

function dedupeById<T extends { id: string }>(items: T[]) {
  const deduped = new Map<string, T>();
  for (const item of items) {
    deduped.set(item.id, item);
  }
  return Array.from(deduped.values());
}
