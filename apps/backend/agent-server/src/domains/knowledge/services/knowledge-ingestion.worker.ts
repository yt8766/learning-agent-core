import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import type { DocumentChunkRecord, DocumentProcessingJobRecord } from '../domain/knowledge-document.types';
import { KnowledgeMemoryRepository } from '../repositories/knowledge-memory.repository';
import type { KnowledgeRepository } from '../repositories/knowledge.repository';
import { InMemoryOssStorageProvider } from '../storage/in-memory-oss-storage.provider';
import type { OssStorageProvider } from '../storage/oss-storage.provider';
import { KnowledgeServiceError } from './knowledge-service.error';

@Injectable()
export class KnowledgeIngestionWorker {
  constructor(
    @Inject(KnowledgeMemoryRepository) private readonly repository: KnowledgeRepository,
    @Inject(InMemoryOssStorageProvider) private readonly storage: OssStorageProvider
  ) {}

  async process(job: DocumentProcessingJobRecord): Promise<DocumentProcessingJobRecord> {
    const document = await this.repository.findDocument(job.documentId);
    if (!document) {
      throw new KnowledgeServiceError('knowledge_document_not_found', '文档不存在');
    }
    const object = await this.storage.getObject(document.objectKey);
    if (!object) {
      throw new KnowledgeServiceError('knowledge_upload_not_found', '上传文件不存在');
    }

    const chunks = splitIntoChunks(object.body.toString('utf8')).map((content, ordinal): DocumentChunkRecord => {
      const now = new Date().toISOString();
      return {
        id: `chunk_${randomUUID()}`,
        documentId: document.id,
        ordinal,
        content,
        tokenCount: countTokens(content),
        embeddingStatus: 'succeeded',
        vectorIndexStatus: 'succeeded',
        keywordIndexStatus: 'succeeded',
        createdAt: now,
        updatedAt: now
      };
    });

    await this.repository.saveChunks(document.id, chunks);
    const updatedAt = new Date().toISOString();
    await this.repository.updateDocument({
      ...document,
      status: 'ready',
      chunkCount: chunks.length,
      embeddedChunkCount: chunks.length,
      updatedAt
    });

    return this.repository.updateJob({
      ...job,
      status: 'succeeded',
      stage: 'succeeded',
      currentStage: 'commit',
      progress: { percent: 100, processedChunks: chunks.length, totalChunks: chunks.length },
      updatedAt,
      stages: [
        ...job.stages,
        { stage: 'chunk', status: 'succeeded', startedAt: updatedAt, completedAt: updatedAt },
        { stage: 'embed', status: 'succeeded', startedAt: updatedAt, completedAt: updatedAt },
        { stage: 'index_vector', status: 'succeeded', startedAt: updatedAt, completedAt: updatedAt },
        { stage: 'commit', status: 'succeeded', startedAt: updatedAt, completedAt: updatedAt }
      ]
    });
  }
}

function splitIntoChunks(content: string): string[] {
  return content
    .split(/\n\s*\n/g)
    .map(chunk => chunk.trim())
    .filter(Boolean);
}

function countTokens(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
}
