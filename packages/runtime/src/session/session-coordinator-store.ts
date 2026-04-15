import type { ChatCheckpointRecord, ChatEventRecord, ChatMessageRecord, ChatSessionRecord } from '@agent/shared';
import { TaskStatus } from '@agent/shared';
import type { RuntimeStateRepository } from '@agent/memory';

export class SessionCoordinatorStore {
  readonly sessions = new Map<string, ChatSessionRecord>();
  readonly messages = new Map<string, ChatMessageRecord[]>();
  readonly events = new Map<string, ChatEventRecord[]>();
  readonly checkpoints = new Map<string, ChatCheckpointRecord>();
  readonly subscribers = new Map<string, Set<(event: ChatEventRecord) => void>>();

  constructor(private readonly runtimeStateRepository: RuntimeStateRepository) {}

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

  addMessage(
    sessionId: string,
    role: ChatMessageRecord['role'],
    content: string,
    linkedAgent?: ChatMessageRecord['linkedAgent'],
    card?: ChatMessageRecord['card'],
    taskId?: string
  ): ChatMessageRecord {
    const message: ChatMessageRecord = {
      id: `chat_msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sessionId,
      role,
      content,
      linkedAgent,
      card,
      taskId,
      createdAt: new Date().toISOString()
    };

    const items = this.messages.get(sessionId) ?? [];
    items.push(message);
    this.messages.set(sessionId, items);
    return message;
  }

  appendStreamingMessage(
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

  addEvent(sessionId: string, type: ChatEventRecord['type'], payload: Record<string, unknown>): ChatEventRecord {
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

  createCheckpoint(sessionId: string, taskId: string): ChatCheckpointRecord {
    const now = new Date().toISOString();
    const checkpoint: ChatCheckpointRecord = {
      checkpointId: `checkpoint_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sessionId,
      taskId,
      context: undefined,
      traceCursor: 0,
      messageCursor: 0,
      approvalCursor: 0,
      learningCursor: 0,
      graphState: {
        status: TaskStatus.QUEUED
      },
      pendingApprovals: [],
      executionSteps: [],
      agentStates: [],
      externalSources: [],
      reusedMemories: [],
      reusedRules: [],
      reusedSkills: [],
      usedInstalledSkills: [],
      usedCompanyWorkers: [],
      currentSkillExecution: undefined,
      recoverability: 'safe',
      createdAt: now,
      updatedAt: now
    };
    this.checkpoints.set(sessionId, checkpoint);
    return checkpoint;
  }

  requireSession(sessionId: string): ChatSessionRecord {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return session;
  }

  requireTaskId(session: ChatSessionRecord): string {
    if (!session.currentTaskId) {
      throw new Error(`Session ${session.id} has no active task`);
    }
    return session.currentTaskId;
  }

  async hydrate(): Promise<void> {
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
      checkpoint.checkpointId ||= `checkpoint_${checkpoint.sessionId}`;
      checkpoint.recoverability ??= checkpoint.pendingApproval ? 'partial' : 'safe';
      this.checkpoints.set(checkpoint.sessionId, checkpoint);
    }
  }

  async persistRuntimeState(): Promise<void> {
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
