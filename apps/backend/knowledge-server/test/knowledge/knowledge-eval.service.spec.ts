import { describe, expect, it } from 'vitest';

import { KnowledgeEvalService } from '../../src/knowledge/knowledge-eval.service';

describe('KnowledgeEvalService', () => {
  it('runs cases and marks a failed case as partial instead of dropping successful results', async () => {
    const service = new KnowledgeEvalService({
      answer: async ({ question }) => {
        if (question.includes('失败')) {
          throw new Error('generation failed');
        }
        return {
          id: 'answer_1',
          citations: [{ chunkId: 'chunk_1', documentId: 'doc_1' }],
          traceId: 'trace_1'
        };
      }
    });

    const run = await service.runDataset({
      datasetId: 'dataset_1',
      cases: [
        { id: 'case_1', datasetId: 'dataset_1', question: '如何定位？', expectedChunkIds: ['chunk_1'] },
        { id: 'case_2', datasetId: 'dataset_1', question: '失败案例', expectedChunkIds: ['chunk_2'] }
      ]
    });

    expect(run.status).toBe('partial');
    expect(run.results).toHaveLength(1);
    expect(run.results[0]).toMatchObject({
      caseId: 'case_1',
      metrics: { recallAtK: 1, citationAccuracy: 1, answerRelevance: 1 },
      traceId: 'trace_1'
    });
    expect(run.failedCases).toMatchObject([{ caseId: 'case_2', code: 'knowledge_eval_run_failed' }]);
  });
});
