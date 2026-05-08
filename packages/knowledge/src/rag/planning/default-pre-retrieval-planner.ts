import { randomUUID } from 'node:crypto';

import {
  KnowledgePreRetrievalPlanSchema,
  type KnowledgeBaseRoutingCandidate,
  type KnowledgeBaseRoutingDecision,
  type KnowledgeRagJsonValue,
  type KnowledgePreRetrievalPlan
} from '../schemas/knowledge-rag-planning.schema';
import type { KnowledgeRagFallbackPolicy, KnowledgeRagPolicy } from '../schemas/knowledge-rag-policy.schema';
import type {
  KnowledgeStructuredPlannerProvider,
  KnowledgeStructuredPlannerProviderResult
} from '../providers/structured-planner-provider';
import { KnowledgeStructuredPlannerProviderResultSchema } from '../providers/structured-planner-provider';

export interface DefaultPreRetrievalPlannerOptions {
  provider: KnowledgeStructuredPlannerProvider;
  now?: () => number;
  idFactory?: () => string;
}

export interface KnowledgePreRetrievalPlannerInput {
  query: string;
  conversation?: {
    summary?: string;
    recentMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  };
  accessibleKnowledgeBases: KnowledgeBaseRoutingCandidate[];
  policy: KnowledgeRagPolicy;
  metadata?: Record<string, KnowledgeRagJsonValue>;
}

type FallbackReason = 'planner-error' | 'provider-contract-error' | 'low-confidence' | 'no-accessible-llm-selection';

export class DefaultPreRetrievalPlanner {
  private readonly provider: KnowledgeStructuredPlannerProvider;
  private readonly now: () => number;
  private readonly idFactory: () => string;

  constructor(options: DefaultPreRetrievalPlannerOptions) {
    this.provider = options.provider;
    this.now = options.now ?? Date.now;
    this.idFactory = options.idFactory ?? randomUUID;
  }

  async plan(input: KnowledgePreRetrievalPlannerInput): Promise<KnowledgePreRetrievalPlan> {
    const startedAt = this.now();

    try {
      const providerResult = await this.provider.plan({
        query: input.query,
        conversation: input.conversation,
        accessibleKnowledgeBases: input.accessibleKnowledgeBases,
        policy: input.policy,
        metadata: input.metadata
      });

      const parsedResult = KnowledgeStructuredPlannerProviderResultSchema.safeParse(providerResult);
      if (!parsedResult.success) {
        return this.buildFallbackPlan(input, 'provider-contract-error', startedAt, {
          errorMessage: parsedResult.error.message,
          providerResult
        });
      }

      return this.buildProviderPlan(input, parsedResult.data, startedAt);
    } catch (error) {
      return this.buildFallbackPlan(input, 'planner-error', startedAt, { errorMessage: getErrorMessage(error) });
    }
  }

  private buildProviderPlan(
    input: KnowledgePreRetrievalPlannerInput,
    result: KnowledgeStructuredPlannerProviderResult,
    startedAt: number
  ): KnowledgePreRetrievalPlan {
    const accessibleIds = new Set(input.accessibleKnowledgeBases.map(candidate => candidate.id));
    const selectedKnowledgeBaseIds = normalizeStringList(
      result.selectedKnowledgeBaseIds.filter(id => accessibleIds.has(id)),
      input.policy.maxSelectedKnowledgeBases
    );
    const invalidSelectedKnowledgeBaseIds = normalizeStringList(
      result.selectedKnowledgeBaseIds.filter(id => !accessibleIds.has(id)),
      result.selectedKnowledgeBaseIds.length
    );

    if (result.confidence < input.policy.minPlannerConfidence) {
      return this.buildFallbackPlan(input, 'low-confidence', startedAt, {
        providerResult: result,
        invalidSelectedKnowledgeBaseIds
      });
    }

    if (selectedKnowledgeBaseIds.length === 0) {
      return this.buildFallbackPlan(input, 'no-accessible-llm-selection', startedAt, {
        providerResult: result,
        invalidSelectedKnowledgeBaseIds
      });
    }

    const queryVariants = normalizeStringList(result.queryVariants ?? [], input.policy.maxQueryVariants);
    const routingDecisions = normalizeRoutingDecisions(
      result.routingDecisions,
      accessibleIds,
      selectedKnowledgeBaseIds,
      'llm'
    );

    return KnowledgePreRetrievalPlanSchema.parse({
      id: this.createPlanId(startedAt),
      originalQuery: input.query,
      rewrittenQuery: trimOptional(result.rewrittenQuery),
      queryVariants,
      selectedKnowledgeBaseIds,
      searchMode: result.searchMode ?? input.policy.defaultSearchMode,
      selectionReason: result.selectionReason,
      confidence: result.confidence,
      fallbackPolicy: resolvePlanFallbackPolicy(input.policy),
      routingDecisions,
      strategyHints: {
        ...(result.strategyHints ?? {}),
        topK: result.strategyHints?.topK ?? input.policy.retrievalTopK,
        contextBudgetTokens: result.strategyHints?.contextBudgetTokens ?? input.policy.contextBudgetTokens
      },
      diagnostics: {
        planner: 'llm',
        consideredKnowledgeBaseCount: input.accessibleKnowledgeBases.length,
        rewriteApplied: Boolean(trimOptional(result.rewrittenQuery)),
        fallbackApplied: false,
        durationMs: Math.max(0, this.now() - startedAt),
        metadata: result.metadata
      }
    });
  }

  private buildFallbackPlan(
    input: KnowledgePreRetrievalPlannerInput,
    reason: FallbackReason,
    startedAt: number,
    diagnostics?: {
      errorMessage?: string;
      providerResult?: unknown;
      invalidSelectedKnowledgeBaseIds?: string[];
    }
  ): KnowledgePreRetrievalPlan {
    const selectedKnowledgeBaseIds = input.accessibleKnowledgeBases
      .reduce<string[]>((ids, candidate) => {
        if (!ids.includes(candidate.id)) {
          ids.push(candidate.id);
        }

        return ids;
      }, [])
      .slice(0, input.policy.maxSelectedKnowledgeBases);
    const routingDecisions = buildFallbackRoutingDecisions(input.accessibleKnowledgeBases, selectedKnowledgeBaseIds);

    return KnowledgePreRetrievalPlanSchema.parse({
      id: this.createPlanId(startedAt),
      originalQuery: input.query,
      queryVariants: normalizeStringList([input.query], input.policy.maxQueryVariants),
      selectedKnowledgeBaseIds,
      searchMode: input.policy.defaultSearchMode,
      selectionReason: diagnostics?.errorMessage
        ? `Planner provider failed: ${diagnostics.errorMessage}`
        : `Fallback selected accessible knowledge bases: ${reason}`,
      confidence: input.policy.minPlannerConfidence,
      fallbackPolicy: resolvePlanFallbackPolicy(input.policy),
      routingDecisions,
      strategyHints: {
        topK: input.policy.retrievalTopK,
        contextBudgetTokens: input.policy.contextBudgetTokens
      },
      diagnostics: {
        planner: 'fallback',
        consideredKnowledgeBaseCount: input.accessibleKnowledgeBases.length,
        rewriteApplied: false,
        fallbackApplied: true,
        fallbackReason: reason,
        durationMs: Math.max(0, this.now() - startedAt),
        metadata: buildFallbackMetadata(diagnostics)
      }
    });
  }

  private createPlanId(startedAt: number): string {
    return `plan_${startedAt}_${this.idFactory()}`;
  }
}

function normalizeStringList(values: string[], limit: number): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();

    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    normalized.push(trimmed);

    if (normalized.length >= limit) {
      break;
    }
  }

  return normalized;
}

function trimOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed || undefined;
}

function normalizeRoutingDecisions(
  decisions: KnowledgeBaseRoutingDecision[] | undefined,
  accessibleIds: Set<string>,
  selectedKnowledgeBaseIds: string[],
  source: KnowledgeBaseRoutingDecision['source']
): KnowledgeBaseRoutingDecision[] {
  const selectedIds = new Set(selectedKnowledgeBaseIds);
  const normalized = new Map<string, KnowledgeBaseRoutingDecision>();

  for (const decision of decisions ?? []) {
    if (!accessibleIds.has(decision.knowledgeBaseId) || normalized.has(decision.knowledgeBaseId)) {
      continue;
    }

    normalized.set(decision.knowledgeBaseId, {
      ...decision,
      selected: selectedIds.has(decision.knowledgeBaseId)
    });
  }

  for (const knowledgeBaseId of selectedKnowledgeBaseIds) {
    if (!normalized.has(knowledgeBaseId)) {
      normalized.set(knowledgeBaseId, {
        knowledgeBaseId,
        selected: true,
        source,
        reason: 'Selected by structured planner provider'
      });
    }
  }

  return [...normalized.values()];
}

function buildFallbackRoutingDecisions(
  candidates: KnowledgeBaseRoutingCandidate[],
  selectedKnowledgeBaseIds: string[]
): KnowledgeBaseRoutingDecision[] {
  const selectedIds = new Set(selectedKnowledgeBaseIds);

  return candidates
    .filter((candidate, index, allCandidates) => {
      return selectedIds.has(candidate.id) && allCandidates.findIndex(item => item.id === candidate.id) === index;
    })
    .map(candidate => ({
      knowledgeBaseId: candidate.id,
      selected: true,
      source: 'fallback',
      reason: 'Selected from accessible knowledge bases by fallback planner'
    }));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resolvePlanFallbackPolicy(policy: KnowledgeRagPolicy): KnowledgeRagFallbackPolicy {
  if (
    policy.fallbackWhenLowConfidence === 'expand-to-top-n' ||
    policy.fallbackWhenLowConfidence === 'search-all-accessible'
  ) {
    return policy.fallbackWhenLowConfidence;
  }

  return policy.fallbackWhenPlannerFails === 'search-all-accessible' ? 'search-all-accessible' : 'expand-to-top-n';
}

function buildFallbackMetadata(
  diagnostics:
    | {
        errorMessage?: string;
        providerResult?: unknown;
        invalidSelectedKnowledgeBaseIds?: string[];
      }
    | undefined
): Record<string, KnowledgeRagJsonValue> | undefined {
  if (!diagnostics) return undefined;

  const metadata: Record<string, KnowledgeRagJsonValue> = {};
  const providerResult = diagnostics.providerResult;

  if (diagnostics.errorMessage) {
    metadata.errorMessage = diagnostics.errorMessage;
  }

  if (diagnostics.invalidSelectedKnowledgeBaseIds && diagnostics.invalidSelectedKnowledgeBaseIds.length > 0) {
    metadata.invalidSelectedKnowledgeBaseIds = diagnostics.invalidSelectedKnowledgeBaseIds;
  }

  if (isPlannerProviderResultLike(providerResult)) {
    metadata.providerConfidence = providerResult.confidence;
    metadata.providerSelectionReason = providerResult.selectionReason;
    metadata.providerSelectedKnowledgeBaseIds = providerResult.selectedKnowledgeBaseIds;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function isPlannerProviderResultLike(value: unknown): value is {
  confidence: number;
  selectionReason: string;
  selectedKnowledgeBaseIds: string[];
} {
  if (typeof value !== 'object' || value === null) return false;

  const record = value as Record<string, unknown>;
  return (
    typeof record.confidence === 'number' &&
    typeof record.selectionReason === 'string' &&
    Array.isArray(record.selectedKnowledgeBaseIds) &&
    record.selectedKnowledgeBaseIds.every(id => typeof id === 'string')
  );
}
