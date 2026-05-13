import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { GatewayRuntimeInvocationSchema } from '@agent/core';

import { AgentGatewayProviderRuntimeController } from '../../src/api/agent-gateway/agent-gateway-provider-runtime.controller';
import { normalizeClaudeMessagesRequest } from '../../src/domains/agent-gateway/runtime-engine/protocols/claude-messages.protocol';
import { normalizeGeminiGenerateContentRequest } from '../../src/domains/agent-gateway/runtime-engine/protocols/gemini-generate-content.protocol';
import { normalizeOpenAIChatCompletionRequest } from '../../src/domains/agent-gateway/runtime-engine/protocols/openai-chat.protocol';
import { normalizeOpenAIResponsesRequest } from '../../src/domains/agent-gateway/runtime-engine/protocols/openai-responses.protocol';
import { getProviderPinnedRuntimeContext } from '../../src/domains/agent-gateway/runtime-engine/protocols/provider-pinned-runtime-invocation';

const client = { clientId: 'client_1', apiKeyId: 'key_1', scopes: ['chat.completions'] };

describe('provider-specific runtime protocol adapters', () => {
  it('normalizes OpenAI Chat requests into schema-owned runtime invocations', () => {
    const invocation = normalizeOpenAIChatCompletionRequest({
      requestId: 'chat_1',
      clientId: client.clientId,
      apiKeyId: client.apiKeyId,
      scopes: client.scopes,
      body: {
        model: 'gpt-5.4',
        messages: [{ role: 'user', content: 'ping' }],
        stream: false,
        rawBody: { secret: 'do-not-keep' },
        headers: { authorization: 'Bearer leaked' },
        tokens: { accessToken: 'token-leak' }
      } as never
    });

    expect(GatewayRuntimeInvocationSchema.parse(invocation)).toEqual(invocation);
    expect(invocation).toMatchObject({
      id: 'chat_1',
      protocol: 'openai.chat.completions',
      model: 'gpt-5.4',
      stream: false
    });
    expect(invocation).not.toHaveProperty('rawBody');
    expect(JSON.stringify(invocation)).not.toContain('do-not-keep');
    expect(JSON.stringify(invocation)).not.toContain('Bearer leaked');
    expect(JSON.stringify(invocation)).not.toContain('token-leak');
  });

  it('normalizes OpenAI Responses requests without keeping raw provider payloads', () => {
    const invocation = normalizeOpenAIResponsesRequest({
      requestId: 'resp_1',
      client,
      body: {
        model: 'gpt-5.4',
        input: 'summarize this',
        stream: true,
        rawResponse: { secret: 'do-not-keep' }
      }
    });

    expect(GatewayRuntimeInvocationSchema.parse(invocation)).toEqual(invocation);
    expect(getProviderPinnedRuntimeContext(invocation)).toEqual({ providerKind: 'openaiCompatible' });
    expect(invocation).toMatchObject({
      id: 'resp_1',
      protocol: 'openai.responses',
      model: 'gpt-5.4',
      stream: true
    });
    expect(invocation).not.toHaveProperty('providerKind');
    expect(invocation.messages[0]?.content).toEqual([{ type: 'text', text: 'summarize this' }]);
    expect(JSON.stringify(invocation)).not.toContain('rawResponse');
    expect(JSON.stringify(invocation)).not.toContain('do-not-keep');
  });

  it('normalizes Claude Messages requests into runtime messages', () => {
    const invocation = normalizeClaudeMessagesRequest({
      requestId: 'msg_1',
      client,
      body: {
        model: 'claude-sonnet-4.5',
        system: 'be concise',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'ping' }] }],
        headers: { authorization: 'Bearer leaked' }
      }
    });

    expect(GatewayRuntimeInvocationSchema.parse(invocation)).toEqual(invocation);
    expect(getProviderPinnedRuntimeContext(invocation)).toEqual({ providerKind: 'claude' });
    expect(invocation).toMatchObject({
      id: 'msg_1',
      protocol: 'claude.messages',
      model: 'claude-sonnet-4.5',
      stream: false
    });
    expect(invocation).not.toHaveProperty('providerKind');
    expect(invocation.messages.map(message => message.role)).toEqual(['system', 'user']);
    expect(JSON.stringify(invocation)).not.toContain('headers');
    expect(JSON.stringify(invocation)).not.toContain('Bearer leaked');
  });

  it('normalizes Gemini generateContent requests into runtime messages', () => {
    const invocation = normalizeGeminiGenerateContentRequest({
      requestId: 'gemini_1',
      client,
      body: {
        model: 'gemini-2.5-pro',
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        rawToken: 'do-not-keep'
      }
    });

    expect(GatewayRuntimeInvocationSchema.parse(invocation)).toEqual(invocation);
    expect(getProviderPinnedRuntimeContext(invocation)).toEqual({ providerKind: 'gemini' });
    expect(invocation).toMatchObject({
      id: 'gemini_1',
      protocol: 'gemini.generateContent',
      model: 'gemini-2.5-pro',
      stream: false
    });
    expect(invocation).not.toHaveProperty('providerKind');
    expect(invocation.messages[0]?.content).toEqual([{ type: 'text', text: 'ping' }]);
    expect(JSON.stringify(invocation)).not.toContain('rawToken');
    expect(JSON.stringify(invocation)).not.toContain('do-not-keep');
  });
});

describe('AgentGatewayProviderRuntimeController', () => {
  it('pins provider family for provider-specific routes without leaking raw payloads', async () => {
    const controller = new AgentGatewayProviderRuntimeController();

    const response = await controller.claudeMessages({
      model: 'claude-sonnet-4.5',
      messages: [{ role: 'user', content: 'ping' }],
      rawResponse: { secret: 'do-not-keep' }
    });

    expect(response.route.providerKind).toBe('claude');
    expect(response.text).toBe('deterministic executor response');
    expect(JSON.stringify(response)).not.toContain('rawResponse');
    expect(JSON.stringify(response)).not.toContain('do-not-keep');
  });

  it('routes provider-specific invocations through the runtime facade when available', async () => {
    const runtimeEngine = new RecordingRuntimeEngine();
    const controller = new AgentGatewayProviderRuntimeController(undefined, runtimeEngine as never);

    await controller.geminiGenerateContentForModel(
      'gemini-2.5-pro',
      {
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        rawToken: 'do-not-keep'
      },
      undefined
    );

    expect(runtimeEngine.invocations).toHaveLength(1);
    expect(runtimeEngine.invocations[0]).toMatchObject({
      invocation: {
        protocol: 'gemini.generateContent',
        model: 'gemini-2.5-pro'
      },
      context: { providerKind: 'gemini' }
    });
    expect(JSON.stringify(runtimeEngine.invocations[0])).not.toContain('rawToken');
    expect(JSON.stringify(runtimeEngine.invocations[0])).not.toContain('do-not-keep');
  });

  it('does not silently deterministic-fallback when auth is configured but runtime facade is missing', async () => {
    const auth = {
      authenticate: async () => ({
        client: { id: 'client_1' },
        apiKey: { id: 'key_1', scopes: ['chat.completions'] }
      })
    };
    const controller = new AgentGatewayProviderRuntimeController(auth as never);

    await expect(
      controller.claudeMessages(
        {
          model: 'claude-sonnet-4.5',
          messages: [{ role: 'user', content: 'ping' }]
        },
        'Bearer test-key'
      )
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

class RecordingRuntimeEngine {
  readonly invocations: Array<{ invocation: unknown; context: unknown }> = [];

  async invoke(invocation: unknown, context: unknown) {
    this.invocations.push({ invocation, context });
    return {
      invocationId: 'gemini-test',
      model: 'gemini-2.5-pro',
      text: 'ok',
      route: {
        invocationId: 'gemini-test',
        providerKind: 'gemini',
        credentialId: 'test',
        model: 'gemini-2.5-pro',
        strategy: 'fill-first',
        reason: 'test',
        decidedAt: '2026-05-11T00:00:00.000Z'
      },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }
    };
  }
}
