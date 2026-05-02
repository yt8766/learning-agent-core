import { Injectable } from '@nestjs/common';

import type {
  KnowledgeDocumentParser,
  KnowledgeEmbedder,
  KnowledgeIngestionResult,
  KnowledgeIngestionStage,
  KnowledgeIngestionStageName,
  KnowledgeProcessUploadedDocumentInput,
  KnowledgeVectorStore
} from './interfaces/knowledge-ingestion.types';
import type { KnowledgeChunkRecord, KnowledgeDocumentRecord } from './interfaces/knowledge-records.types';
import type { KnowledgeRepository } from './repositories/knowledge.repository';

const EMPTY_TEXT_REASON = 'Parsed document text is empty.';
const EMBEDDING_COUNT_MISMATCH_REASON = 'Embedding count does not match chunk count.';
const DUPLICATE_DOCUMENT_REASON = 'Document has already been processed.';
const DEFAULT_MAX_CHARS = 1200;
const DEFAULT_OVERLAP_CHARS = 160;

export interface KnowledgeIngestionServiceOptions {
  repo: KnowledgeRepository;
  parser?: KnowledgeDocumentParser;
  embedder?: KnowledgeEmbedder;
  vectorStore?: KnowledgeVectorStore;
  now?: () => Date;
}

@Injectable()
export class KnowledgeIngestionService {
  private readonly repo: KnowledgeRepository;
  private readonly parser: KnowledgeDocumentParser;
  private readonly embedder: KnowledgeEmbedder;
  private readonly vectorStore: KnowledgeVectorStore;
  private readonly now: () => Date;

  constructor(options: KnowledgeIngestionServiceOptions) {
    this.repo = options.repo;
    this.parser = options.parser ?? new PlainTextKnowledgeDocumentParser();
    this.embedder = options.embedder ?? new DeterministicKnowledgeEmbedder();
    this.vectorStore = options.vectorStore ?? new NoopKnowledgeVectorStore();
    this.now = options.now ?? (() => new Date());
  }

  async processUploadedDocument(input: KnowledgeProcessUploadedDocumentInput): Promise<KnowledgeIngestionResult> {
    const existingDocuments = await this.repo.listDocuments({
      tenantId: input.tenantId,
      knowledgeBaseId: input.knowledgeBaseId
    });
    if (existingDocuments.items.some(document => document.id === input.documentId)) {
      return {
        status: 'failed',
        reason: DUPLICATE_DOCUMENT_REASON,
        chunkCount: 0,
        stages: [{ stage: 'failed', at: this.timestamp(), reason: DUPLICATE_DOCUMENT_REASON }]
      };
    }

    const stages: KnowledgeIngestionStage[] = [];
    const pushStage = (
      stage: KnowledgeIngestionStageName,
      extra: Omit<KnowledgeIngestionStage, 'stage' | 'at'> = {}
    ) => {
      const item: KnowledgeIngestionStage = { stage, at: this.timestamp(), ...extra };
      stages.push(item);
      return item;
    };

    pushStage('uploaded', { metadata: { fileName: input.fileName, byteLength: input.bytes.length } });
    await this.repo.createDocument(
      this.createDocumentRecord(input, {
        title: input.fileName,
        status: 'indexing',
        metadata: this.createDocumentMetadata({ fileName: input.fileName }, stages)
      })
    );

    try {
      const parsed = await this.parser.parse({ fileName: input.fileName, bytes: input.bytes });
      pushStage('parsed', { metadata: { title: parsed.title, textLength: parsed.text.length } });

      if (parsed.text.trim().length === 0) {
        return this.failDocument(input, parsed.title || input.fileName, parsed.metadata, stages, EMPTY_TEXT_REASON);
      }

      const chunks = chunkText(parsed.text);
      pushStage('chunked', { metadata: { chunkCount: chunks.length } });

      const embeddings = await this.embedder.embedTexts(chunks);
      pushStage('embedded', { metadata: { embeddingCount: embeddings.length } });
      if (embeddings.length !== chunks.length) {
        return this.failDocument(
          input,
          parsed.title || input.fileName,
          parsed.metadata,
          stages,
          EMBEDDING_COUNT_MISMATCH_REASON
        );
      }

      const now = this.timestamp();
      const chunkRecords: KnowledgeChunkRecord[] = chunks.map((text, index) => ({
        id: `${input.documentId}-chunk-${String(index + 1).padStart(4, '0')}`,
        tenantId: input.tenantId,
        knowledgeBaseId: input.knowledgeBaseId,
        documentId: input.documentId,
        text,
        ordinal: index,
        tokenCount: estimateTokenCount(text),
        embedding: embeddings[index] ?? [],
        metadata: {
          fileName: input.fileName,
          title: parsed.title || input.fileName
        },
        createdAt: now,
        updatedAt: now
      }));

      const upsertResult = await this.vectorStore.upsert({
        tenantId: input.tenantId,
        knowledgeBaseId: input.knowledgeBaseId,
        documentId: input.documentId,
        chunks: chunkRecords.map(chunk => ({
          id: chunk.id,
          tenantId: chunk.tenantId,
          knowledgeBaseId: chunk.knowledgeBaseId,
          documentId: chunk.documentId,
          text: chunk.text,
          ordinal: chunk.ordinal ?? 0,
          tokenCount: chunk.tokenCount ?? 0,
          embedding: chunk.embedding ?? [],
          metadata: chunk.metadata
        }))
      });

      for (const chunk of chunkRecords) {
        await this.repo.createChunk(chunk);
      }

      pushStage('indexed', { metadata: { inserted: upsertResult.inserted } });
      await this.repo.createDocument(
        this.createDocumentRecord(input, {
          title: parsed.title || input.fileName,
          status: 'ready',
          metadata: this.createDocumentMetadata(parsed.metadata, stages, { indexedAt: this.timestamp() })
        })
      );

      return { status: 'indexed', chunkCount: chunkRecords.length, stages };
    } catch (error) {
      return this.failDocument(input, input.fileName, { fileName: input.fileName }, stages, getErrorReason(error));
    }
  }

  private createDocumentRecord(
    input: KnowledgeProcessUploadedDocumentInput,
    document: Pick<KnowledgeDocumentRecord, 'title' | 'status'> &
      Pick<Partial<KnowledgeDocumentRecord>, 'metadata' | 'errorMessage'>
  ): KnowledgeDocumentRecord {
    const now = this.timestamp();
    const metadataMimeType = document.metadata?.mimeType;

    return {
      id: input.documentId,
      tenantId: input.tenantId,
      knowledgeBaseId: input.knowledgeBaseId,
      title: document.title,
      status: document.status,
      mimeType: typeof metadataMimeType === 'string' ? metadataMimeType : undefined,
      metadata: document.metadata,
      errorMessage: document.errorMessage,
      createdAt: now,
      updatedAt: now
    };
  }

  private createDocumentMetadata(
    parsedMetadata: Record<string, unknown>,
    stages: readonly KnowledgeIngestionStage[],
    extra: Record<string, unknown> = {}
  ): Record<string, unknown> {
    return {
      ...parsedMetadata,
      ...extra,
      ingestionStages: stages
    };
  }

  private timestamp() {
    return this.now().toISOString();
  }

  private async failDocument(
    input: KnowledgeProcessUploadedDocumentInput,
    title: string,
    parsedMetadata: Record<string, unknown>,
    stages: KnowledgeIngestionStage[],
    reason: string
  ): Promise<KnowledgeIngestionResult> {
    if (stages.at(-1)?.stage !== 'failed') {
      stages.push({ stage: 'failed', at: this.timestamp(), reason });
    }
    await this.repo.createDocument(
      this.createDocumentRecord(input, {
        title,
        status: 'failed',
        metadata: this.createDocumentMetadata(parsedMetadata, stages),
        errorMessage: reason
      })
    );

    return { status: 'failed', reason, chunkCount: 0, stages };
  }
}

export class PlainTextKnowledgeDocumentParser implements KnowledgeDocumentParser {
  async parse(input: { fileName: string; bytes: Buffer }) {
    return {
      title: input.fileName,
      text: input.bytes.toString('utf8'),
      metadata: { fileName: input.fileName }
    };
  }
}

export class DeterministicKnowledgeEmbedder implements KnowledgeEmbedder {
  async embedTexts(texts: string[]) {
    return texts.map(text => [text.length]);
  }
}

export class NoopKnowledgeVectorStore implements KnowledgeVectorStore {
  async upsert(input: { chunks: readonly unknown[] }) {
    return { inserted: input.chunks.length };
  }

  async search() {
    return { matches: [] };
  }

  async deleteByDocumentId() {
    return { deleted: 0 };
  }
}

function chunkText(text: string, maxChars = DEFAULT_MAX_CHARS, overlapChars = DEFAULT_OVERLAP_CHARS): string[] {
  if (text.length <= maxChars) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    chunks.push(text.slice(start, end));
    if (end === text.length) {
      break;
    }
    start = Math.max(end - overlapChars, start + 1);
  }

  return chunks;
}

function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

function getErrorReason(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return 'Knowledge ingestion failed.';
}
