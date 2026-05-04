import type {
  AgentFlowListResponse,
  AgentFlowRecord,
  AgentFlowRunRequest,
  AgentFlowRunResponse,
  AgentFlowSaveRequest,
  AgentFlowSaveResponse,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  ChatConversation,
  CreateFeedbackRequest,
  CreateDocumentFromUploadRequest,
  CreateDocumentFromUploadResponse,
  DocumentProcessingJob,
  DocumentChunksResponse,
  DeleteDocumentResponse,
  EmbeddingModelOption,
  EvalCaseResult,
  EvalRunComparison,
  KnowledgeDocument,
  KnowledgeUploadResult,
  PageResult,
  RagModelProfileSummary,
  ReprocessDocumentResponse,
  UploadKnowledgeFileRequest,
  UploadDocumentRequest,
  UploadDocumentResponse,
  KnowledgeRagStreamEvent
} from '../types/api';
import type { KnowledgeFrontendApi } from './knowledge-api-provider';
import {
  mockDashboard,
  mockDocuments,
  mockEvalDatasets,
  mockEvalRuns,
  mockFailedIngestionJob,
  mockObservabilityMetrics,
  mockKnowledgeBases,
  mockTraceDetail
} from './mock-data';
import {
  createDefaultAgentFlow,
  createMockJob,
  latestUserMessage,
  page,
  toSdkCitation,
  upsertAgentFlow
} from './mock-knowledge-api-client.helpers';
import {
  mockChatAssistantConfig,
  mockSettingsApiKeys,
  mockSettingsModelProviders,
  mockSettingsSecurity,
  mockSettingsStorage,
  mockWorkspaceUsers
} from './mock-knowledge-governance-data';

export class MockKnowledgeApiClient implements KnowledgeFrontendApi {
  private agentFlows: AgentFlowRecord[] = [createDefaultAgentFlow()];

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
        dimension: 1024,
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
    return { ...mockFailedIngestionJob, documentId };
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
        stage: 'uploaded',
        status: 'queued',
        stages: [],
        progress: { percent: 0 },
        attempts: 1,
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
        stage: 'uploaded',
        status: 'queued',
        stages: [],
        progress: { percent: 0 },
        attempts: 2,
        createdAt: new Date().toISOString()
      }
    };
  }

  async deleteDocument(): Promise<DeleteDocumentResponse> {
    return { ok: true };
  }

  async listRagModelProfiles(): Promise<{ items: RagModelProfileSummary[] }> {
    return {
      items: [
        {
          id: 'coding-pro',
          label: '用于编程',
          description: '更专业的回答与控制',
          useCase: 'coding',
          enabled: true
        },
        {
          id: 'daily-balanced',
          label: '适合日常工作',
          description: '同样强大，技术细节更少',
          useCase: 'daily',
          enabled: true
        }
      ]
    };
  }

  async listConversations(): Promise<PageResult<ChatConversation>> {
    return page([]);
  }

  async listWorkspaceUsers() {
    return {
      ...page(mockWorkspaceUsers),
      summary: {
        activeUsers: mockWorkspaceUsers.filter(user => user.status === 'active').length,
        adminUsers: mockWorkspaceUsers.filter(user => user.role === 'admin').length,
        pendingUsers: mockWorkspaceUsers.filter(user => user.status === 'pending').length,
        totalUsers: mockWorkspaceUsers.length
      }
    };
  }

  async getSettingsModelProviders() {
    return { items: mockSettingsModelProviders, updatedAt: '2026-05-04T08:00:00.000Z' };
  }

  async getSettingsApiKeys() {
    return { items: mockSettingsApiKeys };
  }

  async getSettingsStorage() {
    return mockSettingsStorage;
  }

  async getSettingsSecurity() {
    return mockSettingsSecurity;
  }

  async getChatAssistantConfig() {
    return mockChatAssistantConfig;
  }

  async listConversationMessages(conversationId: string): Promise<PageResult<ChatMessage>> {
    void conversationId;
    return page([]);
  }

  async chat(input: ChatRequest): Promise<ChatResponse> {
    const conversationId = input.metadata?.conversationId ?? input.conversationId ?? 'conv_1';
    const message = input.message ?? latestUserMessage(input.messages) ?? '';
    const answer = '默认使用顶层静态 import；动态导入只用于代码分割或浏览器专属重资产加载。';
    return {
      conversationId,
      answer,
      traceId: mockTraceDetail.id,
      route: { reason: 'mentions', requestedMentions: ['前端知识库'], selectedKnowledgeBaseIds: ['kb_frontend'] },
      diagnostics: {
        normalizedQuery: message,
        queryVariants: [message],
        retrievalMode: 'hybrid',
        hitCount: 1,
        contextChunkCount: 1
      },
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
        diagnostics: {
          normalizedQuery: message,
          queryVariants: [message],
          retrievalMode: 'hybrid',
          hitCount: 1,
          contextChunkCount: 1
        },
        route: { reason: 'mentions', requestedMentions: ['前端知识库'], selectedKnowledgeBaseIds: ['kb_frontend'] },
        traceId: mockTraceDetail.id,
        citations: mockTraceDetail.citations,
        createdAt: new Date().toISOString()
      }
    };
  }

  async *streamChat(input: ChatRequest): AsyncIterable<KnowledgeRagStreamEvent> {
    const response = await this.chat({ ...input, stream: true });
    const runId = response.traceId;
    yield { type: 'rag.started' as const, runId };
    yield { type: 'planner.started' as const, runId };
    yield { type: 'retrieval.started' as const, runId };
    yield {
      type: 'answer.delta' as const,
      runId,
      delta: response.answer
    };
    yield {
      type: 'answer.completed' as const,
      runId,
      answer: {
        text: response.answer,
        noAnswer: false,
        citations: response.citations.map(toSdkCitation)
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

  async listAgentFlows(): Promise<AgentFlowListResponse> {
    return page(this.agentFlows);
  }

  async saveAgentFlow(input: AgentFlowSaveRequest): Promise<AgentFlowSaveResponse> {
    this.agentFlows = upsertAgentFlow(this.agentFlows, input.flow);
    return { flow: input.flow };
  }

  async updateAgentFlow(flowId: string, input: AgentFlowSaveRequest): Promise<AgentFlowSaveResponse> {
    const flow = { ...input.flow, id: flowId };
    this.agentFlows = upsertAgentFlow(this.agentFlows, flow);
    return { flow };
  }

  async runAgentFlow(flowId: string, input: AgentFlowRunRequest): Promise<AgentFlowRunResponse> {
    return {
      runId: `run_${flowId}`,
      flowId: input.flowId,
      status: 'completed',
      output: {
        answer: `Mock answer for: ${input.input.message}`,
        knowledgeBaseIds: input.input.knowledgeBaseIds
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
}
