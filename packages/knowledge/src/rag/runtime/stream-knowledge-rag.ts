import { randomUUID } from 'node:crypto';

import type { Citation } from '../../contracts';
import { RagAnswerRuntime } from '../answer';
import { DefaultPreRetrievalPlanner } from '../planning';
import {
  KnowledgeAnswerProviderDeltaSchema,
  KnowledgeAnswerProviderInputSchema,
  type KnowledgeAnswerProviderResult
} from '../providers';
import { RagRetrievalRuntime } from '../retrieval';
import {
  KnowledgeRagResultSchema,
  KnowledgeRagRunAnswerSchema,
  KnowledgeRagStreamEventSchema,
  type KnowledgeRagErrorCode,
  type KnowledgeRagNoAnswerReason,
  type KnowledgeNoAnswerPolicy,
  type KnowledgePreRetrievalPlan,
  type KnowledgeRagRetrievalResult,
  type KnowledgeRagRunAnswer,
  type KnowledgeRagStage,
  type KnowledgeRagStreamEvent
} from '../schemas';
import type { KnowledgeRagInput } from './run-knowledge-rag';
import { toKnowledgeRagAnswerMetadata } from './run-knowledge-rag';

export type StreamKnowledgeRagInput = KnowledgeRagInput;

export async function* streamKnowledgeRag(input: StreamKnowledgeRagInput): AsyncIterable<KnowledgeRagStreamEvent> {
  const now = input.now ?? Date.now;
  const idFactory = input.idFactory ?? randomUUID;
  const runStartedAt = now();
  const runId = idFactory();

  yield parseStreamEvent({
    type: 'rag.started',
    runId
  });

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
  yield parseStreamEvent({
    type: 'planner.started',
    runId
  });

  let plan: Awaited<ReturnType<typeof planner.plan>>;
  try {
    plan = await planner.plan({
      query: input.query,
      conversation: input.conversation,
      accessibleKnowledgeBases: input.accessibleKnowledgeBases,
      policy: input.policy,
      metadata: input.metadata
    });
  } catch (error) {
    yield buildErrorEvent(runId, 'planner', 'planner_failed', error);
    return;
  }
  const plannerDurationMs = elapsedMs(now, plannerStartedAt);

  yield parseStreamEvent({
    type: 'planner.completed',
    runId,
    plan
  });

  const retrievalStartedAt = now();
  yield parseStreamEvent({
    type: 'retrieval.started',
    runId,
    plan
  });

  let retrieval: Awaited<ReturnType<typeof retrievalRuntime.retrieve>>;
  try {
    retrieval = await retrievalRuntime.retrieve(plan);
  } catch (error) {
    yield buildErrorEvent(runId, 'retrieval', 'retrieval_failed', error);
    return;
  }
  const retrievalDurationMs = elapsedMs(now, retrievalStartedAt);

  yield parseStreamEvent({
    type: 'retrieval.completed',
    runId,
    retrieval
  });

  const answerStartedAt = now();
  yield parseStreamEvent({
    type: 'answer.started',
    runId
  });

  let streamedAnswer: KnowledgeRagRunAnswer | undefined;
  if (canStreamAnswer(input.answerProvider, input.policy.noAnswer, retrieval)) {
    const providerInput = buildAnswerProviderInput(plan, retrieval, toKnowledgeRagAnswerMetadata(input.metadata));
    let streamedText = '';
    let providerResult: KnowledgeAnswerProviderResult | undefined;
    try {
      for await (const delta of input.answerProvider.stream(providerInput)) {
        const parsedDelta = KnowledgeAnswerProviderDeltaSchema.parse(delta);
        if (parsedDelta.textDelta) {
          streamedText += parsedDelta.textDelta;
          yield parseStreamEvent({
            type: 'answer.delta',
            runId,
            delta: parsedDelta.textDelta
          });
        }
        if (parsedDelta.result) {
          providerResult = parsedDelta.result;
        }
      }
      streamedAnswer = buildAnswerFromStreamResult({
        providerResult,
        streamedText,
        retrieval,
        noAnswerPolicy: input.policy.noAnswer,
        startedAt: answerStartedAt,
        now
      });
    } catch (error) {
      yield buildErrorEvent(runId, 'answer', 'answer_failed', error);
      return;
    }
  }

  let answer: KnowledgeRagRunAnswer;
  if (streamedAnswer) {
    answer = streamedAnswer;
  } else {
    try {
      answer = await answerRuntime.generate(plan, retrieval, {
        metadata: toKnowledgeRagAnswerMetadata(input.metadata)
      });
    } catch (error) {
      yield buildErrorEvent(runId, 'answer', 'answer_failed', error);
      return;
    }
  }
  const answerDurationMs = elapsedMs(now, answerStartedAt);

  yield parseStreamEvent({
    type: 'answer.completed',
    runId,
    answer
  });

  const result = KnowledgeRagResultSchema.parse({
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

  yield parseStreamEvent({
    type: 'rag.completed',
    runId,
    result
  });
}

function elapsedMs(now: () => number, startedAt: number): number {
  return Math.max(0, now() - startedAt);
}

function canStreamAnswer(
  provider: StreamKnowledgeRagInput['answerProvider'],
  noAnswerPolicy: KnowledgeNoAnswerPolicy,
  retrieval: KnowledgeRagRetrievalResult
): provider is StreamKnowledgeRagInput['answerProvider'] & {
  stream: NonNullable<StreamKnowledgeRagInput['answerProvider']['stream']>;
} {
  return typeof provider.stream === 'function' && getPreflightNoAnswerReason(retrieval, noAnswerPolicy) === undefined;
}

function buildAnswerProviderInput(
  plan: KnowledgePreRetrievalPlan,
  retrieval: KnowledgeRagRetrievalResult,
  metadata: Record<string, string | number | boolean | null> | undefined
) {
  return KnowledgeAnswerProviderInputSchema.parse({
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
      ...(metadata ? { extra: metadata } : {})
    }
  });
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

function buildAnswerFromStreamResult(input: {
  providerResult: KnowledgeAnswerProviderResult | undefined;
  streamedText: string;
  retrieval: KnowledgeRagRetrievalResult;
  noAnswerPolicy: KnowledgeNoAnswerPolicy;
  startedAt: number;
  now: () => number;
}): KnowledgeRagRunAnswer {
  const text = (input.providerResult?.text.trim() ? input.providerResult.text : input.streamedText).trim();
  if (!text) {
    return buildNoAnswer(input, 'insufficient_evidence');
  }

  const citations = filterGroundedCitations(
    input.providerResult?.citations ?? input.retrieval.citations,
    input.retrieval.citations
  );
  if (!input.noAnswerPolicy.allowAnswerWithoutCitation && citations.length === 0) {
    return buildNoAnswer(input, 'missing_citations');
  }

  return KnowledgeRagRunAnswerSchema.parse({
    text,
    noAnswer: false,
    citations,
    diagnostics: {
      durationMs: elapsedMs(input.now, input.startedAt),
      groundedCitationCount: input.retrieval.citations.length
    }
  });
}

function buildNoAnswer(
  input: {
    retrieval: KnowledgeRagRetrievalResult;
    noAnswerPolicy: KnowledgeNoAnswerPolicy;
    startedAt: number;
    now: () => number;
  },
  noAnswerReason: KnowledgeRagNoAnswerReason
): KnowledgeRagRunAnswer {
  return KnowledgeRagRunAnswerSchema.parse({
    text: getNoAnswerText(input.noAnswerPolicy),
    noAnswer: true,
    citations: [],
    diagnostics: {
      durationMs: elapsedMs(input.now, input.startedAt),
      groundedCitationCount: input.retrieval.citations.length,
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

  return '未在当前知识库中找到足够依据。';
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

function getRewrittenQuery(plan: KnowledgePreRetrievalPlan): string {
  const rewrittenQuery = plan.rewrittenQuery?.trim();
  return rewrittenQuery || plan.originalQuery;
}

function buildErrorEvent(
  runId: string,
  stage: KnowledgeRagStage,
  code: KnowledgeRagErrorCode,
  error: unknown
): KnowledgeRagStreamEvent {
  return parseStreamEvent({
    type: 'rag.error',
    runId,
    stage,
    error: {
      code,
      message: getErrorMessage(error),
      cause: getErrorCause(error)
    }
  });
}

function parseStreamEvent(event: unknown): KnowledgeRagStreamEvent {
  return KnowledgeRagStreamEventSchema.parse(event);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getErrorCause(error: unknown): string | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }

  const withCause = error as Error & { cause?: unknown };
  if (!('cause' in withCause) || withCause.cause === undefined || withCause.cause === null) {
    return undefined;
  }

  return withCause.cause instanceof Error ? withCause.cause.message : String(withCause.cause);
}
