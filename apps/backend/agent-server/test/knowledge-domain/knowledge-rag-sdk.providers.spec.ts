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
