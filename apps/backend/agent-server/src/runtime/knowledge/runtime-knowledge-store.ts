import { join } from 'node:path';

import type {
  KnowledgeChunkRecord,
  KnowledgeEmbeddingRecord,
  KnowledgeIngestionReceiptRecord,
  KnowledgeSourceRecord,
  KnowledgeStoreRecord
} from '@agent/shared';
import { loadSettings } from '@agent/config';
import {
  chunkDocumentContent,
  embedChunk,
  ensureKnowledgeDirectories,
  estimateTokenCount,
  hashText,
  listKnowledgeCandidates,
  PersistedKnowledgeSnapshot,
  readKnowledgeSnapshot,
  readSourceContent,
  readSourceStat,
  writeKnowledgeSnapshot
} from './runtime-knowledge-store.helpers';

type RuntimeSettings = ReturnType<typeof loadSettings>;

export interface KnowledgeOverviewRecord {
  stores: KnowledgeStoreRecord[];
  searchableDocumentCount: number;
  blockedDocumentCount: number;
  sourceCount: number;
  chunkCount: number;
  embeddingCount: number;
  latestReceipts: KnowledgeIngestionReceiptRecord[];
}

export async function ingestLocalKnowledge(settings: RuntimeSettings): Promise<KnowledgeOverviewRecord> {
  await ensureKnowledgeDirectories(settings);
  const existing = await readKnowledgeSnapshot(settings);
  const candidateFiles = await listKnowledgeCandidates(settings.workspaceRoot);
  const sources: KnowledgeSourceRecord[] = [];
  const chunks: KnowledgeChunkRecord[] = [];
  const embeddings: KnowledgeEmbeddingRecord[] = [];
  const receipts: KnowledgeIngestionReceiptRecord[] = [];
  const embeddedSuccessByDocument = new Set<string>();
  const failedDocuments = new Set<string>();

  for (const file of candidateFiles) {
    const fileStat = await readSourceStat(file.absolutePath);
    const version = `${fileStat.mtimeMs}:${fileStat.size}`;
    const sourceId = `source_${hashText(file.relativePath)}`;
    const receiptId = `receipt_${hashText(`${file.relativePath}:${version}`)}`;
    const content = await readSourceContent(file.absolutePath);
    const nextChunks = chunkDocumentContent(content).map((chunk, index) => {
      const documentId = `doc_${hashText(file.relativePath)}`;
      const chunkId = `chunk_${hashText(`${documentId}:${index}:${chunk}`)}`;
      return {
        id: chunkId,
        store: 'cangjing' as const,
        sourceId,
        documentId,
        chunkIndex: index,
        content: chunk,
        tokenCount: estimateTokenCount(chunk),
        searchable: false,
        receiptId,
        version,
        createdAt: new Date(fileStat.birthtimeMs || fileStat.mtimeMs).toISOString(),
        updatedAt: new Date(fileStat.mtimeMs).toISOString()
      } satisfies KnowledgeChunkRecord;
    });

    let embeddedChunkCount = 0;
    for (const chunk of nextChunks) {
      const embedding = await embedChunk(settings, chunk, receiptId, version);
      if (embedding.status === 'ready') {
        embeddedChunkCount += 1;
        embeddedSuccessByDocument.add(chunk.documentId);
      } else {
        failedDocuments.add(chunk.documentId);
      }
      chunks.push({
        ...chunk,
        searchable: embedding.status === 'ready'
      });
      embeddings.push(embedding);
    }

    sources.push({
      id: sourceId,
      store: 'cangjing',
      sourceType: file.kind,
      uri: file.relativePath,
      title: file.relativePath,
      trustClass: 'internal',
      receiptId,
      version,
      lastIngestedAt: new Date().toISOString(),
      createdAt: new Date(fileStat.birthtimeMs || fileStat.mtimeMs).toISOString(),
      updatedAt: new Date(fileStat.mtimeMs).toISOString()
    });

    receipts.push({
      id: receiptId,
      store: 'cangjing',
      sourceId,
      sourceType: file.kind,
      version,
      status: embeddedChunkCount === nextChunks.length ? 'completed' : embeddedChunkCount > 0 ? 'partial' : 'failed',
      documentCount: 1,
      chunkCount: nextChunks.length,
      embeddedChunkCount,
      skippedChunkCount: nextChunks.length - embeddedChunkCount,
      failureReason: embeddedChunkCount === nextChunks.length ? undefined : 'embedding_unavailable_or_failed',
      createdAt: new Date(fileStat.birthtimeMs || fileStat.mtimeMs).toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  const stores: KnowledgeStoreRecord[] = [
    {
      id: 'wenyuan-store',
      store: 'wenyuan',
      displayName: '文渊阁',
      summary: '运行态记忆、会话历史、trace、checkpoint、治理记录。',
      rootPath: join(settings.workspaceRoot, 'data', 'runtime'),
      status: 'active',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'cangjing-store',
      store: 'cangjing',
      displayName: '藏经阁',
      summary: '本地文档、切片、向量、索引与 ingestion receipts。',
      rootPath: settings.knowledgeRoot,
      status: 'active',
      updatedAt: new Date().toISOString()
    }
  ];

  const snapshot: PersistedKnowledgeSnapshot = {
    stores,
    sources,
    chunks,
    embeddings,
    receipts
  };
  await writeKnowledgeSnapshot(settings, snapshot);

  const searchableDocumentCount = chunks.filter(chunk => chunk.searchable).length
    ? new Set(chunks.filter(chunk => chunk.searchable).map(chunk => chunk.documentId)).size
    : existing.chunks.filter(chunk => chunk.searchable).length
      ? new Set(existing.chunks.filter(chunk => chunk.searchable).map(chunk => chunk.documentId)).size
      : embeddedSuccessByDocument.size;

  return {
    stores,
    searchableDocumentCount,
    blockedDocumentCount: failedDocuments.size,
    sourceCount: sources.length,
    chunkCount: chunks.length,
    embeddingCount: embeddings.filter(item => item.status === 'ready').length,
    latestReceipts: receipts
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 8)
  };
}

export async function readKnowledgeOverview(settings: RuntimeSettings): Promise<KnowledgeOverviewRecord> {
  await ensureKnowledgeDirectories(settings);
  const snapshot = await readKnowledgeSnapshot(settings);
  return {
    stores:
      snapshot.stores.length > 0
        ? snapshot.stores
        : [
            {
              id: 'wenyuan-store',
              store: 'wenyuan',
              displayName: '文渊阁',
              summary: '运行态记忆、会话历史、trace、checkpoint、治理记录。',
              rootPath: join(settings.workspaceRoot, 'data', 'runtime'),
              status: 'active',
              updatedAt: new Date().toISOString()
            },
            {
              id: 'cangjing-store',
              store: 'cangjing',
              displayName: '藏经阁',
              summary: '本地文档、切片、向量、索引与 ingestion receipts。',
              rootPath: settings.knowledgeRoot,
              status: 'active',
              updatedAt: new Date().toISOString()
            }
          ],
    searchableDocumentCount: new Set(snapshot.chunks.filter(item => item.searchable).map(item => item.documentId)).size,
    blockedDocumentCount: new Set(
      snapshot.embeddings.filter(item => item.status === 'failed').map(item => item.documentId)
    ).size,
    sourceCount: snapshot.sources.length,
    chunkCount: snapshot.chunks.length,
    embeddingCount: snapshot.embeddings.filter(item => item.status === 'ready').length,
    latestReceipts: snapshot.receipts
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 8)
  };
}

export async function listKnowledgeArtifacts(settings: RuntimeSettings) {
  await ensureKnowledgeDirectories(settings);
  return readKnowledgeSnapshot(settings);
}

export function buildKnowledgeDescriptor(settings: RuntimeSettings) {
  return {
    wenyuanRoot: join(settings.workspaceRoot, 'data', 'runtime'),
    cangjingRoot: settings.knowledgeRoot,
    sourceDescriptors: [
      'wenyuan runtime snapshot',
      'cangjing local ingestion catalog',
      'cangjing local vectors/indexes'
    ]
  };
}
