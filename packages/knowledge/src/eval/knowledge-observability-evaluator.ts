import {
  KnowledgeEvalMetricSummarySchema,
  KnowledgeEvalSampleSchema,
  type KnowledgeEvalExpectedAnswer,
  type KnowledgeEvalMetricSummary,
  type KnowledgeEvalSample,
  type KnowledgeRagRetrievalHitSnapshot,
  type KnowledgeRagTrace
} from '../contracts';

export interface KnowledgeEvalOptions {
  topK?: number;
}

export interface KnowledgeTraceToEvalSampleInput {
  sampleId: string;
  datasetId?: string;
  createdAt: string;
  expected: KnowledgeEvalExpectedAnswer;
  attributes?: KnowledgeEvalSample['attributes'];
}

export function evaluateKnowledgeEvalSamples(
  samples: KnowledgeEvalSample[],
  options: KnowledgeEvalOptions = {}
): KnowledgeEvalMetricSummary {
  const parsedSamples = samples.map(sample => KnowledgeEvalSampleSchema.parse(sample));
  const sampleCount = parsedSamples.length;
  const topK = options.topK;

  if (sampleCount === 0) {
    return KnowledgeEvalMetricSummarySchema.parse({
      sampleCount: 0,
      topK,
      recallAtK: 0,
      mrr: 0,
      emptyRetrievalRate: 0,
      groundedCitationRate: 0,
      noAnswerAccuracy: 0
    });
  }

  const answerableSamples = parsedSamples.filter(sample => !sample.expected.noAnswer);
  const recallAtK = average(answerableSamples.map(sample => computeRecallAtK(sample, topK)));
  const mrr = average(answerableSamples.map(sample => computeReciprocalRank(sample, topK)));

  const emptyRetrievalCount = parsedSamples.filter(sample => getObservedHits(sample).length === 0).length;
  const groundedCitationRate = computeGroundedCitationRate(parsedSamples);
  const noAnswerAccuracy = computeNoAnswerAccuracy(parsedSamples);

  return KnowledgeEvalMetricSummarySchema.parse({
    sampleCount,
    topK,
    recallAtK,
    mrr,
    emptyRetrievalRate: emptyRetrievalCount / sampleCount,
    groundedCitationRate,
    noAnswerAccuracy
  });
}

export function buildKnowledgeEvalSampleFromTrace(
  trace: KnowledgeRagTrace,
  input: KnowledgeTraceToEvalSampleInput
): KnowledgeEvalSample {
  return KnowledgeEvalSampleSchema.parse({
    sampleId: input.sampleId,
    datasetId: input.datasetId,
    traceId: trace.traceId,
    createdAt: input.createdAt,
    query: trace.query,
    expected: input.expected,
    observed: {
      retrievalHits: trace.retrieval?.hits ?? [],
      citations: trace.retrieval?.citations ?? [],
      answerText: trace.generation?.answerText,
      diagnostics: trace.retrieval?.diagnostics ?? trace.diagnostics
    },
    feedback: trace.feedback,
    attributes: input.attributes
  });
}

function computeRecallAtK(sample: KnowledgeEvalSample, topK: number | undefined): number {
  const expectedIds = getExpectedRetrievalIds(sample);
  if (expectedIds.size === 0) {
    return 0;
  }

  const hitIds = new Set(getTopHits(sample, topK).map(hit => getComparableHitId(sample, hit)));
  const foundCount = Array.from(expectedIds).filter(id => hitIds.has(id)).length;

  return foundCount / expectedIds.size;
}

function computeReciprocalRank(sample: KnowledgeEvalSample, topK: number | undefined): number {
  const expectedIds = getExpectedRetrievalIds(sample);
  if (expectedIds.size === 0) {
    return 0;
  }

  const firstMatchIndex = getTopHits(sample, topK).findIndex(hit =>
    expectedIds.has(getComparableHitId(sample, hit))
  );

  return firstMatchIndex === -1 ? 0 : 1 / (firstMatchIndex + 1);
}

function computeGroundedCitationRate(samples: KnowledgeEvalSample[]): number {
  let groundedCitationCount = 0;
  let citationCount = 0;

  for (const sample of samples) {
    const expectedCitationChunkIds = getExpectedCitationChunkIds(sample);

    for (const citation of sample.observed?.citations ?? []) {
      citationCount += 1;
      if (expectedCitationChunkIds.has(citation.chunkId)) {
        groundedCitationCount += 1;
      }
    }
  }

  return citationCount === 0 ? 0 : groundedCitationCount / citationCount;
}

function computeNoAnswerAccuracy(samples: KnowledgeEvalSample[]): number {
  const noAnswerSamples = samples.filter(sample => sample.expected.noAnswer !== undefined);
  if (noAnswerSamples.length === 0) {
    return 0;
  }

  const correctCount = noAnswerSamples.filter(sample => {
    const observedNoAnswer = isObservedNoAnswer(sample);
    return sample.expected.noAnswer === observedNoAnswer;
  }).length;

  return correctCount / noAnswerSamples.length;
}

function getExpectedRetrievalIds(sample: KnowledgeEvalSample): Set<string> {
  if (sample.expected.chunkIds.length > 0) {
    return new Set(sample.expected.chunkIds);
  }

  return new Set(sample.expected.documentIds);
}

function getComparableHitId(sample: KnowledgeEvalSample, hit: KnowledgeRagRetrievalHitSnapshot): string {
  return sample.expected.chunkIds.length > 0 ? hit.chunkId : hit.documentId;
}

function getExpectedCitationChunkIds(sample: KnowledgeEvalSample): Set<string> {
  if (sample.expected.citations.length > 0) {
    return new Set(sample.expected.citations.map(citation => citation.chunkId));
  }

  return new Set(sample.expected.chunkIds);
}

function getTopHits(sample: KnowledgeEvalSample, topK: number | undefined): KnowledgeRagRetrievalHitSnapshot[] {
  const hits = getObservedHits(sample);
  return topK === undefined ? hits : hits.slice(0, topK);
}

function getObservedHits(sample: KnowledgeEvalSample): KnowledgeRagRetrievalHitSnapshot[] {
  return sample.observed?.retrievalHits ?? [];
}

function isObservedNoAnswer(sample: KnowledgeEvalSample): boolean {
  if (sample.feedback?.label === 'no-answer-correct') {
    return true;
  }

  if (sample.feedback?.label === 'no-answer-incorrect') {
    return false;
  }

  const answerText = sample.observed?.answerText?.trim() ?? '';
  return answerText.length === 0 && getObservedHits(sample).length === 0;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
