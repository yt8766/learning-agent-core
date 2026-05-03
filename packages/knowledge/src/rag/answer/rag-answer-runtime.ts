import type { Citation } from '../../contracts';
import type { KnowledgeAnswerProvider } from '../providers';
import { KnowledgeAnswerProviderInputSchema, KnowledgeAnswerProviderResultSchema } from '../providers';
import type {
  KnowledgeNoAnswerPolicy,
  KnowledgePreRetrievalPlan,
  KnowledgeRagNoAnswerReason,
  KnowledgeRagRetrievalResult,
  KnowledgeRagRunAnswer
} from '../schemas';
import { KnowledgeRagRunAnswerSchema } from '../schemas';

export interface RagAnswerRuntimeOptions {
  provider: KnowledgeAnswerProvider;
  noAnswerPolicy?: Partial<KnowledgeNoAnswerPolicy>;
}

export interface RagAnswerRunOptions {
  noAnswerPolicy?: Partial<KnowledgeNoAnswerPolicy>;
  metadata?: Record<string, string | number | boolean | null>;
}

const DEFAULT_NO_ANSWER_POLICY: KnowledgeNoAnswerPolicy = {
  minHitCount: 1,
  allowAnswerWithoutCitation: false,
  responseStyle: 'explicit-insufficient-evidence'
};

const DEFAULT_NO_ANSWER_TEXT = '未在当前知识库中找到足够依据。';

export class RagAnswerRuntime {
  private readonly provider: KnowledgeAnswerProvider;
  private readonly noAnswerPolicy: KnowledgeNoAnswerPolicy;

  constructor(options: RagAnswerRuntimeOptions) {
    this.provider = options.provider;
    this.noAnswerPolicy = normalizeNoAnswerPolicy(options.noAnswerPolicy);
  }

  async generate(
    plan: KnowledgePreRetrievalPlan,
    retrieval: KnowledgeRagRetrievalResult,
    options: RagAnswerRunOptions = {}
  ): Promise<KnowledgeRagRunAnswer> {
    const startedAt = Date.now();
    const noAnswerPolicy = normalizeNoAnswerPolicy({
      ...this.noAnswerPolicy,
      ...(options.noAnswerPolicy ?? {})
    });
    const preflightReason = getPreflightNoAnswerReason(retrieval, noAnswerPolicy);

    if (preflightReason) {
      return buildNoAnswer(startedAt, getGroundedCitationCount(retrieval), preflightReason, noAnswerPolicy);
    }

    const input = KnowledgeAnswerProviderInputSchema.parse({
      originalQuery: plan.originalQuery,
      rewrittenQuery: getRewrittenQuery(plan),
      contextBundle: retrieval.contextBundle ?? '',
      citations: retrieval.citations,
      selectedKnowledgeBaseIds: plan.selectedKnowledgeBaseIds,
      metadata: {
        planId: plan.id,
        searchMode: plan.searchMode,
        fallbackPolicy: plan.fallbackPolicy,
        selectedKnowledgeBaseIds: plan.selectedKnowledgeBaseIds,
        retrievalTotal: retrieval.total,
        hitCount: retrieval.hits.length,
        citationCount: retrieval.citations.length,
        ...(options.metadata ? { extra: options.metadata } : {})
      }
    });
    const providerResult = await this.generateWithProvider(input);
    if (!providerResult) {
      return buildNoAnswer(startedAt, getGroundedCitationCount(retrieval), 'insufficient_evidence', noAnswerPolicy);
    }
    const text = providerResult.text.trim();

    if (!text) {
      return buildNoAnswer(startedAt, getGroundedCitationCount(retrieval), 'insufficient_evidence', noAnswerPolicy);
    }
    const citations = filterGroundedCitations(providerResult.citations ?? retrieval.citations, retrieval.citations);

    if (!noAnswerPolicy.allowAnswerWithoutCitation && citations.length === 0) {
      return buildNoAnswer(startedAt, getGroundedCitationCount(retrieval), 'missing_citations', noAnswerPolicy);
    }

    return KnowledgeRagRunAnswerSchema.parse({
      text,
      noAnswer: false,
      citations,
      diagnostics: {
        durationMs: Date.now() - startedAt,
        groundedCitationCount: retrieval.citations.length
      }
    });
  }

  private async generateWithProvider(
    input: ReturnType<typeof KnowledgeAnswerProviderInputSchema.parse>
  ): Promise<ReturnType<typeof KnowledgeAnswerProviderResultSchema.parse> | undefined> {
    try {
      return KnowledgeAnswerProviderResultSchema.parse(await this.provider.generate(input));
    } catch {
      return undefined;
    }
  }
}

function normalizeNoAnswerPolicy(policy: Partial<KnowledgeNoAnswerPolicy> | undefined): KnowledgeNoAnswerPolicy {
  return {
    ...DEFAULT_NO_ANSWER_POLICY,
    ...(policy ?? {})
  };
}

function getPreflightNoAnswerReason(
  retrieval: KnowledgeRagRetrievalResult,
  noAnswerPolicy: KnowledgeNoAnswerPolicy
): KnowledgeRagNoAnswerReason | undefined {
  if (retrieval.hits.length === 0 || retrieval.total === 0) {
    return 'no_hits';
  }

  if (retrieval.hits.length < noAnswerPolicy.minHitCount) {
    return 'insufficient_evidence';
  }

  if (noAnswerPolicy.minTopScore !== undefined) {
    const topScore = Math.max(...retrieval.hits.map(hit => hit.score));
    if (topScore < noAnswerPolicy.minTopScore) {
      return 'low_confidence';
    }
  }

  if (!noAnswerPolicy.allowAnswerWithoutCitation && retrieval.citations.length === 0) {
    return 'missing_citations';
  }

  return undefined;
}

function getGroundedCitationCount(retrieval: KnowledgeRagRetrievalResult): number {
  return retrieval.citations.length;
}

function getRewrittenQuery(plan: KnowledgePreRetrievalPlan): string {
  const rewrittenQuery = plan.rewrittenQuery?.trim();
  return rewrittenQuery || plan.originalQuery;
}

function buildNoAnswer(
  startedAt: number,
  groundedCitationCount: number,
  noAnswerReason: KnowledgeRagNoAnswerReason,
  noAnswerPolicy: KnowledgeNoAnswerPolicy
): KnowledgeRagRunAnswer {
  return KnowledgeRagRunAnswerSchema.parse({
    text: getNoAnswerText(noAnswerPolicy),
    noAnswer: true,
    citations: [],
    diagnostics: {
      durationMs: Date.now() - startedAt,
      groundedCitationCount,
      noAnswerReason
    }
  });
}

function getNoAnswerText(noAnswerPolicy: KnowledgeNoAnswerPolicy): string {
  if (noAnswerPolicy.responseStyle === 'ask-clarifying-question') {
    return '当前知识库依据不足。可以补充更具体的问题或指定要检索的知识库吗？';
  }

  if (noAnswerPolicy.responseStyle === 'brief-insufficient-evidence') {
    return '当前知识库依据不足。';
  }

  return DEFAULT_NO_ANSWER_TEXT;
}

function filterGroundedCitations(requestedCitations: Citation[], retrievalCitations: Citation[]): Citation[] {
  const retrievalCitationByKey = new Map(retrievalCitations.map(citation => [getCitationKey(citation), citation]));
  const filteredCitations: Citation[] = [];
  const seen = new Set<string>();

  for (const citation of requestedCitations) {
    const key = getCitationKey(citation);
    const groundedCitation = retrievalCitationByKey.get(key);

    if (!groundedCitation || seen.has(key)) {
      continue;
    }

    seen.add(key);
    filteredCitations.push(groundedCitation);
  }

  return filteredCitations;
}

function getCitationKey(citation: Citation): string {
  return `${citation.sourceId}\u0000${citation.chunkId}`;
}
