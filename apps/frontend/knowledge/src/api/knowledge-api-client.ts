import {
  KnowledgeDashboardOverviewSchema,
  KnowledgeObservabilityMetricsSchema,
  KnowledgeRagTraceSchema,
  KnowledgeRagTraceDetailSchema,
  KnowledgePageResultSchema,
  KnowledgeEvalDatasetSchema,
  KnowledgeEvalRunSchema,
  KnowledgeEvalCaseResultSchema,
  KnowledgeEvalRunComparisonSchema
} from '@agent/core';

import type {
  AgentFlowListResponse,
  AgentFlowRunRequest,
  AgentFlowRunResponse,
  AgentFlowSaveRequest,
  AgentFlowSaveResponse,
  ChatRequest,
  ChatResponse,
  ChatConversation,
  ChatMessage,
  CreateFeedbackRequest,
  CreateDocumentFromUploadRequest,
  CreateDocumentFromUploadResponse,
  CreateKnowledgeBaseRequest,
  DashboardOverview,
  DeleteDocumentResponse,
  DocumentChunksResponse,
  DocumentProcessingJob,
  EmbeddingModelOption,
  EvalCaseResult,
  EvalRunComparison,
  EvalDataset,
  EvalRun,
  KnowledgeBase,
  KnowledgeRagStreamEvent,
  KnowledgeDocument,
  KnowledgeUploadResult,
  ObservabilityMetrics,
  PageResult,
  RagModelProfileSummary,
  RagTrace,
  RagTraceDetail,
  ReprocessDocumentResponse,
  ChatAssistantConfig,
  SettingsApiKeysResponse,
  SettingsModelProvidersResponse,
  SettingsSecurityPolicy,
  SettingsStorageOverview,
  UploadKnowledgeFileRequest,
  UploadDocumentRequest,
  UploadDocumentResponse,
  WorkspaceUsersResponse
} from '../types/api';
import type { AuthClient } from './auth-client';
import { streamKnowledgeChat } from './knowledge-chat-stream';
import type { KnowledgeFrontendApi } from './knowledge-api-provider';
import {
  mergeUploadMetadata,
  normalizeEmbeddingModels,
  normalizeKnowledgeBase,
  normalizeKnowledgeBases,
  type KnowledgeEmbeddingModelsServiceResponse,
  type KnowledgeBasesServiceResponse,
  type KnowledgeServiceBase
} from './knowledge-api-client-normalizers';

function parseResponse<T>(schema: { parse: (data: unknown) => T }, body: unknown): T {
  return schema.parse(body);
}

export interface KnowledgeApiFactoryOptions {
  baseUrl: string;
  getAccessToken: () => string | undefined;
  fetchImpl?: typeof fetch;
}

export interface KnowledgeApiClientOptions {
  baseUrl: string;
  authClient: AuthClient;
  fetcher?: typeof fetch;
}

export class KnowledgeApiClient implements KnowledgeFrontendApi {
  private readonly baseUrl: string;
  private readonly authClient: AuthClient;
  private readonly fetcher: typeof fetch;

  constructor(options: KnowledgeApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.authClient = options.authClient;
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  getDashboardOverview() {
    return this.get<unknown>('/knowledge/dashboard/overview').then(
      body => parseResponse(KnowledgeDashboardOverviewSchema, body) as unknown as DashboardOverview
    );
  }

  async listKnowledgeBases() {
    const result = await this.request<PageResult<KnowledgeBase> | KnowledgeBasesServiceResponse>('/knowledge/bases');
    return normalizeKnowledgeBases(result);
  }

  async listEmbeddingModels() {
    const result = await this.get<PageResult<EmbeddingModelOption> | KnowledgeEmbeddingModelsServiceResponse>(
      '/knowledge/embedding-models'
    );
    return normalizeEmbeddingModels(result);
  }

  listDocuments(input: { knowledgeBaseId?: string } = {}) {
    const params = new URLSearchParams();
    if (input.knowledgeBaseId) {
      params.set('knowledgeBaseId', input.knowledgeBaseId);
    }
    const query = params.toString();
    return this.get<PageResult<KnowledgeDocument>>(`/knowledge/documents${query ? `?${query}` : ''}`);
  }

  uploadKnowledgeFile(input: UploadKnowledgeFileRequest) {
    const body = new FormData();
    body.set('file', input.file);
    return this.request<KnowledgeUploadResult>(`/knowledge/bases/${input.knowledgeBaseId}/uploads`, {
      body,
      method: 'POST'
    });
  }

  createDocumentFromUpload(knowledgeBaseId: string, input: CreateDocumentFromUploadRequest) {
    return this.post<CreateDocumentFromUploadResponse>(`/knowledge/bases/${knowledgeBaseId}/documents`, input);
  }

  getDocument(documentId: string) {
    return this.get<KnowledgeDocument>(`/knowledge/documents/${documentId}`);
  }

  getLatestDocumentJob(documentId: string) {
    return this.get<DocumentProcessingJob>(`/knowledge/documents/${documentId}/jobs/latest`);
  }

  listDocumentChunks(documentId: string) {
    return this.get<DocumentChunksResponse>(`/knowledge/documents/${documentId}/chunks`);
  }

  async uploadDocument(input: UploadDocumentRequest): Promise<UploadDocumentResponse> {
    const uploadResult = await this.uploadKnowledgeFile({
      file: input.file,
      knowledgeBaseId: input.knowledgeBaseId
    });
    return this.createDocumentFromUpload(input.knowledgeBaseId, {
      filename: uploadResult.filename,
      metadata: mergeUploadMetadata(input.metadata, input.embeddingModelId),
      objectKey: uploadResult.objectKey,
      uploadId: uploadResult.uploadId
    });
  }

  reprocessDocument(documentId: string) {
    return this.post<ReprocessDocumentResponse>(`/knowledge/documents/${documentId}/reprocess`, {});
  }

  deleteDocument(documentId: string) {
    return this.request<DeleteDocumentResponse>(`/knowledge/documents/${documentId}`, { method: 'DELETE' });
  }

  listRagModelProfiles() {
    return this.get<{ items: RagModelProfileSummary[] }>('/knowledge/rag/model-profiles');
  }

  listConversations(): Promise<PageResult<ChatConversation>> {
    return this.get<PageResult<ChatConversation>>('/knowledge/conversations');
  }

  listConversationMessages(conversationId: string): Promise<PageResult<ChatMessage>> {
    return this.get<PageResult<ChatMessage>>(`/knowledge/conversations/${encodeURIComponent(conversationId)}/messages`);
  }

  async createKnowledgeBase(input: CreateKnowledgeBaseRequest) {
    const base = await this.post<KnowledgeServiceBase>('/knowledge/bases', {
      name: input.name,
      description: input.description ?? ''
    });
    return normalizeKnowledgeBase(base);
  }

  chat(input: ChatRequest) {
    return this.post<ChatResponse>('/knowledge/chat', input);
  }

  async *streamChat(input: ChatRequest): AsyncIterable<KnowledgeRagStreamEvent> {
    const accessToken = await this.authClient.ensureValidAccessToken();
    yield* streamKnowledgeChat({
      accessToken,
      baseUrl: this.baseUrl,
      fetcher: this.fetcher,
      input
    });
  }

  createFeedback(messageId: string, input: CreateFeedbackRequest): Promise<ChatMessage> {
    return this.post<ChatMessage>(`/knowledge/messages/${messageId}/feedback`, input);
  }

  listEvalDatasets() {
    return this.get<unknown>('/knowledge/eval/datasets').then(
      body =>
        parseResponse(KnowledgePageResultSchema(KnowledgeEvalDatasetSchema), body) as unknown as PageResult<EvalDataset>
    );
  }

  listEvalRuns() {
    return this.get<unknown>('/knowledge/eval/runs').then(
      body => parseResponse(KnowledgePageResultSchema(KnowledgeEvalRunSchema), body) as unknown as PageResult<EvalRun>
    );
  }

  listEvalRunResults(runId: string) {
    return this.get<unknown>(`/knowledge/eval/runs/${runId}/results`).then(
      body =>
        parseResponse(
          KnowledgePageResultSchema(KnowledgeEvalCaseResultSchema),
          body
        ) as unknown as PageResult<EvalCaseResult>
    );
  }

  compareEvalRuns(input: { baselineRunId: string; candidateRunId: string }) {
    return this.post<unknown>('/knowledge/eval/runs/compare', input).then(
      body => parseResponse(KnowledgeEvalRunComparisonSchema, body) as unknown as EvalRunComparison
    );
  }

  getObservabilityMetrics() {
    return this.get<unknown>('/knowledge/observability/metrics').then(
      body => parseResponse(KnowledgeObservabilityMetricsSchema, body) as unknown as ObservabilityMetrics
    );
  }

  listTraces() {
    return this.get<unknown>('/knowledge/observability/traces').then(
      body => parseResponse(KnowledgePageResultSchema(KnowledgeRagTraceSchema), body) as unknown as PageResult<RagTrace>
    );
  }

  getTrace(traceId: string) {
    return this.get<unknown>(`/knowledge/observability/traces/${traceId}`).then(
      body => parseResponse(KnowledgeRagTraceDetailSchema, body) as unknown as RagTraceDetail
    );
  }

  listWorkspaceUsers() {
    return this.get<WorkspaceUsersResponse>('/knowledge/workspace/users');
  }

  getSettingsModelProviders() {
    return this.get<SettingsModelProvidersResponse>('/knowledge/settings/model-providers');
  }

  getSettingsApiKeys() {
    return this.get<SettingsApiKeysResponse>('/knowledge/settings/api-keys');
  }

  getSettingsStorage() {
    return this.get<SettingsStorageOverview>('/knowledge/settings/storage');
  }

  getSettingsSecurity() {
    return this.get<SettingsSecurityPolicy>('/knowledge/settings/security');
  }

  getChatAssistantConfig() {
    return this.get<ChatAssistantConfig>('/knowledge/chat/assistant-config');
  }

  listAgentFlows() {
    return this.request<AgentFlowListResponse>('/knowledge/agent-flows', { method: 'GET' });
  }

  saveAgentFlow(input: AgentFlowSaveRequest) {
    return this.post<AgentFlowSaveResponse>('/knowledge/agent-flows', input);
  }

  updateAgentFlow(flowId: string, input: AgentFlowSaveRequest) {
    return this.put<AgentFlowSaveResponse>(`/knowledge/agent-flows/${encodeURIComponent(flowId)}`, input);
  }

  runAgentFlow(flowId: string, input: AgentFlowRunRequest) {
    return this.post<AgentFlowRunResponse>(`/knowledge/agent-flows/${encodeURIComponent(flowId)}/run`, input);
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }

  post<T>(path: string, body: unknown) {
    return this.request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  put<T>(path: string, body: unknown) {
    return this.request<T>(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  async request<T>(path: string, init: RequestInit = {}, hasRetried = false): Promise<T> {
    const accessToken = await this.authClient.ensureValidAccessToken();
    return this.requestWithFetcher<T>(this.fetcher, path, init, accessToken, hasRetried);
  }

  private async requestWithFetcher<T>(
    fetcher: typeof fetch,
    path: string,
    init: RequestInit,
    accessToken: string | null,
    hasRetried: boolean
  ): Promise<T> {
    const response = await fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: mergeHeaders(init.headers, accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    });

    if (response.status === 401 && !hasRetried) {
      const errorBody = await readJson(response.clone());
      if (isAuthTokenExpired(errorBody)) {
        await this.authClient.refreshTokensOnce();
        return this.request<T>(path, init, true);
      }
    }

    const body = await readJson(response);
    if (!response.ok) {
      throw new Error(getErrorMessage(body, response.status));
    }
    return body as T;
  }
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => undefined);
}

function isAuthTokenExpired(body: unknown) {
  if (!isRecord(body)) {
    return false;
  }
  if (body.code === 'auth_token_expired' || body.code === 'access_token_expired') {
    return true;
  }
  return isRecord(body.error) && body.error.code === 'access_token_expired';
}

function getErrorMessage(body: unknown, status: number) {
  if (typeof body === 'object' && body && 'message' in body && typeof body.message === 'string') {
    return body.message;
  }
  return `HTTP ${status}`;
}

function mergeHeaders(input: HeadersInit | undefined, extra: Record<string, string>) {
  const headers = new Headers(input);
  for (const [key, value] of Object.entries(extra)) {
    headers.set(key, value);
  }
  return headers;
}

export function createKnowledgeApiClient(options: KnowledgeApiFactoryOptions) {
  return new KnowledgeApiClient({
    baseUrl: options.baseUrl,
    authClient: {
      ensureValidAccessToken: async () => options.getAccessToken() ?? null,
      refreshTokensOnce: async () => {
        throw new Error('Refresh is not available for this client factory');
      }
    } as unknown as AuthClient,
    fetcher: options.fetchImpl
  });
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null;
}
