import { Body, Controller, Get, Headers, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import {
  type KnowledgeLoginRequest,
  type KnowledgeLogoutRequest,
  type KnowledgeRefreshRequest
} from './interfaces/knowledge-auth.types';
import type { CreateKnowledgeEvalDatasetInput, RunKnowledgeEvalDatasetInput } from './interfaces/knowledge-eval.types';
import type { KnowledgeRagChatInput } from './interfaces/knowledge-rag.types';
import { KnowledgeAuthService } from './knowledge-auth.service';
import { KnowledgeService } from './knowledge.service';

@Controller('knowledge/v1')
export class KnowledgeController {
  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly knowledgeAuthService: KnowledgeAuthService
  ) {}

  @Post('auth/login')
  login(@Body() body: KnowledgeLoginRequest) {
    return this.knowledgeAuthService.login(body);
  }

  @Post('auth/refresh')
  refresh(@Body() body: KnowledgeRefreshRequest) {
    return this.knowledgeAuthService.refresh(body);
  }

  @Get('auth/me')
  me(@Headers('authorization') authorization?: string) {
    return this.knowledgeAuthService.me({ authorization });
  }

  @Post('auth/logout')
  logout(@Body() body: KnowledgeLogoutRequest = {}) {
    return this.knowledgeAuthService.logout(body);
  }

  @Get('dashboard/overview')
  getDashboardOverview() {
    return this.knowledgeService.getDashboardOverview();
  }

  @Get('knowledge-bases')
  listKnowledgeBases() {
    return this.knowledgeService.listKnowledgeBases();
  }

  @Post('knowledge-bases')
  createKnowledgeBase() {
    return this.knowledgeService.getKnowledgeBase('kb_frontend');
  }

  @Get('knowledge-bases/:id')
  getKnowledgeBase(@Param('id') id: string) {
    return this.knowledgeService.getKnowledgeBase(id);
  }

  @Get('documents')
  listDocuments() {
    return this.knowledgeService.listDocuments();
  }

  @Get('documents/:id')
  getDocument(@Param('id') id: string) {
    return this.knowledgeService.getDocument(id);
  }

  @Post('knowledge-bases/:id/documents/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @Param('id') knowledgeBaseId: string,
    @UploadedFile() file?: { originalname?: string; buffer?: Buffer }
  ) {
    return this.knowledgeService.uploadDocument({
      knowledgeBaseId,
      fileName: file?.originalname ?? 'uploaded-document.txt',
      bytes: file?.buffer ?? Buffer.alloc(0)
    });
  }

  @Post('documents/:id/reprocess')
  reprocessDocument(@Param('id') id: string) {
    return this.knowledgeService.reprocessDocument(id);
  }

  @Get('documents/:id/jobs')
  listDocumentJobs() {
    return this.knowledgeService.listDocumentJobs();
  }

  @Get('documents/:id/chunks')
  listDocumentChunks() {
    return this.knowledgeService.listDocumentChunks();
  }

  @Post('chat')
  chat(@Body() body: KnowledgeRagChatInput) {
    return this.knowledgeService.chat(body);
  }

  @Post('messages/:id/feedback')
  createFeedback(
    @Param('id') id: string,
    @Body() body: { rating?: 'positive' | 'negative'; category?: string; comment?: string }
  ) {
    return this.knowledgeService.createFeedback(id, body);
  }

  @Get('observability/metrics')
  getObservabilityMetrics(@Query('knowledgeBaseId') knowledgeBaseId?: string) {
    return this.knowledgeService.getObservabilityMetrics({ knowledgeBaseId });
  }

  @Get('observability/traces')
  listTraces(@Query('knowledgeBaseId') knowledgeBaseId?: string) {
    return this.knowledgeService.listTraces({ knowledgeBaseId });
  }

  @Get('observability/traces/:id')
  getTrace(@Param('id') id: string) {
    return this.knowledgeService.getTrace(id);
  }

  @Get('eval/datasets')
  listEvalDatasets() {
    return this.knowledgeService.listEvalDatasets();
  }

  @Post('eval/datasets')
  createEvalDataset(@Body() body: CreateKnowledgeEvalDatasetInput) {
    return this.knowledgeService.createEvalDataset(body);
  }

  @Get('evals/datasets')
  listEvalDatasetsAlias() {
    return this.listEvalDatasets();
  }

  @Post('evals/datasets')
  createEvalDatasetAlias(@Body() body: CreateKnowledgeEvalDatasetInput) {
    return this.createEvalDataset(body);
  }

  @Get('eval/runs')
  listEvalRuns(@Query('datasetId') datasetId?: string) {
    return this.knowledgeService.listEvalRuns({ datasetId });
  }

  @Post('eval/runs')
  createEvalRun(@Body() body: RunKnowledgeEvalDatasetInput) {
    return this.knowledgeService.createEvalRun(body);
  }

  @Post('eval/runs/compare')
  compareEvalRuns(@Body() body: { baselineRunId: string; candidateRunId: string; tenantId?: string }) {
    return this.knowledgeService.compareEvalRuns(body);
  }

  @Get('eval/runs/:id')
  getEvalRun(@Param('id') id: string) {
    return this.knowledgeService.getEvalRun(id);
  }

  @Get('eval/runs/:id/results')
  listEvalRunResults(@Param('id') id: string) {
    return this.knowledgeService.listEvalRunResults(id);
  }

  @Get('evals/runs')
  listEvalRunsAlias(@Query('datasetId') datasetId?: string) {
    return this.listEvalRuns(datasetId);
  }

  @Post('evals/runs')
  createEvalRunAlias(@Body() body: RunKnowledgeEvalDatasetInput) {
    return this.createEvalRun(body);
  }

  @Post('evals/runs/compare')
  compareEvalRunsAlias(@Body() body: { baselineRunId: string; candidateRunId: string; tenantId?: string }) {
    return this.compareEvalRuns(body);
  }

  @Get('evals/runs/:id')
  getEvalRunAlias(@Param('id') id: string) {
    return this.getEvalRun(id);
  }

  @Get('evals/runs/:id/results')
  listEvalRunResultsAlias(@Param('id') id: string) {
    return this.listEvalRunResults(id);
  }

  @Get('dashboard/overview')
  getDashboardOverview() {
    return this.knowledgeService.getDashboardOverview();
  }

  @Get('knowledge-bases')
  listKnowledgeBases() {
    return this.knowledgeService.listKnowledgeBases();
  }

  @Post('knowledge-bases')
  createKnowledgeBase() {
    return this.knowledgeService.getKnowledgeBase('kb_frontend');
  }

  @Get('knowledge-bases/:id')
  getKnowledgeBase(@Param('id') id: string) {
    return this.knowledgeService.getKnowledgeBase(id);
  }

  @Get('documents')
  listDocuments() {
    return this.knowledgeService.listDocuments();
  }

  @Get('documents/:id')
  getDocument(@Param('id') id: string) {
    return this.knowledgeService.getDocument(id);
  }

  @Get('documents/:id/jobs')
  listDocumentJobs() {
    return this.knowledgeService.listDocumentJobs();
  }

  @Get('documents/:id/chunks')
  listDocumentChunks() {
    return this.knowledgeService.listDocumentChunks();
  }

  @Post('chat')
  chat(@Body() body: { conversationId?: string; message?: string }) {
    return this.knowledgeService.chat(body);
  }

  @Post('messages/:id/feedback')
  createFeedback(
    @Param('id') id: string,
    @Body() body: { rating?: 'positive' | 'negative'; category?: string; comment?: string }
  ) {
    return this.knowledgeService.createFeedback(id, body);
  }

  @Get('observability/metrics')
  getObservabilityMetrics() {
    return this.knowledgeService.getObservabilityMetrics();
  }

  @Get('observability/traces')
  listTraces() {
    return this.knowledgeService.listTraces();
  }

  @Get('observability/traces/:id')
  getTrace() {
    return this.knowledgeService.getTrace();
  }

  @Get('eval/datasets')
  listEvalDatasets() {
    return this.knowledgeService.listEvalDatasets();
  }

  @Post('eval/datasets')
  createEvalDataset() {
    return this.knowledgeService.listEvalDatasets().items[0];
  }

  @Get('eval/runs')
  listEvalRuns() {
    return this.knowledgeService.listEvalRuns();
  }

  @Post('eval/runs')
  createEvalRun() {
    return this.knowledgeService.listEvalRuns().items[0];
  }

  @Get('eval/runs/:id')
  getEvalRun(@Param('id') id: string) {
    return this.knowledgeService.getEvalRun(id);
  }

  @Get('eval/runs/:id/results')
  listEvalRunResults() {
    return this.knowledgeService.listEvalRunResults();
  }
}
