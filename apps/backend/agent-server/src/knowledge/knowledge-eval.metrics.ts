import type {
  KnowledgeEvalResultRecord,
  KnowledgeEvalRetrievalMetrics,
  KnowledgeEvalRunSummary
} from './interfaces/knowledge-records.types';

export function calculateRetrievalMetrics(input: {
  expectedChunkIds: readonly string[];
  retrievedChunkIds: readonly string[];
}): KnowledgeEvalRetrievalMetrics {
  const expected = new Set(input.expectedChunkIds);
  const retrieved = input.retrievedChunkIds;
  const hits = retrieved.filter(chunkId => expected.has(chunkId));
  const firstHitIndex = retrieved.findIndex(chunkId => expected.has(chunkId));

  return {
    recallAtK: expected.size === 0 ? 0 : roundMetric(hits.length / expected.size),
    precisionAtK: retrieved.length === 0 ? 0 : roundMetric(hits.length / retrieved.length),
    mrr: firstHitIndex === -1 ? 0 : roundMetric(1 / (firstHitIndex + 1)),
    ndcg: roundMetric(calculateNdcgAtK(expected, retrieved))
  };
}

export function summarizeResults(results: readonly KnowledgeEvalResultRecord[]): KnowledgeEvalRunSummary {
  const completed = results.filter(result => result.status === 'succeeded');
  const retrievalScore = average(
    completed.map(result =>
      average([
        result.retrievalMetrics.recallAtK,
        result.retrievalMetrics.precisionAtK,
        result.retrievalMetrics.mrr,
        result.retrievalMetrics.ndcg
      ])
    )
  );
  const generationScore = average(
    completed.map(result =>
      average([
        result.generationMetrics.faithfulness,
        result.generationMetrics.answerRelevance,
        result.generationMetrics.citationAccuracy
      ])
    )
  );

  return {
    caseCount: results.length,
    completedCaseCount: completed.length,
    failedCaseCount: results.length - completed.length,
    retrievalScore: roundMetric(retrievalScore),
    generationScore: roundMetric(generationScore),
    totalScore: roundMetric(average([retrievalScore, generationScore]))
  };
}

export function flattenSummary(summary: KnowledgeEvalRunSummary): Record<string, number> {
  return {
    totalScore: summary.totalScore,
    retrievalScore: summary.retrievalScore,
    generationScore: summary.generationScore
  };
}

export function compareMetricAverages(
  baseline: readonly KnowledgeEvalResultRecord[],
  candidate: readonly KnowledgeEvalResultRecord[]
): Record<string, number> {
  const baselineMetrics = averageMetrics(baseline);
  const candidateMetrics = averageMetrics(candidate);
  const metricNames = new Set([...Object.keys(baselineMetrics), ...Object.keys(candidateMetrics)]);
  return Object.fromEntries(
    [...metricNames].map(name => [name, roundMetric(score(candidateMetrics[name]) - score(baselineMetrics[name]))])
  );
}

export function roundMetric(value: number): number {
  return Math.round(score(value) * 1_000_000) / 1_000_000;
}

export function overlapRatio(left: readonly string[], right: readonly string[]): number {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }
  const rightSet = new Set(right);
  return roundMetric(left.filter(token => rightSet.has(token)).length / left.length);
}

export function intersectionSize(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  return [...left].filter(value => right.has(value)).length;
}

export function tokenize(value: string): string[] {
  return [
    ...new Set(
      value
        .toLowerCase()
        .split(/[^\p{L}\p{N}_]+/u)
        .map(token => token.trim())
        .filter(Boolean)
    )
  ];
}

function calculateNdcgAtK(expected: ReadonlySet<string>, retrieved: readonly string[]): number {
  if (expected.size === 0 || retrieved.length === 0) {
    return 0;
  }
  const dcg = retrieved.reduce((total, chunkId, index) => {
    return expected.has(chunkId) ? total + 1 / Math.log2(index + 2) : total;
  }, 0);
  const idealLength = Math.min(expected.size, retrieved.length);
  const idcg = Array.from({ length: idealLength }).reduce<number>((total, _value, index) => {
    return total + 1 / Math.log2(index + 2);
  }, 0);

  return idcg === 0 ? 0 : dcg / idcg;
}

function averageMetrics(results: readonly KnowledgeEvalResultRecord[]): Record<string, number> {
  const values: Record<string, number[]> = {};
  for (const result of results) {
    for (const [name, value] of Object.entries({ ...result.retrievalMetrics, ...result.generationMetrics })) {
      values[name] = [...(values[name] ?? []), value];
    }
  }
  return Object.fromEntries(Object.entries(values).map(([name, entries]) => [name, average(entries)]));
}

function average(values: readonly number[]): number {
  const finite = values.filter(Number.isFinite);
  return finite.length === 0 ? 0 : finite.reduce((total, value) => total + value, 0) / finite.length;
}

export function score(value: number | undefined): number {
  return Number.isFinite(value) ? value : 0;
}
