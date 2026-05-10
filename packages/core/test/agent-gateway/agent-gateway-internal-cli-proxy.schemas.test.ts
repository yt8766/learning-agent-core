import { describe, expect, it } from 'vitest';
import {
  GatewayClientApiKeyListResponseSchema,
  GatewayClientListResponseSchema,
  GatewayClientQuotaSchema,
  GatewayClientRequestLogListResponseSchema,
  GatewayCreateClientApiKeyResponseSchema,
  GatewayOpenAIChatCompletionRequestSchema,
  GatewayOpenAIChatCompletionResponseSchema,
  GatewayOpenAICompatibleErrorResponseSchema,
  GatewayOpenAIModelsResponseSchema,
  GatewayUpdateClientQuotaRequestSchema
} from '../../src/contracts/agent-gateway';

describe('agent gateway internal CLI proxy contracts', () => {
  it('parses Gateway client, key, quota, usage log, and OpenAI-compatible runtime contracts', () => {
    expect(
      GatewayClientListResponseSchema.parse({
        items: [
          {
            id: 'client-acme',
            name: 'Acme App',
            description: 'internal app',
            ownerEmail: 'owner@example.com',
            status: 'active',
            tags: ['internal'],
            createdAt: '2026-05-10T00:00:00.000Z',
            updatedAt: '2026-05-10T00:00:00.000Z'
          }
        ]
      }).items[0].status
    ).toBe('active');

    expect(
      GatewayCreateClientApiKeyResponseSchema.parse({
        apiKey: {
          id: 'key-1',
          clientId: 'client-acme',
          name: 'default',
          prefix: 'agp_live_1234',
          status: 'active',
          scopes: ['models.read', 'chat.completions'],
          createdAt: '2026-05-10T00:00:00.000Z',
          expiresAt: null,
          lastUsedAt: null
        },
        secret: 'agp_live_secret'
      }).secret
    ).toBe('agp_live_secret');

    expect(
      GatewayClientApiKeyListResponseSchema.parse({
        items: [
          {
            id: 'key-1',
            clientId: 'client-acme',
            name: 'default',
            prefix: 'agp_live_1234',
            status: 'active',
            scopes: ['models.read'],
            createdAt: '2026-05-10T00:00:00.000Z',
            expiresAt: null,
            lastUsedAt: null
          }
        ]
      }).items[0]
    ).not.toHaveProperty('secret');

    expect(
      GatewayClientQuotaSchema.parse({
        clientId: 'client-acme',
        period: 'monthly',
        tokenLimit: 1000,
        requestLimit: 10,
        usedTokens: 20,
        usedRequests: 1,
        resetAt: '2026-06-01T00:00:00.000Z',
        status: 'normal'
      }).tokenLimit
    ).toBe(1000);

    expect(
      GatewayUpdateClientQuotaRequestSchema.parse({
        tokenLimit: 5000,
        requestLimit: 50,
        resetAt: '2026-06-01T00:00:00.000Z'
      })
    ).toMatchObject({ requestLimit: 50 });

    expect(
      GatewayClientRequestLogListResponseSchema.parse({
        items: [
          {
            id: 'req-1',
            clientId: 'client-acme',
            apiKeyId: 'key-1',
            occurredAt: '2026-05-10T00:00:01.000Z',
            endpoint: '/v1/chat/completions',
            model: 'gpt-5.4',
            providerId: 'openai-primary',
            statusCode: 200,
            inputTokens: 2,
            outputTokens: 3,
            latencyMs: 12
          }
        ]
      }).items
    ).toHaveLength(1);

    expect(
      GatewayOpenAIChatCompletionRequestSchema.parse({
        model: 'gpt-5.4',
        messages: [{ role: 'user', content: 'ping' }],
        stream: false
      }).messages[0].content
    ).toBe('ping');

    expect(
      GatewayOpenAIChatCompletionResponseSchema.parse({
        id: 'chatcmpl-1',
        object: 'chat.completion',
        created: 1778342400,
        model: 'gpt-5.4',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'pong' },
            finish_reason: 'stop'
          }
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
      }).choices[0].message.content
    ).toBe('pong');

    expect(
      GatewayOpenAIModelsResponseSchema.parse({
        object: 'list',
        data: [{ id: 'gpt-5.4', object: 'model', created: 1778342400, owned_by: 'openai-primary' }]
      }).data[0].id
    ).toBe('gpt-5.4');

    expect(
      GatewayOpenAICompatibleErrorResponseSchema.parse({
        error: {
          message: 'quota exceeded',
          type: 'rate_limit_error',
          code: 'quota_exceeded'
        }
      }).error.code
    ).toBe('quota_exceeded');
  });
});
