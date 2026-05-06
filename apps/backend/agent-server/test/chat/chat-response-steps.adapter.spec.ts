import { describe, expect, it } from 'vitest';

import type { ChatEventRecord } from '@agent/core';

import { buildChatResponseStepEvent, buildChatResponseStepSnapshot } from '../../src/chat/chat-response-steps.adapter';

const baseEvent = {
  id: 'event-1',
  sessionId: 'session-1',
  taskId: 'task-1',
  at: '2026-05-02T08:30:00.000Z'
} satisfies Partial<ChatEventRecord>;

describe('chat response steps adapter', () => {
  it('projects a tool call into a running explore step', () => {
    const event = {
      ...baseEvent,
      type: 'tool_called',
      payload: {
        title: 'Read chat-message-adapter.tsx',
        summary: 'Inspecting message rendering.',
        path: 'apps/frontend/agent-chat/src/pages/chat/chat-message-adapter.tsx'
      }
    } as ChatEventRecord;

    const projection = buildChatResponseStepEvent(event, {
      messageId: 'assistant-1',
      sequence: 0
    });

    expect(projection?.action).toBe('started');
    expect(projection?.step.phase).toBe('explore');
    expect(projection?.step.target?.kind).toBe('file');
  });

  it('projects an execution completion into a completed command step', () => {
    const event = {
      ...baseEvent,
      id: 'event-2',
      type: 'execution_step_completed',
      payload: {
        title: 'Ran affected tests',
        command:
          'pnpm exec vitest run --config vitest.config.js apps/frontend/agent-chat/test/components/chat-response-steps.test.tsx'
      }
    } as ChatEventRecord;

    const projection = buildChatResponseStepEvent(event, {
      messageId: 'assistant-1',
      sequence: 1
    });

    expect(projection?.action).toBe('completed');
    expect(projection?.step.status).toBe('completed');
    expect(projection?.step.phase).toBe('verify');
    expect(projection?.step.target?.kind).toBe('command');
  });

  it('returns null for assistant token deltas', () => {
    const event = {
      ...baseEvent,
      id: 'event-3',
      type: 'assistant_token',
      payload: { content: 'hello' }
    } as ChatEventRecord;

    expect(buildChatResponseStepEvent(event, { messageId: 'assistant-1', sequence: 2 })).toBeNull();
  });

  it('prefers summary over outputPreview for step detail', () => {
    const event = {
      ...baseEvent,
      id: 'event-detail-priority',
      type: 'execution_step_completed',
      payload: {
        title: 'read_local_file',
        path: 'package.json',
        summary: 'first',
        outputPreview: 'second'
      }
    } as ChatEventRecord;

    expect(buildChatResponseStepEvent(event, { messageId: 'assistant-1', sequence: 0 })?.step.detail).toBe('first');
  });

  it('uses outputPreview as step detail when summary is absent', () => {
    const event = {
      ...baseEvent,
      id: 'event-detail-preview',
      type: 'execution_step_completed',
      payload: {
        title: 'read_local_file',
        path: 'package.json',
        outputPreview: '已读取文件 package.json（42 字符）'
      }
    } as ChatEventRecord;

    expect(buildChatResponseStepEvent(event, { messageId: 'assistant-1', sequence: 0 })?.step.detail).toBe(
      '已读取文件 package.json（42 字符）'
    );
  });

  it('ignores invalid optional url payloads instead of throwing', () => {
    const event = {
      ...baseEvent,
      id: 'event-invalid-url',
      type: 'tool_called',
      payload: {
        title: 'Read local route',
        url: '/relative/path'
      }
    } as ChatEventRecord;

    const projection = buildChatResponseStepEvent(event, {
      messageId: 'assistant-1',
      sequence: 0
    });

    expect(projection?.step.title).toBe('Read local route');
    expect(projection?.step.target).toBeUndefined();
  });

  it('builds a summary snapshot from projected steps', () => {
    const started = buildChatResponseStepEvent(
      {
        ...baseEvent,
        id: 'event-4',
        type: 'tool_called',
        payload: { title: 'Read file', path: 'apps/frontend/agent-chat/src/pages/chat/chat-message-adapter.tsx' }
      } as ChatEventRecord,
      { messageId: 'assistant-1', sequence: 0 }
    );
    const completed = buildChatResponseStepEvent(
      {
        ...baseEvent,
        id: 'event-5',
        type: 'execution_step_completed',
        payload: { title: 'Ran tests', command: 'pnpm exec vitest run' }
      } as ChatEventRecord,
      { messageId: 'assistant-1', sequence: 1 }
    );

    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'session-1',
      messageId: 'assistant-1',
      status: 'completed',
      steps: [started!.step, completed!.step],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });

    expect(snapshot.summary.completedCount).toBe(1);
    expect(snapshot.summary.runningCount).toBe(1);
    expect(snapshot.projection).toBe('chat_response_steps');
  });
});
