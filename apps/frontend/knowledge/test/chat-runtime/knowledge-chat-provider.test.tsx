import { describe, expect, it, vi } from 'vitest';

import { createKnowledgeChatProvider } from '@/chat-runtime/knowledge-chat-provider';

describe('createKnowledgeChatProvider', () => {
  it('streams answer deltas and completes with normalized assistant message meta', async () => {
    const api = {
      streamChat: vi.fn(async function* () {
        yield { type: 'answer.delta', delta: 'Hel', runId: 'run-1' };
        yield { type: 'answer.delta', delta: 'lo', runId: 'run-1' };
        yield {
          type: 'answer.completed',
          runId: 'run-1',
          answer: { text: 'Hello', citations: [{ id: 'c1', title: 'Doc', quote: 'Quote' }] }
        };
      })
    };

    const provider = createKnowledgeChatProvider({ api: api as never });
    const chunks: string[] = [];

    await provider.sendMessage(
      { conversationId: 'conv-1', messages: [{ role: 'user', content: 'Hi' }] },
      {
        onChunk: chunk => chunks.push(chunk.content)
      }
    );

    expect(api.streamChat).toHaveBeenCalledTimes(1);
    expect(chunks).toEqual(['Hel', 'Hello']);
  });
});
