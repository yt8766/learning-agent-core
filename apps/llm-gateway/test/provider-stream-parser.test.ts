import { describe, expect, it } from 'vitest';
import { parseProviderSseStream } from '../src/providers/provider-stream-parser.js';

function textStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    }
  });
}

async function collectEvents(stream: ReadableStream<Uint8Array>) {
  const events = [];

  for await (const event of parseProviderSseStream(stream)) {
    events.push(event);
  }

  return events;
}

describe('provider SSE parser', () => {
  it('separates JSON data events from the provider done sentinel', async () => {
    await expect(
      collectEvents(
        textStream([
          'data: {"choices":[{"delta":{"content":"hel"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
          'data: [DONE]\n\n'
        ])
      )
    ).resolves.toEqual([
      { type: 'json', data: { choices: [{ delta: { content: 'hel' } }] } },
      { type: 'json', data: { choices: [{ delta: { content: 'lo' } }] } },
      { type: 'done' }
    ]);
  });

  it('handles provider SSE frames split across stream chunks', async () => {
    await expect(
      collectEvents(textStream(['data: {"id":"chunk_', '1"}\n\n', 'data:', ' [DONE]\n\n']))
    ).resolves.toEqual([{ type: 'json', data: { id: 'chunk_1' } }, { type: 'done' }]);
  });

  it('ignores comments and non-data fields while preserving multi-line data payloads', async () => {
    await expect(
      collectEvents(
        textStream([': keepalive\n', 'event: message\n', 'data: {"text":"a', '\\nb"}\n\n', 'data: [DONE]\n\n'])
      )
    ).resolves.toEqual([{ type: 'json', data: { text: 'a\nb' } }, { type: 'done' }]);
  });
});
