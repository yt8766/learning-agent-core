import { describe, expect, it, vi } from 'vitest';

import {
  buildChatViewStreamPath,
  getRunIdForChatRuntimeV2ViewStream,
  parseChatViewStreamEvent
} from '@/api/chat-runtime-v2-api';
import { applyChatViewStreamEvent, createInitialChatViewStreamState } from '@/hooks/chat-session/use-chat-view-stream';

const at = '2026-05-05T10:00:00.000Z';

describe('chat runtime v2 api helper', () => {
  it('builds encoded view-stream paths and parses schema-backed events', () => {
    expect(buildChatViewStreamPath({ sessionId: 'session/1', runId: 'run 1', afterSeq: 7 })).toBe(
      '/chat/view-stream?sessionId=session%2F1&runId=run+1&afterSeq=7'
    );

    const parsed = parseChatViewStreamEvent(
      JSON.stringify({
        event: 'ready',
        id: 'view-1',
        seq: 1,
        sessionId: 'session/1',
        runId: 'run 1',
        at,
        data: {
          requestMessageId: 'msg-user',
          responseMessageId: 'msg-assistant',
          thinkingEnabled: true
        }
      })
    );

    expect(parsed?.event).toBe('ready');
    expect(parseChatViewStreamEvent('{bad json')).toBeUndefined();
    expect(parseChatViewStreamEvent(JSON.stringify({ event: 'ready' }))).toBeUndefined();
  });

  it('starts v2 view-stream only for new-run message responses', () => {
    expect(
      getRunIdForChatRuntimeV2ViewStream({
        handledAs: 'new_run',
        run: { id: 'run-1' }
      })
    ).toBe('run-1');

    expect(
      getRunIdForChatRuntimeV2ViewStream({
        handledAs: 'pending_interaction_reply',
        run: { id: 'run-should-not-start' }
      })
    ).toBeUndefined();
  });
});

describe('chat view-stream reducer', () => {
  it('marks the stream ready and records response message identity', () => {
    const state = applyChatViewStreamEvent(
      createInitialChatViewStreamState(),
      {
        event: 'ready',
        id: 'view-1',
        seq: 1,
        sessionId: 'session-1',
        runId: 'run-1',
        at,
        data: {
          requestMessageId: 'msg-user',
          responseMessageId: 'msg-assistant',
          modelId: 'default',
          thinkingEnabled: true
        }
      },
      { now: () => at }
    );

    expect(state.status).toBe('open');
    expect(state.sessionId).toBe('session-1');
    expect(state.runId).toBe('run-1');
    expect(state.lastSeq).toBe(1);
    expect(state.responseMessageId).toBe('msg-assistant');
    expect(state.messages).toEqual([
      {
        id: 'msg-assistant',
        sessionId: 'session-1',
        role: 'assistant',
        content: '',
        createdAt: at
      }
    ]);
  });

  it('appends fragment deltas into the matching assistant message', () => {
    const readyState = applyChatViewStreamEvent(
      createInitialChatViewStreamState(),
      {
        event: 'ready',
        id: 'view-1',
        seq: 1,
        sessionId: 'session-1',
        runId: 'run-1',
        at,
        data: {
          requestMessageId: 'msg-user',
          responseMessageId: 'msg-assistant'
        }
      },
      { now: () => at }
    );

    const state = [
      {
        event: 'fragment_delta' as const,
        id: 'view-2',
        seq: 2,
        sessionId: 'session-1',
        runId: 'run-1',
        at,
        data: {
          messageId: 'msg-assistant',
          fragmentId: 'frag-response',
          delta: '推荐'
        }
      },
      {
        event: 'fragment_delta' as const,
        id: 'view-3',
        seq: 3,
        sessionId: 'session-1',
        runId: 'run-1',
        at,
        data: {
          messageId: 'msg-assistant',
          fragmentId: 'frag-response',
          delta: '采用 v2'
        }
      }
    ].reduce((current, event) => applyChatViewStreamEvent(current, event, { now: () => at }), readyState);

    expect(state.fragments['frag-response']).toEqual({
      id: 'frag-response',
      messageId: 'msg-assistant',
      content: '推荐采用 v2'
    });
    expect(state.messages[0]?.content).toBe('推荐采用 v2');
  });

  it('marks natural-language pending interactions without creating a new run', () => {
    const state = applyChatViewStreamEvent(
      {
        ...createInitialChatViewStreamState(),
        runId: 'run-1',
        sessionId: 'session-1'
      },
      {
        event: 'interaction_waiting',
        id: 'view-4',
        seq: 4,
        sessionId: 'session-1',
        runId: 'run-1',
        at,
        data: {
          naturalLanguageOnly: true,
          interaction: {
            id: 'interaction-1',
            sessionId: 'session-1',
            runId: 'run-1',
            kind: 'tool_approval',
            status: 'pending',
            promptMessageId: 'msg-assistant',
            expectedActions: ['approve', 'reject', 'feedback'],
            requiredConfirmationPhrase: '确认推送',
            createdAt: at
          }
        }
      },
      { now: () => at }
    );

    expect(state.status).toBe('waiting_interaction');
    expect(state.runId).toBe('run-1');
    expect(state.pendingInteraction?.id).toBe('interaction-1');
    expect(state.pendingInteraction?.requiredConfirmationPhrase).toBe('确认推送');
  });

  it('closes and invokes the completion callback on close events', () => {
    const onClose = vi.fn();
    const state = applyChatViewStreamEvent(
      createInitialChatViewStreamState(),
      {
        event: 'close',
        id: 'view-5',
        seq: 5,
        sessionId: 'session-1',
        runId: 'run-1',
        at,
        data: {
          reason: 'completed',
          retryable: false
        }
      },
      { now: () => at, onClose }
    );

    expect(state.status).toBe('closed');
    expect(state.close?.reason).toBe('completed');
    expect(onClose).toHaveBeenCalledWith(state.close);
  });
});
