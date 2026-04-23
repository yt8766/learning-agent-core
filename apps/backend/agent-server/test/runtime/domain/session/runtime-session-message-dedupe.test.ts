import { describe, expect, it } from 'vitest';

import { dedupeSessionMessages } from '../../../../src/runtime/domain/session/runtime-session-message-dedupe';

describe('runtime session message dedupe', () => {
  it('collapses stream and final assistant messages for the same task while keeping the fuller final record', () => {
    const result = dedupeSessionMessages([
      {
        id: 'summary_stream_task-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: '我是内阁首辅，一个基于大语言模型的智能助手',
        createdAt: '2026-04-07T00:00:00.000Z'
      },
      {
        id: 'chat_msg_final_1',
        sessionId: 'session-1',
        role: 'assistant',
        taskId: 'task-1',
        content: '我是内阁首辅，一个基于大语言模型的智能助手。',
        createdAt: '2026-04-07T00:00:01.000Z'
      }
    ] as any);

    expect(result).toEqual([
      expect.objectContaining({
        id: 'chat_msg_final_1',
        content: '我是内阁首辅，一个基于大语言模型的智能助手。'
      })
    ]);
  });
});
