import { createContext, useContext, type ReactNode } from 'react';

import type {
  ChatRequest,
  ChatResponse,
  ChatMessage,
  CreateFeedbackRequest,
  CreateDocumentFromUploadRequest,
  CreateDocumentFromUploadResponse,
  DashboardOverview,
  DeleteDocumentResponse,
  DocumentChunksResponse,
  DocumentProcessingJob,
  EvalCaseResult,
  EvalRunComparison,
  EvalDataset,
  EvalRun,
  KnowledgeBase,
  KnowledgeDocument,
  KnowledgeUploadResult,
  ObservabilityMetrics,
  PageResult,
  RagTrace,
  RagTraceDetail,
  ReprocessDocumentResponse,
  UploadKnowledgeFileRequest,
  UploadDocumentRequest,
  UploadDocumentResponse
} from '../types/api';

export interface KnowledgeFrontendApi {
  getDashboardOverview(): Promise<DashboardOverview>;
  listKnowledgeBases(): Promise<PageResult<KnowledgeBase>>;
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
  chat(input: ChatRequest): Promise<ChatResponse>;
  createFeedback(messageId: string, input: CreateFeedbackRequest): Promise<ChatMessage>;
  listEvalDatasets(): Promise<PageResult<EvalDataset>>;
  listEvalRuns(): Promise<PageResult<EvalRun>>;
  listEvalRunResults(runId: string): Promise<PageResult<EvalCaseResult>>;
  compareEvalRuns(input: { baselineRunId: string; candidateRunId: string }): Promise<EvalRunComparison>;
  getObservabilityMetrics(): Promise<ObservabilityMetrics>;
  listTraces(): Promise<PageResult<RagTrace>>;
  getTrace(traceId: string): Promise<RagTraceDetail>;
}

const KnowledgeApiContext = createContext<KnowledgeFrontendApi | undefined>(undefined);

export function KnowledgeApiProvider({ children, client }: { children: ReactNode; client: KnowledgeFrontendApi }) {
  return <KnowledgeApiContext.Provider value={client}>{children}</KnowledgeApiContext.Provider>;
}

export function useKnowledgeApi(): KnowledgeFrontendApi {
  const client = useContext(KnowledgeApiContext);
  if (!client) {
    throw new Error('KnowledgeApiProvider is required before using knowledge API hooks.');
  }
  return client;
}
