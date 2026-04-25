import { beforeAll, describe, expect, it } from 'vitest';

import {
  E2E_KEYS,
  authHeaders,
  gatewayBaseUrl,
  parseChatCompletion,
  parseKeyStatus,
  parseModels,
  parseSseChunks,
  parseStreamChunk,
  readJson
} from './fixtures';
import { waitForGateway } from './wait-for-gateway';

describe('llm-gateway HTTP E2E', () => {
  beforeAll(async () => {
    await waitForGateway();
  }, 35_000);

  it('lists only models allowed for the API key', async () => {
    const response = await fetch(`${gatewayBaseUrl()}/api/v1/models`, {
      headers: authHeaders(E2E_KEYS.modelLimited)
    });
    const body = parseModels(await readJson(response));

    expect(response.status).toBe(200);
    expect(body.data.map(model => model.id)).toEqual(['minimax-main']);
  });

  it('returns key status, limits, and today usage', async () => {
    const response = await fetch(`${gatewayBaseUrl()}/api/v1/key`, {
      headers: authHeaders(E2E_KEYS.validFull)
    });
    const body = parseKeyStatus(await readJson(response));

    expect(response.status).toBe(200);
    expect(body.id).toBe('key-e2e-valid-full');
    expect(body.status).toBe('active');
    expect(body.models).toEqual(['gpt-main', 'minimax-main']);
    expect(body.used_tokens_today).toBeGreaterThanOrEqual(0);
  });

  it('returns OpenAI-compatible non-streaming chat completions and records usage', async () => {
    const response = await fetch(`${gatewayBaseUrl()}/api/v1/chat/completions`, {
      method: 'POST',
      headers: {
        ...authHeaders(E2E_KEYS.validFull),
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-main',
        messages: [{ role: 'user', content: 'hello from e2e' }],
        stream: false,
        max_tokens: 32
      })
    });
    const body = parseChatCompletion(await readJson(response));

    expect(response.status).toBe(200);
    expect(body.object).toBe('chat.completion');
    expect(body.model).toBe('gpt-main');
    expect(body.choices[0]?.message.content).toContain('llm-gateway e2e response');
    expect(body.usage.total_tokens).toBeGreaterThan(0);
  });

  it('returns OpenAI-compatible SSE chat completions', async () => {
    const response = await fetch(`${gatewayBaseUrl()}/api/v1/chat/completions`, {
      method: 'POST',
      headers: {
        ...authHeaders(E2E_KEYS.validFull),
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-main',
        messages: [{ role: 'user', content: 'stream from e2e' }],
        stream: true,
        max_tokens: 32
      })
    });
    const text = await response.text();
    const payloads = parseSseChunks(text);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(payloads.at(-1)).toBe('[DONE]');
    expect(parseStreamChunk(payloads[0] ?? '').object).toBe('chat.completion.chunk');
  });

  it('maps auth and model permission errors to stable gateway errors', async () => {
    const missing = await fetch(`${gatewayBaseUrl()}/api/v1/models`);
    expect(missing.status).toBe(401);
    await expect(missing.json()).resolves.toMatchObject({ error: { code: 'AUTH_ERROR' } });

    const disabled = await fetch(`${gatewayBaseUrl()}/api/v1/models`, {
      headers: authHeaders(E2E_KEYS.disabled)
    });
    expect(disabled.status).toBe(403);
    await expect(disabled.json()).resolves.toMatchObject({ error: { code: 'KEY_DISABLED' } });

    const modelDenied = await fetch(`${gatewayBaseUrl()}/api/v1/chat/completions`, {
      method: 'POST',
      headers: {
        ...authHeaders(E2E_KEYS.modelLimited),
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-main',
        messages: [{ role: 'user', content: 'denied' }]
      })
    });
    expect(modelDenied.status).toBe(403);
    await expect(modelDenied.json()).resolves.toMatchObject({ error: { code: 'MODEL_NOT_ALLOWED' } });
  });

  it('blocks requests that exceed daily token budget', async () => {
    const response = await fetch(`${gatewayBaseUrl()}/api/v1/chat/completions`, {
      method: 'POST',
      headers: {
        ...authHeaders(E2E_KEYS.budgetLow),
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-main',
        messages: [{ role: 'user', content: 'this prompt should exceed the one token daily budget' }]
      })
    });

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'BUDGET_EXCEEDED' } });
  });

  it('runs the admin auth HTTP lifecycle', async () => {
    const login = await fetch(`${gatewayBaseUrl()}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'correct-e2e-owner-password' })
    });
    const tokenPair = (await login.json()) as { accessToken: string; refreshToken: string };

    expect(login.status).toBe(200);
    expect(tokenPair.accessToken).toBeTruthy();
    expect(tokenPair.refreshToken).toBeTruthy();

    const refresh = await fetch(`${gatewayBaseUrl()}/api/admin/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokenPair.refreshToken })
    });

    expect(refresh.status).toBe(200);
  });
});
