import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';

import { knowledgeApiFixtures } from './knowledge-api-fixtures';
import {
  KNOWLEDGE_EVAL_DEFAULT_CREATED_BY,
  KNOWLEDGE_EVAL_DEFAULT_TENANT_ID,
  type CreateKnowledgeEvalDatasetInput,
  type RunKnowledgeEvalDatasetInput
} from './interfaces/knowledge-eval.types';
import { KnowledgeObservabilityService } from './knowledge-observability.service';
import { KnowledgeIngestionService } from './knowledge-ingestion.service';
import { KnowledgeRagService } from './knowledge-rag.service';
import {
  KNOWLEDGE_RAG_DEFAULT_CREATED_BY,
  KNOWLEDGE_RAG_DEFAULT_TENANT_ID,
  type KnowledgeRagChatInput
} from './interfaces/knowledge-rag.types';
import type { KnowledgeDocumentRecord } from './interfaces/knowledge-records.types';
import { KnowledgeEvalService } from './knowledge-eval.service';
import { KNOWLEDGE_REPOSITORY, type KnowledgeRepository } from './repositories/knowledge.repository';
import {
  getEmptyKnowledgeMetrics,
  getFixtureKnowledgeMetrics,
  getFixtureTracePage,
  page,
  toKnowledgeBaseDto,
  toKnowledgeDocumentDto,
  toServerEvalDatasetInput,
  toServerEvalRunInput,
  toServerRagChatInput,
  uploadKnowledgeDocument
} from './knowledge.service.helpers';

export interface KnowledgeServiceOptions {
  repository?: KnowledgeRepository;
  ragService?: KnowledgeRagService;
  ingestionService?: KnowledgeIngestionService;
  observabilityService?: KnowledgeObservabilityService;
  evalService?: KnowledgeEvalService;
  fixtureFallback?: boolean;
}

@Injectable()
export class KnowledgeService {
  private readonly repository?: KnowledgeRepository;
  private readonly ragService?: KnowledgeRagService;
  private readonly ingestionService?: KnowledgeIngestionService;
  private readonly observabilityService?: KnowledgeObservabilityService;
  private readonly evalService?: KnowledgeEvalService;
  private readonly fixtureFallback: boolean;

  constructor(
    @Optional()
    @Inject(KNOWLEDGE_REPOSITORY)
    repositoryOrOptions?: KnowledgeRepository | KnowledgeServiceOptions,
    @Optional()
    ragService?: KnowledgeRagService,
    @Optional()
    ingestionService?: KnowledgeIngestionService,
    @Optional()
    observabilityService?: KnowledgeObservabilityService,
    @Optional()
    evalService?: KnowledgeEvalService,
    @Optional()
    options?: KnowledgeServiceOptions
  ) {
    if (isKnowledgeServiceOptions(repositoryOrOptions)) {
      this.repository = repositoryOrOptions.repository;
      this.ragService = repositoryOrOptions.ragService;
      this.ingestionService = repositoryOrOptions.ingestionService;
      this.observabilityService = repositoryOrOptions.observabilityService;
      this.evalService = repositoryOrOptions.evalService;
      this.fixtureFallback = repositoryOrOptions.fixtureFallback ?? true;
      return;
    }

    this.repository = repositoryOrOptions;
    this.ragService = ragService;
    this.ingestionService = ingestionService;
    this.observabilityService = observabilityService;
    this.evalService = evalService;
    this.fixtureFallback = options?.fixtureFallback ?? true;
  }

  getDashboardOverview() {
    return knowledgeApiFixtures.dashboard;
  }

  async listKnowledgeBases() {
    if (this.repository) {
      const records = await this.repository.listKnowledgeBases({ tenantId: KNOWLEDGE_RAG_DEFAULT_TENANT_ID });
      if (records.items.length > 0) {
        return page(records.items.map(toKnowledgeBaseDto));
      }
      if (!this.fixtureFallback) {
        return page([]);
      }
    }

    return knowledgeApiFixtures.knowledgeBases;
  }

  async getKnowledgeBase(id: string) {
    if (this.repository) {
      const records = await this.repository.listKnowledgeBases({ tenantId: KNOWLEDGE_RAG_DEFAULT_TENANT_ID });
      const record = records.items.find(item => item.id === id);
      if (record) {
        return toKnowledgeBaseDto(record);
      }
      if (!this.fixtureFallback) {
        throw new NotFoundException({ code: 'knowledge_base_not_found', message: 'Knowledge base not found.' });
      }
    }

    const fixture = knowledgeApiFixtures.knowledgeBases.items.find(item => item.id === id);
    if (!fixture) {
      throw new NotFoundException({ code: 'knowledge_base_not_found', message: 'Knowledge base not found.' });
    }
    return fixture;
  }

  async listDocuments() {
    if (this.repository) {
      const documents = await this.repository.listDocuments({
        tenantId: KNOWLEDGE_RAG_DEFAULT_TENANT_ID,
        knowledgeBaseId: 'kb_frontend'
      });
      if (documents.items.length > 0) {
        return page(await Promise.all(documents.items.map(record => this.toDocumentDto(record))));
      }
      if (!this.fixtureFallback) {
        return page([]);
      }
    }
    return knowledgeApiFixtures.documents;
  }

  async getDocument(id: string) {
    if (this.repository) {
      const documents = await this.repository.listDocuments({
        tenantId: KNOWLEDGE_RAG_DEFAULT_TENANT_ID,
        knowledgeBaseId: 'kb_frontend'
      });
      const record = documents.items.find(item => item.id === id);
      if (record) {
        return this.toDocumentDto(record);
      }
      if (!this.fixtureFallback) {
        throw new NotFoundException({ code: 'document_not_found', message: 'Document not found.' });
      }
    }
    const fixture = knowledgeApiFixtures.documents.items.find(item => item.id === id);
    if (!fixture) {
      throw new NotFoundException({ code: 'document_not_found', message: 'Document not found.' });
    }
    return fixture;
  }

  listDocumentJobs() {
    if (!this.fixtureFallback) {
      return page([]);
    }
    return page(knowledgeApiFixtures.jobs);
  }

  listDocumentChunks() {
    if (!this.fixtureFallback) {
      return page([]);
    }
    return knowledgeApiFixtures.chunks;
  }

  async uploadDocument(input: { knowledgeBaseId: string; fileName: string; bytes: Buffer }) {
    return uploadKnowledgeDocument(input, this.ingestionService);
  }

  async reprocessDocument(id: string) {
    const document = await this.getDocument(id);
    return {
      document,
      job: {
        id: `job_reprocess_${id}`,
        documentId: id,
        status: 'queued',
        currentStage: 'upload_received',
        stages: [],
        createdAt: new Date().toISOString()
      }
    };
  }

  async chat(input: KnowledgeRagChatInput) {
    const secureInput = toServerRagChatInput(input);
    if (this.ragService) {
      return this.ragService.answer(secureInput);
    }
    if (this.repository) {
      return new KnowledgeRagService({ repo: this.repository }).answer(secureInput);
    }

    if (!this.fixtureFallback) {
      throw new Error('knowledge RAG repository or service is required');
    }

    return {
      ...knowledgeApiFixtures.chatResponse,
      conversationId: input.conversationId ?? knowledgeApiFixtures.chatResponse.conversationId,
      userMessage: {
        ...knowledgeApiFixtures.chatResponse.userMessage,
        conversationId: input.conversationId ?? knowledgeApiFixtures.chatResponse.conversationId,
        content: input.message ?? knowledgeApiFixtures.chatResponse.userMessage.content
      },
      assistantMessage: {
        ...knowledgeApiFixtures.chatResponse.assistantMessage,
        conversationId: input.conversationId ?? knowledgeApiFixtures.chatResponse.conversationId
      }
    };
  }

  createFeedback(messageId: string, input: { rating?: 'positive' | 'negative'; category?: string; comment?: string }) {
    return {
      ...knowledgeApiFixtures.chatResponse.assistantMessage,
      id: messageId,
      feedback: {
        rating: input.rating ?? 'negative',
        category: input.category
      }
    };
  }

  getObservabilityMetrics(query: { knowledgeBaseId?: string } = {}) {
    const observabilityService = this.resolveObservabilityService();
    if (observabilityService) {
      return observabilityService.getMetrics({
        tenantId: KNOWLEDGE_RAG_DEFAULT_TENANT_ID,
        knowledgeBaseId: query.knowledgeBaseId
      });
    }

    if (!this.fixtureFallback) {
      return getEmptyKnowledgeMetrics();
    }

    return getFixtureKnowledgeMetrics();
  }

  listTraces(query: { knowledgeBaseId?: string } = {}) {
    const observabilityService = this.resolveObservabilityService();
    if (observabilityService) {
      return observabilityService.listTraces({
        tenantId: KNOWLEDGE_RAG_DEFAULT_TENANT_ID,
        knowledgeBaseId: query.knowledgeBaseId
      });
    }

    if (!this.fixtureFallback) {
      return page([]);
    }

    return getFixtureTracePage();
  }

  getTrace(id?: string) {
    const observabilityService = this.resolveObservabilityService();
    if (observabilityService && id) {
      return observabilityService.getTrace({ tenantId: KNOWLEDGE_RAG_DEFAULT_TENANT_ID, id });
    }

    if (!this.fixtureFallback) {
      throw new NotFoundException({ code: 'trace_not_found', message: 'Trace not found.' });
    }

    return knowledgeApiFixtures.traceDetail;
  }

  listEvalDatasets() {
    const evalService = this.resolveEvalService();
    if (evalService) {
      return evalService.listDatasets({ tenantId: KNOWLEDGE_EVAL_DEFAULT_TENANT_ID });
    }

    if (!this.fixtureFallback) {
      return page([]);
    }

    return knowledgeApiFixtures.evalDatasets;
  }

  createEvalDataset(input: CreateKnowledgeEvalDatasetInput) {
    return this.requireEvalService().createDataset(toServerEvalDatasetInput(input));
  }

  listEvalRuns(query: { datasetId?: string } = {}) {
    const evalService = this.resolveEvalService();
    if (evalService) {
      return evalService.listRuns({ tenantId: KNOWLEDGE_EVAL_DEFAULT_TENANT_ID, datasetId: query.datasetId });
    }

    if (!this.fixtureFallback) {
      return page([]);
    }

    return knowledgeApiFixtures.evalRuns;
  }

  getEvalRun(id: string) {
    const evalService = this.resolveEvalService();
    if (evalService) {
      return evalService.getRun({ tenantId: KNOWLEDGE_EVAL_DEFAULT_TENANT_ID, id });
    }

    if (!this.fixtureFallback) {
      throw new NotFoundException({ code: 'eval_run_not_found', message: 'Eval run not found.' });
    }

    return knowledgeApiFixtures.evalRuns.items.find(item => item.id === id) ?? knowledgeApiFixtures.evalRuns.items[0];
  }

  createEvalRun(input: RunKnowledgeEvalDatasetInput) {
    return this.requireEvalService().runDataset(toServerEvalRunInput(input));
  }

  listEvalRunResults(runId?: string) {
    const evalService = this.resolveEvalService();
    if (evalService && runId) {
      return evalService.listRunResults({ tenantId: KNOWLEDGE_EVAL_DEFAULT_TENANT_ID, runId });
    }

    if (!this.fixtureFallback) {
      return page([]);
    }

    return knowledgeApiFixtures.evalResults;
  }

  compareEvalRuns(input: { baselineRunId: string; candidateRunId: string; tenantId?: string }) {
    return this.requireEvalService().compareRuns({
      tenantId: KNOWLEDGE_EVAL_DEFAULT_TENANT_ID,
      baselineRunId: input.baselineRunId,
      candidateRunId: input.candidateRunId
    });
  }

  private resolveObservabilityService(): KnowledgeObservabilityService | undefined {
    if (this.observabilityService) {
      return this.observabilityService;
    }
    if (this.repository) {
      return new KnowledgeObservabilityService({ repo: this.repository });
    }
    return undefined;
  }

  private resolveEvalService(): KnowledgeEvalService | undefined {
    if (this.evalService) {
      return this.evalService;
    }
    if (this.repository) {
      return new KnowledgeEvalService({ repo: this.repository });
    }
    return undefined;
  }

  private requireEvalService(): KnowledgeEvalService {
    const evalService = this.resolveEvalService();
    if (!evalService) {
      throw new Error('knowledge eval repository is required');
    }
    return evalService;
  }

  private async toDocumentDto(record: KnowledgeDocumentRecord) {
    return toKnowledgeDocumentDto(record, this.repository);
  }
}

function isKnowledgeServiceOptions(
  input: KnowledgeRepository | KnowledgeServiceOptions | undefined
): input is KnowledgeServiceOptions {
  return (
    typeof input === 'object' &&
    input !== null &&
    ('fixtureFallback' in input ||
      'repository' in input ||
      'ragService' in input ||
      'ingestionService' in input ||
      'observabilityService' in input ||
      'evalService' in input)
  );
}
