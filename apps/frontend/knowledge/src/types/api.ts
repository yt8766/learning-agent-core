export type { EmbeddingModelOption, EmbeddingModelStatus } from './embedding';
export type * from './common';
export type * from './auth';
export type * from './knowledge-base';
export type * from './documents';
export type * from './chat';
export type * from './observability';
export type * from './evals';
export type * from './dashboard';
export type * from './agent-flow';
export type * from './governance';
export type ID = string;
export type ISODateTime = string;

export interface PageQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

export type WorkspaceRole = 'owner' | 'admin' | 'maintainer' | 'evaluator' | 'viewer';

export interface CurrentUser {
  id: ID;
  email: string;
  name?: string;
  avatarUrl?: string;
  currentWorkspaceId?: ID;
  roles: WorkspaceRole[];
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshExpiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: CurrentUser;
  tokens: AuthTokens;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  tokens: AuthTokens;
}

export interface MeResponse {
  user: CurrentUser;
}

export type KnowledgeBaseStatus = 'active' | 'disabled' | 'archived';
export type KnowledgeBaseVisibility = 'private' | 'workspace' | 'public';

export interface KnowledgeBase {
  id: ID;
  workspaceId: ID;
  name: string;
  description?: string;
  icon?: string;
  tags: string[];
  visibility: KnowledgeBaseVisibility;
  status: KnowledgeBaseStatus;
  documentCount: number;
  chunkCount: number;
  readyDocumentCount: number;
  failedDocumentCount: number;
  latestEvalScore?: number;
  latestQuestionCount?: number;
  latestTraceAt?: ISODateTime;
  defaultRetrievalConfigId?: ID;
  defaultPromptTemplateId?: ID;
  createdBy: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface CreateKnowledgeBaseRequest {
  name: string;
  description?: string;
  tags?: string[];
  visibility: KnowledgeBaseVisibility;
}

export interface UpdateKnowledgeBaseRequest {
  name?: string;
  description?: string;
  tags?: string[];
  visibility?: KnowledgeBaseVisibility;
  status?: KnowledgeBaseStatus;
  defaultRetrievalConfigId?: ID;
  defaultPromptTemplateId?: ID;
}

export type DocumentSourceType =
  | 'user-upload'
  | 'web-url'
  | 'catalog-sync'
  | 'connector-sync'
  | 'workspace-docs'
  | 'repo-docs';

export type DocumentStatus =
  | 'uploaded'
  | 'queued'
  | 'parsing'
  | 'cleaning'
  | 'chunking'
  | 'embedding'
  | 'indexing'
  | 'ready'
  | 'failed'
  | 'disabled'
  | 'deprecated';

export type DocumentProcessingStage =
  | 'upload_received'
  | 'parse'
  | 'clean'
  | 'chunk'
  | 'embed'
  | 'index_vector'
  | 'index_keyword'
  | 'commit';

export type ProcessingJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'retrying';

export interface ProcessingErrorSummary {
  code: string;
  message: string;
  stage?: DocumentProcessingStage;
}

export interface KnowledgeDocument {
  id: ID;
  workspaceId: ID;
  knowledgeBaseId: ID;
  title: string;
  filename?: string;
  sourceType: DocumentSourceType;
  uri?: string;
  mimeType?: string;
  status: DocumentStatus;
  version: string;
  chunkCount: number;
  embeddedChunkCount: number;
  tokenCount?: number;
  latestJobId?: ID;
  latestError?: ProcessingErrorSummary;
  metadata?: Record<string, unknown>;
  createdBy: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface DocumentProcessingStageRecord {
  stage: DocumentProcessingStage;
  status: ProcessingJobStatus;
  latencyMs?: number;
  error?: ProcessingErrorSummary;
  startedAt?: ISODateTime;
  completedAt?: ISODateTime;
}

export interface DocumentProcessingJob {
  id: ID;
  documentId: ID;
  status: ProcessingJobStatus;
  currentStage?: DocumentProcessingStage;
  stages: DocumentProcessingStageRecord[];
  error?: ProcessingErrorSummary;
  startedAt?: ISODateTime;
  completedAt?: ISODateTime;
  createdAt: ISODateTime;
}

export interface UploadDocumentResponse {
  document: KnowledgeDocument;
  job: DocumentProcessingJob;
}

export type ChunkStatus = 'ready' | 'failed' | 'disabled' | 'deprecated';

export interface DocumentChunk {
  id: ID;
  documentId: ID;
  knowledgeBaseId: ID;
  chunkIndex: number;
  content: string;
  tokenCount?: number;
  status: ChunkStatus;
  embeddingModel?: string;
  embeddingStatus?: 'missing' | 'ready' | 'failed';
  metadata?: Record<string, unknown>;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Citation {
  id: ID;
  documentId: ID;
  chunkId: ID;
  title: string;
  uri?: string;
  quote: string;
  score?: number;
  page?: number;
}

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export type ChatMessageRole = 'user' | 'assistant' | 'system';

export type FeedbackCategory =
  | 'helpful'
  | 'not_helpful'
  | 'wrong_citation'
  | 'hallucination'
  | 'missing_knowledge'
  | 'too_slow'
  | 'unsafe'
  | 'other';

export interface MessageFeedbackSummary {
  rating: 'positive' | 'negative';
  category?: FeedbackCategory;
}

export interface ChatMessage {
  id: ID;
  conversationId: ID;
  role: ChatMessageRole;
  content: string;
  citations?: Citation[];
  traceId?: ID;
  feedback?: MessageFeedbackSummary;
  createdAt: ISODateTime;
}

export interface ChatRequest {
  conversationId?: ID;
  knowledgeBaseIds: ID[];
  message: string;
  retrievalConfigId?: ID;
  promptTemplateId?: ID;
  debug?: boolean;
}

export interface ChatResponse {
  conversationId: ID;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  answer: string;
  citations: Citation[];
  traceId: ID;
  usage?: TokenUsage;
}

export interface CreateFeedbackRequest {
  rating: 'positive' | 'negative';
  category?: FeedbackCategory;
  comment?: string;
}

export interface FeedbackRecord {
  id: ID;
  workspaceId: ID;
  traceId?: ID;
  messageId?: ID;
  rating: 'positive' | 'negative';
  category?: FeedbackCategory;
  comment?: string;
  createdBy: ID;
  createdAt: ISODateTime;
}

export type TraceStatus = 'running' | 'succeeded' | 'failed' | 'canceled';

export type TraceSpanStage =
  | 'query_rewrite'
  | 'embedding'
  | 'keyword_search'
  | 'vector_search'
  | 'hybrid_merge'
  | 'rerank'
  | 'context_assembly'
  | 'generation'
  | 'citation_check'
  | 'eval_judge';

export interface RetrievalHitPreview {
  chunkId: ID;
  documentId: ID;
  title: string;
  contentPreview: string;
  score?: number;
  rank: number;
}

export interface RetrievalSnapshot {
  rewrittenQuery?: string;
  vectorHits: RetrievalHitPreview[];
  keywordHits: RetrievalHitPreview[];
  mergedHits: RetrievalHitPreview[];
  rerankedHits: RetrievalHitPreview[];
  selectedChunks: RetrievalHitPreview[];
}

export type TraceSpanPayloadScalar = string | number | boolean | null;

export interface TraceSpanPayloadSummary {
  summary?: string;
  data?: Record<string, TraceSpanPayloadScalar | string[] | number[]>;
  itemIds?: ID[];
}

export interface StageLatencyMetric {
  stage: TraceSpanStage;
  averageLatencyMs: number;
  p95LatencyMs: number;
}

export interface ObservabilityMetrics {
  traceCount: number;
  questionCount: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  errorRate: number;
  timeoutRate: number;
  noAnswerRate: number;
  negativeFeedbackRate: number;
  citationClickRate: number;
  stageLatency: StageLatencyMetric[];
}

export interface RagTrace {
  id: ID;
  workspaceId: ID;
  conversationId?: ID;
  messageId?: ID;
  knowledgeBaseIds: ID[];
  question: string;
  answer?: string;
  status: TraceStatus;
  latencyMs?: number;
  hitCount?: number;
  citationCount?: number;
  feedbackRating?: 'positive' | 'negative';
  createdBy?: ID;
  createdAt: ISODateTime;
}

export interface RagTraceSpan {
  id: ID;
  traceId: ID;
  stage: TraceSpanStage;
  name: string;
  status: TraceStatus;
  latencyMs?: number;
  input?: TraceSpanPayloadSummary;
  output?: TraceSpanPayloadSummary;
  error?: ApiErrorResponse;
  startedAt?: ISODateTime;
  endedAt?: ISODateTime;
}

export interface RagTraceDetail extends RagTrace {
  spans: RagTraceSpan[];
  citations: Citation[];
  retrievalSnapshot?: RetrievalSnapshot;
  usage?: TokenUsage;
}

export type EvalDifficulty = 'easy' | 'medium' | 'hard';
export type EvalRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';

export interface EvalDataset {
  id: ID;
  workspaceId: ID;
  name: string;
  description?: string;
  tags: string[];
  caseCount: number;
  createdBy: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface EvalCase {
  id: ID;
  datasetId: ID;
  question: string;
  expectedAnswer?: string;
  expectedDocumentIds: ID[];
  expectedChunkIds: ID[];
  tags: string[];
  difficulty: EvalDifficulty;
  sourceTraceId?: ID;
  metadata?: Record<string, unknown>;
  createdAt: ISODateTime;
}

export interface CreateEvalDatasetRequest {
  name: string;
  description?: string;
  tags?: string[];
}

export interface CreateEvalCaseRequest {
  question: string;
  expectedAnswer?: string;
  expectedDocumentIds?: ID[];
  expectedChunkIds?: ID[];
  tags?: string[];
  difficulty?: EvalDifficulty;
  sourceTraceId?: ID;
  metadata?: Record<string, unknown>;
}

export interface EvalReportSummary {
  totalScore?: number;
  retrievalScore?: number;
  generationScore?: number;
  citationScore?: number;
  regressionDelta?: number;
}

export interface EvalRun {
  id: ID;
  workspaceId: ID;
  datasetId: ID;
  knowledgeBaseIds: ID[];
  status: EvalRunStatus;
  retrievalConfigId?: ID;
  promptTemplateId?: ID;
  modelConfigId?: ID;
  caseCount: number;
  completedCaseCount: number;
  failedCaseCount: number;
  summary?: EvalReportSummary;
  startedAt?: ISODateTime;
  completedAt?: ISODateTime;
  createdBy: ID;
  createdAt: ISODateTime;
}

export interface CreateEvalRunRequest {
  datasetId: ID;
  knowledgeBaseIds: ID[];
  retrievalConfigId?: ID;
  promptTemplateId?: ID;
  modelConfigId?: ID;
}

export interface RetrievalMetrics {
  recallAtK?: number;
  precisionAtK?: number;
  mrr?: number;
  ndcg?: number;
}

export interface GenerationMetrics {
  faithfulness?: number;
  answerRelevance?: number;
  citationAccuracy?: number;
  hallucinationRisk?: number;
}

export interface JudgeResult {
  score: number;
  reason: string;
  labels?: string[];
}

export type EvalFailureCategory =
  | 'not_retrieved'
  | 'ranked_too_low'
  | 'context_truncated'
  | 'unsupported_citation'
  | 'hallucination'
  | 'irrelevant_answer'
  | 'prompt_failure'
  | 'provider_error';

export interface EvalCaseResult {
  id: ID;
  runId: ID;
  caseId: ID;
  status: 'succeeded' | 'failed';
  actualAnswer?: string;
  citations: Citation[];
  traceId?: ID;
  retrievalMetrics?: RetrievalMetrics;
  generationMetrics?: GenerationMetrics;
  judgeResult?: JudgeResult;
  failureCategory?: EvalFailureCategory;
  error?: ApiErrorResponse;
}

export interface DashboardOverview {
  knowledgeBaseCount: number;
  documentCount: number;
  readyDocumentCount: number;
  failedDocumentCount: number;
  todayQuestionCount: number;
  averageLatencyMs?: number;
  p95LatencyMs?: number;
  p99LatencyMs?: number;
  errorRate?: number;
  noAnswerRate?: number;
  negativeFeedbackRate?: number;
  latestEvalScore?: number;
  activeAlertCount: number;
  recentFailedJobs: DocumentProcessingJob[];
  recentLowScoreTraces: RagTrace[];
  recentEvalRuns: EvalRun[];
  topMissingKnowledgeQuestions: string[];
}
