import { Injectable } from '@nestjs/common';

import type {
  KnowledgeBaseRecord,
  KnowledgeChatMessageRecord,
  KnowledgeChunkRecord,
  KnowledgeDocumentRecord,
  KnowledgeEvalDatasetRecord,
  KnowledgeEvalResultRecord,
  KnowledgeEvalRunRecord,
  KnowledgeTraceRecord
} from '../interfaces/knowledge-records.types';
import type {
  KnowledgeChatMessageQuery,
  KnowledgeChunkQuery,
  KnowledgeDocumentQuery,
  KnowledgeEvalDatasetDetailQuery,
  KnowledgeEvalResultQuery,
  KnowledgeEvalRunDetailQuery,
  KnowledgeEvalRunQuery,
  KnowledgeRepository,
  KnowledgeRepositoryListResult,
  KnowledgeTenantQuery,
  KnowledgeTraceQuery
} from './knowledge.repository';

@Injectable()
export class InMemoryKnowledgeRepository implements KnowledgeRepository {
  private readonly knowledgeBases: KnowledgeBaseRecord[] = [];
  private readonly documents: KnowledgeDocumentRecord[] = [];
  private readonly chunks: KnowledgeChunkRecord[] = [];
  private readonly chatMessages: KnowledgeChatMessageRecord[] = [];
  private readonly evalDatasets: KnowledgeEvalDatasetRecord[] = [];
  private readonly evalRuns: KnowledgeEvalRunRecord[] = [];
  private readonly evalResults: KnowledgeEvalResultRecord[] = [];
  private readonly traces: KnowledgeTraceRecord[] = [];

  async createKnowledgeBase(record: KnowledgeBaseRecord): Promise<KnowledgeBaseRecord> {
    const stored = copyRecord(record);
    this.knowledgeBases.push(stored);
    return copyRecord(stored);
  }

  async listKnowledgeBases(query: KnowledgeTenantQuery): Promise<KnowledgeRepositoryListResult<KnowledgeBaseRecord>> {
    return listRecords(this.knowledgeBases.filter(record => record.tenantId === query.tenantId));
  }

  async createDocument(record: KnowledgeDocumentRecord): Promise<KnowledgeDocumentRecord> {
    const stored = copyRecord(record);
    const index = this.documents.findIndex(
      document =>
        document.tenantId === record.tenantId &&
        document.knowledgeBaseId === record.knowledgeBaseId &&
        document.id === record.id
    );
    if (index >= 0) {
      this.documents[index] = stored;
    } else {
      this.documents.push(stored);
    }
    return copyRecord(stored);
  }

  async listDocuments(query: KnowledgeDocumentQuery): Promise<KnowledgeRepositoryListResult<KnowledgeDocumentRecord>> {
    return listRecords(
      this.documents.filter(
        record => record.tenantId === query.tenantId && record.knowledgeBaseId === query.knowledgeBaseId
      )
    );
  }

  async createChunk(record: KnowledgeChunkRecord): Promise<KnowledgeChunkRecord> {
    const stored = copyRecord(record);
    this.chunks.push(stored);
    return copyRecord(stored);
  }

  async listChunks(query: KnowledgeChunkQuery): Promise<KnowledgeRepositoryListResult<KnowledgeChunkRecord>> {
    return listRecords(
      this.chunks.filter(
        record =>
          record.tenantId === query.tenantId &&
          (query.documentId === undefined || record.documentId === query.documentId) &&
          (query.knowledgeBaseId === undefined || record.knowledgeBaseId === query.knowledgeBaseId)
      )
    );
  }

  async createChatMessage(record: KnowledgeChatMessageRecord): Promise<KnowledgeChatMessageRecord> {
    const stored = copyRecord(record);
    this.chatMessages.push(stored);
    return copyRecord(stored);
  }

  async listChatMessages(
    query: KnowledgeChatMessageQuery
  ): Promise<KnowledgeRepositoryListResult<KnowledgeChatMessageRecord>> {
    return listRecords(
      this.chatMessages.filter(
        record => record.tenantId === query.tenantId && record.conversationId === query.conversationId
      )
    );
  }

  async createEvalRun(record: KnowledgeEvalRunRecord): Promise<KnowledgeEvalRunRecord> {
    const stored = copyRecord(record);
    this.evalRuns.push(stored);
    return copyRecord(stored);
  }

  async listEvalRuns(query: KnowledgeEvalRunQuery): Promise<KnowledgeRepositoryListResult<KnowledgeEvalRunRecord>> {
    return listRecords(
      this.evalRuns.filter(
        record =>
          record.tenantId === query.tenantId && (query.datasetId === undefined || record.datasetId === query.datasetId)
      )
    );
  }

  async getEvalRun(query: KnowledgeEvalRunDetailQuery): Promise<KnowledgeEvalRunRecord | undefined> {
    const record = this.evalRuns.find(run => run.tenantId === query.tenantId && run.id === query.id);
    return record ? copyRecord(record) : undefined;
  }

  async updateEvalRun(record: KnowledgeEvalRunRecord): Promise<KnowledgeEvalRunRecord> {
    const index = this.evalRuns.findIndex(run => run.tenantId === record.tenantId && run.id === record.id);
    const stored = copyRecord(record);
    if (index >= 0) {
      this.evalRuns[index] = stored;
    } else {
      this.evalRuns.push(stored);
    }
    return copyRecord(stored);
  }

  async createEvalDataset(record: KnowledgeEvalDatasetRecord): Promise<KnowledgeEvalDatasetRecord> {
    const stored = copyRecord(record);
    this.evalDatasets.push(stored);
    return copyRecord(stored);
  }

  async listEvalDatasets(
    query: KnowledgeTenantQuery
  ): Promise<KnowledgeRepositoryListResult<KnowledgeEvalDatasetRecord>> {
    return listRecords(this.evalDatasets.filter(record => record.tenantId === query.tenantId));
  }

  async getEvalDataset(query: KnowledgeEvalDatasetDetailQuery): Promise<KnowledgeEvalDatasetRecord | undefined> {
    const record = this.evalDatasets.find(dataset => dataset.tenantId === query.tenantId && dataset.id === query.id);
    return record ? copyRecord(record) : undefined;
  }

  async createEvalResult(record: KnowledgeEvalResultRecord): Promise<KnowledgeEvalResultRecord> {
    const stored = copyRecord(record);
    this.evalResults.push(stored);
    return copyRecord(stored);
  }

  async listEvalResults(
    query: KnowledgeEvalResultQuery
  ): Promise<KnowledgeRepositoryListResult<KnowledgeEvalResultRecord>> {
    return listRecords(
      this.evalResults.filter(record => record.tenantId === query.tenantId && record.runId === query.runId)
    );
  }

  async createTrace(record: KnowledgeTraceRecord): Promise<KnowledgeTraceRecord> {
    const stored = copyRecord(record);
    this.traces.push(stored);
    return copyRecord(stored);
  }

  async listTraces(query: KnowledgeTraceQuery): Promise<KnowledgeRepositoryListResult<KnowledgeTraceRecord>> {
    return listRecords(
      this.traces.filter(
        record =>
          record.tenantId === query.tenantId &&
          (query.knowledgeBaseId === undefined || record.knowledgeBaseIds.includes(query.knowledgeBaseId)) &&
          (query.operation === undefined || record.operation === query.operation) &&
          (query.status === undefined || record.status === query.status)
      )
    );
  }

  async getTrace(query: { tenantId: string; id: string }): Promise<KnowledgeTraceRecord | undefined> {
    const record = this.traces.find(trace => trace.tenantId === query.tenantId && trace.id === query.id);
    return record ? copyRecord(record) : undefined;
  }
}

function listRecords<T>(records: readonly T[]): KnowledgeRepositoryListResult<T> {
  return { items: records.map(record => copyRecord(record)) };
}

function copyRecord<T>(record: T): T {
  return JSON.parse(JSON.stringify(record)) as T;
}
