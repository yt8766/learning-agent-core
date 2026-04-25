import { afterEach, describe, expect, it } from 'vitest';

import { POST } from '../../app/api/v1/chat/completions/route.js';
import { ChatCompletionResponseSchema, ChatCompletionStreamChunkSchema } from '../../src/contracts/chat.js';
import { createRouteTestRuntime, resetRouteTestRuntime } from '../helpers/create-route-test-runtime.js';
import { createJsonRequest, readJsonResponse } from '../helpers/http-test-helpers.js';

describe('/api/v1/chat/completions route', () => {
  afterEach(resetRouteTestRuntime);

  it('returns an OpenAI-compatible completion for stream=false through the real route handler', async () => {
    const runtime = createRouteTestRuntime({ providerContent: 'route completion' });

    const response = await POST(
      createJsonRequest('http://localhost/api/v1/chat/completions', {
        headers: { authorization: runtime.authorization },
        body: {
          model: 'gpt-main',
          messages: [{ role: 'user', content: 'hello' }],
          stream: false
        }
      })
    );
    const body = await readJsonResponse(response);
    const parsed = ChatCompletionResponseSchema.parse(body);

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);
    expect(parsed.object).toBe('chat.completion');
    expect(parsed.model).toBe('gpt-main');
    expect(parsed.choices[0]?.message).toEqual({
      role: 'assistant',
      content: 'route completion'
    });
  });

  it('returns an OpenAI-compatible error when the bearer token is missing', async () => {
    createRouteTestRuntime();

    const response = await POST(
      createJsonRequest('http://localhost/api/v1/chat/completions', {
        body: {
          model: 'gpt-main',
          messages: [{ role: 'user', content: 'hello' }]
        }
      })
    );
    const body = await readJsonResponse(response);

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: {
        code: 'AUTH_ERROR',
        message: 'Missing bearer token',
        type: 'gateway_error'
      }
    });
  });

  it('returns an OpenAI-compatible error when the bearer token is invalid', async () => {
    createRouteTestRuntime();

    const response = await POST(
      createJsonRequest('http://localhost/api/v1/chat/completions', {
        headers: { authorization: 'Bearer sk-invalid' },
        body: {
          model: 'gpt-main',
          messages: [{ role: 'user', content: 'hello' }]
        }
      })
    );
    const body = await readJsonResponse(response);

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: {
        code: 'AUTH_ERROR',
        message: 'Invalid API key',
        type: 'gateway_error'
      }
    });
  });

  it('streams OpenAI-compatible SSE chunks and the done sentinel for stream=true', async () => {
    const runtime = createRouteTestRuntime({ providerContent: 'ok' });

    const response = await POST(
      createJsonRequest('http://localhost/api/v1/chat/completions', {
        headers: { authorization: runtime.authorization },
        body: {
          model: 'gpt-main',
          messages: [{ role: 'user', content: 'stream please' }],
          stream: true
        }
      })
    );
    const body = await readResponseBody(response);
    const events = body
      .split('\n')
      .filter(line => line.startsWith('data: '))
      .map(line => line.slice('data: '.length));
    const chunks = events
      .filter(event => event !== '[DONE]')
      .map(event => ChatCompletionStreamChunkSchema.parse(JSON.parse(event) as unknown));

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(events.at(-1)).toBe('[DONE]');
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.some(chunk => chunk.choices.some(choice => choice.delta.content === 'o'))).toBe(true);
    expect(chunks.some(chunk => chunk.choices.some(choice => choice.finish_reason === 'stop'))).toBe(true);
  });
});

async function readResponseBody(response: Response): Promise<string> {
  expect(response.body).not.toBeNull();

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let text = '';

  while (true) {
    const result = await reader.read();
    if (result.done) {
      return text + decoder.decode();
    }

    text += decoder.decode(result.value, { stream: true });
  }
}
