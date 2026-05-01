const now = '2026-05-01T00:00:00.000Z';

const citation = {
  id: 'cite_1',
  documentId: 'doc_frontend_conventions',
  chunkId: 'chunk_1',
  title: '前端规范',
  quote: '默认使用顶层静态 import',
  score: 0.91
};

export const knowledgeApiFixtures = {
  knowledgeBases: {
    items: [
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
    ],
    total: 1,
    page: 1,
    pageSize: 20
  },
  documents: {
    items: [
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
    ],
    total: 1,
    page: 1,
    pageSize: 20
  },
  chunks: {
    items: [
      {
        id: 'chunk_1',
        documentId: 'doc_frontend_conventions',
        knowledgeBaseId: 'kb_frontend',
        chunkIndex: 0,
        content: '默认使用顶层静态 import，动态导入只用于代码分割或浏览器专属重资产加载。',
        tokenCount: 32,
        status: 'ready',
        embeddingModel: 'mock-embedding',
        embeddingStatus: 'ready',
        createdAt: now,
        updatedAt: now
      }
    ],
    total: 1,
    page: 1,
    pageSize: 20
  },
  jobs: [
    {
      id: 'job_1',
      documentId: 'doc_frontend_conventions',
      status: 'succeeded',
      currentStage: 'commit',
      stages: [
        { stage: 'upload_received', status: 'succeeded', latencyMs: 10 },
        { stage: 'parse', status: 'succeeded', latencyMs: 20 },
        { stage: 'chunk', status: 'succeeded', latencyMs: 15 },
        { stage: 'embed', status: 'succeeded', latencyMs: 30 },
        { stage: 'index_vector', status: 'succeeded', latencyMs: 12 },
        { stage: 'index_keyword', status: 'succeeded', latencyMs: 9 },
        { stage: 'commit', status: 'succeeded', latencyMs: 5 }
      ],
      createdAt: now,
      startedAt: now,
      completedAt: now
    }
  ],
  chatResponse: {
    conversationId: 'conv_1',
    answer: '默认使用顶层静态 import；动态导入只用于代码分割或浏览器专属重资产加载。',
    traceId: 'trace_1',
    citations: [citation],
    userMessage: {
      id: 'msg_user',
      conversationId: 'conv_1',
      role: 'user',
      content: '动态导入有什么限制？',
      createdAt: now
    },
    assistantMessage: {
      id: 'msg_assistant',
      conversationId: 'conv_1',
      role: 'assistant',
      content: '默认使用顶层静态 import；动态导入只用于代码分割或浏览器专属重资产加载。',
      traceId: 'trace_1',
      citations: [citation],
      createdAt: now
    }
  },
  traceDetail: {
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
    citations: [citation],
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
  },
  evalDatasets: {
    items: [
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
    ],
    total: 1,
    page: 1,
    pageSize: 20
  },
  evalRuns: {
    items: [
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
    ],
    total: 1,
    page: 1,
    pageSize: 20
  },
  evalResults: {
    items: [
      {
        id: 'result_1',
        runId: 'run_1',
        caseId: 'case_1',
        status: 'succeeded',
        actualAnswer: '默认使用顶层静态 import。',
        citations: [],
        traceId: 'trace_1',
        retrievalMetrics: { recallAtK: 1, mrr: 1 },
        generationMetrics: { faithfulness: 0.86, answerRelevance: 0.9 }
      }
    ],
    total: 1,
    page: 1,
    pageSize: 20
  },
  dashboard: {
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
  }
} as const;
