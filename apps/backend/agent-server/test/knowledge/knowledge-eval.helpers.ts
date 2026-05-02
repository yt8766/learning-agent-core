import type { KnowledgeEvalResultRecord } from '../../src/knowledge/interfaces/knowledge-records.types';

export const evalNow = '2026-05-01T09:00:00.000Z';

export function runRecord(
  datasetId: string,
  id: string,
  summary: { totalScore: number; retrievalScore: number; generationScore: number }
) {
  return {
    id,
    tenantId: 'tenant-1',
    datasetId,
    status: 'succeeded' as const,
    summary: {
      caseCount: 1,
      completedCaseCount: 1,
      failedCaseCount: 0,
      ...summary
    },
    createdBy: 'user-1',
    createdAt: evalNow,
    updatedAt: evalNow
  };
}

export function resultRecord(
  runId: string,
  id: string,
  retrievalMetrics: Partial<KnowledgeEvalResultRecord['retrievalMetrics']>,
  generationMetrics: Partial<KnowledgeEvalResultRecord['generationMetrics']>
): KnowledgeEvalResultRecord {
  return {
    id,
    tenantId: 'tenant-1',
    runId,
    caseId: 'case-compare',
    status: 'succeeded',
    question: 'compare question',
    actualAnswer: 'answer',
    retrievedChunkIds: [],
    citations: [],
    retrievalMetrics: {
      recallAtK: 0,
      precisionAtK: 0,
      mrr: 0,
      ndcg: 0,
      ...retrievalMetrics
    },
    generationMetrics: {
      faithfulness: 0,
      answerRelevance: 0,
      citationAccuracy: 0,
      ...generationMetrics
    },
    createdAt: evalNow,
    updatedAt: evalNow
  };
}
