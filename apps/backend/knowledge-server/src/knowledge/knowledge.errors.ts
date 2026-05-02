import type { KnowledgeServiceErrorCode } from '@agent/core';

export type KnowledgeServerErrorCode =
  | KnowledgeServiceErrorCode
  | 'knowledge_upload_invalid_type'
  | 'knowledge_upload_too_large'
  | 'knowledge_upload_oss_config_invalid'
  | 'knowledge_upload_oss_failed'
  | 'knowledge_upload_permission_denied'
  | 'knowledge_upload_not_found'
  | 'knowledge_document_create_failed'
  | 'knowledge_document_not_found'
  | 'knowledge_job_not_found'
  | 'knowledge_ingestion_enqueue_failed'
  | 'knowledge_parse_failed'
  | 'knowledge_chunk_failed'
  | 'knowledge_embedding_failed'
  | 'knowledge_index_failed';

export class KnowledgeServiceError extends Error {
  constructor(
    readonly code: KnowledgeServerErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'KnowledgeServiceError';
  }
}
