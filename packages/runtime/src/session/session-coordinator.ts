import { ContextStrategy } from '@agent/config';
import { ApprovalDecision } from '@agent/core';
import type {
  AppendChatMessageDto,
  CapabilityAttachmentRecord,
  CapabilityAugmentationRecord,
  ChatCheckpointRecord,
  ChatEventRecord,
  ChatMessageRecord,
  ChatSessionRecord,
  CreateChatSessionDto,
  ILLMProvider as LlmProvider,
  LearningConfirmationDto,
  RecoverToCheckpointDto,
  SessionCancelDto,
  SessionApprovalDto,
  UpdateChatSessionDto
} from '@agent/core';
import { RuntimeStateRepository, MemorySearchService } from '@agent/memory';

import { AgentOrchestrator } from '../graphs/main/main.graph';
import { autoConfirmLearningIfNeeded, runLearningConfirmation } from './session-coordinator-learning';
import {
  cancelSessionRun,
  deleteSessionState,
  recoverSession,
  recoverSessionToCheckpoint,
  syncSessionTask
} from './session-coordinator-session-ops';
import {
  bindSessionCoordinatorSubscriptions,
  persistSessionApprovalScopePolicy,
  resolveApprovalEventType,
  resolveApprovalInteractionKind
} from './session-coordinator-approvals';
import { completeInlineCapabilitySession, dedupeById } from './session-coordinator-inline';
import { SessionCoordinatorStore } from './session-coordinator-store';
import { SessionCoordinatorThinking } from './session-coordinator-thinking';
import type { SessionTaskAggregate } from './session-task.types';
import {
  buildTaskContextHints,
  compressConversationIfNeeded,
  deriveSessionTitle,
  runSessionTurn,
  shouldDeriveSessionTitle
} from './session-coordinator-turns';

type ChatEventType = ChatEventRecord['type'];

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
      void this.runTurn(session.id, { message: initialMessage });
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
    void this.runTurn(sessionId, dto);
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
    const { userMessage } = completeInlineCapabilitySession({
      store: this.store,
      session,
      sessionId,
      userMessageContent: dto.message,
      response
    });
    await this.store.persistRuntimeState();
    return userMessage;
  }

  async approve(sessionId: string, dto: SessionApprovalDto): Promise<ChatSessionRecord> {
    await this.initialize();
    const session = this.store.requireSession(sessionId);
    const taskId = this.store.requireTaskId(session);
    const currentTask = this.orchestrator.getTask(taskId);
    const resolutionEventType = resolveApprovalEventType(ApprovalDecision.APPROVED, currentTask, dto);
    const task = await this.orchestrator.applyApproval(taskId, dto, ApprovalDecision.APPROVED);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    if (dto.approvalScope === 'session' || dto.approvalScope === 'always') {
      await persistSessionApprovalScopePolicy({
        runtimeStateRepository: this.runtimeStateRepository,
        session,
        task: currentTask,
        dto
      });
    }
    this.syncTask(sessionId, task);
    this.store.addEvent(sessionId, resolutionEventType as ChatEventType, {
      taskId,
      decision: 'approved',
      intent: dto.intent,
      feedback: dto.feedback,
      interactionKind: resolveApprovalInteractionKind(task, dto)
    });
    await this.store.persistRuntimeState();
    return this.store.requireSession(sessionId);
  }

  async reject(sessionId: string, dto: SessionApprovalDto): Promise<ChatSessionRecord> {
    await this.initialize();
    const session = this.store.requireSession(sessionId);
    const taskId = this.store.requireTaskId(session);
    const currentTask = this.orchestrator.getTask(taskId);
    const rejectionEventType = resolveApprovalEventType(ApprovalDecision.REJECTED, currentTask, dto);
    const task = await this.orchestrator.applyApproval(taskId, dto, ApprovalDecision.REJECTED);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    this.syncTask(sessionId, task);
    this.store.addEvent(sessionId, rejectionEventType as ChatEventType, {
      taskId,
      decision: 'rejected',
      intent: dto.intent,
      feedback: dto.feedback,
      interactionKind: resolveApprovalInteractionKind(task, dto)
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
    void bindSessionCoordinatorSubscriptions({
      orchestrator: this.orchestrator,
      store: this.store,
      runtimeStateRepository: this.runtimeStateRepository,
      autoApprovingTaskIds: this.autoApprovingTaskIds,
      syncTask: (sessionId, task) => this.syncTask(sessionId, task)
    });
  }

  private async runTurn(
    sessionId: string,
    input: {
      message: string;
      modelId?: string;
    }
  ): Promise<void> {
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

  private syncTask(sessionId: string, task: SessionTaskAggregate): void {
    syncSessionTask({ orchestrator: this.orchestrator, store: this.store, thinking: this.thinking }, sessionId, task);
  }

  private async hydrateCoordinator(): Promise<void> {
    await this.orchestrator.initialize();
    await this.store.hydrate();
  }
}
