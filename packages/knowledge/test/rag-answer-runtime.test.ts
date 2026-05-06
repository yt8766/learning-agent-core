import { describe, expect, it, vi } from 'vitest';

import type { Citation, RetrievalHit } from '../src/contracts';
import {
  KnowledgeRagRunAnswerSchema,
  RagAnswerRuntime,
  type KnowledgeAnswerProvider,
  type KnowledgeAnswerProviderInput,
  type KnowledgePreRetrievalPlan,
  type KnowledgeRagRetrievalResult
} from '../src/rag';

function makePlan(overrides: Partial<KnowledgePreRetrievalPlan> = {}): KnowledgePreRetrievalPlan {
  return {
    id: 'plan-1',
    originalQuery: 'how does grounded answer runtime work',
    rewrittenQuery: 'grounded answer runtime behavior',
    queryVariants: ['grounded answer runtime behavior'],
    selectedKnowledgeBaseIds: ['kb-rag', 'kb-runtime'],
    searchMode: 'hybrid',
    selectionReason: 'The user asks about answer generation over retrieved evidence.',
    confidence: 0.92,
    fallbackPolicy: 'selected-only',
    routingDecisions: [],
    diagnostics: {
      planner: 'llm',
      consideredKnowledgeBaseCount: 2,
      rewriteApplied: true,
      fallbackApplied: false
    },
    ...overrides
  };
}

function makeCitation(overrides: Partial<Citation> = {}): Citation {
  const chunkId = overrides.chunkId ?? 'chunk-1';
  const sourceId = overrides.sourceId ?? 'source-1';

  return {
    ...overrides,
    sourceId,
    chunkId,
    title: overrides.title ?? 'Grounded Runtime Guide',
    uri: overrides.uri ?? '/grounded-runtime.md',
    sourceType: overrides.sourceType ?? 'repo-docs',
    trustClass: overrides.trustClass ?? 'internal'
  };
}

function makeHit(overrides: Partial<RetrievalHit> = {}): RetrievalHit {
  const citation = overrides.citation ?? makeCitation({ chunkId: overrides.chunkId, sourceId: overrides.sourceId });

  return {
    chunkId: citation.chunkId,
    documentId: overrides.documentId ?? 'doc-1',
    sourceId: citation.sourceId,
    knowledgeBaseId: overrides.knowledgeBaseId ?? 'kb-rag',
    title: citation.title,
    uri: citation.uri,
    sourceType: citation.sourceType,
    trustClass: citation.trustClass,
    content: overrides.content ?? 'Answers must be grounded in retrieval citations.',
    score: overrides.score ?? 0.87,
    citation,
    ...overrides
  };
}

function makeRetrievalResult(overrides: Partial<KnowledgeRagRetrievalResult> = {}): KnowledgeRagRetrievalResult {
  const hits = overrides.hits ?? [makeHit()];

  return {
    hits,
    total: overrides.total ?? hits.length,
    citations: overrides.citations ?? hits.map(hit => hit.citation),
    contextBundle:
      overrides.contextBundle ?? 'Grounded Runtime Guide\nAnswers must be grounded in retrieval citations.',
    diagnostics: overrides.diagnostics,
    ...overrides
  };
}

function makeProvider(
  generate: KnowledgeAnswerProvider['generate']
): KnowledgeAnswerProvider & { inputs: KnowledgeAnswerProviderInput[] } {
  const inputs: KnowledgeAnswerProviderInput[] = [];

  return {
    inputs,
    generate: vi.fn(async input => {
      inputs.push(input);
      return generate(input);
    })
  };
}

describe('RagAnswerRuntime', () => {
  it('generates a grounded answer with plan, context, citations, and routing metadata', async () => {
    const retrieval = makeRetrievalResult();
    const provider = makeProvider(async input => ({
      text: `Grounded answer for ${input.rewrittenQuery}.`,
      citations: input.citations
    }));
    const runtime = new RagAnswerRuntime({
      provider,
      noAnswerPolicy: {
        minHitCount: 1,
        allowAnswerWithoutCitation: false,
        responseStyle: 'explicit-insufficient-evidence'
      }
    });

    const answer = await runtime.generate(makePlan(), retrieval);

    expect(provider.generate).toHaveBeenCalledTimes(1);
    expect(provider.inputs[0]).toMatchObject({
      originalQuery: 'how does grounded answer runtime work',
      rewrittenQuery: 'grounded answer runtime behavior',
      contextBundle: retrieval.contextBundle,
      selectedKnowledgeBaseIds: ['kb-rag', 'kb-runtime'],
      metadata: {
        planId: 'plan-1',
        searchMode: 'hybrid',
        fallbackPolicy: 'selected-only'
      }
    });
    expect(provider.inputs[0]?.citations).toEqual(retrieval.citations);
    expect(answer).toMatchObject({
      text: 'Grounded answer for grounded answer runtime behavior.',
      noAnswer: false,
      citations: retrieval.citations
    });
    expect(KnowledgeRagRunAnswerSchema.parse(answer)).toMatchObject({ noAnswer: false });
  });

  it('returns no-answer without calling the provider when retrieval has no citations', async () => {
    const provider = makeProvider(async () => ({ text: 'should not be called' }));
    const runtime = new RagAnswerRuntime({ provider });

    const answer = await runtime.generate(
      makePlan(),
      makeRetrievalResult({
        hits: [makeHit()],
        citations: [],
        total: 1
      })
    );

    expect(provider.generate).not.toHaveBeenCalled();
    expect(answer).toMatchObject({
      noAnswer: true,
      citations: [],
      diagnostics: {
        groundedCitationCount: 0,
        noAnswerReason: 'missing_citations'
      }
    });
  });

  it('returns no-answer without calling the provider when minHitCount exceeds citation count', async () => {
    const provider = makeProvider(async () => ({ text: 'should not be called' }));
    const runtime = new RagAnswerRuntime({
      provider,
      noAnswerPolicy: {
        minHitCount: 2,
        allowAnswerWithoutCitation: false,
        responseStyle: 'explicit-insufficient-evidence'
      }
    });

    const answer = await runtime.generate(makePlan(), makeRetrievalResult());

    expect(provider.generate).not.toHaveBeenCalled();
    expect(answer).toMatchObject({
      noAnswer: true,
      citations: [],
      diagnostics: {
        groundedCitationCount: 1,
        noAnswerReason: 'insufficient_evidence'
      }
    });
  });

  it('returns low-confidence no-answer when top hit score is below policy threshold', async () => {
    const provider = makeProvider(async () => ({ text: 'should not be called' }));
    const runtime = new RagAnswerRuntime({
      provider,
      noAnswerPolicy: {
        minHitCount: 1,
        minTopScore: 0.75,
        allowAnswerWithoutCitation: false,
        responseStyle: 'explicit-insufficient-evidence'
      }
    });

    const answer = await runtime.generate(makePlan(), makeRetrievalResult({ hits: [makeHit({ score: 0.2 })] }));

    expect(provider.generate).not.toHaveBeenCalled();
    expect(answer).toMatchObject({
      noAnswer: true,
      diagnostics: {
        noAnswerReason: 'low_confidence'
      }
    });
  });

  it('uses no-answer responseStyle when returning insufficient evidence', async () => {
    const provider = makeProvider(async () => ({ text: 'should not be called' }));
    const runtime = new RagAnswerRuntime({
      provider,
      noAnswerPolicy: {
        minHitCount: 1,
        allowAnswerWithoutCitation: false,
        responseStyle: 'ask-clarifying-question'
      }
    });

    const answer = await runtime.generate(makePlan(), makeRetrievalResult({ hits: [], citations: [], total: 0 }));

    expect(answer).toMatchObject({
      noAnswer: true,
      text: '当前知识库依据不足。可以补充更具体的问题或指定要检索的知识库吗？'
    });
  });

  it('allows provider generation without citations when policy explicitly permits it', async () => {
    const provider = makeProvider(async () => ({ text: 'Allowed answer without citations.' }));
    const runtime = new RagAnswerRuntime({
      provider,
      noAnswerPolicy: {
        minHitCount: 1,
        allowAnswerWithoutCitation: true,
        responseStyle: 'explicit-insufficient-evidence'
      }
    });

    const answer = await runtime.generate(
      makePlan(),
      makeRetrievalResult({
        hits: [makeHit()],
        citations: [],
        total: 1
      })
    );

    expect(provider.generate).toHaveBeenCalledTimes(1);
    expect(answer).toMatchObject({
      noAnswer: false,
      citations: []
    });
  });

  it('returns no-answer when the provider returns blank text', async () => {
    const provider = makeProvider(async () => ({ text: '   ' }));
    const runtime = new RagAnswerRuntime({ provider });

    const answer = await runtime.generate(makePlan(), makeRetrievalResult());

    expect(provider.generate).toHaveBeenCalledTimes(1);
    expect(answer).toMatchObject({
      noAnswer: true,
      citations: [],
      diagnostics: {
        groundedCitationCount: 1,
        noAnswerReason: 'insufficient_evidence'
      }
    });
  });

  it('filters provider-injected citations to the retrieval citation set', async () => {
    const retrievalCitation = makeCitation({ chunkId: 'chunk-allowed', sourceId: 'source-allowed' });
    const injectedCitation = makeCitation({ chunkId: 'chunk-injected', sourceId: 'source-injected' });
    const retrieval = makeRetrievalResult({
      hits: [makeHit({ citation: retrievalCitation })],
      citations: [retrievalCitation]
    });
    const provider = makeProvider(async () => ({
      text: 'Only retrieval citations may survive.',
      citations: [injectedCitation, retrievalCitation]
    }));
    const runtime = new RagAnswerRuntime({ provider });

    const answer = await runtime.generate(makePlan(), retrieval);

    expect(answer).toMatchObject({
      noAnswer: false,
      citations: [retrievalCitation]
    });
  });

  it('returns no-answer when provider citations are all ungrounded and citations are required', async () => {
    const retrievalCitation = makeCitation({ chunkId: 'chunk-allowed', sourceId: 'source-allowed' });
    const injectedCitation = makeCitation({ chunkId: 'chunk-injected', sourceId: 'source-injected' });
    const retrieval = makeRetrievalResult({
      hits: [makeHit({ citation: retrievalCitation })],
      citations: [retrievalCitation]
    });
    const provider = makeProvider(async () => ({
      text: 'Ungrounded citation should not pass.',
      citations: [injectedCitation]
    }));
    const runtime = new RagAnswerRuntime({ provider });

    const answer = await runtime.generate(makePlan(), retrieval);

    expect(answer).toMatchObject({
      noAnswer: true,
      citations: [],
      diagnostics: {
        noAnswerReason: 'missing_citations'
      }
    });
  });

  it('propagates provider failures and invalid provider results', async () => {
    const throwingProvider = makeProvider(async () => {
      throw new Error('model unavailable');
    });
    const invalidProvider = makeProvider(async () => ({ text: 123 }) as never);

    await expect(
      new RagAnswerRuntime({ provider: throwingProvider }).generate(makePlan(), makeRetrievalResult())
    ).rejects.toThrow('model unavailable');
    await expect(
      new RagAnswerRuntime({ provider: invalidProvider }).generate(makePlan(), makeRetrievalResult())
    ).rejects.toThrow();
  });
});
