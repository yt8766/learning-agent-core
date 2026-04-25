export type ProviderSseEvent = { type: 'json'; data: unknown } | { type: 'done' };

function parseSseFrame(frame: string): ProviderSseEvent | undefined {
  const dataLines = frame
    .split(/\r?\n/)
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice('data:'.length).trimStart());

  if (dataLines.length === 0) {
    return undefined;
  }

  const data = dataLines.join('\n').trim();
  if (data === '[DONE]') {
    return { type: 'done' };
  }

  return { type: 'json', data: JSON.parse(data) };
}

export async function* parseProviderSseStream(stream: ReadableStream<Uint8Array>): AsyncIterable<ProviderSseEvent> {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        const event = parseSseFrame(frame);
        if (event) {
          yield event;
        }
      }
    }

    buffer += decoder.decode();
    const event = parseSseFrame(buffer);
    if (event) {
      yield event;
    }
  } finally {
    reader.releaseLock();
  }
}
