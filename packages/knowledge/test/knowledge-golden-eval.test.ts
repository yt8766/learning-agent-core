import { describe, expect, it } from 'vitest';

import {
  createKnowledgeGoldenEvalFixture,
  DEFAULT_KNOWLEDGE_GOLDEN_EVAL_DATASET,
  KnowledgeEvalMetricSummarySchema,
  runKnowledgeGoldenEval,
  type KnowledgeGoldenEvalDataset,
  type KnowledgeGoldenEvalObservedAnswer
} from '../src';

const CREATED_AT = '2026-05-10T10:00:00.000Z';

describe('knowledge golden eval runner', () => {
  it('provides a maintainable offline golden dataset fixture for local regression', () => {
    const fixture = createKnowledgeGoldenEvalFixture();

    expect(fixture.dataset).toEqual(DEFAULT_KNOWLEDGE_GOLDEN_EVAL_DATASET);
    expect(fixture.dataset.cases).toHaveLength(9);
    expect(new Set(fixture.dataset.cases.map(caseItem => caseItem.caseId)).size).toBe(fixture.dataset.cases.length);
    expect(fixture.dataset.cases.map(caseItem => caseItem.attributes?.category)).toEqual([
      'exact-id',
      'exact-id',
      'policy-faq',
      'policy-faq',
      'no-answer',
      'no-answer',
      'zh-synonym',
      'zh-synonym',
      'multi-document'
    ]);

    const result = runKnowledgeGoldenEval(fixture.dataset, fixture.observeCase);

    expect(result.summary).toEqual({
      sampleCount: 9,
      topK: 3,
      recallAtK: 1,
      mrr: 1,
      emptyRetrievalRate: 2 / 9,
      groundedCitationRate: 1,
      noAnswerAccuracy: 1
    });
    expect(KnowledgeEvalMetricSummarySchema.parse(result.summary)).toEqual(result.summary);
  });

  it('runs a minimal golden dataset and reports retrieval, citation, and no-answer metrics', () => {
    const dataset: KnowledgeGoldenEvalDataset = {
      datasetId: 'knowledge-minimal-golden',
      createdAt: CREATED_AT,
      topK: 2,
      cases: [
        {
          caseId: 'exact-query',
          query: { text: 'What is the refund window?' },
          expected: {
            chunkIds: ['chunk-refund-window'],
            documentIds: ['doc-policy-faq'],
            citations: [citation('chunk-refund-window')],
            answerFacts: ['Refunds are available within 30 days.']
          }
        },
        {
          caseId: 'policy-faq',
          query: { text: 'Which policy explains approval retention?' },
          expected: {
            chunkIds: ['chunk-approval-retention'],
            documentIds: ['doc-approval-policy'],
            citations: [citation('chunk-approval-retention')],
            answerFacts: ['Approval evidence is retained for audit review.']
          }
        },
        {
          caseId: 'no-answer',
          query: { text: 'Who won the internal hackathon in 1998?' },
          expected: {
            chunkIds: [],
            documentIds: [],
            citations: [],
            answerFacts: [],
            noAnswer: true
          }
        },
        {
          caseId: 'chinese-synonym',
          query: {
            text: '审批记录要保存多久？',
            normalizedText: 'approval evidence retention duration',
            variants: ['审批证据留存时间', 'approval record retention']
          },
          expected: {
            chunkIds: ['chunk-approval-retention'],
            documentIds: ['doc-approval-policy'],
            citations: [citation('chunk-approval-retention')],
            answerFacts: ['审批证据需要留存用于审计。']
          }
        }
      ]
    };

    const result = runKnowledgeGoldenEval(dataset, caseItem => getObservedAnswer(caseItem.caseId));

    expect(result.datasetId).toBe('knowledge-minimal-golden');
    expect(result.samples.map(sample => sample.sampleId)).toEqual([
      'knowledge-minimal-golden:exact-query',
      'knowledge-minimal-golden:policy-faq',
      'knowledge-minimal-golden:no-answer',
      'knowledge-minimal-golden:chinese-synonym'
    ]);
    expect(KnowledgeEvalMetricSummarySchema.parse(result.summary)).toEqual(result.summary);
    expect(result.summary).toEqual({
      sampleCount: 4,
      topK: 2,
      recallAtK: 1,
      mrr: 5 / 6,
      emptyRetrievalRate: 1 / 4,
      groundedCitationRate: 1,
      noAnswerAccuracy: 1
    });
  });
});

const observedByCaseId: Record<string, KnowledgeGoldenEvalObservedAnswer> = {
  'exact-query': {
    retrievalHits: [hit('chunk-refund-window', 1, 'doc-policy-faq')],
    citations: [citation('chunk-refund-window')],
    answerText: 'Refunds are available within 30 days.'
  },
  'policy-faq': {
    retrievalHits: [hit('chunk-distractor', 1, 'doc-other'), hit('chunk-approval-retention', 2, 'doc-approval-policy')],
    citations: [citation('chunk-approval-retention')],
    answerText: 'Approval evidence is retained for audit review.'
  },
  'no-answer': {
    retrievalHits: [],
    citations: [],
    answerText: ''
  },
  'chinese-synonym': {
    retrievalHits: [hit('chunk-approval-retention', 1, 'doc-approval-policy')],
    citations: [],
    answerText: '审批证据需要留存用于审计。'
  }
};

function getObservedAnswer(caseId: string): KnowledgeGoldenEvalObservedAnswer {
  const observed = observedByCaseId[caseId];
  if (!observed) {
    throw new Error(`Missing golden eval observed answer for ${caseId}`);
  }

  return observed;
}

function hit(chunkId: string, rank: number, documentId = `doc-${chunkId}`) {
  return {
    chunkId,
    documentId,
    sourceId: `source-${documentId}`,
    rank
  };
}

function citation(chunkId: string) {
  return {
    sourceId: `source-${chunkId}`,
    chunkId,
    title: `Title ${chunkId}`,
    uri: `docs/${chunkId}.md`,
    sourceType: 'repo-docs' as const,
    trustClass: 'internal' as const
  };
}
