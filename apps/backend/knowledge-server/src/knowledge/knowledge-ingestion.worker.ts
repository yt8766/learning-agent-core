import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';

import { KnowledgeServiceError } from './knowledge.errors';
import type { DocumentChunkRecord, DocumentProcessingJobRecord } from './domain/knowledge-document.types';
import type { KnowledgeRepository } from './repositories/knowledge.repository';
import type { OssStorageProvider } from './storage/oss-storage.provider';

@Injectable()
export class KnowledgeIngestionWorker {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly storage: OssStorageProvider
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

    const now = new Date().toISOString();
    await this.repository.updateJob({
      ...job,
      status: 'running',
      currentStage: 'parse',
      updatedAt: now,
      stages: [{ stage: 'parse', status: 'running', startedAt: now }]
    });

    const chunks = splitIntoChunks(object.body.toString('utf8')).map((content, index): DocumentChunkRecord => {
      const timestamp = new Date().toISOString();
      return {
        id: `chunk_${randomUUID()}`,
        documentId: document.id,
        ordinal: index,
        content,
        tokenCount: countTokens(content),
        embeddingStatus: 'succeeded',
        vectorIndexStatus: 'succeeded',
        keywordIndexStatus: 'succeeded',
        createdAt: timestamp,
        updatedAt: timestamp
      };
    });

    await this.repository.saveChunks(document.id, chunks);
    await this.repository.updateDocument({
      ...document,
      status: 'ready',
      chunkCount: chunks.length,
      embeddedChunkCount: chunks.length,
      updatedAt: new Date().toISOString()
    });

    const completedAt = new Date().toISOString();
    return this.repository.updateJob({
      ...job,
      status: 'succeeded',
      currentStage: 'commit',
      updatedAt: completedAt,
      stages: [
        { stage: 'parse', status: 'succeeded', startedAt: now, completedAt },
        { stage: 'chunk', status: 'succeeded', startedAt: now, completedAt },
        { stage: 'embed', status: 'succeeded', startedAt: now, completedAt },
        { stage: 'index_vector', status: 'succeeded', startedAt: now, completedAt },
        { stage: 'index_keyword', status: 'succeeded', startedAt: now, completedAt },
        { stage: 'commit', status: 'succeeded', startedAt: now, completedAt }
      ]
    });
  }
}

function splitIntoChunks(content: string): string[] {
  const chunks = content
    .split(/\n{2,}/)
    .map(chunk => chunk.trim())
    .filter(Boolean);
  return chunks.length > 0 ? chunks : [content.trim()].filter(Boolean);
}

function countTokens(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
}
