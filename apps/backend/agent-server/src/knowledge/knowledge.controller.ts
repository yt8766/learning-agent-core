import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { KnowledgeService, type KnowledgeLoginRequest, type KnowledgeRefreshRequest } from './knowledge.service';

@Controller('knowledge/v1')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('auth/login')
  login(@Body() body: KnowledgeLoginRequest) {
    return this.knowledgeService.login(body);
  }

  @Post('auth/refresh')
  refresh(@Body() body: KnowledgeRefreshRequest) {
    return this.knowledgeService.refresh(body);
  }

  @Get('auth/me')
  me() {
    return this.knowledgeService.me();
  }

  @Post('auth/logout')
  logout() {
    return { ok: true };
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
