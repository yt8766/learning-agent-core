import type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  CreateFeedbackRequest,
  CreateDocumentFromUploadRequest,
  CreateDocumentFromUploadResponse,
  DocumentChunksResponse,
  DocumentProcessingJob,
  DeleteDocumentResponse,
  EmbeddingModelOption,
  EvalCaseResult,
  EvalRunComparison,
  KnowledgeDocument,
  KnowledgeUploadResult,
  PageResult,
  ReprocessDocumentResponse,
  UploadKnowledgeFileRequest,
  UploadDocumentRequest,
  UploadDocumentResponse
} from '../types/api';
import type { KnowledgeFrontendApi } from './knowledge-api-provider';
import {
  mockDashboard,
  mockDocuments,
  mockEvalDatasets,
  mockEvalRuns,
  mockObservabilityMetrics,
  mockKnowledgeBases,
  mockTraceDetail
} from './mock-data';

export class MockKnowledgeApiClient implements KnowledgeFrontendApi {
  async getDashboardOverview() {
    return mockDashboard;
  }

  async listKnowledgeBases() {
    return page(mockKnowledgeBases);
  }

  async listEmbeddingModels(): Promise<PageResult<EmbeddingModelOption>> {
    return page([
      {
        id: 'embed_mock_default',
        name: 'Mock Embedding Small',
        provider: 'mock',
        dimension: 1536,
        status: 'active'
      }
    ]);
  }

  async listDocuments() {
    return page(mockDocuments);
  }

  async uploadKnowledgeFile(input: UploadKnowledgeFileRequest): Promise<KnowledgeUploadResult> {
    return {
      uploadId: 'upload_mock',
      knowledgeBaseId: input.knowledgeBaseId,
      filename: input.file.name,
      size: input.file.size,
      contentType: input.file.type === 'text/plain' ? 'text/plain' : 'text/markdown',
      objectKey: `knowledge/${input.knowledgeBaseId}/upload_mock/${input.file.name}`,
      ossUrl: `oss://mock-bucket/knowledge/${input.knowledgeBaseId}/upload_mock/${input.file.name}`,
      uploadedAt: new Date().toISOString()
    };
  }

  async createDocumentFromUpload(
    knowledgeBaseId: string,
    input: CreateDocumentFromUploadRequest
  ): Promise<CreateDocumentFromUploadResponse> {
    const document = {
      ...mockDocuments[0]!,
      knowledgeBaseId,
      filename: input.filename,
      title: input.title ?? input.filename,
      metadata: input.metadata
    };
    return {
      document,
      job: createMockJob(document.id)
    };
  }

  async getDocument(documentId: string): Promise<KnowledgeDocument> {
    return mockDocuments.find(item => item.id === documentId) ?? mockDocuments[0]!;
  }

  async getLatestDocumentJob(documentId: string): Promise<DocumentProcessingJob> {
    return createMockJob(documentId);
  }

  async listDocumentChunks(documentId: string): Promise<DocumentChunksResponse> {
    const document = await this.getDocument(documentId);
    return {
      items: [],
      total: document.chunkCount
    };
  }

  async uploadDocument(input: UploadDocumentRequest): Promise<UploadDocumentResponse> {
    const document = {
      ...mockDocuments[0]!,
      filename: input.file.name,
      metadata: input.embeddingModelId
        ? { ...input.metadata, embeddingModelId: input.embeddingModelId }
        : input.metadata,
      title: input.file.name
    };
    return {
      document,
      job: {
        id: 'job_upload_mock',
        documentId: document.id,
        status: 'queued',
        stages: [],
        createdAt: new Date().toISOString()
      }
    };
  }

  async reprocessDocument(documentId: string): Promise<ReprocessDocumentResponse> {
    const document = mockDocuments.find(item => item.id === documentId) ?? mockDocuments[0]!;
    return {
      document,
      job: {
        id: 'job_reprocess_mock',
        documentId,
        status: 'queued',
        stages: [],
        createdAt: new Date().toISOString()
      }
    };
  }

  async deleteDocument(): Promise<DeleteDocumentResponse> {
    return { ok: true };
  }

  async chat(input: ChatRequest): Promise<ChatResponse> {
    const conversationId = input.metadata?.conversationId ?? input.conversationId ?? 'conv_1';
    const message = input.message ?? latestUserMessage(input.messages) ?? '';
    const answer = '默认使用顶层静态 import；动态导入只用于代码分割或浏览器专属重资产加载。';
    return {
      conversationId,
      answer,
      traceId: mockTraceDetail.id,
      citations: mockTraceDetail.citations,
      userMessage: {
        id: 'msg_user',
        conversationId,
        role: 'user',
        content: message,
        createdAt: new Date().toISOString()
      },
      assistantMessage: {
        id: 'msg_assistant',
        conversationId,
        role: 'assistant',
        content: answer,
        traceId: mockTraceDetail.id,
        citations: mockTraceDetail.citations,
        createdAt: new Date().toISOString()
      }
    };
  }

  async createFeedback(messageId: string, input: CreateFeedbackRequest): Promise<ChatMessage> {
    return {
      id: messageId,
      conversationId: 'conv_1',
      role: 'assistant',
      content: '默认使用顶层静态 import；动态导入只用于代码分割或浏览器专属重资产加载。',
      feedback: {
        rating: input.rating,
        category: input.category
      },
      createdAt: new Date().toISOString()
    };
  }

  async getObservabilityMetrics() {
    return mockObservabilityMetrics;
  }

  async getTrace() {
    return mockTraceDetail;
  }

  async listTraces() {
    return page([mockTraceDetail]);
  }

  async listEvalDatasets() {
    return page(mockEvalDatasets);
  }

  async listEvalRuns() {
    return page(mockEvalRuns);
  }

  async listEvalRunResults(): Promise<PageResult<EvalCaseResult>> {
    return page([]);
  }

  async compareEvalRuns(input: { baselineRunId: string; candidateRunId: string }): Promise<EvalRunComparison> {
    return {
      baselineRunId: input.baselineRunId,
      candidateRunId: input.candidateRunId,
      totalScoreDelta: 0,
      retrievalScoreDelta: 0,
      generationScoreDelta: 0,
      perMetricDelta: {}
    };
  }
}

function latestUserMessage(messages: ChatRequest['messages']): string | undefined {
  const message = [...(messages ?? [])].reverse().find(item => item.role === 'user');
  if (!message) {
    return undefined;
  }
  if (typeof message.content === 'string') {
    return message.content;
  }
  return message.content
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('\n');
}

function page<T>(items: T[]): PageResult<T> {
  return { items, total: items.length, page: 1, pageSize: 20 };
}

function createMockJob(documentId: string): DocumentProcessingJob {
  return {
    id: 'job_mock_latest',
    documentId,
    status: 'queued',
    stages: [],
    createdAt: new Date().toISOString()
  };
}
