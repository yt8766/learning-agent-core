import { describe, expect, it } from 'vitest';

import { DeterministicOpenAICompatibleExecutor } from '../../src/domains/agent-gateway/runtime-engine/executors/deterministic-openai-compatible.executor';

const now = '2026-05-11T00:00:00.000Z';

function makeInvocation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    protocol: 'openai.chat.completions' as const,
    model: 'gpt-5.4',
    stream: false,
    messages: [
      {
        role: 'user' as const,
        content: [{ type: 'text' as const, text: 'hello world' }]
      }
    ],
    requestedAt: now,
    client: { clientId: 'client-1', apiKeyId: 'key-1', scopes: ['chat.completions'] },
    metadata: {},
    ...overrides
  };
}

describe('DeterministicOpenAICompatibleExecutor', () => {
  it('uses default options when constructed with no arguments', () => {
    const executor = new DeterministicOpenAICompatibleExecutor();
    expect(executor.providerKind).toBe('codex');
  });

  it('respects custom providerKind', () => {
    const executor = new DeterministicOpenAICompatibleExecutor({ providerKind: 'gemini' });
    expect(executor.providerKind).toBe('gemini');
  });

  it('health returns ready status with activeRequests count', async () => {
    const executor = new DeterministicOpenAICompatibleExecutor({ now: () => now });
    const health = await executor.health();

    expect(health).toEqual({
      providerKind: 'codex',
      status: 'ready',
      checkedAt: now,
      activeRequests: 0,
      supportsStreaming: true
    });
  });

  it('discoverModels returns configured model ids', async () => {
    const executor = new DeterministicOpenAICompatibleExecutor({
      modelIds: ['gpt-5.4', 'gpt-5-mini'],
      providerKind: 'codex'
    });

    const models = await executor.discoverModels();
    expect(models).toEqual([
      { id: 'gpt-5.4', ownedBy: 'codex', created: 1_778_367_600 },
      { id: 'gpt-5-mini', ownedBy: 'codex', created: 1_778_367_600 }
    ]);
  });

  it('discoverModels uses default model list when none provided', async () => {
    const executor = new DeterministicOpenAICompatibleExecutor();
    const models = await executor.discoverModels();
    expect(models.map(m => m.id)).toEqual(['gpt-5.4']);
  });

  it('canHandle returns true for known model', () => {
    const executor = new DeterministicOpenAICompatibleExecutor({ modelIds: ['gpt-5.4'] });
    expect(executor.canHandle(makeInvocation())).toBe(true);
  });

  it('canHandle returns false for unknown model', () => {
    const executor = new DeterministicOpenAICompatibleExecutor({ modelIds: ['gpt-5.4'] });
    expect(executor.canHandle(makeInvocation({ model: 'unknown-model' }))).toBe(false);
  });

  it('invoke returns deterministic response with usage', async () => {
    const executor = new DeterministicOpenAICompatibleExecutor({
      now: () => now,
      responseText: 'test response'
    });

    const result = await executor.invoke(makeInvocation());

    expect(result.invocationId).toBe('inv-1');
    expect(result.model).toBe('gpt-5.4');
    expect(result.text).toBe('test response');
    expect(result.route.providerKind).toBe('codex');
    expect(result.route.strategy).toBe('fill-first');
    expect(result.usage.inputTokens).toBeGreaterThan(0);
    expect(result.usage.outputTokens).toBeGreaterThan(0);
    expect(result.usage.totalTokens).toBe(result.usage.inputTokens + result.usage.outputTokens);
  });

  it('invoke calculates usage from message text content length', async () => {
    const executor = new DeterministicOpenAICompatibleExecutor({
      now: () => now,
      responseText: 'abcd' // 4 chars = 1 token
    });

    const invocation = makeInvocation({
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'abcdefgh' }] } // 8 chars = 2 tokens
      ]
    });

    const result = await executor.invoke(invocation);
    expect(result.usage.inputTokens).toBe(2);
    expect(result.usage.outputTokens).toBe(1);
  });

  it('invoke calculates usage from image url content length', async () => {
    const executor = new DeterministicOpenAICompatibleExecutor({
      now: () => now,
      responseText: 'ok'
    });

    const invocation = makeInvocation({
      messages: [
        { role: 'user', content: [{ type: 'imageUrl', imageUrl: 'https://example.com/image.png' }] } // 32 chars
      ]
    });

    const result = await executor.invoke(invocation);
    expect(result.usage.inputTokens).toBe(Math.ceil(32 / 4));
  });

  it('invoke tracks activeRequests correctly', async () => {
    const executor = new DeterministicOpenAICompatibleExecutor({ now: () => now });
    const healthDuring = executor.health();
    expect((await healthDuring).activeRequests).toBe(0);

    await executor.invoke(makeInvocation());
    const healthAfter = await executor.health();
    expect(healthAfter.activeRequests).toBe(0);
  });

  it('stream yields delta, usage, and done events', async () => {
    const executor = new DeterministicOpenAICompatibleExecutor({
      now: () => now,
      responseText: 'stream test'
    });

    const events: unknown[] = [];
    for await (const event of executor.stream(makeInvocation())) {
      events.push(event);
    }

    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({ type: 'delta', sequence: 0, delta: { text: 'stream test' } });
    expect(events[1]).toMatchObject({ type: 'usage', sequence: 1 });
    expect(events[2]).toMatchObject({ type: 'done', sequence: 2 });
  });

  it('stream uses default responseText when none provided', async () => {
    const executor = new DeterministicOpenAICompatibleExecutor({ now: () => now });

    const events: unknown[] = [];
    for await (const event of executor.stream(makeInvocation())) {
      events.push(event);
    }

    expect(events[0]).toMatchObject({ delta: { text: 'deterministic executor response' } });
  });

  it('invoke handles messages with multiple content parts', async () => {
    const executor = new DeterministicOpenAICompatibleExecutor({
      now: () => now,
      responseText: 'ok'
    });

    const invocation = makeInvocation({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'hello' },
            { type: 'imageUrl', imageUrl: 'https://example.com/img.png' }
          ]
        }
      ]
    });

    const result = await executor.invoke(invocation);
    expect(result.usage.inputTokens).toBe(Math.ceil(('hello'.length + 'https://example.com/img.png'.length) / 4));
  });

  it('invoke handles empty messages array', async () => {
    const executor = new DeterministicOpenAICompatibleExecutor({ now: () => now });
    const result = await executor.invoke(makeInvocation({ messages: [] }));
    expect(result.usage.inputTokens).toBe(1); // Math.max(1, ...)
  });
});
