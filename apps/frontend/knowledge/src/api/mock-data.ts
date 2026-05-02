import type {
  DashboardOverview,
  EvalDataset,
  EvalRun,
  KnowledgeBase,
  KnowledgeDocument,
  ObservabilityMetrics,
  RagTraceDetail
} from '../types/api';

const now = '2026-05-01T00:00:00.000Z';

export const mockKnowledgeBases = [
  {
    id: 'kb_frontend',
    workspaceId: 'ws_1',
    name: '前端知识库',
    tags: ['frontend'],
    visibility: 'workspace',
    status: 'active',
    documentCount: 1,
    chunkCount: 2,
    readyDocumentCount: 1,
    failedDocumentCount: 0,
    latestEvalScore: 86,
    latestQuestionCount: 12,
    latestTraceAt: now,
    createdBy: 'user_1',
    createdAt: now,
    updatedAt: now
  }
] satisfies KnowledgeBase[];

export const mockDocuments = [
  {
    id: 'doc_frontend_conventions',
    workspaceId: 'ws_1',
    knowledgeBaseId: 'kb_frontend',
    title: '前端规范',
    filename: 'frontend.md',
    sourceType: 'user-upload',
    status: 'ready',
    version: 'v1',
    chunkCount: 2,
    embeddedChunkCount: 2,
    createdBy: 'user_1',
    createdAt: now,
    updatedAt: now
  }
] satisfies KnowledgeDocument[];

export const mockDashboard = {
  knowledgeBaseCount: 1,
  documentCount: 1,
  readyDocumentCount: 1,
  failedDocumentCount: 0,
  todayQuestionCount: 12,
  averageLatencyMs: 880,
  p95LatencyMs: 1200,
  p99LatencyMs: 1600,
  errorRate: 0,
  noAnswerRate: 0.02,
  negativeFeedbackRate: 0.08,
  latestEvalScore: 86,
  activeAlertCount: 0,
  recentFailedJobs: [],
  recentLowScoreTraces: [],
  recentEvalRuns: [],
  topMissingKnowledgeQuestions: ['如何配置多知识库检索？']
} satisfies DashboardOverview;

export const mockTraceDetail = {
  id: 'trace_1',
  workspaceId: 'ws_1',
  conversationId: 'conv_1',
  messageId: 'msg_assistant',
  knowledgeBaseIds: ['kb_frontend'],
  question: '动态导入有什么限制？',
  answer: '默认使用顶层静态 import；动态导入只用于代码分割或浏览器专属重资产加载。',
  status: 'succeeded',
  latencyMs: 880,
  hitCount: 1,
  citationCount: 1,
  createdBy: 'user_1',
  createdAt: now,
  citations: [
    {
      id: 'cite_1',
      documentId: 'doc_frontend_conventions',
      chunkId: 'chunk_1',
      title: '前端规范',
      quote: '默认使用顶层静态 import',
      score: 0.91,
      uri: 'docs/conventions/project-conventions.md'
    }
  ],
  spans: [
    {
      id: 'span_embedding',
      traceId: 'trace_1',
      stage: 'embedding',
      name: 'Embedding',
      status: 'succeeded',
      latencyMs: 100
    },
    {
      id: 'span_vector',
      traceId: 'trace_1',
      stage: 'vector_search',
      name: 'Vector Search',
      status: 'succeeded',
      latencyMs: 120
    },
    {
      id: 'span_generation',
      traceId: 'trace_1',
      stage: 'generation',
      name: 'Generation',
      status: 'succeeded',
      latencyMs: 600
    }
  ],
  retrievalSnapshot: {
    vectorHits: [
      {
        chunkId: 'chunk_1',
        documentId: 'doc_frontend_conventions',
        title: '前端规范',
        contentPreview: '默认使用顶层静态 import',
        score: 0.91,
        rank: 1
      }
    ],
    keywordHits: [
      {
        chunkId: 'chunk_1',
        documentId: 'doc_frontend_conventions',
        title: '前端规范',
        contentPreview: '动态导入',
        score: 0.88,
        rank: 1
      }
    ],
    mergedHits: [
      {
        chunkId: 'chunk_1',
        documentId: 'doc_frontend_conventions',
        title: '前端规范',
        contentPreview: '默认使用顶层静态 import',
        score: 0.91,
        rank: 1
      }
    ],
    rerankedHits: [],
    selectedChunks: [
      {
        chunkId: 'chunk_1',
        documentId: 'doc_frontend_conventions',
        title: '前端规范',
        contentPreview: '默认使用顶层静态 import',
        score: 0.91,
        rank: 1
      }
    ]
  }
} satisfies RagTraceDetail;

export const mockObservabilityMetrics = {
  traceCount: 1,
  questionCount: mockDashboard.todayQuestionCount,
  averageLatencyMs: mockDashboard.averageLatencyMs ?? 0,
  p95LatencyMs: mockDashboard.p95LatencyMs ?? 0,
  p99LatencyMs: mockDashboard.p99LatencyMs ?? 0,
  errorRate: mockDashboard.errorRate ?? 0,
  timeoutRate: 0,
  noAnswerRate: mockDashboard.noAnswerRate ?? 0,
  negativeFeedbackRate: mockDashboard.negativeFeedbackRate ?? 0,
  citationClickRate: 0.42,
  stageLatency: [
    { stage: 'embedding', averageLatencyMs: 100, p95LatencyMs: 130 },
    { stage: 'vector_search', averageLatencyMs: 120, p95LatencyMs: 160 },
    { stage: 'generation', averageLatencyMs: 600, p95LatencyMs: 820 }
  ]
} satisfies ObservabilityMetrics;

export const mockEvalDatasets = [
  {
    id: 'dataset_1',
    workspaceId: 'ws_1',
    name: '前端规范评测集',
    tags: ['frontend'],
    caseCount: 1,
    createdBy: 'user_1',
    createdAt: now,
    updatedAt: now
  }
] satisfies EvalDataset[];

export const mockEvalRuns = [
  {
    id: 'run_1',
    workspaceId: 'ws_1',
    datasetId: 'dataset_1',
    knowledgeBaseIds: ['kb_frontend'],
    status: 'succeeded',
    caseCount: 1,
    completedCaseCount: 1,
    failedCaseCount: 0,
    summary: { totalScore: 86, retrievalScore: 90, generationScore: 82 },
    createdBy: 'user_1',
    createdAt: now
  }
] satisfies EvalRun[];
