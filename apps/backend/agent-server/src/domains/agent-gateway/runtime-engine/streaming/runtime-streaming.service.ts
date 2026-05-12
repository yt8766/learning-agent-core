import { Injectable } from '@nestjs/common';
import type { GatewayRuntimeStreamEvent } from '@agent/core';

import { projectOpenAIChatCompletionStreamEvent } from '../protocols/openai-chat.protocol';

interface OpenAIChatSseOptions {
  model: string;
  created?: number;
}

interface WritableSseResponse {
  setHeader(name: string, value: string): void;
  write(chunk: string): void;
  end(): void;
}

@Injectable()
export class RuntimeStreamingService {
  async toOpenAIChatSse(
    events: AsyncIterable<GatewayRuntimeStreamEvent>,
    options: OpenAIChatSseOptions
  ): Promise<string> {
    const chunks: string[] = [];
    for await (const line of this.toOpenAIChatSseLines(events, options)) {
      chunks.push(line);
    }
    return chunks.join('');
  }

  async writeOpenAIChatSse(
    response: WritableSseResponse,
    events: AsyncIterable<GatewayRuntimeStreamEvent>,
    options: OpenAIChatSseOptions
  ): Promise<void> {
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    for await (const line of this.toOpenAIChatSseLines(events, options)) {
      response.write(line);
    }
    response.end();
  }

  private async *toOpenAIChatSseLines(
    events: AsyncIterable<GatewayRuntimeStreamEvent>,
    options: OpenAIChatSseOptions
  ): AsyncIterable<string> {
    for await (const event of events) {
      yield `data: ${projectOpenAIChatCompletionStreamEvent(event, options)}\n\n`;
    }
  }
}
