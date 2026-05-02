import type {
  KnowledgeBase,
  KnowledgeBaseCreateRequest,
  KnowledgeBaseMember,
  KnowledgeBaseMemberCreateRequest
} from '@agent/core';

import type {
  DocumentChunkRecord,
  DocumentProcessingJobRecord,
  KnowledgeDocumentRecord
} from '../domain/knowledge-document.types';
import type { KnowledgeUploadRecord } from '../domain/knowledge-upload.types';
import { mapBase, mapChunk, mapDocument, mapJob, mapMember, mapUpload } from './knowledge-postgres.mappers';
import type { KnowledgeRepository } from './knowledge.repository';

export interface PostgresKnowledgeClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

export class PostgresKnowledgeRepository implements KnowledgeRepository {
  constructor(private readonly client: PostgresKnowledgeClient) {}

  async createBase(
    input: KnowledgeBaseCreateRequest & { id: string; createdByUserId: string }
  ): Promise<KnowledgeBase> {
    const result = await this.client.query(
      `insert into knowledge_bases (id, name, description, created_by_user_id, status)
       values ($1, $2, $3, $4, 'active')
       returning id, name, description, created_by_user_id, status, created_at, updated_at`,
      [input.id, input.name, input.description ?? '', input.createdByUserId]
    );
    const base = mapBase(requiredRow(result.rows[0], 'knowledge base'));
    await this.addMember({ knowledgeBaseId: base.id, userId: input.createdByUserId, role: 'owner' });
    return base;
  }

  async listBasesForUser(userId: string): Promise<KnowledgeBase[]> {
    const result = await this.client.query(
      `select b.id, b.name, b.description, b.created_by_user_id, b.status, b.created_at, b.updated_at
       from knowledge_bases b
       join knowledge_base_members m on m.knowledge_base_id = b.id
       where m.user_id = $1
       order by b.updated_at desc`,
      [userId]
    );
    return result.rows.map(mapBase);
  }

  async findBase(baseId: string): Promise<KnowledgeBase | undefined> {
    const result = await this.client.query(
      `select id, name, description, created_by_user_id, status, created_at, updated_at
       from knowledge_bases
       where id = $1
       limit 1`,
      [baseId]
    );
    return result.rows[0] ? mapBase(result.rows[0]) : undefined;
  }

  async addMember(input: KnowledgeBaseMemberCreateRequest & { knowledgeBaseId: string }): Promise<KnowledgeBaseMember> {
    const result = await this.client.query(
      `insert into knowledge_base_members (knowledge_base_id, user_id, role)
       values ($1, $2, $3)
       on conflict (knowledge_base_id, user_id) do update set role = excluded.role, updated_at = now()
       returning knowledge_base_id, user_id, role, created_at, updated_at`,
      [input.knowledgeBaseId, input.userId, input.role]
    );
    return mapMember(requiredRow(result.rows[0], 'knowledge base member'));
  }

  async findMember(baseId: string, userId: string): Promise<KnowledgeBaseMember | undefined> {
    const result = await this.client.query(
      `select knowledge_base_id, user_id, role, created_at, updated_at
       from knowledge_base_members
       where knowledge_base_id = $1 and user_id = $2
       limit 1`,
      [baseId, userId]
    );
    return result.rows[0] ? mapMember(result.rows[0]) : undefined;
  }

  async listMembers(baseId: string): Promise<KnowledgeBaseMember[]> {
    const result = await this.client.query(
      `select knowledge_base_id, user_id, role, created_at, updated_at
       from knowledge_base_members
       where knowledge_base_id = $1
       order by user_id`,
      [baseId]
    );
    return result.rows.map(mapMember);
  }

  async saveUpload(input: KnowledgeUploadRecord): Promise<KnowledgeUploadRecord> {
    const result = await this.client.query(
      `insert into knowledge_uploads
        (upload_id, knowledge_base_id, filename, size_bytes, content_type, object_key, oss_url, uploaded_by_user_id, uploaded_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning upload_id, knowledge_base_id, filename, size_bytes, content_type, object_key, oss_url, uploaded_by_user_id, uploaded_at`,
      [
        input.uploadId,
        input.knowledgeBaseId,
        input.filename,
        input.size,
        input.contentType,
        input.objectKey,
        input.ossUrl,
        input.uploadedByUserId,
        input.uploadedAt
      ]
    );
    return mapUpload(requiredRow(result.rows[0], 'knowledge upload'));
  }

  async findUpload(uploadId: string): Promise<KnowledgeUploadRecord | undefined> {
    const result = await this.client.query(
      `select upload_id, knowledge_base_id, filename, size_bytes, content_type, object_key, oss_url, uploaded_by_user_id, uploaded_at
       from knowledge_uploads
       where upload_id = $1
       limit 1`,
      [uploadId]
    );
    return result.rows[0] ? mapUpload(result.rows[0]) : undefined;
  }

  async createDocument(input: KnowledgeDocumentRecord): Promise<KnowledgeDocumentRecord> {
    const result = await this.client.query(
      `insert into knowledge_documents
        (id, workspace_id, knowledge_base_id, upload_id, object_key, filename, title, source_type, status, version, chunk_count, embedded_chunk_count, created_by, metadata, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       returning id, workspace_id, knowledge_base_id, upload_id, object_key, filename, title, source_type, status, version, chunk_count, embedded_chunk_count, created_by, metadata, created_at, updated_at`,
      [
        input.id,
        input.workspaceId,
        input.knowledgeBaseId,
        input.uploadId,
        input.objectKey,
        input.filename,
        input.title,
        input.sourceType,
        input.status,
        input.version,
        input.chunkCount,
        input.embeddedChunkCount,
        input.createdBy,
        JSON.stringify(input.metadata),
        input.createdAt,
        input.updatedAt
      ]
    );
    return mapDocument(requiredRow(result.rows[0], 'knowledge document'));
  }

  async updateDocument(input: KnowledgeDocumentRecord): Promise<KnowledgeDocumentRecord> {
    const result = await this.client.query(
      `update knowledge_documents
       set status = $2, chunk_count = $3, embedded_chunk_count = $4, metadata = $5, updated_at = $6
       where id = $1
       returning id, workspace_id, knowledge_base_id, upload_id, object_key, filename, title, source_type, status, version, chunk_count, embedded_chunk_count, created_by, metadata, created_at, updated_at`,
      [
        input.id,
        input.status,
        input.chunkCount,
        input.embeddedChunkCount,
        JSON.stringify(input.metadata),
        input.updatedAt
      ]
    );
    return mapDocument(requiredRow(result.rows[0], 'knowledge document'));
  }

  async findDocument(documentId: string): Promise<KnowledgeDocumentRecord | undefined> {
    const result = await this.client.query(
      `select id, workspace_id, knowledge_base_id, upload_id, object_key, filename, title, source_type, status, version, chunk_count, embedded_chunk_count, created_by, metadata, created_at, updated_at
       from knowledge_documents
       where id = $1
       limit 1`,
      [documentId]
    );
    return result.rows[0] ? mapDocument(result.rows[0]) : undefined;
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.client.query('delete from knowledge_documents where id = $1', [documentId]);
  }

  async listDocumentsForBase(baseId: string): Promise<KnowledgeDocumentRecord[]> {
    const result = await this.client.query(
      `select id, workspace_id, knowledge_base_id, upload_id, object_key, filename, title, source_type, status, version, chunk_count, embedded_chunk_count, created_by, metadata, created_at, updated_at
       from knowledge_documents
       where knowledge_base_id = $1
       order by updated_at desc`,
      [baseId]
    );
    return result.rows.map(mapDocument);
  }

  async createJob(input: DocumentProcessingJobRecord): Promise<DocumentProcessingJobRecord> {
    const result = await this.client.query(
      `insert into knowledge_document_jobs
        (id, document_id, status, stage, current_stage, stages, progress, error, error_code, error_message, attempts, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       returning id, document_id, status, stage, current_stage, stages, progress, error, error_code, error_message, attempts, created_at, updated_at`,
      [
        input.id,
        input.documentId,
        input.status,
        input.stage,
        input.currentStage,
        JSON.stringify(input.stages),
        JSON.stringify(input.progress),
        input.error ? JSON.stringify(input.error) : null,
        input.errorCode ?? null,
        input.errorMessage ?? null,
        input.attempts,
        input.createdAt,
        input.updatedAt
      ]
    );
    return mapJob(requiredRow(result.rows[0], 'document job'));
  }

  async updateJob(input: DocumentProcessingJobRecord): Promise<DocumentProcessingJobRecord> {
    const result = await this.client.query(
      `update knowledge_document_jobs
       set status = $2, stage = $3, current_stage = $4, stages = $5, progress = $6, error = $7, error_code = $8, error_message = $9, attempts = $10, updated_at = $11
       where id = $1
       returning id, document_id, status, stage, current_stage, stages, progress, error, error_code, error_message, attempts, created_at, updated_at`,
      [
        input.id,
        input.status,
        input.stage,
        input.currentStage,
        JSON.stringify(input.stages),
        JSON.stringify(input.progress),
        input.error ? JSON.stringify(input.error) : null,
        input.errorCode ?? null,
        input.errorMessage ?? null,
        input.attempts,
        input.updatedAt
      ]
    );
    return mapJob(requiredRow(result.rows[0], 'document job'));
  }

  async findLatestJobForDocument(documentId: string): Promise<DocumentProcessingJobRecord | undefined> {
    const result = await this.client.query(
      `select id, document_id, status, stage, current_stage, stages, progress, error, error_code, error_message, attempts, created_at, updated_at
       from knowledge_document_jobs
       where document_id = $1
       order by created_at desc
       limit 1`,
      [documentId]
    );
    return result.rows[0] ? mapJob(result.rows[0]) : undefined;
  }

  async saveChunks(documentId: string, chunks: DocumentChunkRecord[]): Promise<DocumentChunkRecord[]> {
    await this.client.query('delete from knowledge_document_chunks where document_id = $1', [documentId]);
    const saved: DocumentChunkRecord[] = [];
    for (const chunk of chunks) {
      const result = await this.client.query(
        `insert into knowledge_document_chunks
          (id, document_id, ordinal, content, token_count, embedding_status, vector_index_status, keyword_index_status, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         returning id, document_id, ordinal, content, token_count, embedding_status, vector_index_status, keyword_index_status, created_at, updated_at`,
        [
          chunk.id,
          chunk.documentId,
          chunk.ordinal,
          chunk.content,
          chunk.tokenCount,
          chunk.embeddingStatus,
          chunk.vectorIndexStatus,
          chunk.keywordIndexStatus,
          chunk.createdAt,
          chunk.updatedAt
        ]
      );
      saved.push(mapChunk(requiredRow(result.rows[0], 'document chunk')));
    }
    return saved;
  }

  async listChunks(documentId: string): Promise<DocumentChunkRecord[]> {
    const result = await this.client.query(
      `select id, document_id, ordinal, content, token_count, embedding_status, vector_index_status, keyword_index_status, created_at, updated_at
       from knowledge_document_chunks
       where document_id = $1
       order by ordinal asc`,
      [documentId]
    );
    return result.rows.map(mapChunk);
  }
}

function requiredRow(row: Record<string, unknown> | undefined, name: string): Record<string, unknown> {
  if (!row) {
    throw new Error(`Missing ${name} row`);
  }
  return row;
}
