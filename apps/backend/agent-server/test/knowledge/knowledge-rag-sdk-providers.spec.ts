import { describe, expect, it, vi } from 'vitest';

import {
  createDeterministicKnowledgeRagPlannerProvider,
  createKnowledgeRagAnswerProvider,
  readKnowledgeRagAnswerProviderError
} from '../../src/domains/knowledge/rag/knowledge-rag-sdk.providers';
import type { KnowledgeSdkRuntimeProviderValue } from '../../src/domains/knowledge/runtime/knowledge-sdk-runtime.provider';

function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    originalQuery: 'what is the answer?',
    rewrittenQuery: 'what is the answer?',
    citations: [
      { title: 'Doc 1', quote: 'The answer is 42.', documentId: 'd1', chunkId: 'c1' },
      { title: 'Doc 2', quote: undefined, documentId: 'd2', chunkId: 'c2' }
    ],
    contextBundle: '',
    metadata: {},
    ...overrides
  } as any;
}

function makeDisabledSdkRuntime(): KnowledgeSdkRuntimeProviderValue {
  return { enabled: false } as any;
}

function makeEnabledSdkRuntime(overrides: Record<string, unknown> = {}): KnowledgeSdkRuntimeProviderValue {
  return {
    enabled: true,
    runtime: {
      chatProvider: {
        generate: vi.fn().mockResolvedValue({ text: 'generated answer', providerId: 'test', model: 'test-model' }),
        stream: vi.fn().mockReturnValue(
          (async function* () {
            yield { type: 'delta', text: 'streamed ' };
            yield { type: 'delta', text: 'answer' };
            yield { type: 'done', result: { text: 'streamed answer', providerId: 'test', model: 'test-model' } };
          })()
        ),
        ...overrides
      }
    }
  } as any;
}

describe('createDeterministicKnowledgeRagPlannerProvider', () => {
  it('selects all accessible knowledge bases when no preferred IDs set', async () => {
    const provider = createDeterministicKnowledgeRagPlannerProvider();
    const result = await provider.plan({
      query: 'test query',
      accessibleKnowledgeBases: [
        { id: 'kb1', name: 'KB 1' },
        { id: 'kb2', name: 'KB 2' }
      ],
      policy: { defaultSearchMode: 'hybrid' }
    } as any);

    expect(result.selectedKnowledgeBaseIds).toEqual(['kb1', 'kb2']);
    expect(result.queryVariants).toEqual(['test query']);
    expect(result.searchMode).toBe('hybrid');
    expect(result.confidence).toBe(1);
    expect(result.selectionReason).toContain('deterministic planner fallback');
  });

  it('selects only preferred knowledge bases when set', async () => {
    const provider = createDeterministicKnowledgeRagPlannerProvider({
      preferredKnowledgeBaseIds: ['kb1']
    });
    const result = await provider.plan({
      query: 'test query',
      accessibleKnowledgeBases: [
        { id: 'kb1', name: 'KB 1' },
        { id: 'kb2', name: 'KB 2' }
      ],
      policy: { defaultSearchMode: 'vector' }
    } as any);

    expect(result.selectedKnowledgeBaseIds).toEqual(['kb1']);
    expect(result.selectionReason).toContain('explicit route constraints');
  });

  it('produces routing decisions for all accessible knowledge bases', async () => {
    const provider = createDeterministicKnowledgeRagPlannerProvider({
      preferredKnowledgeBaseIds: ['kb1']
    });
    const result = await provider.plan({
      query: 'test',
      accessibleKnowledgeBases: [
        { id: 'kb1', name: 'KB 1' },
        { id: 'kb2', name: 'KB 2' }
      ],
      policy: { defaultSearchMode: 'hybrid' }
    } as any);

    expect(result.routingDecisions).toHaveLength(2);
    expect(result.routingDecisions[0]).toMatchObject({
      knowledgeBaseId: 'kb1',
      selected: true,
      source: 'deterministic'
    });
    expect(result.routingDecisions[1]).toMatchObject({
      knowledgeBaseId: 'kb2',
      selected: false,
      source: 'deterministic'
    });
  });

  it('selects empty when preferred IDs do not match any accessible bases', async () => {
    const provider = createDeterministicKnowledgeRagPlannerProvider({
      preferredKnowledgeBaseIds: ['kb-nonexistent']
    });
    const result = await provider.plan({
      query: 'test',
      accessibleKnowledgeBases: [{ id: 'kb1', name: 'KB 1' }],
      policy: { defaultSearchMode: 'hybrid' }
    } as any);

    expect(result.selectedKnowledgeBaseIds).toEqual([]);
  });
});

describe('createKnowledgeRagAnswerProvider', () => {
  describe('when SDK runtime is disabled', () => {
    it('returns citation quotes joined by newlines', async () => {
      const provider = createKnowledgeRagAnswerProvider(makeDisabledSdkRuntime());
      const result = await provider.generate(makeInput());

      expect(result.text).toBe('The answer is 42.');
      expect(result.citations).toHaveLength(2);
    });

    it('returns empty string when all citations have undefined quotes (filtered out by isPresent)', async () => {
      const provider = createKnowledgeRagAnswerProvider(makeDisabledSdkRuntime());
      const result = await provider.generate(
        makeInput({
          citations: [{ title: 'Doc 1', quote: undefined, documentId: 'd1', chunkId: 'c1' }]
        })
      );

      // quote is undefined so isPresent filters it; empty array join yields ''
      expect(result.text).toBe('');
    });

    it('returns fallback text when citations are empty', async () => {
      const provider = createKnowledgeRagAnswerProvider(makeDisabledSdkRuntime());
      const result = await provider.generate(makeInput({ citations: [] }));

      expect(result.text).toBe('未在当前知识库中找到足够依据。');
    });

    it('filters out citations with empty string quotes', async () => {
      const provider = createKnowledgeRagAnswerProvider(makeDisabledSdkRuntime());
      const result = await provider.generate(
        makeInput({
          citations: [
            { title: 'Doc 1', quote: '', documentId: 'd1', chunkId: 'c1' },
            { title: 'Doc 2', quote: 'valid quote', documentId: 'd2', chunkId: 'c2' }
          ]
        })
      );

      expect(result.text).toBe('valid quote');
    });
  });

  describe('when SDK runtime is enabled', () => {
    it('generates answer using chat provider', async () => {
      const sdkRuntime = makeEnabledSdkRuntime();
      const provider = createKnowledgeRagAnswerProvider(sdkRuntime);

      const result = await provider.generate(makeInput());

      expect(result.text).toBe('generated answer');
      expect(result.metadata).toEqual({ provider: 'test', model: 'test-model' });
    });

    it('uses contextBundle when provided', async () => {
      const sdkRuntime = makeEnabledSdkRuntime();
      const provider = createKnowledgeRagAnswerProvider(sdkRuntime);
      await provider.generate(makeInput({ contextBundle: 'custom context' }));

      const generateCall = (sdkRuntime.runtime.chatProvider.generate as any).mock.calls[0][0];
      const systemMessages = generateCall.messages.filter((m: any) => m.role === 'system');
      const devMessage = systemMessages.find((m: any) => m.name === 'developer');
      expect(devMessage.content).toContain('custom context');
    });

    it('falls back to citation context when contextBundle is empty', async () => {
      const sdkRuntime = makeEnabledSdkRuntime();
      const provider = createKnowledgeRagAnswerProvider(sdkRuntime);
      await provider.generate(makeInput({ contextBundle: '' }));

      const generateCall = (sdkRuntime.runtime.chatProvider.generate as any).mock.calls[0][0];
      const systemMessages = generateCall.messages.filter((m: any) => m.role === 'system');
      const devMessage = systemMessages.find((m: any) => m.name === 'developer');
      expect(devMessage.content).toContain('[1]');
    });

    it('includes model in generate call when answerModelId is set', async () => {
      const sdkRuntime = makeEnabledSdkRuntime();
      const provider = createKnowledgeRagAnswerProvider(sdkRuntime, { answerModelId: 'custom-model' });
      await provider.generate(makeInput());

      const generateCall = (sdkRuntime.runtime.chatProvider.generate as any).mock.calls[0][0];
      expect(generateCall.model).toBe('custom-model');
    });

    it('omits model from generate call when answerModelId is not set', async () => {
      const sdkRuntime = makeEnabledSdkRuntime();
      const provider = createKnowledgeRagAnswerProvider(sdkRuntime);
      await provider.generate(makeInput());

      const generateCall = (sdkRuntime.runtime.chatProvider.generate as any).mock.calls[0][0];
      expect(generateCall.model).toBeUndefined();
    });

    it('handles chat provider failure gracefully', async () => {
      const sdkRuntime = makeEnabledSdkRuntime({
        generate: vi.fn().mockRejectedValue(new Error('API error'))
      });
      const provider = createKnowledgeRagAnswerProvider(sdkRuntime);

      const result = await provider.generate(makeInput());
      expect(result.text).toBe('Knowledge answer provider failed.');
      expect(readKnowledgeRagAnswerProviderError(provider)?.message).toBe('API error');
    });

    it('handles non-Error thrown by chat provider', async () => {
      const sdkRuntime = makeEnabledSdkRuntime({
        generate: vi.fn().mockRejectedValue('string error')
      });
      const provider = createKnowledgeRagAnswerProvider(sdkRuntime);

      const result = await provider.generate(makeInput());
      expect(result.text).toBe('Knowledge answer provider failed.');
      expect(readKnowledgeRagAnswerProviderError(provider)?.message).toBe('string error');
    });

    it('handles empty string rejection from chat provider', async () => {
      const sdkRuntime = makeEnabledSdkRuntime({
        generate: vi.fn().mockRejectedValue('')
      });
      const provider = createKnowledgeRagAnswerProvider(sdkRuntime);

      await provider.generate(makeInput());
      expect(readKnowledgeRagAnswerProviderError(provider)?.message).toBe('Knowledge answer provider failed.');
    });

    it('stream yields delta and done events', async () => {
      const sdkRuntime = makeEnabledSdkRuntime();
      const provider = createKnowledgeRagAnswerProvider(sdkRuntime);
      const events: unknown[] = [];

      for await (const event of provider.stream!(makeInput())) {
        events.push(event);
      }

      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events[0]).toMatchObject({ textDelta: 'streamed ' });
    });

    it('stream handles done event with result', async () => {
      const sdkRuntime = makeEnabledSdkRuntime();
      const provider = createKnowledgeRagAnswerProvider(sdkRuntime);
      const events: unknown[] = [];

      for await (const event of provider.stream!(makeInput())) {
        events.push(event);
      }

      const doneEvent = events.find((e: any) => e.result);
      expect(doneEvent).toMatchObject({
        result: expect.objectContaining({ text: 'streamed answer' })
      });
    });

    it('stream handles done event with only metadata (no result)', async () => {
      const sdkRuntime = makeEnabledSdkRuntime({
        stream: vi.fn().mockReturnValue(
          (async function* () {
            yield { type: 'delta', text: 'partial' };
            yield { type: 'done', metadata: { key: 'value' } };
          })()
        )
      });
      const provider = createKnowledgeRagAnswerProvider(sdkRuntime);
      const events: unknown[] = [];

      for await (const event of provider.stream!(makeInput())) {
        events.push(event);
      }

      expect(events.length).toBeGreaterThanOrEqual(2);
    });

    it('stream handles done event with result and no metadata', async () => {
      const sdkRuntime = makeEnabledSdkRuntime({
        stream: vi.fn().mockReturnValue(
          (async function* () {
            yield { type: 'delta', text: 'partial' };
            yield { type: 'done', result: { text: 'final' } };
          })()
        )
      });
      const provider = createKnowledgeRagAnswerProvider(sdkRuntime);
      const events: unknown[] = [];

      for await (const event of provider.stream!(makeInput())) {
        events.push(event);
      }

      const doneEvent = events.find((e: any) => e.result);
      expect(doneEvent).toBeDefined();
    });

    it('stream re-throws errors and stores them', async () => {
      const sdkRuntime = makeEnabledSdkRuntime({
        stream: vi.fn().mockReturnValue(
          (async function* () {
            yield { type: 'delta', text: 'partial' };
            throw new Error('stream error');
          })()
        )
      });
      const provider = createKnowledgeRagAnswerProvider(sdkRuntime);

      const events: unknown[] = [];
      await expect(async () => {
        for await (const event of provider.stream!(makeInput())) {
          events.push(event);
        }
      }).rejects.toThrow('stream error');

      expect(readKnowledgeRagAnswerProviderError(provider)?.message).toBe('stream error');
    });

    it('stream does not exist when chatProvider has no stream method', () => {
      const sdkRuntime: KnowledgeSdkRuntimeProviderValue = {
        enabled: true,
        runtime: {
          chatProvider: {
            generate: vi.fn().mockResolvedValue({ text: 'ok' })
          }
        }
      } as any;

      const provider = createKnowledgeRagAnswerProvider(sdkRuntime);
      expect(provider.stream).toBeUndefined();
    });

    it('uses rewrittenQuery in messages', async () => {
      const sdkRuntime = makeEnabledSdkRuntime();
      const provider = createKnowledgeRagAnswerProvider(sdkRuntime);
      await provider.generate(makeInput({ originalQuery: 'original', rewrittenQuery: 'rewritten' }));

      const generateCall = (sdkRuntime.runtime.chatProvider.generate as any).mock.calls[0][0];
      const userMessage = generateCall.messages.find((m: any) => m.role === 'user');
      expect(userMessage.content).toBe('rewritten');
    });

    it('falls back to originalQuery when rewrittenQuery is empty', async () => {
      const sdkRuntime = makeEnabledSdkRuntime();
      const provider = createKnowledgeRagAnswerProvider(sdkRuntime);
      await provider.generate(makeInput({ originalQuery: 'original', rewrittenQuery: '' }));

      const generateCall = (sdkRuntime.runtime.chatProvider.generate as any).mock.calls[0][0];
      const userMessage = generateCall.messages.find((m: any) => m.role === 'user');
      expect(userMessage.content).toBe('original');
    });

    it('clears lastError on successful generate', async () => {
      const sdkRuntime = makeEnabledSdkRuntime({
        generate: vi
          .fn()
          .mockRejectedValueOnce(new Error('first error'))
          .mockResolvedValueOnce({ text: 'recovered', providerId: 'test', model: 'test-model' })
      });
      const provider = createKnowledgeRagAnswerProvider(sdkRuntime);

      await provider.generate(makeInput());
      expect(readKnowledgeRagAnswerProviderError(provider)?.message).toBe('first error');

      await provider.generate(makeInput());
      expect(readKnowledgeRagAnswerProviderError(provider)).toBeUndefined();
    });
  });
});

describe('readKnowledgeRagAnswerProviderError', () => {
  it('returns undefined for provider without getLastError', () => {
    const provider = { generate: async () => ({ text: '', citations: [] }) } as any;
    expect(readKnowledgeRagAnswerProviderError(provider)).toBeUndefined();
  });

  it('returns error from provider with getLastError', async () => {
    const sdkRuntime = makeEnabledSdkRuntime({
      generate: vi.fn().mockRejectedValue(new Error('test error'))
    });
    const provider = createKnowledgeRagAnswerProvider(sdkRuntime);
    await provider.generate(makeInput());

    expect(readKnowledgeRagAnswerProviderError(provider)?.message).toBe('test error');
  });
});
