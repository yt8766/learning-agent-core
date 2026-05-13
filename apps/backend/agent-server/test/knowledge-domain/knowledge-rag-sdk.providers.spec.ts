import { describe, expect, it, vi } from 'vitest';

import {
  createDeterministicKnowledgeRagPlannerProvider,
  createKnowledgeRagAnswerProvider,
  readKnowledgeRagAnswerProviderError
} from '../../src/domains/knowledge/rag/knowledge-rag-sdk.providers';
import type { KnowledgeSdkRuntimeProviderValue } from '../../src/domains/knowledge/runtime/knowledge-sdk-runtime.provider';

describe('knowledge RAG SDK providers', () => {
  it('keeps deterministic planning inside explicit accessible base constraints', async () => {
    const planner = createDeterministicKnowledgeRagPlannerProvider({
      preferredKnowledgeBaseIds: ['kb_allowed', 'kb_missing']
    });

    await expect(
      planner.plan({
        query: 'release checklist',
        accessibleKnowledgeBases: [
          { id: 'kb_allowed', name: 'Allowed', documentCount: 1, updatedAt: '2026-05-07T00:00:00.000Z' },
          { id: 'kb_other', name: 'Other', documentCount: 1, updatedAt: '2026-05-07T00:00:00.000Z' }
        ],
        policy: {
          maxSelectedKnowledgeBases: 5,
          minPlannerConfidence: 0.5,
          defaultSearchMode: 'hybrid',
          fallbackWhenPlannerFails: 'search-all-accessible',
          fallbackWhenLowConfidence: 'search-all-accessible',
          maxQueryVariants: 3,
          retrievalTopK: 5,
          contextBudgetTokens: 4000,
          requireGroundedCitations: true,
          noAnswer: {
            minHitCount: 1,
            allowAnswerWithoutCitation: false,
            responseStyle: 'explicit-insufficient-evidence'
          }
        },
        metadata: {}
      })
    ).resolves.toMatchObject({
      selectedKnowledgeBaseIds: ['kb_allowed'],
      queryVariants: ['release checklist'],
      confidence: 1
    });
  });

  it('selects all accessible bases when no preferredKnowledgeBaseIds', async () => {
    const planner = createDeterministicKnowledgeRagPlannerProvider();

    const result = await planner.plan({
      query: 'test query',
      accessibleKnowledgeBases: [{ id: 'kb-1' }, { id: 'kb-2' }],
      policy: { defaultSearchMode: 'hybrid' }
    } as any);

    expect(result.selectedKnowledgeBaseIds).toEqual(['kb-1', 'kb-2']);
    expect(result.selectionReason).toContain('all accessible');
  });

  it('includes routing decisions for all accessible bases', async () => {
    const planner = createDeterministicKnowledgeRagPlannerProvider();

    const result = await planner.plan({
      query: 'test',
      accessibleKnowledgeBases: [{ id: 'kb-1' }, { id: 'kb-2' }],
      policy: { defaultSearchMode: 'hybrid' }
    } as any);

    expect(result.routingDecisions).toHaveLength(2);
    expect(result.routingDecisions[0].selected).toBe(true);
    expect(result.routingDecisions[1].selected).toBe(true);
  });

  it('marks unselected bases with proper reason', async () => {
    const planner = createDeterministicKnowledgeRagPlannerProvider({
      preferredKnowledgeBaseIds: ['kb-1']
    });

    const result = await planner.plan({
      query: 'test',
      accessibleKnowledgeBases: [{ id: 'kb-1' }, { id: 'kb-2' }],
      policy: { defaultSearchMode: 'hybrid' }
    } as any);

    expect(result.routingDecisions[1].selected).toBe(false);
    expect(result.routingDecisions[1].reason).toContain('Not selected');
  });

  it('records SDK answer provider failures without leaking vendor errors as successful answers', async () => {
    const runtime = enabledRuntime({
      generate: vi.fn(async () => {
        throw new Error('llm unavailable');
      })
    });
    const provider = createKnowledgeRagAnswerProvider(runtime, { answerModelId: 'answer-model' });

    await expect(
      provider.generate({
        originalQuery: 'release checklist',
        rewrittenQuery: 'release checklist',
        citations: [{ sourceId: 'doc_1', chunkId: 'chunk_1', title: 'Runbook', quote: 'Rollback plan' }],
        metadata: { traceId: 'trace_1' }
      })
    ).resolves.toMatchObject({
      text: 'Knowledge answer provider failed.',
      citations: [{ sourceId: 'doc_1', chunkId: 'chunk_1', title: 'Runbook', quote: 'Rollback plan' }]
    });
    expect(readKnowledgeRagAnswerProviderError(provider)).toMatchObject({ message: 'llm unavailable' });
  });

  it('handles non-Error thrown from chatProvider', async () => {
    const runtime = enabledRuntime({
      generate: vi.fn(async () => {
        throw 'string error';
      })
    });
    const provider = createKnowledgeRagAnswerProvider(runtime);

    await provider.generate({
      originalQuery: 'test',
      citations: []
    } as any);

    const error = provider.getLastError?.();
    expect(error).toBeInstanceOf(Error);
  });

  it('handles empty string error thrown from chatProvider', async () => {
    const runtime = enabledRuntime({
      generate: vi.fn(async () => {
        throw '';
      })
    });
    const provider = createKnowledgeRagAnswerProvider(runtime);

    await provider.generate({
      originalQuery: 'test',
      citations: []
    } as any);

    const error = provider.getLastError?.();
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe('Knowledge answer provider failed.');
  });

  it('uses assembled contextBundle when generating SDK RAG answers', async () => {
    const capturedMessages: Array<{ role: string; content: string; name?: string }> = [];
    const runtime = enabledRuntime({
      generate: vi.fn(async input => {
        const messages = (input as { messages: typeof capturedMessages }).messages;
        capturedMessages.push(...messages);
        return { text: 'answer from assembled context', providerId: 'test', model: 'test-model' };
      })
    });
    const provider = createKnowledgeRagAnswerProvider(runtime);

    await provider.generate({
      originalQuery: 'question',
      rewrittenQuery: 'question',
      contextBundle: '[1] Assembled\nThis text only exists in contextBundle.',
      citations: [
        {
          sourceId: 'source',
          chunkId: 'chunk',
          title: 'Citation title',
          quote: 'citation quote should not replace bundle'
        }
      ],
      metadata: {}
    });

    const developerMessage = capturedMessages.find(message => message.name === 'developer');
    expect(developerMessage?.content).toContain('This text only exists in contextBundle.');
    expect(developerMessage?.content).not.toContain('Context citations:');
  });

  it('falls back to citations when assembled contextBundle is blank', async () => {
    const capturedMessages: Array<{ role: string; content: string; name?: string }> = [];
    const runtime = enabledRuntime({
      generate: vi.fn(async input => {
        const messages = (input as { messages: typeof capturedMessages }).messages;
        capturedMessages.push(...messages);
        return { text: 'answer from citations', providerId: 'test', model: 'test-model' };
      })
    });
    const provider = createKnowledgeRagAnswerProvider(runtime);

    await provider.generate({
      originalQuery: 'question',
      rewrittenQuery: 'question',
      contextBundle: '   ',
      citations: [
        {
          sourceId: 'source',
          chunkId: 'chunk',
          title: 'Citation title',
          quote: 'citation quote is fallback context'
        }
      ],
      metadata: {}
    });

    const developerMessage = capturedMessages.find(message => message.name === 'developer');
    expect(developerMessage?.content).toContain('citation quote is fallback context');
  });

  it('falls back to grounded citation text when SDK runtime is disabled', async () => {
    const provider = createKnowledgeRagAnswerProvider({
      enabled: false,
      reason: 'missing_env',
      missingEnv: ['DATABASE_URL', 'KNOWLEDGE_CHAT_MODEL', 'KNOWLEDGE_EMBEDDING_MODEL', 'KNOWLEDGE_LLM_API_KEY'],
      runtime: null
    });

    await expect(
      provider.generate({
        originalQuery: 'release checklist',
        rewrittenQuery: 'release checklist',
        citations: [
          { sourceId: 'doc_1', chunkId: 'chunk_1', title: 'Runbook', quote: 'Rollback plan' },
          { sourceId: 'doc_2', chunkId: 'chunk_2', title: 'Runbook', quote: 'Verify health endpoint' }
        ],
        metadata: {}
      })
    ).resolves.toMatchObject({
      text: 'Rollback plan\n\nVerify health endpoint'
    });
  });

  it('returns no-answer message when SDK disabled and no citations', async () => {
    const provider = createKnowledgeRagAnswerProvider({ enabled: false } as any);

    const result = await provider.generate({
      originalQuery: 'test',
      citations: []
    } as any);

    expect(result.text).toContain('未在当前知识库中找到足够依据');
  });

  it('includes provider metadata from generate result', async () => {
    const runtime = enabledRuntime({
      generate: vi.fn(async () => ({ text: 'answer', providerId: 'openai', model: 'gpt-4' }))
    });
    const provider = createKnowledgeRagAnswerProvider(runtime);

    const result = await provider.generate({
      originalQuery: 'test',
      citations: [],
      metadata: {}
    } as any);

    expect(result.metadata).toEqual({ provider: 'openai', model: 'gpt-4' });
  });

  it('omits metadata keys when generate returns empty values', async () => {
    const runtime = enabledRuntime({
      generate: vi.fn(async () => ({ text: 'answer' }))
    });
    const provider = createKnowledgeRagAnswerProvider(runtime);

    const result = await provider.generate({
      originalQuery: 'test',
      citations: [],
      metadata: {}
    } as any);

    expect(result.metadata).toEqual({});
  });

  it('streams delta and done events from enabled runtime', async () => {
    async function* mockStream() {
      yield { type: 'delta', text: 'Hello ' };
      yield { type: 'delta', text: 'world' };
      yield { type: 'done', result: { text: 'Hello world', providerId: 'test', model: 'test-model' } };
    }
    const runtime = enabledRuntime({});
    (runtime as any).runtime.chatProvider.stream = mockStream;
    const provider = createKnowledgeRagAnswerProvider(runtime);

    const events: unknown[] = [];
    for await (const event of provider.stream!({
      originalQuery: 'test',
      rewrittenQuery: 'test',
      citations: [],
      metadata: {}
    } as any)) {
      events.push(event);
    }

    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({ textDelta: 'Hello ' });
    expect(events[1]).toMatchObject({ textDelta: 'world' });
    expect(events[2]).toMatchObject({
      result: { text: 'Hello world', citations: [] }
    });
  });

  it('streams done event without result but with metadata', async () => {
    async function* mockStream() {
      yield { type: 'done', metadata: { model: 'test-model' } };
    }
    const runtime = enabledRuntime({});
    (runtime as any).runtime.chatProvider.stream = mockStream;
    const provider = createKnowledgeRagAnswerProvider(runtime);

    const events: unknown[] = [];
    for await (const event of provider.stream!({
      originalQuery: 'test',
      citations: [],
      metadata: {}
    } as any)) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ metadata: { model: 'test-model' } });
  });

  it('streams error from chat provider stream', async () => {
    async function* mockStream() {
      yield { type: 'delta', text: 'partial' };
      throw new Error('stream error');
    }
    const runtime = enabledRuntime({});
    (runtime as any).runtime.chatProvider.stream = mockStream;
    const provider = createKnowledgeRagAnswerProvider(runtime);

    const events: unknown[] = [];
    await expect(async () => {
      for await (const event of provider.stream!({
        originalQuery: 'test',
        citations: [],
        metadata: {}
      } as any)) {
        events.push(event);
      }
    }).rejects.toThrow('stream error');

    expect(provider.getLastError?.()?.message).toBe('stream error');
  });

  it('ignores non-delta non-done stream events', async () => {
    async function* mockStream() {
      yield { type: 'other', text: 'ignored' };
      yield { type: 'done', result: { text: 'final' } };
    }
    const runtime = enabledRuntime({});
    (runtime as any).runtime.chatProvider.stream = mockStream;
    const provider = createKnowledgeRagAnswerProvider(runtime);

    const events: unknown[] = [];
    for await (const event of provider.stream!({
      originalQuery: 'test',
      citations: [],
      metadata: {}
    } as any)) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ result: { text: 'final' } });
  });

  it('handles stream delta with metadata', async () => {
    async function* mockStream() {
      yield { type: 'delta', text: 'chunk', metadata: { score: 0.9 } };
      yield { type: 'done', result: { text: 'chunk' } };
    }
    const runtime = enabledRuntime({});
    (runtime as any).runtime.chatProvider.stream = mockStream;
    const provider = createKnowledgeRagAnswerProvider(runtime);

    const events: unknown[] = [];
    for await (const event of provider.stream!({
      originalQuery: 'test',
      citations: [],
      metadata: {}
    } as any)) {
      events.push(event);
    }

    expect(events[0]).toMatchObject({ textDelta: 'chunk', metadata: { score: 0.9 } });
  });

  it('uses answerModelId in stream call', async () => {
    const capturedInputs: unknown[] = [];
    async function* mockStream(input: unknown) {
      capturedInputs.push(input);
      yield { type: 'done', result: { text: 'done' } };
    }
    const runtime = enabledRuntime({});
    (runtime as any).runtime.chatProvider.stream = mockStream;
    const provider = createKnowledgeRagAnswerProvider(runtime, { answerModelId: 'stream-model' });

    const events: unknown[] = [];
    for await (const event of provider.stream!({
      originalQuery: 'test',
      citations: [],
      metadata: {}
    } as any)) {
      events.push(event);
    }

    expect(capturedInputs[0]).toMatchObject({ model: 'stream-model' });
  });

  it('handles non-Error thrown from stream', async () => {
    async function* mockStream() {
      if (Date.now() < 0) yield { type: 'noop' };
      throw 'string stream error';
    }
    const runtime = enabledRuntime({});
    (runtime as any).runtime.chatProvider.stream = mockStream;
    const provider = createKnowledgeRagAnswerProvider(runtime);

    await expect(async () => {
      for await (const _event of provider.stream!({
        originalQuery: 'test',
        citations: [],
        metadata: {}
      } as any)) {
        // consume
      }
    }).rejects.toThrow();

    expect(provider.getLastError?.()).toBeInstanceOf(Error);
  });

  it('handles empty string error thrown from stream', async () => {
    async function* mockStream() {
      if (Date.now() < 0) yield { type: 'noop' };
      throw '';
    }
    const runtime = enabledRuntime({});
    (runtime as any).runtime.chatProvider.stream = mockStream;
    const provider = createKnowledgeRagAnswerProvider(runtime);

    await expect(async () => {
      for await (const _event of provider.stream!({
        originalQuery: 'test',
        citations: [],
        metadata: {}
      } as any)) {
        // consume
      }
    }).rejects.toThrow('Knowledge answer provider failed.');
  });

  it('returns empty metadata when generate returns no providerId or model', async () => {
    const runtime = enabledRuntime({
      generate: vi.fn(async () => ({ text: 'answer', providerId: '', model: '' }))
    });
    const provider = createKnowledgeRagAnswerProvider(runtime);

    const result = await provider.generate({
      originalQuery: 'test',
      citations: [],
      metadata: {}
    } as any);

    expect(result.metadata).toEqual({});
  });

  it('filters undefined quote from citation context', async () => {
    const capturedMessages: Array<{ role: string; content: string; name?: string }> = [];
    const runtime = enabledRuntime({
      generate: vi.fn(async input => {
        const messages = (input as { messages: typeof capturedMessages }).messages;
        capturedMessages.push(...messages);
        return { text: 'answer' };
      })
    });
    const provider = createKnowledgeRagAnswerProvider(runtime);

    await provider.generate({
      originalQuery: 'test',
      rewrittenQuery: 'test',
      citations: [{ sourceId: 's1', chunkId: 'c1', title: 'Title' }],
      metadata: {}
    });

    const devMsg = capturedMessages.find(m => m.name === 'developer');
    expect(devMsg?.content).toContain('Title');
  });

  it('returns empty context message when no citations and no bundle', async () => {
    const capturedMessages: Array<{ role: string; content: string; name?: string }> = [];
    const runtime = enabledRuntime({
      generate: vi.fn(async input => {
        const messages = (input as { messages: typeof capturedMessages }).messages;
        capturedMessages.push(...messages);
        return { text: 'answer' };
      })
    });
    const provider = createKnowledgeRagAnswerProvider(runtime);

    await provider.generate({
      originalQuery: 'test',
      rewrittenQuery: 'test',
      citations: [],
      metadata: {}
    });

    const devMsg = capturedMessages.find(m => m.name === 'developer');
    expect(devMsg?.content).toContain('未检索到可引用片段');
  });
});

describe('readKnowledgeRagAnswerProviderError', () => {
  it('returns undefined when provider has no getLastError', () => {
    const provider = { generate: vi.fn() } as any;
    expect(readKnowledgeRagAnswerProviderError(provider)).toBeUndefined();
  });

  it('returns error from getLastError when available', () => {
    const error = new Error('test error');
    const provider = { generate: vi.fn(), getLastError: () => error } as any;
    expect(readKnowledgeRagAnswerProviderError(provider)).toBe(error);
  });
});

function enabledRuntime(input: {
  generate?: (input: unknown) => Promise<{ text: string; model?: string; providerId?: string }>;
}): Extract<KnowledgeSdkRuntimeProviderValue, { enabled: true }> {
  return {
    enabled: true,
    runtime: {
      chatProvider: {
        providerId: 'fake',
        defaultModel: 'fake-chat',
        generate: input.generate ?? (async () => ({ text: 'answer', model: 'fake-chat', providerId: 'fake' }))
      },
      embeddingProvider: {
        providerId: 'fake',
        defaultModel: 'fake-embedding',
        embedText: async () => ({ embedding: [1, 2] })
      },
      vectorStore: {
        search: async () => ({ hits: [] })
      }
    }
  };
}
