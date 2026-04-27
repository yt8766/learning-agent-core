import { describe, expect, it } from 'vitest';

import {
  ChatEventRecordSchema,
  type ChatEventRecord,
  type ChatMessageRecord,
  type ChatSessionRecord
} from '@agent/core';

import {
  syncMessageFromEvent,
  syncSessionFromEvent
} from '../../../apps/frontend/agent-chat/src/hooks/chat-session/chat-session-events';
import {
  shouldIgnoreStaleTerminalStreamEvent,
  shouldStopStreamingForEvent,
  syncCheckpointFromStreamEvent
} from '../../../apps/frontend/agent-chat/src/hooks/chat-session/chat-session-stream';

function event(overrides: Partial<ChatEventRecord>): ChatEventRecord {
  return ChatEventRecordSchema.parse({
    id: overrides.id ?? `evt-${overrides.type ?? 'assistant_token'}`,
    sessionId: overrides.sessionId ?? 'session-stream-1',
    type: overrides.type ?? 'assistant_token',
    at: overrides.at ?? '2026-04-23T00:00:00.000Z',
    payload: overrides.payload ?? {}
  });
}

describe('frontend-backend chat session stream merge integration', () => {
  it('merges assistant token and final delta events without duplicating the assistant message', () => {
    const tokenA = event({
      id: 'evt-token-a',
      type: 'assistant_token',
      payload: { messageId: 'assistant-stream-1', content: '你', taskId: 'task-stream-1' }
    });
    const tokenB = event({
      id: 'evt-token-b',
      type: 'assistant_token',
      at: '2026-04-23T00:00:01.000Z',
      payload: { messageId: 'assistant-stream-1', content: '好', taskId: 'task-stream-1' }
    });
    const finalDelta = event({
      id: 'evt-final-delta',
      type: 'final_response_delta',
      at: '2026-04-23T00:00:02.000Z',
      payload: { messageId: 'assistant-stream-1', content: '你好', taskId: 'task-stream-1' }
    });
    const committed = event({
      id: 'evt-assistant-message',
      type: 'assistant_message',
      at: '2026-04-23T00:00:03.000Z',
      payload: { messageId: 'assistant-stream-1', content: '你好', taskId: 'task-stream-1' }
    });

    let messages: ChatMessageRecord[] = [];
    for (const next of [tokenA, tokenB, finalDelta, committed]) {
      messages = syncMessageFromEvent(messages as never, next as never) as ChatMessageRecord[];
    }

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      id: 'assistant-stream-1',
      sessionId: 'session-stream-1',
      role: 'assistant',
      content: '你好',
      taskId: 'task-stream-1'
    });
  });

  it('updates frontend session and checkpoint status from canonical backend terminal events', () => {
    const sessions: ChatSessionRecord[] = [
      {
        id: 'session-stream-1',
        title: 'stream session',
        status: 'running',
        createdAt: '2026-04-23T00:00:00.000Z',
        updatedAt: '2026-04-23T00:00:00.000Z'
      }
    ];
    const checkpoint = {
      sessionId: 'session-stream-1',
      taskId: 'task-stream-1',
      graphState: { status: 'running' },
      thinkState: { loading: true, blink: true },
      updatedAt: '2026-04-23T00:00:00.000Z'
    };
    const finished = event({
      id: 'evt-finished',
      type: 'session_finished',
      payload: { taskId: 'task-stream-1' }
    });

    expect(shouldStopStreamingForEvent(finished.type)).toBe(true);
    expect(syncSessionFromEvent(sessions as never, finished as never)[0].status).toBe('completed');
    expect(syncCheckpointFromStreamEvent(checkpoint as never, finished as never)).toMatchObject({
      graphState: { status: 'completed' },
      thinkState: { loading: false, blink: false }
    });
  });

  it('ignores malformed assistant payloads instead of corrupting current messages', () => {
    const current: ChatMessageRecord[] = [
      {
        id: 'assistant-existing',
        sessionId: 'session-stream-1',
        role: 'assistant',
        content: 'existing',
        createdAt: '2026-04-23T00:00:00.000Z'
      }
    ];
    const malformed = event({
      id: 'evt-malformed',
      type: 'assistant_token',
      payload: { content: 'missing messageId' }
    });

    expect(syncMessageFromEvent(current as never, malformed as never)).toBe(current);
  });

  it('ignores stale terminal events when a newer running checkpoint is already active', () => {
    const checkpoint = {
      sessionId: 'session-stream-1',
      taskId: 'task-new-run',
      graphState: { status: 'running' },
      thinkState: { loading: true, blink: true },
      updatedAt: '2026-04-23T00:00:10.000Z'
    };

    const staleFinished = event({
      id: 'evt-stale-finished',
      type: 'session_finished',
      at: '2026-04-23T00:00:05.000Z',
      payload: { taskId: 'task-old-run' }
    });

    const nextCheckpoint = shouldIgnoreStaleTerminalStreamEvent(checkpoint as never, staleFinished)
      ? checkpoint
      : syncCheckpointFromStreamEvent(checkpoint as never, staleFinished);

    expect(nextCheckpoint).toBe(checkpoint);
  });

  it('does not ignore terminal events for the active task even when checkpoint recovery uses the same task id', () => {
    const checkpoint = {
      sessionId: 'session-stream-1',
      taskId: 'task-stream-1',
      graphState: { status: 'running' },
      thinkState: { loading: true, blink: true },
      updatedAt: '2026-04-23T00:00:00.000Z'
    };
    const cancelled = event({
      id: 'evt-cancelled',
      type: 'run_cancelled',
      at: '2026-04-23T00:00:02.000Z',
      payload: { taskId: 'task-stream-1', reason: '用户取消' }
    });

    expect(shouldIgnoreStaleTerminalStreamEvent(checkpoint as never, cancelled)).toBe(false);
    expect(syncCheckpointFromStreamEvent(checkpoint as never, cancelled)).toMatchObject({
      graphState: { status: 'cancelled' },
      thinkState: { loading: false, blink: false }
    });
  });
});
