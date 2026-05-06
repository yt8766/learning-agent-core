import { createContext, useContext, type ReactNode } from 'react';

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
  KnowledgeRagStreamEvent,
  CreateFeedbackRequest,
  CreateDocumentFromUploadRequest,
  CreateDocumentFromUploadResponse,
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

export interface KnowledgeFrontendApi {
  getDashboardOverview(): Promise<DashboardOverview>;
  listKnowledgeBases(): Promise<PageResult<KnowledgeBase>>;
  listEmbeddingModels(): Promise<PageResult<EmbeddingModelOption>>;
  listDocuments(input?: { knowledgeBaseId?: string }): Promise<PageResult<KnowledgeDocument>>;
  uploadKnowledgeFile(input: UploadKnowledgeFileRequest): Promise<KnowledgeUploadResult>;
  createDocumentFromUpload(
    knowledgeBaseId: string,
    input: CreateDocumentFromUploadRequest
  ): Promise<CreateDocumentFromUploadResponse>;
  getDocument(documentId: string): Promise<KnowledgeDocument>;
  getLatestDocumentJob(documentId: string): Promise<DocumentProcessingJob>;
  listDocumentChunks(documentId: string): Promise<DocumentChunksResponse>;
  uploadDocument(input: UploadDocumentRequest): Promise<UploadDocumentResponse>;
  reprocessDocument(documentId: string): Promise<ReprocessDocumentResponse>;
  deleteDocument(documentId: string): Promise<DeleteDocumentResponse>;
  listRagModelProfiles(): Promise<{ items: RagModelProfileSummary[] }>;
  listConversations(): Promise<PageResult<ChatConversation>>;
  listConversationMessages(conversationId: string): Promise<PageResult<ChatMessage>>;
  chat(input: ChatRequest): Promise<ChatResponse>;
  streamChat(input: ChatRequest): AsyncIterable<KnowledgeRagStreamEvent>;
  createFeedback(messageId: string, input: CreateFeedbackRequest): Promise<ChatMessage>;
  listEvalDatasets(): Promise<PageResult<EvalDataset>>;
  listEvalRuns(): Promise<PageResult<EvalRun>>;
  listEvalRunResults(runId: string): Promise<PageResult<EvalCaseResult>>;
  compareEvalRuns(input: { baselineRunId: string; candidateRunId: string }): Promise<EvalRunComparison>;
  getObservabilityMetrics(): Promise<ObservabilityMetrics>;
  listTraces(): Promise<PageResult<RagTrace>>;
  getTrace(traceId: string): Promise<RagTraceDetail>;
  listWorkspaceUsers(): Promise<WorkspaceUsersResponse>;
  getSettingsModelProviders(): Promise<SettingsModelProvidersResponse>;
  getSettingsApiKeys(): Promise<SettingsApiKeysResponse>;
  getSettingsStorage(): Promise<SettingsStorageOverview>;
  getSettingsSecurity(): Promise<SettingsSecurityPolicy>;
  getChatAssistantConfig(): Promise<ChatAssistantConfig>;
  listAgentFlows(): Promise<AgentFlowListResponse>;
  saveAgentFlow(input: AgentFlowSaveRequest): Promise<AgentFlowSaveResponse>;
  updateAgentFlow(flowId: string, input: AgentFlowSaveRequest): Promise<AgentFlowSaveResponse>;
  runAgentFlow(flowId: string, input: AgentFlowRunRequest): Promise<AgentFlowRunResponse>;
}

const KnowledgeApiContext = createContext<KnowledgeFrontendApi | undefined>(undefined);

export function KnowledgeApiProvider({
  api,
  children,
  client
}: {
  api?: KnowledgeFrontendApi;
  children: ReactNode;
  client?: KnowledgeFrontendApi;
}) {
  return <KnowledgeApiContext.Provider value={client ?? api}>{children}</KnowledgeApiContext.Provider>;
}

export function useKnowledgeApi(): KnowledgeFrontendApi {
  const client = useContext(KnowledgeApiContext);
  if (!client) {
    throw new Error('KnowledgeApiProvider is required before using knowledge API hooks.');
  }
  return client;
}
