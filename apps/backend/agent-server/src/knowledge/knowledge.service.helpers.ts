import {
  KNOWLEDGE_EVAL_DEFAULT_CREATED_BY,
  KNOWLEDGE_EVAL_DEFAULT_TENANT_ID,
  type CreateKnowledgeEvalDatasetInput,
  type RunKnowledgeEvalDatasetInput
} from './interfaces/knowledge-eval.types';
import {
  KNOWLEDGE_RAG_DEFAULT_CREATED_BY,
  KNOWLEDGE_RAG_DEFAULT_TENANT_ID,
  type KnowledgeRagChatInput
} from './interfaces/knowledge-rag.types';
import type { KnowledgeDocumentRecord } from './interfaces/knowledge-records.types';
import { knowledgeApiFixtures } from './knowledge-api-fixtures';
import type { KnowledgeIngestionService } from './knowledge-ingestion.service';
import type { KnowledgeRepository } from './repositories/knowledge.repository';

export async function uploadKnowledgeDocument(
  input: { knowledgeBaseId: string; fileName: string; bytes: Buffer },
  ingestionService?: KnowledgeIngestionService
) {
  const documentId = `doc_${Date.now()}`;
  const jobId = `job_${documentId}`;
  const result = ingestionService
    ? await ingestionService.processUploadedDocument({
        tenantId: KNOWLEDGE_RAG_DEFAULT_TENANT_ID,
        knowledgeBaseId: input.knowledgeBaseId,
        documentId,
        fileName: input.fileName,
        bytes: input.bytes
      })
    : {
        status: 'failed' as const,
        chunkCount: 0,
        reason: 'knowledge ingestion service is unavailable',
        stages: []
      };
  const failed = result.status === 'failed';
  const failedStage = result.stages.find(stage => stage.stage === 'failed') ?? result.stages.at(-1);

  return {
    document: {
      id: documentId,
      workspaceId: KNOWLEDGE_RAG_DEFAULT_TENANT_ID,
      knowledgeBaseId: input.knowledgeBaseId,
      title: input.fileName,
      filename: input.fileName,
      sourceType: 'user-upload',
      status: failed ? 'failed' : 'ready',
      version: '1',
      chunkCount: result.chunkCount,
      embeddedChunkCount: failed ? 0 : result.chunkCount,
      latestJobId: jobId,
      latestError: failed
        ? {
            code: 'ingestion_failed',
            message: result.reason ?? 'Document ingestion failed.',
            stage: toPublicDocumentStage(failedStage?.stage)
          }
        : undefined,
      createdBy: KNOWLEDGE_RAG_DEFAULT_CREATED_BY,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    job: {
      id: jobId,
      documentId,
      status: failed ? 'failed' : 'succeeded',
      currentStage: toPublicDocumentStage(failedStage?.stage),
      stages: result.stages.map(stage => ({
        stage: toPublicDocumentStage(stage.stage),
        status: stage.stage === 'failed' ? 'failed' : 'succeeded',
        error: stage.reason
          ? { code: 'ingestion_stage_failed', message: stage.reason, stage: toPublicDocumentStage(stage.stage) }
          : undefined,
        startedAt: stage.at,
        completedAt: stage.at
      })),
      error: failed ? { code: 'ingestion_failed', message: result.reason ?? 'Document ingestion failed.' } : undefined,
      createdAt: new Date().toISOString()
    }
  };
}

export async function toKnowledgeDocumentDto(record: KnowledgeDocumentRecord, repository?: KnowledgeRepository) {
  const chunks = repository
    ? await repository.listChunks({
        tenantId: record.tenantId,
        knowledgeBaseId: record.knowledgeBaseId,
        documentId: record.id
      })
    : { items: [] };
  const stage = getLatestPublicStage(record.metadata);
  return {
    id: record.id,
    workspaceId: record.tenantId,
    knowledgeBaseId: record.knowledgeBaseId,
    title: record.title,
    filename: typeof record.metadata?.fileName === 'string' ? record.metadata.fileName : record.title,
    sourceType: 'user-upload',
    uri: record.sourceUri,
    mimeType: record.mimeType,
    status: record.status,
    version: '1',
    chunkCount: chunks.items.length,
    embeddedChunkCount: record.status === 'ready' ? chunks.items.length : 0,
    latestJobId: undefined,
    latestError: record.errorMessage
      ? {
          code: 'ingestion_failed',
          message: record.errorMessage,
          stage
        }
      : undefined,
    metadata: record.metadata,
    createdBy: KNOWLEDGE_RAG_DEFAULT_CREATED_BY,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

export function toKnowledgeBaseDto(record: {
  id: string;
  tenantId: string;
  name: string;
  tags: string[];
  visibility: string;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: record.id,
    workspaceId: record.tenantId,
    name: record.name,
    tags: record.tags,
    visibility: record.visibility,
    status: record.status,
    documentCount: 0,
    chunkCount: 0,
    readyDocumentCount: 0,
    failedDocumentCount: 0,
    latestEvalScore: undefined,
    latestQuestionCount: 0,
    latestTraceAt: undefined,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

export function page<T>(items: readonly T[]) {
  return { items, total: items.length, page: 1, pageSize: 20 };
}

export function getEmptyKnowledgeMetrics() {
  return {
    traceCount: 0,
    questionCount: 0,
    averageLatencyMs: 0,
    p95LatencyMs: 0,
    p99LatencyMs: 0,
    errorRate: 0,
    timeoutRate: 0,
    noAnswerRate: 0,
    negativeFeedbackRate: 0,
    citationClickRate: 0,
    stageLatency: []
  };
}

export function getFixtureKnowledgeMetrics() {
  return {
    traceCount: 1,
    questionCount: knowledgeApiFixtures.dashboard.todayQuestionCount,
    averageLatencyMs: knowledgeApiFixtures.dashboard.averageLatencyMs,
    p95LatencyMs: knowledgeApiFixtures.dashboard.p95LatencyMs,
    p99LatencyMs: knowledgeApiFixtures.dashboard.p99LatencyMs,
    errorRate: knowledgeApiFixtures.dashboard.errorRate,
    timeoutRate: 0,
    noAnswerRate: knowledgeApiFixtures.dashboard.noAnswerRate,
    negativeFeedbackRate: knowledgeApiFixtures.dashboard.negativeFeedbackRate,
    citationClickRate: 0.42,
    stageLatency: [
      { stage: 'embedding', averageLatencyMs: 100, p95LatencyMs: 130 },
      { stage: 'vector_search', averageLatencyMs: 120, p95LatencyMs: 160 },
      { stage: 'generation', averageLatencyMs: 600, p95LatencyMs: 820 }
    ]
  };
}

export function getFixtureTracePage() {
  return page([
    {
      id: knowledgeApiFixtures.traceDetail.id,
      workspaceId: knowledgeApiFixtures.traceDetail.workspaceId,
      conversationId: knowledgeApiFixtures.traceDetail.conversationId,
      messageId: knowledgeApiFixtures.traceDetail.messageId,
      knowledgeBaseIds: knowledgeApiFixtures.traceDetail.knowledgeBaseIds,
      question: knowledgeApiFixtures.traceDetail.question,
      answer: knowledgeApiFixtures.traceDetail.answer,
      status: knowledgeApiFixtures.traceDetail.status,
      latencyMs: knowledgeApiFixtures.traceDetail.latencyMs,
      hitCount: knowledgeApiFixtures.traceDetail.hitCount,
      citationCount: knowledgeApiFixtures.traceDetail.citationCount,
      createdBy: knowledgeApiFixtures.traceDetail.createdBy,
      createdAt: knowledgeApiFixtures.traceDetail.createdAt
    }
  ]);
}

export function toServerRagChatInput(input: KnowledgeRagChatInput): KnowledgeRagChatInput {
  return {
    ...input,
    tenantId: KNOWLEDGE_RAG_DEFAULT_TENANT_ID,
    createdBy: KNOWLEDGE_RAG_DEFAULT_CREATED_BY
  };
}

export function toServerEvalDatasetInput(input: CreateKnowledgeEvalDatasetInput): CreateKnowledgeEvalDatasetInput {
  return {
    ...input,
    tenantId: KNOWLEDGE_EVAL_DEFAULT_TENANT_ID,
    createdBy: KNOWLEDGE_EVAL_DEFAULT_CREATED_BY
  };
}

export function toServerEvalRunInput(input: RunKnowledgeEvalDatasetInput): RunKnowledgeEvalDatasetInput {
  return {
    ...input,
    tenantId: KNOWLEDGE_EVAL_DEFAULT_TENANT_ID,
    createdBy: KNOWLEDGE_EVAL_DEFAULT_CREATED_BY
  };
}

function getLatestPublicStage(metadata: Record<string, unknown> | undefined) {
  const stages = metadata?.ingestionStages;
  if (!Array.isArray(stages)) {
    return undefined;
  }
  const latest = stages.at(-1);
  if (!latest || typeof latest !== 'object' || !('stage' in latest) || typeof latest.stage !== 'string') {
    return undefined;
  }
  return toPublicDocumentStage(latest.stage);
}

function toPublicDocumentStage(stage: string | undefined) {
  switch (stage) {
    case 'uploaded':
      return 'upload_received';
    case 'parsed':
      return 'parse';
    case 'chunked':
      return 'chunk';
    case 'embedded':
      return 'embed';
    case 'indexed':
      return 'index_vector';
    case 'failed':
      return 'failed';
    default:
      return stage ?? 'upload_received';
  }
}
