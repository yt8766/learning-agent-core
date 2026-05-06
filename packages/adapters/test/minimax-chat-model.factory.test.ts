import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { HumanMessage } from '@langchain/core/messages';

import { createMiniMaxChatModel } from '../src/minimax/chat/minimax-chat-model.factory';

describe('createMiniMaxChatModel', () => {
  const servers: http.Server[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.map(
        server =>
          new Promise<void>(resolve => {
            server.close(() => resolve());
          })
      )
    );
    servers.length = 0;
  });

  it('uses only MiniMax-compatible chat settings in streamed requests', async () => {
    const bodies: unknown[] = [];
    const server = http.createServer((request, response) => {
      let body = '';
      request.on('data', chunk => {
        body += chunk;
      });
      request.on('end', () => {
        bodies.push(JSON.parse(body));
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        response.end(
          [
            `data: ${JSON.stringify({
              id: 'chatcmpl-test',
              object: 'chat.completion.chunk',
              created: 1,
              model: 'MiniMax-M2.7',
              choices: [{ index: 0, delta: { role: 'assistant', content: 'ok' }, finish_reason: null }]
            })}`,
            'data: [DONE]',
            ''
          ].join('\n\n')
        );
      });
    });
    servers.push(server);
    await new Promise<void>(resolve => {
      server.listen(0, () => resolve());
    });
    const port = (server.address() as { port: number }).port;

    const model = createMiniMaxChatModel({
      model: 'MiniMax-M2.7',
      apiKey: 'test-key',
      baseUrl: `http://127.0.0.1:${port}/v1`,
      streamUsage: false,
      thinking: false,
      temperature: 0.2,
      maxTokens: 1200
    });

    for await (const _ of await model.stream([new HumanMessage('hello')])) {
      // Consume the stream so LangChain sends the request.
    }

    expect(bodies[0]).toMatchObject({
      model: 'MiniMax-M2.7',
      stream: true,
      max_completion_tokens: 1200
    });
    expect(bodies[0]).not.toHaveProperty('max_tokens');
    expect(bodies[0]).not.toHaveProperty('stream_options');
    expect(bodies[0]).not.toHaveProperty('thinking');
    expect(bodies[0]).not.toHaveProperty('temperature');
  }, 20_000);
});
