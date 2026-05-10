import {
  KnowledgeEvalObservedAnswerSchema,
  KnowledgeEvalSampleSchema,
  type KnowledgeEvalExpectedAnswer,
  type KnowledgeEvalMetricSummary,
  type KnowledgeEvalObservedAnswer,
  type KnowledgeEvalSample,
  type KnowledgeRagFeedback,
  type KnowledgeRagQuerySnapshot
} from '../contracts';
import { evaluateKnowledgeEvalSamples } from './knowledge-observability-evaluator';

export type KnowledgeGoldenEvalObservedAnswer = KnowledgeEvalObservedAnswer;

export interface KnowledgeGoldenEvalCase {
  caseId: string;
  query: KnowledgeRagQuerySnapshot;
  expected: KnowledgeEvalExpectedAnswer;
  feedback?: KnowledgeRagFeedback;
  attributes?: KnowledgeEvalSample['attributes'];
}

export interface KnowledgeGoldenEvalDataset {
  datasetId: string;
  createdAt: string;
  topK?: number;
  cases: KnowledgeGoldenEvalCase[];
}

export interface KnowledgeGoldenEvalRunOptions {
  topK?: number;
}

export interface KnowledgeGoldenEvalRunResult {
  datasetId: string;
  summary: KnowledgeEvalMetricSummary;
  samples: KnowledgeEvalSample[];
}

export type KnowledgeGoldenEvalObserver = (caseItem: KnowledgeGoldenEvalCase) => KnowledgeGoldenEvalObservedAnswer;

export function runKnowledgeGoldenEval(
  dataset: KnowledgeGoldenEvalDataset,
  observeCase: KnowledgeGoldenEvalObserver,
  options: KnowledgeGoldenEvalRunOptions = {}
): KnowledgeGoldenEvalRunResult {
  const samples = dataset.cases.map(caseItem =>
    buildKnowledgeGoldenEvalSample(dataset, caseItem, observeCase(caseItem))
  );
  const topK = options.topK ?? dataset.topK;

  return {
    datasetId: dataset.datasetId,
    samples,
    summary: evaluateKnowledgeEvalSamples(samples, { topK })
  };
}

function buildKnowledgeGoldenEvalSample(
  dataset: KnowledgeGoldenEvalDataset,
  caseItem: KnowledgeGoldenEvalCase,
  observed: KnowledgeGoldenEvalObservedAnswer
): KnowledgeEvalSample {
  const parsedObserved = KnowledgeEvalObservedAnswerSchema.parse(observed);

  return KnowledgeEvalSampleSchema.parse({
    sampleId: `${dataset.datasetId}:${caseItem.caseId}`,
    datasetId: dataset.datasetId,
    createdAt: dataset.createdAt,
    query: caseItem.query,
    expected: caseItem.expected,
    observed: parsedObserved,
    feedback: caseItem.feedback,
    attributes: caseItem.attributes
  });
}
