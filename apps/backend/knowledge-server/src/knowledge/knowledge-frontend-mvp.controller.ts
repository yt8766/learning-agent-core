import {
  Body,
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  ServiceUnavailableException,
  Optional,
  UseGuards
} from '@nestjs/common';
import { ZodError } from 'zod';

import { AuthUser } from '../auth/auth-user.decorator';
import { AuthGuard } from '../auth/auth.guard';
import type { KnowledgeAuthUser } from '../auth/auth-token-verifier';
import {
  CreateKnowledgeMessageFeedbackRequestSchema,
  KnowledgeChatRequestSchema
} from './domain/knowledge-document.schemas';
import type {
  KnowledgeChatMessage,
  KnowledgeChatRequest,
  KnowledgeChatResponse,
  KnowledgeEmbeddingModelsResponse
} from './domain/knowledge-document.types';
import { KnowledgeServiceError } from './knowledge.errors';
import { KnowledgeDocumentService } from './knowledge-document.service';
import { KnowledgeTraceService } from './knowledge-trace.service';

const now = '2026-05-02T00:00:00.000Z';

@UseGuards(AuthGuard)
@Controller()
export class KnowledgeFrontendMvpController {
  constructor(
    @Optional() @Inject(KnowledgeDocumentService) private readonly documents?: KnowledgeDocumentService,
    @Optional() @Inject(KnowledgeTraceService) private readonly traces?: KnowledgeTraceService
  ) {}

  @Get('dashboard/overview')
  getDashboardOverview() {
    return {
      knowledgeBaseCount: 0,
      documentCount: 0,
      readyDocumentCount: 0,
      failedDocumentCount: 0,
      todayQuestionCount: 0,
      averageLatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      errorRate: 0,
      noAnswerRate: 0,
      negativeFeedbackRate: 0,
      latestEvalScore: 0,
      activeAlertCount: 0,
      recentFailedJobs: [],
      recentLowScoreTraces: [],
      recentEvalRuns: [],
      topMissingKnowledgeQuestions: []
    };
  }

  @Get('documents')
  listDocuments(@AuthUser() user?: KnowledgeAuthUser, @Query('knowledgeBaseId') knowledgeBaseId?: string) {
    if (!this.documents || !user) {
      return page([]);
    }
    return this.documents.listDocuments(user, { knowledgeBaseId });
  }

  @Post('chat')
  async chat(@AuthUser() user: KnowledgeAuthUser, @Body() body: unknown): Promise<KnowledgeChatResponse> {
    try {
      return await this.requireDocuments().chat(user, KnowledgeChatRequestSchema.parse(body) as KnowledgeChatRequest);
    } catch (error) {
      throw toKnowledgeHttpException(error);
    }
  }

  @Get('embedding-models')
  listEmbeddingModels(): KnowledgeEmbeddingModelsResponse {
    return this.documents?.listEmbeddingModels() ?? defaultEmbeddingModels();
  }

  @Post('messages/:messageId/feedback')
  createFeedback(@Param('messageId') messageId: string, @Body() body: unknown): KnowledgeChatMessage {
    const feedback = CreateKnowledgeMessageFeedbackRequestSchema.parse(body);
    return {
      id: messageId,
      conversationId: 'conv_feedback',
      role: 'assistant',
      content: '',
      feedback,
      createdAt: new Date().toISOString()
    };
  }

  @Post('documents/:documentId/reprocess')
  reprocessDocument(@Param('documentId') documentId: string) {
    const document = createPlaceholderDocument(documentId);
    return {
      document,
      job: {
        id: `job_${documentId}`,
        documentId,
        status: 'queued',
        stages: [],
        progress: { percent: 0, processedChunks: 0, totalChunks: 0 },
        createdAt: now
      }
    };
  }

  @Get('observability/metrics')
  getObservabilityMetrics() {
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

  @Get('observability/traces')
  listTraces() {
    return page(this.traces?.listTraces() ?? []);
  }

  @Get('observability/traces/:traceId')
  getTrace(@Param('traceId') traceId: string) {
    const trace = this.traces?.getTrace(traceId);
    if (!trace) {
      throw new NotFoundException({ code: 'knowledge_trace_not_found', message: 'Trace not found' });
    }
    return trace;
  }

  @Get('eval/datasets')
  listEvalDatasets() {
    return page([]);
  }

  @Get('eval/runs')
  listEvalRuns() {
    return page([]);
  }

  @Get('eval/runs/:runId/results')
  listEvalRunResults() {
    return page([]);
  }

  @Post('eval/runs/compare')
  compareEvalRuns(@Body() body: { baselineRunId?: string; candidateRunId?: string }) {
    return {
      baselineRunId: body.baselineRunId ?? '',
      candidateRunId: body.candidateRunId ?? '',
      totalScoreDelta: 0,
      retrievalScoreDelta: 0,
      generationScoreDelta: 0,
      perMetricDelta: {}
    };
  }

  private requireDocuments(): KnowledgeDocumentService {
    if (!this.documents) {
      throw new Error('KnowledgeDocumentService is not configured');
    }
    return this.documents;
  }
}

function toKnowledgeHttpException(error: unknown): unknown {
  if (error instanceof ZodError) {
    return new BadRequestException({ code: 'validation_error', message: '请求参数不合法', details: error.issues });
  }
  if (error instanceof KnowledgeServiceError) {
    if (error.code === 'knowledge_chat_message_required') {
      return new BadRequestException({ code: error.code, message: error.message });
    }
    if (error.code === 'knowledge_mention_not_found') {
      return new BadRequestException({ code: error.code, message: error.message });
    }
    if (error.code === 'knowledge_base_not_found') {
      return new NotFoundException({ code: error.code, message: error.message });
    }
    if (error.code === 'knowledge_permission_denied') {
      return new ForbiddenException({ code: error.code, message: error.message });
    }
    if (error.code === 'knowledge_chat_failed') {
      return new ServiceUnavailableException({ code: error.code, message: error.message });
    }
  }
  return error;
}

function page<T>(items: T[]) {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 20
  };
}

function createPlaceholderDocument(documentId: string) {
  return {
    id: documentId,
    workspaceId: 'default',
    knowledgeBaseId: 'default',
    title: documentId,
    sourceType: 'user-upload',
    status: 'queued',
    version: 'v1',
    chunkCount: 0,
    embeddedChunkCount: 0,
    createdBy: 'system',
    createdAt: now,
    updatedAt: now
  };
}

function defaultEmbeddingModels(): KnowledgeEmbeddingModelsResponse {
  const id = process.env.KNOWLEDGE_EMBEDDING_MODEL ?? 'text-embedding-3-small';
  const provider = 'openai-compatible';
  const status = process.env.KNOWLEDGE_LLM_API_KEY ? 'available' : 'unconfigured';
  return {
    items: [{ id, label: id, provider, status }]
  };
}
