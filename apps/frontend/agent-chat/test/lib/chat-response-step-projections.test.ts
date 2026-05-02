import { describe, expect, it } from 'vitest';

import type { ChatResponseStepEvent, ChatResponseStepSnapshot } from '@agent/core';

import {
  foldChatResponseStepProjection,
  foldChatResponseStepProjectionsFromEvents,
  initialChatResponseStepsState,
  parseChatResponseStepProjection
} from '../../src/lib/chat-response-step-projections';
import type { ChatEventRecord } from '../../src/types/chat';

const step = {
  id: 'response-step-event-1',
  sessionId: 'session-1',
  messageId: 'assistant-1',
  sequence: 0,
  phase: 'explore',
  status: 'running',
  title: 'Read chat-message-adapter.tsx',
  startedAt: '2026-05-02T08:30:00.000Z',
  sourceEventId: 'event-1',
  sourceEventType: 'tool_called'
} satisfies ChatResponseStepEvent['step'];

describe('chat response step projections', () => {
  it('upserts incremental steps by id and sorts by sequence', () => {
    const next = foldChatResponseStepProjection(initialChatResponseStepsState(), {
      projection: 'chat_response_step',
      action: 'started',
      step
    } satisfies ChatResponseStepEvent);

    expect(next.byMessageId['assistant-1']?.steps.map(item => item.title)).toEqual(['Read chat-message-adapter.tsx']);
    expect(next.byMessageId['assistant-1']?.summary.title).toBe('处理中 1 个步骤');
  });

  it('replaces message state with a completed snapshot', () => {
    const snapshot = {
      projection: 'chat_response_steps',
      sessionId: 'session-1',
      messageId: 'assistant-1',
      status: 'completed',
      steps: [{ ...step, status: 'completed', completedAt: '2026-05-02T08:31:00.000Z' }],
      summary: {
        title: '已处理 1 个步骤',
        completedCount: 1,
        runningCount: 0,
        blockedCount: 0,
        failedCount: 0
      },
      updatedAt: '2026-05-02T08:31:00.000Z'
    } satisfies ChatResponseStepSnapshot;

    const next = foldChatResponseStepProjection(initialChatResponseStepsState(), snapshot);

    expect(next.byMessageId['assistant-1']?.status).toBe('completed');
    expect(next.byMessageId['assistant-1']?.summary.completedCount).toBe(1);
  });

  it('ignores unrelated payloads while parsing projections', () => {
    expect(parseChatResponseStepProjection({ projection: 'task_trajectory' })).toBeNull();
  });

  it('derives response steps from chat events without stream reducer state', () => {
    const events: ChatEventRecord[] = [
      {
        id: 'event-1',
        sessionId: 'session-1',
        type: 'node_progress',
        at: '2026-05-02T08:30:00.000Z',
        payload: {
          projection: 'chat_response_step',
          action: 'started',
          step
        }
      },
      {
        id: 'event-2',
        sessionId: 'session-1',
        type: 'assistant_token',
        at: '2026-05-02T08:30:01.000Z',
        payload: { content: 'hello' }
      }
    ];

    const next = foldChatResponseStepProjectionsFromEvents(events);

    expect(next.byMessageId['assistant-1']?.steps[0]?.title).toBe('Read chat-message-adapter.tsx');
  });
});
