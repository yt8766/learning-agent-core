import { describe, expect, it } from 'vitest';

import type { ChatCheckpointRecord, ChatEventRecord } from '@/types/chat';
import {
  isAssistantContentEvent,
  shouldStopStreamingForEvent,
  syncCheckpointFromStreamEvent
} from '@/hooks/chat-session/chat-session-stream';
import { buildChatCheckpoint, buildChatEvent } from '../fixtures/chat-session-fixtures';

describe('chat wire contract', () => {
  it('consumes canonical SSE event types without relying on legacy aliases', () => {
    const tokenEvent = {
      id: 'evt-assistant-token',
      sessionId: 'session-1',
      type: 'assistant_token',
      at: '2026-03-31T00:00:00.000Z',
      payload: { messageId: 'msg-1', content: '你' }
    } satisfies ChatEventRecord;
    const finishedEvent = {
      id: 'evt-session-finished',
      sessionId: 'session-1',
      type: 'session_finished',
      at: '2026-03-31T00:00:01.000Z',
      payload: { taskId: 'task-1' }
    } satisfies ChatEventRecord;

    expect(isAssistantContentEvent(tokenEvent.type)).toBe(true);
    expect(shouldStopStreamingForEvent(tokenEvent.type)).toBe(false);
    expect(shouldStopStreamingForEvent(finishedEvent.type)).toBe(true);
  });

  it('accepts checkpoint payloads that use canonical graphState/taskId/sessionId fields', () => {
    const checkpoint = buildChatCheckpoint({
      taskId: 'task-1',
      dispatches: [
        {
          taskId: 'task-1',
          subTaskId: 'sub-1',
          from: 'manager',
          to: 'research',
          kind: 'strategy',
          objective: '整理策略约束'
        }
      ],
      governanceScore: {
        ministry: 'libu-governance',
        score: 84,
        status: 'healthy',
        summary: '治理评分稳定',
        rationale: ['刑部终审通过'],
        recommendedLearningTargets: ['memory'],
        trustAdjustment: 'promote',
        updatedAt: '2026-03-31T00:00:00.000Z'
      },
      finalReviewState: {
        node: 'final_review',
        ministry: 'xingbu-review',
        decision: 'pass',
        summary: '终审通过',
        interruptRequired: false,
        deliveryStatus: 'delivered',
        deliveryMinistry: 'libu-delivery',
        createdAt: '2026-03-31T00:00:00.000Z',
        updatedAt: '2026-03-31T00:00:00.000Z'
      },
      graphState: {
        status: 'running',
        microLoopState: {
          state: 'retrying',
          attempt: 1,
          maxAttempts: 2,
          updatedAt: '2026-03-31T00:00:00.000Z'
        }
      },
      updatedAt: '2026-03-31T00:00:00.000Z'
    } satisfies Partial<ChatCheckpointRecord>);

    const next = syncCheckpointFromStreamEvent(checkpoint, {
      ...buildChatEvent('assistant_token'),
      payload: { messageId: 'msg-1', content: '好' }
    } satisfies ChatEventRecord);

    expect(next).toEqual(
      expect.objectContaining({
        sessionId: 'session-1',
        taskId: 'task-1',
        dispatches: [expect.objectContaining({ kind: 'strategy' })],
        governanceScore: expect.objectContaining({ score: 84, trustAdjustment: 'promote' }),
        finalReviewState: expect.objectContaining({ decision: 'pass', deliveryStatus: 'delivered' }),
        graphState: expect.objectContaining({
          status: 'running',
          microLoopState: expect.objectContaining({ state: 'retrying', attempt: 1 })
        })
      })
    );
  });
});
