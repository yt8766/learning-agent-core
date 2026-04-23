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

  it('会忽略 running 状态下时间戳更旧的终态事件（事件比 checkpoint 旧）', () => {
    const checkpoint = buildChatCheckpoint({
      taskId: 'task-1',
      graphState: { status: 'running', currentStep: 'executing' },
      updatedAt: '2026-03-30T00:00:10.000Z'
    });
    const staleEvent = {
      ...buildChatEvent('session_finished', 'session-1'),
      at: '2026-03-30T00:00:05.000Z', // 比 checkpoint 早 5 秒
      payload: { taskId: 'task-1' }
    };

    expect(shouldIgnoreStaleTerminalStreamEvent(checkpoint, staleEvent)).toBe(true);
  });

  it('non-running 状态下即使事件更旧也不忽略', () => {
    const checkpoint = buildChatCheckpoint({
      taskId: 'task-1',
      graphState: { status: 'completed', currentStep: 'done' },
      updatedAt: '2026-03-30T00:00:10.000Z'
    });
    const staleEvent = {
      ...buildChatEvent('session_finished', 'session-1'),
      at: '2026-03-30T00:00:05.000Z',
      payload: { taskId: 'task-1' }
    };

    // status 不是 running，不走时间戳忽略逻辑
    expect(shouldIgnoreStaleTerminalStreamEvent(checkpoint, staleEvent)).toBe(false);
  });

  it('running 状态下 taskId mismatch 会触发忽略', () => {
    const checkpoint = buildChatCheckpoint({
      taskId: 'task-current',
      graphState: { status: 'running', currentStep: 'executing' },
      updatedAt: '2026-03-30T00:00:05.000Z'
    });
    const mismatchEvent = {
      ...buildChatEvent('session_finished', 'session-1'),
      at: '2026-03-30T00:00:06.000Z',
      payload: { taskId: 'task-old' }
    };

    expect(shouldIgnoreStaleTerminalStreamEvent(checkpoint, mismatchEvent)).toBe(true);
  });

  it('final_response_completed 会把 graphState.status 改为 completed', () => {
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

    const next = syncCheckpointFromStreamEvent(checkpoint, buildChatEvent('final_response_completed'));

    expect((next as typeof checkpoint).graphState?.status).toBe('completed');
  });

  it('session_finished 会把 graphState.status 改为 completed', () => {
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

    const next = syncCheckpointFromStreamEvent(checkpoint, buildChatEvent('session_finished'));

    expect((next as typeof checkpoint).graphState?.status).toBe('completed');
  });

  it('node_status 事件会更新 streamStatus', () => {
    const checkpoint = buildChatCheckpoint();

    const nodeStatusEvent = {
      ...buildChatEvent('node_status'),
      payload: {
        nodeId: 'coder',
        nodeLabel: 'Code Generator',
        detail: 'generating...',
        progressPercent: 50
      }
    };

    const next = syncCheckpointFromStreamEvent(checkpoint, nodeStatusEvent) as typeof checkpoint;

    expect(next?.streamStatus?.nodeId).toBe('coder');
    expect(next?.streamStatus?.nodeLabel).toBe('Code Generator');
    expect(next?.streamStatus?.progressPercent).toBe(50);
  });

  it('node_progress 事件会更新 streamStatus', () => {
    const checkpoint = buildChatCheckpoint();

    const nodeProgressEvent = {
      ...buildChatEvent('node_progress'),
      payload: {
        nodeId: 'supervisor',
        progressPercent: 75
      }
    };

    const next = syncCheckpointFromStreamEvent(checkpoint, nodeProgressEvent) as typeof checkpoint;

    expect(next?.streamStatus?.nodeId).toBe('supervisor');
    expect(next?.streamStatus?.progressPercent).toBe(75);
  });
});
