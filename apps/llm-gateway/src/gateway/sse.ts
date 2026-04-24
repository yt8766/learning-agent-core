import type { GatewayChatStreamChunk } from '../providers/provider-adapter';

export function formatOpenAiSseChunk(chunk: GatewayChatStreamChunk): string {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

export function formatOpenAiSseDone(): string {
  return 'data: [DONE]\n\n';
}

export function createOpenAiSseStream(chunks: AsyncIterable<GatewayChatStreamChunk>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of chunks) {
          controller.enqueue(encoder.encode(formatOpenAiSseChunk(chunk)));
        }

        controller.enqueue(encoder.encode(formatOpenAiSseDone()));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });
}
