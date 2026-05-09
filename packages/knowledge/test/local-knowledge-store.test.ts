import { mkdtemp, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildKnowledgeDescriptor,
  ingestLocalKnowledge,
  type LocalKnowledgeStoreSettings,
  type LocalKnowledgeSnapshotRepository,
  listKnowledgeArtifacts,
  type PersistedKnowledgeSnapshot,
  readKnowledgeOverview
} from '../src/runtime/local-knowledge-store';
import { embedChunk } from '../src/runtime/local-knowledge-store.helpers';

const tempRoots: string[] = [];

function createTestLocalKnowledgeSettings(
  workspaceRoot: string,
  overrides: Partial<LocalKnowledgeStoreSettings> = {}
): LocalKnowledgeStoreSettings {
  const { embeddings, mcp, ...restOverrides } = overrides;
  return {
    workspaceRoot,
    knowledgeRoot: join(workspaceRoot, 'data/knowledge'),
    tasksStateFilePath: join(workspaceRoot, 'data/tasks/tasks-state.json'),
    zhipuApiKey: '',
    ...restOverrides,
    embeddings: {
      provider: embeddings?.provider ?? 'glm',
      model: embeddings?.model ?? 'Embedding-3',
      apiKey: embeddings?.apiKey ?? ''
    },
    mcp: {
      bigmodelApiKey: mcp?.bigmodelApiKey ?? ''
    }
  };
}

describe('Local knowledge store', () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.splice(0).map(async root => {
        await rm(root, { recursive: true, force: true });
      })
    );
  });

  it('persists local sources, chunks, and failed embedding receipts when embedding credentials are unavailable', async () => {
    const root = await mkdtemp(join(tmpdir(), 'knowledge-store-'));
    tempRoots.push(root);
    await mkdir(join(root, 'docs/conventions'), { recursive: true });
    await mkdir(join(root, 'apps/backend/agent-server'), { recursive: true });
    await writeFile(join(root, 'README.md'), '# Root\n\nhello knowledge');
    await writeFile(join(root, 'docs/conventions/project-conventions.md'), '# Conventions\n\nkeep it canonical');
    await writeFile(join(root, 'docs', 'ARCHITECTURE.md'), '# Architecture\n\nfive layers');
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'fixture' }, null, 2));
    await writeFile(join(root, 'apps/backend/agent-server/package.json'), JSON.stringify({ name: 'server' }, null, 2));

    const settings = createTestLocalKnowledgeSettings(root);

    const overview = await ingestLocalKnowledge(settings);
    const stored = await listKnowledgeArtifacts(settings);
    const reloaded = await readKnowledgeOverview(settings);

    expect(overview.stores.map(item => item.store)).toEqual(expect.arrayContaining(['wenyuan', 'cangjing']));
    expect(stored.sources.length).toBeGreaterThan(0);
    expect(stored.chunks.length).toBeGreaterThan(0);
    expect(stored.embeddings.every(item => item.embeddingProvider === 'glm')).toBe(true);
    expect(stored.embeddings.every(item => item.embeddingModel === 'Embedding-3')).toBe(true);
    expect(stored.embeddings.some(item => item.status === 'failed')).toBe(true);
    expect(stored.receipts.length).toBeGreaterThan(0);
    expect(reloaded.blockedDocumentCount).toBeGreaterThan(0);
  });

  it('can ingest through an injected snapshot repository without touching root data directories', async () => {
    const root = await mkdtemp(join(tmpdir(), 'knowledge-store-memory-'));
    tempRoots.push(root);
    const emptySnapshot: PersistedKnowledgeSnapshot = {
      stores: [],
      sources: [],
      chunks: [],
      embeddings: [],
      receipts: []
    };
    const accessLog: string[] = [];
    let snapshot = emptySnapshot;
    const repository: LocalKnowledgeSnapshotRepository = {
      async read() {
        accessLog.push('read');
        return snapshot;
      },
      async write(nextSnapshot) {
        accessLog.push('write');
        snapshot = nextSnapshot;
      }
    };
    const settings = createTestLocalKnowledgeSettings(root);
    const options = {
      repository,
      runtimePaths: {
        wenyuanRoot: 'memory://wenyuan',
        cangjingRoot: 'memory://cangjing'
      },
      sourceProvider: async () => []
    };

    const overview = await ingestLocalKnowledge(settings, options);
    const stored = await listKnowledgeArtifacts(settings, options);
    const reloaded = await readKnowledgeOverview(settings, options);
    const descriptor = buildKnowledgeDescriptor(settings, options);

    await expect(stat(join(root, 'data'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(accessLog).toEqual(['read', 'write', 'read', 'read']);
    expect(overview.stores.map(item => item.rootPath)).toEqual(['memory://wenyuan', 'memory://cangjing']);
    expect(stored.stores.map(item => item.rootPath)).toEqual(['memory://wenyuan', 'memory://cangjing']);
    expect(reloaded.stores.map(item => item.rootPath)).toEqual(['memory://wenyuan', 'memory://cangjing']);
    expect(descriptor.wenyuanRoot).toBe('memory://wenyuan');
    expect(descriptor.cangjingRoot).toBe('memory://cangjing');
  });

  it('marks embeddings failed when credentials and injected providers are unavailable', async () => {
    const settings = createTestLocalKnowledgeSettings('/tmp/knowledge-store-adapter-skip');

    const embedding = await embedChunk(
      settings,
      {
        id: 'chunk_adapter_skip',
        store: 'cangjing',
        sourceId: 'source_adapter_skip',
        documentId: 'doc_adapter_skip',
        chunkIndex: 0,
        content: 'hello knowledge',
        tokenCount: 4,
        searchable: false,
        receiptId: 'receipt_adapter_skip',
        version: 'v1',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z'
      },
      'receipt_adapter_skip',
      'v1'
    );

    expect(embedding.status).toBe('failed');
    expect(embedding.failureReason).toBe('missing_embedding_api_key');
  });

  it('embeds chunks through an injected provider without loading repo adapters', async () => {
    const settings = createTestLocalKnowledgeSettings('/tmp/knowledge-store-injected-provider');
    const embeddingProvider = {
      embedQuery: vi.fn(async () => [0.1, 0.2, 0.3])
    };

    const embedding = await embedChunk(
      settings,
      {
        id: 'chunk_injected_provider',
        store: 'cangjing',
        sourceId: 'source_injected_provider',
        documentId: 'doc_injected_provider',
        chunkIndex: 0,
        content: 'hello knowledge',
        tokenCount: 4,
        searchable: false,
        receiptId: 'receipt_injected_provider',
        version: 'v1',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z'
      },
      'receipt_injected_provider',
      'v1',
      { embeddingProvider }
    );

    expect(embeddingProvider.embedQuery).toHaveBeenCalledWith('hello knowledge');
    expect(embedding.status).toBe('ready');
    expect(embedding.dimensions).toBe(3);
  });

  it('ingests searchable chunks through an injected embedding provider', async () => {
    const root = await mkdtemp(join(tmpdir(), 'knowledge-store-provider-'));
    tempRoots.push(root);
    await mkdir(join(root, 'docs/conventions'), { recursive: true });
    await mkdir(join(root, 'apps/backend/agent-server'), { recursive: true });
    await writeFile(join(root, 'README.md'), '# Root\n\nhello knowledge');
    await writeFile(join(root, 'docs/conventions/project-conventions.md'), '# Conventions\n\nkeep it canonical');
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'fixture' }, null, 2));
    await writeFile(join(root, 'apps/backend/agent-server/package.json'), JSON.stringify({ name: 'server' }, null, 2));

    const settings = createTestLocalKnowledgeSettings(root);
    const embeddingProvider = {
      embedQuery: vi.fn(async () => [0.25, 0.5])
    };

    const overview = await ingestLocalKnowledge(settings, { embeddingProvider });
    const stored = await listKnowledgeArtifacts(settings);

    expect(embeddingProvider.embedQuery).toHaveBeenCalled();
    expect(overview.searchableDocumentCount).toBeGreaterThan(0);
    expect(overview.blockedDocumentCount).toBe(0);
    expect(stored.chunks.every(item => item.searchable)).toBe(true);
    expect(stored.embeddings.every(item => item.status === 'ready')).toBe(true);
    expect(stored.embeddings.every(item => item.dimensions === 2)).toBe(true);
  });
});
