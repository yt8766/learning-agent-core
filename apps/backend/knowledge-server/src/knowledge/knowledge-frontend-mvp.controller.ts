import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';

import { AuthUser } from '../auth/auth-user.decorator';
import { AuthGuard } from '../auth/auth.guard';
import type { KnowledgeAuthUser } from '../auth/auth-token-verifier';
import { KnowledgeDocumentService } from './knowledge-document.service';

const now = '2026-05-02T00:00:00.000Z';

@UseGuards(AuthGuard)
@Controller()
export class KnowledgeFrontendMvpController {
  constructor(@Inject(KnowledgeDocumentService) private readonly documents?: KnowledgeDocumentService) {}

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
    return page([]);
  }

  @Get('observability/traces/:traceId')
  getTrace(@Param('traceId') traceId: string) {
    return {
      id: traceId,
      workspaceId: 'default',
      knowledgeBaseIds: [],
      question: '',
      status: 'succeeded',
      createdAt: now,
      spans: [],
      citations: []
    };
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
