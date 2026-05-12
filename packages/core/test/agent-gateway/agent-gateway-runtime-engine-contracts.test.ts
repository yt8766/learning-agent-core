import { describe, expect, it } from 'vitest';

import {
  GatewayRuntimeErrorSchema,
  GatewayRuntimeExecutorHealthSchema,
  GatewayRuntimeHealthResponseSchema,
  GatewayRuntimeInvocationSchema,
  GatewayRuntimeQuotaPolicySchema,
  GatewayRuntimeRouteDecisionSchema,
  GatewayRuntimeStreamEventSchema
} from '../../src/contracts/agent-gateway';

describe('agent gateway runtime engine contracts', () => {
  it('parses a normalized OpenAI chat invocation without raw vendor payloads', () => {
    const invocation = GatewayRuntimeInvocationSchema.parse({
      id: 'inv_1',
      protocol: 'openai.chat.completions',
      model: 'gpt-5-codex',
      stream: false,
      messages: [{ role: 'user', content: [{ type: 'text', text: 'ping' }] }],
      requestedAt: '2026-05-10T00:00:00.000Z',
      client: { clientId: 'client_1', apiKeyId: 'key_1', scopes: ['chat.completions'] },
      metadata: { userId: 'user_1' }
    });

    expect(invocation.protocol).toBe('openai.chat.completions');
    expect(() =>
      GatewayRuntimeInvocationSchema.parse({
        ...invocation,
        rawPayload: { vendor: true }
      })
    ).toThrow();
  });

  it('parses route decisions used by logs and debug panels', () => {
    const decision = GatewayRuntimeRouteDecisionSchema.parse({
      invocationId: 'inv_1',
      providerKind: 'codex',
      credentialId: 'cred_1',
      authIndex: 'auth_1',
      model: 'gpt-5-codex',
      strategy: 'round-robin',
      reason: 'matched model alias and healthy credential',
      decidedAt: '2026-05-10T00:00:01.000Z'
    });

    expect(decision.providerKind).toBe('codex');
  });

  it('parses stream events and protocol-safe errors', () => {
    expect(
      GatewayRuntimeStreamEventSchema.parse({
        invocationId: 'inv_1',
        type: 'delta',
        sequence: 1,
        createdAt: '2026-05-10T00:00:02.000Z',
        delta: { text: 'pong' }
      }).type
    ).toBe('delta');

    expect(
      GatewayRuntimeErrorSchema.parse({
        code: 'quota_exceeded',
        type: 'insufficient_quota',
        message: 'Gateway quota exceeded.',
        retryable: false
      }).code
    ).toBe('quota_exceeded');
  });

  it('parses executor health and quota policy projections', () => {
    expect(
      GatewayRuntimeExecutorHealthSchema.parse({
        providerKind: 'codex',
        status: 'ready',
        checkedAt: '2026-05-10T00:00:03.000Z',
        activeRequests: 0,
        supportsStreaming: true
      }).status
    ).toBe('ready');

    expect(
      GatewayRuntimeQuotaPolicySchema.parse({
        subjectType: 'client',
        subjectId: 'client_1',
        window: 'monthly',
        maxTokens: 1000000,
        maxRequests: 10000,
        action: 'deny'
      }).action
    ).toBe('deny');
  });

  it('parses runtime health response and rejects invalid executor values', () => {
    expect(
      GatewayRuntimeHealthResponseSchema.parse({
        status: 'ready',
        checkedAt: '2026-05-10T00:00:04.000Z',
        executors: [
          {
            providerKind: 'codex',
            status: 'ready',
            checkedAt: '2026-05-10T00:00:04.000Z',
            activeRequests: 0,
            supportsStreaming: true
          }
        ],
        activeRequests: 0,
        activeStreams: 0,
        usageQueue: { pending: 0, failed: 0 },
        cooldowns: []
      }).executors[0]?.providerKind
    ).toBe('codex');

    expect(() =>
      GatewayRuntimeHealthResponseSchema.parse({
        status: 'ready',
        checkedAt: '2026-05-10T00:00:04.000Z',
        executors: [
          {
            providerKind: 'unknown',
            status: 'ready',
            checkedAt: '2026-05-10T00:00:04.000Z',
            activeRequests: 0,
            supportsStreaming: true
          }
        ],
        activeRequests: 0,
        activeStreams: 0,
        usageQueue: { pending: 0, failed: 0 },
        cooldowns: []
      })
    ).toThrow();

    expect(() =>
      GatewayRuntimeHealthResponseSchema.parse({
        status: 'ready',
        checkedAt: '2026-05-10T00:00:04.000Z',
        executors: [
          {
            providerKind: 'codex',
            status: 'ready',
            checkedAt: '2026-05-10T00:00:04.000Z',
            activeRequests: -1,
            supportsStreaming: true
          }
        ],
        activeRequests: 0,
        activeStreams: 0,
        usageQueue: { pending: 0, failed: 0 },
        cooldowns: []
      })
    ).toThrow();

    expect(() =>
      GatewayRuntimeHealthResponseSchema.parse({
        status: 'ready',
        checkedAt: '2026-05-10T00:00:04.000Z',
        executors: [],
        activeRequests: 0,
        activeStreams: 0,
        usageQueue: { pending: -1, failed: 0 },
        cooldowns: []
      })
    ).toThrow();
  });
});
