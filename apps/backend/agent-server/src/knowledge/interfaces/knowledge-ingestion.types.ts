export type KnowledgeIngestionStageName = 'uploaded' | 'parsed' | 'chunked' | 'embedded' | 'indexed' | 'failed';

export interface KnowledgeIngestionStage {
  stage: KnowledgeIngestionStageName;
  at: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeDocumentParserInput {
  fileName: string;
  bytes: Buffer;
}

export interface KnowledgeDocumentParserResult {
  title: string;
  text: string;
  metadata: Record<string, unknown>;
}

export interface KnowledgeDocumentParser {
  parse(input: KnowledgeDocumentParserInput): Promise<KnowledgeDocumentParserResult>;
}

export interface KnowledgeEmbedder {
  embedTexts(texts: string[]): Promise<number[][]>;
}

export interface KnowledgeVectorStoreUpsertChunk {
  id: string;
  tenantId: string;
  knowledgeBaseId: string;
  documentId: string;
  text: string;
  ordinal: number;
  tokenCount: number;
  embedding: number[];
  metadata?: Record<string, unknown>;
}

export interface KnowledgeVectorStoreUpsertInput {
  tenantId: string;
  knowledgeBaseId: string;
  documentId: string;
  chunks: KnowledgeVectorStoreUpsertChunk[];
}

export interface KnowledgeVectorStoreSearchInput {
  tenantId: string;
  knowledgeBaseId: string;
  embedding: number[];
  topK: number;
  filters?: {
    documentIds?: string[];
    metadata?: Record<string, unknown>;
  };
}

export interface KnowledgeVectorStoreSearchMatch {
  chunkId: string;
  documentId: string;
  score: number;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeVectorStore {
  upsert(input: KnowledgeVectorStoreUpsertInput): Promise<{ inserted: number }>;
  search(input: KnowledgeVectorStoreSearchInput): Promise<{ matches: KnowledgeVectorStoreSearchMatch[] }>;
  deleteByDocumentId(input: {
    tenantId: string;
    knowledgeBaseId: string;
    documentId: string;
  }): Promise<{ deleted: number }>;
}

export interface KnowledgeProcessUploadedDocumentInput {
  tenantId: string;
  knowledgeBaseId: string;
  documentId: string;
  fileName: string;
  bytes: Buffer;
}

export interface KnowledgeIngestionResult {
  status: 'indexed' | 'failed';
  chunkCount: number;
  stages: KnowledgeIngestionStage[];
  reason?: string;
}
