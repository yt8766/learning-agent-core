import { describe, expect, it } from 'vitest';
import { GatewayOpenAIChatCompletionResponseSchema } from '@agent/core';

import {
  normalizeOpenAIChatCompletionRequest,
  projectOpenAIChatCompletionResponse,
  projectOpenAIChatCompletionStreamEvent
} from '../../src/domains/agent-gateway/runtime-engine/protocols/openai-chat.protocol';

describe('OpenAI chat protocol adapter', () => {
  it('normalizes chat messages into runtime invocation content parts', () => {
    const invocation = normalizeOpenAIChatCompletionRequest({
      requestId: 'inv_1',
      clientId: 'client_1',
      apiKeyId: 'key_1',
      scopes: ['chat.completions'],
      body: {
        model: 'gpt-5-codex',
        messages: [{ role: 'user', content: 'ping' }],
        stream: false
      }
    });

    expect(invocation).toMatchObject({
      id: 'inv_1',
      protocol: 'openai.chat.completions',
      model: 'gpt-5-codex',
      stream: false
    });
    expect(invocation.messages[0]?.content).toEqual([{ type: 'text', text: 'ping' }]);
  });

  it('normalizes unsupported roles to user', () => {
    const invocation = normalizeOpenAIChatCompletionRequest({
      requestId: 'inv_1',
      clientId: 'client_1',
      apiKeyId: 'key_1',
      scopes: ['chat.completions'],
      body: {
        model: 'gpt-5-codex',
        messages: [{ role: 'developer', content: 'ship it' }]
      }
    });

    expect(invocation.messages[0]?.role).toBe('user');
  });

  it('normalizes omitted stream to false and true stream to true', () => {
    const omittedStreamInvocation = normalizeOpenAIChatCompletionRequest({
      requestId: 'inv_1',
      clientId: 'client_1',
      apiKeyId: 'key_1',
      scopes: ['chat.completions'],
      body: {
        model: 'gpt-5-codex',
        messages: [{ role: 'user', content: 'ping' }]
      }
    });
    const enabledStreamInvocation = normalizeOpenAIChatCompletionRequest({
      requestId: 'inv_2',
      clientId: 'client_1',
      apiKeyId: 'key_1',
      scopes: ['chat.completions'],
      body: {
        model: 'gpt-5-codex',
        messages: [{ role: 'user', content: 'ping' }],
        stream: true
      }
    });

    expect(omittedStreamInvocation.stream).toBe(false);
    expect(enabledStreamInvocation.stream).toBe(true);
  });

  it('projects executor runtime results into OpenAI-compatible responses', () => {
    const response = projectOpenAIChatCompletionResponse({
      invocationId: 'inv_1',
      model: 'gpt-5-codex',
      text: 'executor fixture response',
      route: {
        invocationId: 'inv_1',
        providerKind: 'codex',
        credentialId: 'cred_1',
        model: 'gpt-5-codex',
        strategy: 'round-robin',
        reason: 'test',
        decidedAt: '2026-05-10T00:00:00.000Z'
      },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }
    });

    GatewayOpenAIChatCompletionResponseSchema.parse(response);
    expect(response.object).toBe('chat.completion');
    expect(response.model).toBe('gpt-5-codex');
    expect(response.choices[0]?.message.content).toBe('executor fixture response');
    expect(response.choices[0]?.finish_reason).toBe('stop');
    expect(response.usage.prompt_tokens).toBe(1);
    expect(response.usage.completion_tokens).toBe(1);
    expect(response.usage.total_tokens).toBe(2);
  });

  it('projects internal stream delta events into OpenAI SSE JSON payloads', () => {
    const payload = projectOpenAIChatCompletionStreamEvent(
      {
        invocationId: 'inv_1',
        type: 'delta',
        sequence: 0,
        createdAt: '2026-05-10T00:00:00.000Z',
        delta: { text: 'p' }
      },
      { model: 'gpt-5-codex', created: 1_747_874_400 }
    );

    expect(JSON.parse(payload)).toMatchObject({
      id: 'inv_1',
      object: 'chat.completion.chunk',
      created: 1_747_874_400,
      model: 'gpt-5-codex',
      choices: [{ index: 0, delta: { content: 'p' }, finish_reason: null }]
    });
  });

  it('projects internal stream done events into OpenAI SSE done marker', () => {
    const payload = projectOpenAIChatCompletionStreamEvent({
      invocationId: 'inv_1',
      type: 'done',
      sequence: 1,
      createdAt: '2026-05-10T00:00:00.000Z'
    });

    expect(payload).toBe('[DONE]');
  });

  it('projects internal stream usage events into OpenAI usage chunks', () => {
    const payload = projectOpenAIChatCompletionStreamEvent(
      {
        invocationId: 'inv_1',
        type: 'usage',
        sequence: 1,
        createdAt: '2026-05-10T00:00:00.000Z',
        usage: { inputTokens: 3, outputTokens: 5, totalTokens: 8 }
      },
      { model: 'gpt-5-codex', created: 1_747_874_400 }
    );

    expect(JSON.parse(payload)).toMatchObject({
      id: 'inv_1',
      object: 'chat.completion.chunk',
      created: 1_747_874_400,
      model: 'gpt-5-codex',
      choices: [],
      usage: {
        prompt_tokens: 3,
        completion_tokens: 5,
        total_tokens: 8
      }
    });
  });
});
