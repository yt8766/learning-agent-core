import { describe, expect, it, vi } from 'vitest';

import { KnowledgeEvalService } from '../../src/domains/knowledge/services/knowledge-eval.service';

describe('KnowledgeEvalService', () => {
  it('marks a dataset run completed and scores cited expected chunks', async () => {
    const service = new KnowledgeEvalService({
      answer: vi.fn().mockResolvedValue({
        id: 'answer_1',
        citations: [
          { chunkId: 'chunk_1', documentId: 'doc_1' },
          { chunkId: 'chunk_2', documentId: 'doc_1' }
        ],
        traceId: 'trace_1'
      })
    });

    const result = await service.runDataset({
      datasetId: 'dataset_1',
      cases: [{ id: 'case_1', question: 'Where is the runbook?', expectedChunkIds: ['chunk_1', 'chunk_3'] }]
    });

    expect(result).toMatchObject({
      datasetId: 'dataset_1',
      status: 'completed',
      failedCases: [],
      results: [
        expect.objectContaining({
          caseId: 'case_1',
          answerId: 'answer_1',
          metrics: {
            recallAtK: 0.5,
            citationAccuracy: 0.5,
            answerRelevance: 0.5
          },
          traceId: 'trace_1'
        })
      ]
    });
  });

  it('marks a dataset run partial when one case fails after another succeeds', async () => {
    const service = new KnowledgeEvalService({
      answer: vi
        .fn()
        .mockResolvedValueOnce({ id: 'answer_1', citations: [], traceId: undefined })
        .mockRejectedValueOnce(new Error('answer failed'))
    });

    const result = await service.runDataset({
      datasetId: 'dataset_1',
      cases: [
        { id: 'case_1', question: 'ok' },
        { id: 'case_2', question: 'fail' }
      ]
    });

    expect(result.status).toBe('partial');
    expect(result.results).toHaveLength(1);
    expect(result.failedCases).toEqual([
      {
        caseId: 'case_2',
        code: 'knowledge_eval_run_failed',
        message: 'answer failed'
      }
    ]);
  });
});
