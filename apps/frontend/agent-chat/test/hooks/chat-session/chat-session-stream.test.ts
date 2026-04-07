import { describe, expect, it } from 'vitest';

import {
  isAssistantContentEvent,
  shouldIgnoreStaleTerminalStreamEvent,
  shouldStopStreamingForEvent,
  syncCheckpointFromStreamEvent
} from '@/hooks/chat-session/chat-session-stream';
import { buildChatCheckpoint, buildChatEvent } from '../../fixtures/chat-session-fixtures';

describe('chat-session-stream', () => {
  it('会把 assistant_token、final_response_delta 和 assistant_message 识别为正文开始事件', () => {
    expect(isAssistantContentEvent('assistant_token')).toBe(true);
    expect(isAssistantContentEvent('final_response_delta')).toBe(true);
    expect(isAssistantContentEvent('assistant_message')).toBe(true);
    expect(isAssistantContentEvent('session_finished')).toBe(false);
  });

  it('会把最终收口事件识别为需要关闭流', () => {
    expect(shouldStopStreamingForEvent('final_response_completed')).toBe(true);
    expect(shouldStopStreamingForEvent('session_failed')).toBe(true);
    expect(shouldStopStreamingForEvent('assistant_token')).toBe(false);
  });

  it('首个正文事件到来时保留 think loading，并保持 running graph', () => {
    const checkpoint = buildChatCheckpoint();

    const next = syncCheckpointFromStreamEvent(checkpoint, buildChatEvent('assistant_token'));

    expect(next).toEqual(checkpoint);
  });

  it('完成事件到来时会同步收口 think，并更新 graph 状态', () => {
    const checkpoint = buildChatCheckpoint();

    const next = syncCheckpointFromStreamEvent(checkpoint, buildChatEvent('session_failed'));

    expect(next).toEqual({
      ...checkpoint,
      thinkState: {
        ...checkpoint.thinkState,
        loading: false,
        blink: false
      },
      graphState: {
        ...checkpoint.graphState,
        status: 'failed'
      }
    });
  });

  it('如果 think 已经结束，仍会在终态事件里更新 graph 状态', () => {
    const checkpoint = buildChatCheckpoint({
      thinkState: {
        messageId: 'assistant-1',
        thinkingDurationMs: 500,
        title: '正在思考',
        content: 'done',
        loading: false,
        blink: false
      }
    });

    const next = syncCheckpointFromStreamEvent(checkpoint, buildChatEvent('run_cancelled'));

    expect(next).toEqual({
      ...checkpoint,
      graphState: {
        ...checkpoint.graphState,
        status: 'cancelled'
      }
    });
  });

  it('不会误改其他会话或无关事件的 checkpoint', () => {
    const checkpoint = buildChatCheckpoint();

    expect(syncCheckpointFromStreamEvent(checkpoint, buildChatEvent('tool_called'))).toBe(checkpoint);
    expect(syncCheckpointFromStreamEvent(checkpoint, buildChatEvent('assistant_token', 'session-2'))).toBe(checkpoint);
    expect(syncCheckpointFromStreamEvent(undefined, buildChatEvent('assistant_token'))).toBeUndefined();
  });

  it('会忽略比当前 optimistic 轮次更旧的终态 replay 事件', () => {
    const checkpoint = buildChatCheckpoint({
      taskId: 'optimistic_session-1',
      graphState: {
        status: 'running',
        currentStep: 'drafting_reply'
      },
      updatedAt: '2026-03-30T00:00:05.000Z'
    });
    const staleTerminalEvent = {
      ...buildChatEvent('session_finished', 'session-1'),
      payload: {
        taskId: 'task-old'
      }
    };

    expect(shouldIgnoreStaleTerminalStreamEvent(checkpoint, staleTerminalEvent)).toBe(true);
  });

  it('不会忽略属于当前轮次的终态事件', () => {
    const checkpoint = buildChatCheckpoint({
      taskId: 'task-current',
      graphState: {
        status: 'running',
        currentStep: 'drafting_reply'
      },
      updatedAt: '2026-03-30T00:00:05.000Z'
    });
    const currentTerminalEvent = {
      ...buildChatEvent('session_finished', 'session-1'),
      at: '2026-03-30T00:00:06.000Z',
      payload: {
        taskId: 'task-current'
      }
    };

    expect(shouldIgnoreStaleTerminalStreamEvent(checkpoint, currentTerminalEvent)).toBe(false);
  });
});
