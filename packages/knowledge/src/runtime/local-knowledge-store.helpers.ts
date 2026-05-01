import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

import { loadSettings } from '@agent/config';
import type {
  KnowledgeChunkRecord,
  KnowledgeEmbeddingRecord,
  KnowledgeIngestionReceiptRecord,
  KnowledgeSourceRecord,
  KnowledgeStoreRecord
} from '@agent/knowledge';

type RuntimeSettings = ReturnType<typeof loadSettings>;
export type KnowledgeStorageSettings = Pick<RuntimeSettings, 'knowledgeRoot'>;

export type PersistedKnowledgeSnapshot = {
  stores: KnowledgeStoreRecord[];
  sources: KnowledgeSourceRecord[];
  chunks: KnowledgeChunkRecord[];
  embeddings: KnowledgeEmbeddingRecord[];
  receipts: KnowledgeIngestionReceiptRecord[];
};

export const KNOWLEDGE_RELATIVE_PATHS = {
  catalog: 'catalog/stores.json',
  sources: 'sources/records.json',
  chunks: 'chunks/records.json',
  vectors: 'vectors/records.json',
  receipts: 'ingestion/receipts/records.json'
} as const;

export async function ensureKnowledgeDirectories(settings: KnowledgeStorageSettings) {
  await Promise.all(
    Object.values(KNOWLEDGE_RELATIVE_PATHS).map(relativePath =>
      mkdir(dirname(join(settings.knowledgeRoot, relativePath)), { recursive: true })
    )
  );
}

export async function readKnowledgeSnapshot(settings: KnowledgeStorageSettings): Promise<PersistedKnowledgeSnapshot> {
  const [stores, sources, chunks, embeddings, receipts] = await Promise.all([
    readJsonArray<KnowledgeStoreRecord>(join(settings.knowledgeRoot, KNOWLEDGE_RELATIVE_PATHS.catalog)),
    readJsonArray<KnowledgeSourceRecord>(join(settings.knowledgeRoot, KNOWLEDGE_RELATIVE_PATHS.sources)),
    readJsonArray<KnowledgeChunkRecord>(join(settings.knowledgeRoot, KNOWLEDGE_RELATIVE_PATHS.chunks)),
    readJsonArray<KnowledgeEmbeddingRecord>(join(settings.knowledgeRoot, KNOWLEDGE_RELATIVE_PATHS.vectors)),
    readJsonArray<KnowledgeIngestionReceiptRecord>(join(settings.knowledgeRoot, KNOWLEDGE_RELATIVE_PATHS.receipts))
  ]);
  return { stores, sources, chunks, embeddings, receipts };
}

export async function writeKnowledgeSnapshot(settings: KnowledgeStorageSettings, snapshot: PersistedKnowledgeSnapshot) {
  await Promise.all([
    writeJson(join(settings.knowledgeRoot, KNOWLEDGE_RELATIVE_PATHS.catalog), snapshot.stores),
    writeJson(join(settings.knowledgeRoot, KNOWLEDGE_RELATIVE_PATHS.sources), snapshot.sources),
    writeJson(join(settings.knowledgeRoot, KNOWLEDGE_RELATIVE_PATHS.chunks), snapshot.chunks),
    writeJson(join(settings.knowledgeRoot, KNOWLEDGE_RELATIVE_PATHS.vectors), snapshot.embeddings),
    writeJson(join(settings.knowledgeRoot, KNOWLEDGE_RELATIVE_PATHS.receipts), snapshot.receipts)
  ]);
}

export async function listKnowledgeCandidates(workspaceRoot: string) {
  const docsRoot = join(workspaceRoot, 'docs');
  const candidates: Array<{ absolutePath: string; relativePath: string; kind: KnowledgeSourceRecord['sourceType'] }> =
    [];
  for (const file of ['README.md', 'docs/conventions/project-conventions.md']) {
    candidates.push({
      absolutePath: join(workspaceRoot, file),
      relativePath: file,
      kind: 'workspace-docs'
    });
  }
  for (const path of await listFiles(docsRoot, value => value.endsWith('.md'))) {
    candidates.push({
      absolutePath: path,
      relativePath: relative(workspaceRoot, path),
      kind: 'repo-docs'
    });
  }
  for (const manifestPath of [
    join(workspaceRoot, 'package.json'),
    join(workspaceRoot, 'apps/backend/agent-server/package.json')
  ]) {
    candidates.push({
      absolutePath: manifestPath,
      relativePath: relative(workspaceRoot, manifestPath),
      kind: 'connector-manifest'
    });
  }
  const unique = new Map<string, (typeof candidates)[number]>();
  for (const candidate of candidates) unique.set(candidate.absolutePath, candidate);
  return [...unique.values()];
}

export function chunkDocumentContent(content: string) {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  const paragraphs = normalized.split(/\n{2,}/g);
  const chunks: string[] = [];
  let current = '';
  for (const paragraph of paragraphs) {
    if ((current + '\n\n' + paragraph).length > 1200 && current) {
      chunks.push(current.trim());
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export async function embedChunk(
  settings: RuntimeSettings,
  chunk: KnowledgeChunkRecord,
  receiptId: string,
  version: string
): Promise<KnowledgeEmbeddingRecord> {
  const now = new Date().toISOString();
  // Keep adapter loading lazy so @agent/knowledge root exports do not create a package init cycle.
  const { createRuntimeEmbeddingProvider, resolveRuntimeEmbeddingApiKey } = await import('@agent/adapters');
  if (!resolveRuntimeEmbeddingApiKey(settings)) {
    return failedEmbedding(settings, chunk, receiptId, version, now, 'missing_embedding_api_key');
  }
  try {
    const vector = await createRuntimeEmbeddingProvider(settings).embedQuery(chunk.content);
    if (!vector?.length) throw new Error('empty_embedding');
    return {
      id: `embedding_${hashText(chunk.id)}`,
      store: 'cangjing',
      sourceId: chunk.sourceId,
      documentId: chunk.documentId,
      chunkId: chunk.id,
      embeddingProvider: settings.embeddings.provider,
      embeddingModel: settings.embeddings.model,
      dimensions: vector.length,
      embeddedAt: now,
      receiptId,
      version,
      status: 'ready'
    };
  } catch (error) {
    return failedEmbedding(
      settings,
      chunk,
      receiptId,
      version,
      now,
      error instanceof Error ? error.message : 'embedding_failed'
    );
  }
}

export function estimateTokenCount(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function hashText(text: string) {
  return createHash('sha1').update(text).digest('hex').slice(0, 16);
}

async function listFiles(root: string, predicate: (path: string) => boolean): Promise<string[]> {
  const found: string[] = [];
  try {
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      const nextPath = join(root, entry.name);
      if (entry.isDirectory()) found.push(...(await listFiles(nextPath, predicate)));
      else if (predicate(nextPath)) found.push(nextPath);
    }
  } catch {
    return [];
  }
  return found;
}

function failedEmbedding(
  settings: RuntimeSettings,
  chunk: KnowledgeChunkRecord,
  receiptId: string,
  version: string,
  embeddedAt: string,
  failureReason: string
): KnowledgeEmbeddingRecord {
  return {
    id: `embedding_${hashText(chunk.id)}`,
    store: 'cangjing',
    sourceId: chunk.sourceId,
    documentId: chunk.documentId,
    chunkId: chunk.id,
    embeddingProvider: settings.embeddings.provider,
    embeddingModel: settings.embeddings.model,
    dimensions: 0,
    embeddedAt,
    receiptId,
    version,
    status: 'failed',
    failureReason
  };
}

async function readJsonArray<T>(path: string): Promise<T[]> {
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function writeJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2), 'utf8');
}

export async function readSourceContent(path: string) {
  return readFile(path, 'utf8');
}

export async function readSourceStat(path: string) {
  return stat(path);
}
