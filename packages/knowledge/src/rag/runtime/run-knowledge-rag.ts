import { randomUUID } from 'node:crypto';

import type { KnowledgeSearchService } from '../../contracts/knowledge-facade';
import type { RetrievalPipelineConfig } from '../../contracts/knowledge-retrieval-runtime';
import { RagAnswerRuntime } from '../answer';
import { DefaultPreRetrievalPlanner } from '../planning';
import type { KnowledgeAnswerProvider, KnowledgeStructuredPlannerProvider } from '../providers';
import type {
  KnowledgeBaseRoutingCandidate,
  KnowledgeRagJsonValue,
  KnowledgeRagPolicy,
  KnowledgeRagResult
} from '../schemas';
import { KnowledgeRagResultSchema } from '../schemas';
import { RagRetrievalRuntime } from '../retrieval';

export interface KnowledgeRagConversation {
  summary?: string;
  recentMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface KnowledgeRagInput {
  query: string;
  conversation?: KnowledgeRagConversation;
  accessibleKnowledgeBases: KnowledgeBaseRoutingCandidate[];
  policy: KnowledgeRagPolicy;
  plannerProvider: KnowledgeStructuredPlannerProvider;
  searchService: KnowledgeSearchService;
  answerProvider: KnowledgeAnswerProvider;
  pipeline?: RetrievalPipelineConfig;
  metadata?: Record<string, KnowledgeRagJsonValue>;
  now?: () => number;
  idFactory?: () => string;
}

export async function runKnowledgeRag(input: KnowledgeRagInput): Promise<KnowledgeRagResult> {
  const now = input.now ?? Date.now;
  const idFactory = input.idFactory ?? randomUUID;
  const runStartedAt = now();
  const runId = idFactory();

  const planner = new DefaultPreRetrievalPlanner({
    provider: input.plannerProvider,
    now,
    idFactory
  });
  const retrievalRuntime = new RagRetrievalRuntime({
    searchService: input.searchService,
    pipeline: input.pipeline,
    includeDiagnostics: true,
    assembleContext: true
  });
  const answerRuntime = new RagAnswerRuntime({
    provider: input.answerProvider,
    noAnswerPolicy: input.policy.noAnswer
  });

  const plannerStartedAt = now();
  const plan = await planner.plan({
    query: input.query,
    conversation: input.conversation,
    accessibleKnowledgeBases: input.accessibleKnowledgeBases,
    policy: input.policy,
    metadata: input.metadata
  });
  const plannerDurationMs = elapsedMs(now, plannerStartedAt);

  const retrievalStartedAt = now();
  const retrieval = await retrievalRuntime.retrieve(plan);
  const retrievalDurationMs = elapsedMs(now, retrievalStartedAt);

  const answerStartedAt = now();
  const answer = await answerRuntime.generate(plan, retrieval, {
    metadata: toKnowledgeRagAnswerMetadata(input.metadata)
  });
  const answerDurationMs = elapsedMs(now, answerStartedAt);

  return KnowledgeRagResultSchema.parse({
    runId,
    plan,
    retrieval,
    answer,
    diagnostics: {
      durationMs: elapsedMs(now, runStartedAt),
      plannerDurationMs,
      retrievalDurationMs,
      answerDurationMs
    }
  });
}

function elapsedMs(now: () => number, startedAt: number): number {
  return Math.max(0, now() - startedAt);
}

export function toKnowledgeRagAnswerMetadata(
  metadata: Record<string, KnowledgeRagJsonValue> | undefined
): Record<string, string | number | boolean | null> | undefined {
  if (!metadata) {
    return undefined;
  }

  const answerMetadata: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      answerMetadata[key] = value;
    }
  }

  return Object.keys(answerMetadata).length > 0 ? answerMetadata : undefined;
}
