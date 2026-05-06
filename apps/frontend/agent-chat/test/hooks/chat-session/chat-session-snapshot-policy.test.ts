import { describe, expect, it } from 'vitest';

import { mergeSessionMessagesForDetailRefresh } from '@/hooks/chat-session/chat-session-snapshot-policy';
import type { ChatEventRecord, ChatMessageRecord } from '@/types/chat';
import { buildChatCheckpoint } from '../../fixtures/chat-session-fixtures';

describe('chat-session snapshot policy', () => {
  it('preserves non-empty direct reply stream text when a cancelled snapshot has no final assistant message', () => {
    const currentMessages: ChatMessageRecord[] = [
      {
        id: 'direct_reply_task-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: '取消前已经生成的半截回复。',
        taskId: 'task-1',
        createdAt: '2026-05-02T08:30:00.000Z'
      }
    ];
    const fetchedMessages: ChatMessageRecord[] = [];
    const events: ChatEventRecord[] = [
      {
        id: 'evt-cancel-1',
        sessionId: 'session-1',
        type: 'run_cancelled',
        at: '2026-05-02T08:31:00.000Z',
        payload: { reason: '用户停止当前会话' }
      }
    ];
    const checkpoint = buildChatCheckpoint({
      updatedAt: '2026-05-02T08:31:00.000Z',
      graphState: {
        status: 'cancelled',
        currentStep: 'cancelled'
      }
    });

    const merged = mergeSessionMessagesForDetailRefresh(currentMessages, fetchedMessages, events, checkpoint);

    expect(merged).toEqual([
      expect.objectContaining({
        id: 'direct_reply_task-1',
        content: '取消前已经生成的半截回复。'
      })
    ]);
  });
});
