import { describe, expect, it } from 'vitest';
import {
  AdminAuthLoginRequestSchema,
  ChatCompletionRequestSchema,
  GatewayErrorCodeSchema,
  KeyStatusResponseSchema,
  ModelListResponseSchema
} from '../src/contracts/index.js';

describe('llm-gateway contracts', () => {
  it('parses an OpenAI-compatible chat completion request', () => {
    const parsed = ChatCompletionRequestSchema.parse({
      model: 'gpt-main',
      messages: [{ role: 'user', content: 'hello' }],
      stream: true,
      max_tokens: 1024
    });

    expect(parsed.model).toBe('gpt-main');
    expect(parsed.messages[0]?.role).toBe('user');
    expect(parsed.max_tokens).toBe(1024);
  });

  it('rejects an unsupported message role', () => {
    expect(() =>
      ChatCompletionRequestSchema.parse({
        model: 'gpt-main',
        messages: [{ role: 'system-admin', content: 'hello' }]
      })
    ).toThrow();
  });

  it('keeps gateway error codes stable', () => {
    expect(GatewayErrorCodeSchema.parse('BUDGET_EXCEEDED')).toBe('BUDGET_EXCEEDED');
  });

  it('parses an OpenAI-compatible model list response', () => {
    const parsed = ModelListResponseSchema.parse({
      object: 'list',
      data: [{ id: 'gpt-main', object: 'model', owned_by: 'llm-gateway' }]
    });

    expect(parsed.data[0]?.id).toBe('gpt-main');
  });

  it('parses a current key status response with snake_case API fields', () => {
    const parsed = KeyStatusResponseSchema.parse({
      id: 'key_1',
      name: 'local',
      status: 'active',
      models: ['gpt-main'],
      rpm_limit: 60,
      tpm_limit: 100000,
      daily_token_limit: 500000,
      daily_cost_limit: 10,
      used_tokens_today: 42,
      used_cost_today: 0.001,
      expires_at: null
    });

    expect(parsed.models).toEqual(['gpt-main']);
    expect(parsed.used_tokens_today).toBe(42);
  });

  it('parses admin login requests with a username and defaults omitted usernames to admin', () => {
    expect(
      AdminAuthLoginRequestSchema.parse({
        username: 'admin',
        password: 'secret'
      })
    ).toEqual({
      username: 'admin',
      password: 'secret'
    });

    expect(AdminAuthLoginRequestSchema.parse({ password: 'secret' }).username).toBe('admin');
  });

  it('normalizes legacy admin account login requests to username', () => {
    expect(
      AdminAuthLoginRequestSchema.parse({
        account: 'Owner',
        password: 'secret'
      })
    ).toEqual({
      username: 'Owner',
      password: 'secret'
    });
  });
});
