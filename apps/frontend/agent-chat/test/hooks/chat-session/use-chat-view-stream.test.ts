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

  it('ignores duplicate or older seq events during replay', () => {
    const currentState = applyChatViewStreamEvent(createInitialChatViewStreamState(), {
      event: 'fragment_delta',
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
    });

    const duplicateState = applyChatViewStreamEvent(currentState, {
      event: 'fragment_delta',
      id: 'view-2-duplicate',
      seq: 2,
      sessionId: 'session-1',
      runId: 'run-1',
      at,
      data: {
        messageId: 'msg-assistant',
        fragmentId: 'frag-response',
        delta: '推荐'
      }
    });

    const olderState = applyChatViewStreamEvent(duplicateState, {
      event: 'fragment_delta',
      id: 'view-1-old',
      seq: 1,
      sessionId: 'session-1',
      runId: 'run-1',
      at,
      data: {
        messageId: 'msg-assistant',
        fragmentId: 'frag-response',
        delta: '旧内容'
      }
    });

    expect(duplicateState).toBe(currentState);
    expect(olderState).toBe(currentState);
    expect(olderState.fragments['frag-response'].content).toBe('推荐');
    expect(olderState.lastSeq).toBe(2);
  });

  it('calibrates assistant content from fragment completion events', () => {
    const streamedState = applyChatViewStreamEvent(createInitialChatViewStreamState(), {
      event: 'fragment_delta',
      id: 'view-2',
      seq: 2,
      sessionId: 'session-1',
      runId: 'run-1',
      at,
      data: {
        messageId: 'msg-assistant',
        fragmentId: 'frag-response',
        delta: '临时内容'
      }
    });

    const completedState = applyChatViewStreamEvent(streamedState, {
      event: 'fragment_completed',
      id: 'view-3',
      seq: 3,
      sessionId: 'session-1',
      runId: 'run-1',
      at,
      data: {
        messageId: 'msg-assistant',
        fragmentId: 'frag-response',
        kind: 'response',
        status: 'completed',
        content: '最终内容'
      }
    });

    expect(completedState.fragments['frag-response']).toEqual({
      id: 'frag-response',
      messageId: 'msg-assistant',
      content: '最终内容'
    });
    expect(completedState.messages[0]?.content).toBe('最终内容');
    expect(completedState.lastSeq).toBe(3);
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

  it('handles error events', () => {
    const state = applyChatViewStreamEvent(createInitialChatViewStreamState(), {
      event: 'error',
      id: 'view-err',
      seq: 6,
      sessionId: 'session-1',
      runId: 'run-1',
      at,
      data: {
        code: 'STREAM_ERROR',
        message: 'Something went wrong',
        recoverable: true
      }
    });

    expect(state.status).toBe('error');
    expect(state.error?.code).toBe('STREAM_ERROR');
    expect(state.error?.message).toBe('Something went wrong');
    expect(state.error?.recoverable).toBe(true);
  });

  it('handles unknown event types by returning base state', () => {
    const initial = createInitialChatViewStreamState();
    const state = applyChatViewStreamEvent(initial, {
      event: 'unknown_event' as any,
      id: 'view-unk',
      seq: 7,
      sessionId: 'session-1',
      runId: 'run-1',
      at,
      data: {}
    });

    expect(state.sessionId).toBe('session-1');
    expect(state.runId).toBe('run-1');
    expect(state.lastSeq).toBe(7);
  });

  it('handles ready event without responseMessageId', () => {
    const state = applyChatViewStreamEvent(
      createInitialChatViewStreamState(),
      {
        event: 'ready',
        id: 'view-rdy',
        seq: 1,
        sessionId: 'session-1',
        runId: 'run-1',
        at,
        data: {
          requestMessageId: 'msg-user',
          modelId: 'default',
          thinkingEnabled: false
        }
      },
      { now: () => at }
    );

    expect(state.status).toBe('open');
    expect(state.requestMessageId).toBe('msg-user');
    expect(state.messages).toEqual([]);
  });

  it('handles fragment_delta from idle status', () => {
    const state = applyChatViewStreamEvent(createInitialChatViewStreamState(), {
      event: 'fragment_delta',
      id: 'view-fd',
      seq: 1,
      sessionId: 'session-1',
      runId: 'run-1',
      at,
      data: {
        messageId: 'msg-1',
        fragmentId: 'frag-1',
        delta: 'Hello'
      }
    });

    expect(state.status).toBe('open');
    expect(state.fragments['frag-1'].content).toBe('Hello');
  });

  it('handles fragment_delta from connecting status', () => {
    const state = applyChatViewStreamEvent(
      { ...createInitialChatViewStreamState(), status: 'connecting' },
      {
        event: 'fragment_delta',
        id: 'view-fd2',
        seq: 1,
        sessionId: 'session-1',
        runId: 'run-1',
        at,
        data: {
          messageId: 'msg-1',
          fragmentId: 'frag-1',
          delta: 'World'
        }
      }
    );

    expect(state.status).toBe('open');
  });

  it('preserves status on fragment_delta when already open', () => {
    const state = applyChatViewStreamEvent(
      { ...createInitialChatViewStreamState(), status: 'open' },
      {
        event: 'fragment_delta',
        id: 'view-fd3',
        seq: 1,
        sessionId: 'session-1',
        runId: 'run-1',
        at,
        data: {
          messageId: 'msg-1',
          fragmentId: 'frag-1',
          delta: '!'
        }
      }
    );

    expect(state.status).toBe('open');
  });

  it('handles close with autoResume and retryable', () => {
    const onClose = vi.fn();
    const state = applyChatViewStreamEvent(
      createInitialChatViewStreamState(),
      {
        event: 'close',
        id: 'view-close2',
        seq: 8,
        sessionId: 'session-1',
        runId: 'run-1',
        at,
        data: {
          reason: 'completed',
          retryable: true,
          autoResume: true
        }
      },
      { onClose }
    );

    expect(state.status).toBe('closed');
    expect(state.close?.retryable).toBe(true);
    expect(state.close?.autoResume).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps cancelled close events non-resumable unless the stream says otherwise', () => {
    const state = applyChatViewStreamEvent(createInitialChatViewStreamState(), {
      event: 'close',
      id: 'view-cancelled',
      seq: 8,
      sessionId: 'session-1',
      runId: 'run-1',
      at,
      data: {
        reason: 'cancelled',
        retryable: false
      }
    });

    expect(state.status).toBe('closed');
    expect(state.close).toEqual({
      reason: 'cancelled',
      retryable: false,
      autoResume: undefined
    });
  });

  it('handles interaction_waiting event', () => {
    const state = applyChatViewStreamEvent(createInitialChatViewStreamState(), {
      event: 'interaction_waiting',
      id: 'view-iw',
      seq: 9,
      sessionId: 'session-1',
      runId: 'run-1',
      at,
      data: {
        interaction: {
          id: 'int-1',
          sessionId: 'session-1',
          runId: 'run-1',
          kind: 'tool_approval',
          status: 'pending',
          promptMessageId: 'msg-1',
          expectedActions: ['approve', 'reject'],
          createdAt: at
        }
      }
    });

    expect(state.status).toBe('waiting_interaction');
    expect(state.pendingInteraction?.id).toBe('int-1');
  });

  it('appends to existing fragment content', () => {
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

    const state1 = applyChatViewStreamEvent(readyState, {
      event: 'fragment_delta',
      id: 'view-2',
      seq: 2,
      sessionId: 'session-1',
      runId: 'run-1',
      at,
      data: { messageId: 'msg-assistant', fragmentId: 'frag-1', delta: 'Hello' }
    });

    const state2 = applyChatViewStreamEvent(state1, {
      event: 'fragment_delta',
      id: 'view-3',
      seq: 3,
      sessionId: 'session-1',
      runId: 'run-1',
      at,
      data: { messageId: 'msg-assistant', fragmentId: 'frag-1', delta: ' World' }
    });

    expect(state2.fragments['frag-1'].content).toBe('Hello World');
    expect(state2.messages[0].content).toBe('Hello World');
  });
});
