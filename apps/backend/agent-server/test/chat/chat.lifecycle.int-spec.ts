import { describe, expect, it, vi } from 'vitest';
import type {
  ChatCheckpointRecord,
  ChatEventRecord,
  ChatMessageRecord,
  ChatSessionRecord,
  LearningConfirmationDto,
  SessionApprovalDto
} from '@agent/core';

import { ChatController } from '../../src/chat/chat.controller';
import { ChatService } from '../../src/chat/chat.service';
import { RuntimeSessionService } from '../../src/runtime/services/runtime-session.service';

function createSseResponse() {
  return {
    cookie: vi.fn(),
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    flush: vi.fn(),
    write: vi.fn(),
    end: vi.fn()
  };
}

function createLifecycleHarness() {
  const sessions = new Map<string, ChatSessionRecord>();
  const messages = new Map<string, ChatMessageRecord[]>();
  const events = new Map<string, ChatEventRecord[]>();
  const checkpoints = new Map<string, ChatCheckpointRecord>();
  const listeners = new Map<string, Set<(event: ChatEventRecord) => void>>();
  const now = () => '2026-03-31T00:00:00.000Z';

  const emit = (sessionId: string, event: ChatEventRecord) => {
    const sessionEvents = events.get(sessionId) ?? [];
    sessionEvents.push(event);
    events.set(sessionId, sessionEvents);
    for (const listener of listeners.get(sessionId) ?? []) {
      listener(event);
    }
  };

  const sessionCoordinator = {
    listSessions: () => Array.from(sessions.values()),
    createSession: async (dto: { title?: string; message?: string }) => {
      const id = `session_${sessions.size + 1}`;
      const session: ChatSessionRecord = {
        id,
        title: dto.title ?? '新会话',
        status: 'idle',
        createdAt: now(),
        updatedAt: now()
      };
      sessions.set(id, session);
      messages.set(id, []);
      events.set(id, []);
      checkpoints.set(id, {
        sessionId: id,
        taskId: `task_${id}`,
        graphState: 'idle',
        updatedAt: now()
      } as ChatCheckpointRecord);
      emit(id, { sessionId: id, type: 'session_started', createdAt: now() } as ChatEventRecord);
      if (dto.message) {
        await sessionCoordinator.appendMessage(id, { message: dto.message });
      }
      return session;
    },
    deleteSession: async (id: string) => {
      sessions.delete(id);
      messages.delete(id);
      events.delete(id);
      checkpoints.delete(id);
    },
    updateSession: async (id: string, dto: { title: string }) => {
      const session = sessions.get(id)!;
      session.title = dto.title;
      return session;
    },
    getSession: (id: string) => sessions.get(id),
    getMessages: (id: string) => messages.get(id) ?? [],
    getEvents: (id: string) => events.get(id) ?? [],
    getCheckpoint: (id: string) => checkpoints.get(id),
    appendMessage: async (id: string, dto: { message: string }) => {
      const message: ChatMessageRecord = {
        id: `msg_${(messages.get(id)?.length ?? 0) + 1}`,
        sessionId: id,
        role: 'user',
        content: dto.message,
        createdAt: now()
      } as ChatMessageRecord;
      messages.set(id, [...(messages.get(id) ?? []), message]);
      emit(id, {
        sessionId: id,
        type: 'user_message',
        createdAt: now(),
        payload: { messageId: message.id, content: dto.message }
      } as ChatEventRecord);
      return message;
    },
    approve: async (id: string, dto: SessionApprovalDto) => {
      const session = sessions.get(id)!;
      session.status = 'running';
      emit(id, {
        sessionId: id,
        type: 'approval_resolved',
        createdAt: now(),
        payload: { decision: 'approved', intent: dto.intent }
      } as ChatEventRecord);
      return session;
    },
    reject: async (id: string, dto: SessionApprovalDto) => {
      const session = sessions.get(id)!;
      session.status = 'running';
      emit(id, {
        sessionId: id,
        type: 'approval_resolved',
        createdAt: now(),
        payload: { decision: 'rejected', intent: dto.intent }
      } as ChatEventRecord);
      return session;
    },
    confirmLearning: async (id: string, dto: LearningConfirmationDto) => {
      const session = sessions.get(id)!;
      emit(id, {
        sessionId: id,
        type: 'learning_confirmed',
        createdAt: now(),
        payload: { candidateIds: dto.candidateIds }
      } as ChatEventRecord);
      return session;
    },
    recover: async (id: string) => {
      const session = sessions.get(id)!;
      session.status = 'running';
      emit(id, { sessionId: id, type: 'interrupt_resumed', createdAt: now() } as ChatEventRecord);
      return session;
    },
    recoverToCheckpoint: async (id: string) => sessions.get(id)!,
    cancel: async (id: string) => {
      const session = sessions.get(id)!;
      session.status = 'cancelled';
      emit(id, { sessionId: id, type: 'run_cancelled', createdAt: now() } as ChatEventRecord);
      return session;
    },
    subscribe: (id: string, listener: (event: ChatEventRecord) => void) => {
      const set = listeners.get(id) ?? new Set();
      set.add(listener);
      listeners.set(id, set);
      return () => set.delete(listener);
    }
  };

  const runtimeSessionService = new RuntimeSessionService(() => ({ sessionCoordinator }));
  const chatService = new ChatService(runtimeSessionService, { tryHandle: vi.fn(async () => undefined) } as never);
  const controller = new ChatController(chatService);

  return { controller, emit };
}

describe('Chat lifecycle integration contract', () => {
  it('covers create, append, approve, recover, learning confirmation and SSE token delivery', async () => {
    const { controller, emit } = createLifecycleHarness();
    const response = { cookie: vi.fn() };
    const request = { headers: {} };

    const session = await controller.createSession({ title: '集成会话' }, response as never);
    expect(session).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^session_/),
        title: '集成会话',
        status: 'idle'
      })
    );

    const appended = await controller.appendMessage(request as never, response as never, {
      sessionId: session.id,
      message: '继续执行'
    });
    expect(appended).toEqual(
      expect.objectContaining({
        sessionId: session.id,
        role: 'user',
        content: '继续执行'
      })
    );

    await controller.approve(
      request as never,
      response as never,
      {
        sessionId: session.id,
        actor: 'tester',
        intent: 'write_file'
      } as never
    );
    await controller.recover(request as never, response as never, { sessionId: session.id });
    await controller.confirmLearning(
      request as never,
      response as never,
      {
        sessionId: session.id,
        actor: 'tester',
        candidateIds: ['memory-1']
      } as never
    );

    expect(controller.getCheckpoint(request as never, response as never, session.id)).toEqual(
      expect.objectContaining({
        sessionId: session.id,
        taskId: expect.any(String),
        graphState: expect.any(String)
      })
    );
    expect(controller.listMessages(request as never, response as never, session.id)).toEqual(
      expect.arrayContaining([expect.objectContaining({ sessionId: session.id, role: 'user', content: '继续执行' })])
    );
    expect(controller.listEvents(request as never, response as never, session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'session_started' }),
        expect.objectContaining({ type: 'user_message' }),
        expect.objectContaining({ type: 'approval_resolved' }),
        expect.objectContaining({ type: 'interrupt_resumed' }),
        expect.objectContaining({ type: 'learning_confirmed' })
      ])
    );

    emit(session.id, {
      sessionId: session.id,
      type: 'assistant_token',
      createdAt: '2026-03-31T00:00:01.000Z',
      payload: { messageId: 'msg-2', content: '你' }
    } as ChatEventRecord);

    const sseResponse = createSseResponse();
    const sseRequest = { headers: {}, on: vi.fn() };
    controller.stream(sseRequest as never, sseResponse as never, session.id);

    expect(sseResponse.write).toHaveBeenCalledWith(': stream-open\n\n');
    expect(sseResponse.write).not.toHaveBeenCalledWith(expect.stringContaining('"type":"assistant_token"'));

    emit(session.id, {
      sessionId: session.id,
      type: 'assistant_token',
      createdAt: '2026-03-31T00:00:02.000Z',
      payload: { messageId: 'msg-2', content: '好' }
    } as ChatEventRecord);

    expect(sseResponse.write).toHaveBeenCalledWith(expect.stringContaining('"type":"assistant_token"'));

    const closeHandler = sseRequest.on.mock.calls.find(call => call[0] === 'close')?.[1];
    closeHandler?.();
    expect(sseResponse.end).toHaveBeenCalledTimes(1);
  });
});
