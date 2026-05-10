import type { Citation } from '../contracts';
import {
  type KnowledgeGoldenEvalDataset,
  type KnowledgeGoldenEvalObservedAnswer,
  type KnowledgeGoldenEvalObserver
} from './knowledge-golden-eval';

const CREATED_AT = '2026-05-10T00:00:00.000Z';

export interface KnowledgeGoldenEvalFixture {
  dataset: KnowledgeGoldenEvalDataset;
  observeCase: KnowledgeGoldenEvalObserver;
  observedByCaseId: Readonly<Record<string, KnowledgeGoldenEvalObservedAnswer>>;
}

export const DEFAULT_KNOWLEDGE_GOLDEN_EVAL_DATASET: KnowledgeGoldenEvalDataset = {
  datasetId: 'knowledge-minimal-golden-v1',
  createdAt: CREATED_AT,
  topK: 3,
  cases: [
    {
      caseId: 'kb-article-42-owner',
      query: { text: 'What does KB-42 assign to the runtime owner?' },
      expected: {
        chunkIds: ['chunk-kb-42-runtime-owner'],
        documentIds: ['doc-runtime-ownership'],
        citations: [citation('chunk-kb-42-runtime-owner', 'doc-runtime-ownership')],
        answerFacts: ['KB-42 assigns runtime ownership to the Runtime Center.']
      },
      attributes: { category: 'exact-id' }
    },
    {
      caseId: 'section-7-approval-action',
      query: { text: 'In section 7, which action is required before high-risk execution?' },
      expected: {
        chunkIds: ['chunk-section-7-approval-gate'],
        documentIds: ['doc-approval-controls'],
        citations: [citation('chunk-section-7-approval-gate', 'doc-approval-controls')],
        answerFacts: ['Section 7 requires an approval gate before high-risk execution.']
      },
      attributes: { category: 'exact-id' }
    },
    {
      caseId: 'faq-retry-limit',
      query: { text: 'How many retry attempts does the FAQ allow before escalating?' },
      expected: {
        chunkIds: ['chunk-faq-retry-limit'],
        documentIds: ['doc-runtime-faq'],
        citations: [citation('chunk-faq-retry-limit', 'doc-runtime-faq')],
        answerFacts: ['The FAQ allows three retry attempts before escalating.']
      },
      attributes: { category: 'policy-faq' }
    },
    {
      caseId: 'policy-evidence-retention',
      query: { text: 'Which policy says approval evidence must be retained for audit review?' },
      expected: {
        chunkIds: ['chunk-policy-evidence-retention'],
        documentIds: ['doc-approval-controls'],
        citations: [citation('chunk-policy-evidence-retention', 'doc-approval-controls')],
        answerFacts: ['Approval evidence must be retained for audit review.']
      },
      attributes: { category: 'policy-faq' }
    },
    {
      caseId: 'unknown-hackathon-winner',
      query: { text: 'Who won the internal knowledge hackathon in 1998?' },
      expected: {
        chunkIds: [],
        documentIds: [],
        citations: [],
        answerFacts: [],
        noAnswer: true
      },
      attributes: { category: 'no-answer' }
    },
    {
      caseId: 'unsupported-vendor-roadmap',
      query: { text: 'What is the unreleased vendor roadmap codename for 2035?' },
      expected: {
        chunkIds: [],
        documentIds: [],
        citations: [],
        answerFacts: [],
        noAnswer: true
      },
      attributes: { category: 'no-answer' }
    },
    {
      caseId: 'zh-approval-retention',
      query: {
        text: '审批证据需要保留到什么时候？',
        normalizedText: 'approval evidence retention requirement',
        variants: ['审批记录要保存多久', 'approval record retention']
      },
      expected: {
        chunkIds: ['chunk-policy-evidence-retention'],
        documentIds: ['doc-approval-controls'],
        citations: [citation('chunk-policy-evidence-retention', 'doc-approval-controls')],
        answerFacts: ['审批证据必须保留用于审计复查。']
      },
      attributes: { category: 'zh-synonym' }
    },
    {
      caseId: 'zh-recover-run',
      query: {
        text: '任务中断后怎么恢复执行？',
        normalizedText: 'recover interrupted run',
        variants: ['恢复中断任务', 'resume an interrupted run']
      },
      expected: {
        chunkIds: ['chunk-runtime-recover-run'],
        documentIds: ['doc-runtime-operations'],
        citations: [citation('chunk-runtime-recover-run', 'doc-runtime-operations')],
        answerFacts: ['中断后的任务应通过 recover 入口恢复，并继续保留可观察状态。']
      },
      attributes: { category: 'zh-synonym' }
    },
    {
      caseId: 'audit-recover-evidence-summary',
      query: { text: 'Summarize how recover and evidence retention work together for audit.' },
      expected: {
        chunkIds: ['chunk-runtime-recover-run', 'chunk-policy-evidence-retention'],
        documentIds: ['doc-runtime-operations', 'doc-approval-controls'],
        citations: [
          citation('chunk-runtime-recover-run', 'doc-runtime-operations'),
          citation('chunk-policy-evidence-retention', 'doc-approval-controls')
        ],
        answerFacts: [
          'Recover resumes interrupted runs from the runtime entrypoint.',
          'Approval evidence is retained for audit review.'
        ]
      },
      attributes: { category: 'multi-document' }
    }
  ]
};

const DEFAULT_OBSERVED_BY_CASE_ID: Readonly<Record<string, KnowledgeGoldenEvalObservedAnswer>> = {
  'kb-article-42-owner': observed(
    ['chunk-kb-42-runtime-owner'],
    'KB-42 assigns runtime ownership to the Runtime Center.'
  ),
  'section-7-approval-action': observed(
    ['chunk-section-7-approval-gate'],
    'Section 7 requires an approval gate before high-risk execution.'
  ),
  'faq-retry-limit': observed(['chunk-faq-retry-limit'], 'The FAQ allows three retry attempts before escalating.'),
  'policy-evidence-retention': observed(
    ['chunk-policy-evidence-retention'],
    'Approval evidence must be retained for audit review.'
  ),
  'unknown-hackathon-winner': {
    retrievalHits: [],
    citations: [],
    answerText: ''
  },
  'unsupported-vendor-roadmap': {
    retrievalHits: [],
    citations: [],
    answerText: ''
  },
  'zh-approval-retention': observed(['chunk-policy-evidence-retention'], '审批证据必须保留用于审计复查。'),
  'zh-recover-run': observed(
    ['chunk-runtime-recover-run'],
    '中断后的任务应通过 recover 入口恢复，并继续保留可观察状态。'
  ),
  'audit-recover-evidence-summary': observed(
    ['chunk-runtime-recover-run', 'chunk-policy-evidence-retention'],
    'Recover resumes interrupted runs from the runtime entrypoint, and approval evidence is retained for audit review.'
  )
};

export function createKnowledgeGoldenEvalFixture(): KnowledgeGoldenEvalFixture {
  return {
    dataset: DEFAULT_KNOWLEDGE_GOLDEN_EVAL_DATASET,
    observeCase: caseItem => {
      const observed = DEFAULT_OBSERVED_BY_CASE_ID[caseItem.caseId];
      if (!observed) {
        throw new Error(`Missing golden eval observed answer for ${caseItem.caseId}`);
      }

      return observed;
    },
    observedByCaseId: DEFAULT_OBSERVED_BY_CASE_ID
  };
}

function observed(chunkIds: string[], answerText: string): KnowledgeGoldenEvalObservedAnswer {
  return {
    retrievalHits: chunkIds.map((chunkId, index) => hit(chunkId, index + 1)),
    citations: chunkIds.map(chunkId => citation(chunkId, documentIdForChunk(chunkId))),
    answerText
  };
}

function hit(chunkId: string, rank: number) {
  const documentId = documentIdForChunk(chunkId);

  return {
    chunkId,
    documentId,
    sourceId: sourceIdForDocument(documentId),
    rank
  };
}

function citation(chunkId: string, documentId: string): Citation {
  return {
    sourceId: sourceIdForDocument(documentId),
    chunkId,
    title: titleForDocument(documentId),
    uri: `docs/knowledge-golden/${documentId}.md`,
    sourceType: 'repo-docs',
    trustClass: 'internal'
  };
}

function documentIdForChunk(chunkId: string): string {
  const documentIdsByChunkId: Record<string, string> = {
    'chunk-kb-42-runtime-owner': 'doc-runtime-ownership',
    'chunk-section-7-approval-gate': 'doc-approval-controls',
    'chunk-faq-retry-limit': 'doc-runtime-faq',
    'chunk-policy-evidence-retention': 'doc-approval-controls',
    'chunk-runtime-recover-run': 'doc-runtime-operations'
  };

  return documentIdsByChunkId[chunkId] ?? `doc-${chunkId}`;
}

function sourceIdForDocument(documentId: string): string {
  return `source-${documentId}`;
}

function titleForDocument(documentId: string): string {
  return documentId
    .replace(/^doc-/, '')
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
