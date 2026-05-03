import type {
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
  UploadKnowledgeFileRequest,
  UploadDocumentRequest,
  UploadDocumentResponse
} from '../types/api';
import type { AuthClient } from './auth-client';
import { streamKnowledgeChat } from './knowledge-chat-stream';
import type { KnowledgeFrontendApi } from './knowledge-api-provider';

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
    return this.get<DashboardOverview>('/dashboard/overview');
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
    return this.get<PageResult<KnowledgeDocument>>(`/documents${query ? `?${query}` : ''}`);
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
    return this.get<{ items: RagModelProfileSummary[] }>('/rag/model-profiles');
  }

  listConversations() {
    return this.get<PageResult<ChatConversation>>('/conversations');
  }

  listConversationMessages(conversationId: string) {
    return this.get<PageResult<ChatMessage>>(`/conversations/${encodeURIComponent(conversationId)}/messages`);
  }

  async createKnowledgeBase(input: CreateKnowledgeBaseRequest) {
    const base = await this.post<KnowledgeServiceBase>('/knowledge/bases', {
      name: input.name,
      description: input.description ?? ''
    });
    return normalizeKnowledgeBase(base);
  }

  chat(input: ChatRequest) {
    return this.post<ChatResponse>('/chat', input);
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

  createFeedback(messageId: string, input: CreateFeedbackRequest) {
    return this.post<ChatMessage>(`/messages/${messageId}/feedback`, input);
  }

  listEvalDatasets() {
    return this.get<PageResult<EvalDataset>>('/eval/datasets');
  }

  listEvalRuns() {
    return this.get<PageResult<EvalRun>>('/eval/runs');
  }

  listEvalRunResults(runId: string) {
    return this.get<PageResult<EvalCaseResult>>(`/eval/runs/${runId}/results`);
  }

  compareEvalRuns(input: { baselineRunId: string; candidateRunId: string }) {
    return this.post<EvalRunComparison>('/eval/runs/compare', input);
  }

  getObservabilityMetrics() {
    return this.get<ObservabilityMetrics>('/observability/metrics');
  }

  listTraces() {
    return this.get<PageResult<RagTrace>>('/observability/traces');
  }

  getTrace(traceId: string) {
    return this.get<RagTraceDetail>(`/observability/traces/${traceId}`);
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

interface KnowledgeBasesServiceResponse {
  bases: KnowledgeServiceBase[];
}

interface KnowledgeServiceBase {
  id: string;
  name: string;
  description: string;
  createdByUserId: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeEmbeddingModelsServiceResponse {
  items: Array<{
    id: string;
    label?: string;
    name?: string;
    provider: string;
    dimension?: number;
    dimensions?: number;
    description?: string;
    status?: 'active' | 'disabled' | 'available' | 'unconfigured' | 'degraded';
  }>;
  page?: number;
  pageSize?: number;
  total?: number;
}

function normalizeKnowledgeBases(
  input: PageResult<KnowledgeBase> | KnowledgeBasesServiceResponse
): PageResult<KnowledgeBase> {
  if ('items' in input) {
    return input;
  }
  return {
    items: input.bases.map(normalizeKnowledgeBase),
    total: input.bases.length,
    page: 1,
    pageSize: input.bases.length
  };
}

function normalizeKnowledgeBase(base: KnowledgeServiceBase): KnowledgeBase {
  return {
    id: base.id,
    workspaceId: 'default',
    name: base.name,
    description: base.description,
    tags: [],
    visibility: 'private',
    status: base.status === 'active' ? 'active' : 'archived',
    documentCount: 0,
    chunkCount: 0,
    readyDocumentCount: 0,
    failedDocumentCount: 0,
    createdBy: base.createdByUserId,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt
  };
}

function normalizeEmbeddingModels(
  input: PageResult<EmbeddingModelOption> | KnowledgeEmbeddingModelsServiceResponse
): PageResult<EmbeddingModelOption> {
  return {
    items: input.items.map(normalizeEmbeddingModel),
    total: input.total ?? input.items.length,
    page: input.page ?? 1,
    pageSize: input.pageSize ?? input.items.length
  };
}

function normalizeEmbeddingModel(
  item: EmbeddingModelOption | KnowledgeEmbeddingModelsServiceResponse['items'][number]
): EmbeddingModelOption {
  return {
    id: item.id,
    name: item.name ?? ('label' in item ? item.label : undefined) ?? item.id,
    provider: item.provider,
    dimension: item.dimension ?? ('dimensions' in item ? item.dimensions : undefined),
    description: item.description,
    status: item.status
  };
}

function mergeUploadMetadata(metadata: Record<string, unknown> | undefined, embeddingModelId: string | undefined) {
  if (!embeddingModelId) {
    return metadata;
  }
  return {
    ...metadata,
    embeddingModelId
  };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null;
}
