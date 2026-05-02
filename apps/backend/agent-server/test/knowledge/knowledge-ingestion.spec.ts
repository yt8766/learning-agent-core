import { describe, expect, it, vi } from 'vitest';

import { KnowledgeIngestionService } from '../../src/knowledge/knowledge-ingestion.service';
import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';

const now = () => new Date('2026-05-01T09:00:00.000Z');

describe('KnowledgeIngestionService', () => {
  it('indexes a short uploaded document as one ready chunk', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const upsert = vi.fn(async () => ({ inserted: 1 }));
    const service = new KnowledgeIngestionService({
      repo,
      parser: {
        parse: async () => ({
          title: 'RAG知识框架.pptx',
          text: '检索评测包含 Recall@K、Precision@K、MRR、NDCG。',
          metadata: { mimeType: 'application/vnd.ms-powerpoint' }
        })
      },
      embedder: {
        embedTexts: async texts => texts.map(() => [0.1, 0.2, 0.3])
      },
      vectorStore: {
        upsert,
        search: async () => ({ matches: [] }),
        deleteByDocumentId: async () => ({ deleted: 0 })
      },
      now
    });

    const result = await service.processUploadedDocument({
      tenantId: 'tenant-1',
      knowledgeBaseId: 'kb-1',
      documentId: 'doc-1',
      fileName: 'RAG知识框架.pptx',
      bytes: Buffer.from('binary-file')
    });

    expect(result).toMatchObject({ status: 'indexed', chunkCount: 1 });
    expect(result.stages.map(stage => stage.stage)).toEqual(['uploaded', 'parsed', 'chunked', 'embedded', 'indexed']);
    expect(upsert).toHaveBeenCalledOnce();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        knowledgeBaseId: 'kb-1',
        documentId: 'doc-1',
        chunks: [expect.objectContaining({ id: 'doc-1-chunk-0001', ordinal: 0, embedding: [0.1, 0.2, 0.3] })]
      })
    );

    const documents = await repo.listDocuments({ tenantId: 'tenant-1', knowledgeBaseId: 'kb-1' });
    expect(documents.items).toHaveLength(1);
    expect(documents.items[0]).toMatchObject({
      id: 'doc-1',
      title: 'RAG知识框架.pptx',
      status: 'ready',
      metadata: expect.objectContaining({
        indexedAt: '2026-05-01T09:00:00.000Z',
        ingestionStages: result.stages
      })
    });
    await expect(repo.listChunks({ tenantId: 'tenant-1', documentId: 'doc-1' })).resolves.toMatchObject({
      items: [
        {
          id: 'doc-1-chunk-0001',
          ordinal: 0,
          tokenCount: expect.any(Number),
          embedding: [0.1, 0.2, 0.3]
        }
      ]
    });
  });

  it('marks the document failed when parsed text is empty and skips embedding and vector upsert', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const embedTexts = vi.fn(async () => [[0.1]]);
    const upsert = vi.fn(async () => ({ inserted: 1 }));
    const service = new KnowledgeIngestionService({
      repo,
      parser: {
        parse: async () => ({ title: 'Empty.txt', text: '   ', metadata: { source: 'test' } })
      },
      embedder: { embedTexts },
      vectorStore: {
        upsert,
        search: async () => ({ matches: [] }),
        deleteByDocumentId: async () => ({ deleted: 0 })
      },
      now
    });

    const result = await service.processUploadedDocument({
      tenantId: 'tenant-1',
      knowledgeBaseId: 'kb-1',
      documentId: 'doc-empty',
      fileName: 'Empty.txt',
      bytes: Buffer.from('empty')
    });

    expect(result).toMatchObject({
      status: 'failed',
      reason: 'Parsed document text is empty.',
      chunkCount: 0
    });
    expect(result.stages.map(stage => stage.stage)).toEqual(['uploaded', 'parsed', 'failed']);
    expect(embedTexts).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    const documents = await repo.listDocuments({ tenantId: 'tenant-1', knowledgeBaseId: 'kb-1' });
    expect(documents.items).toHaveLength(1);
    expect(documents.items[0]).toMatchObject({
      id: 'doc-empty',
      status: 'failed',
      errorMessage: 'Parsed document text is empty.',
      metadata: expect.objectContaining({ ingestionStages: result.stages })
    });
  });

  it('marks the document failed when the parser throws', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const service = new KnowledgeIngestionService({
      repo,
      parser: {
        parse: async () => {
          throw new Error('Parser unavailable');
        }
      },
      embedder: {
        embedTexts: async texts => texts.map(() => [0.1])
      },
      vectorStore: {
        upsert: async input => ({ inserted: input.chunks.length }),
        search: async () => ({ matches: [] }),
        deleteByDocumentId: async () => ({ deleted: 0 })
      },
      now
    });

    const result = await service.processUploadedDocument({
      tenantId: 'tenant-1',
      knowledgeBaseId: 'kb-1',
      documentId: 'doc-parser-fail',
      fileName: 'Broken.md',
      bytes: Buffer.from('broken')
    });

    expect(result).toMatchObject({ status: 'failed', chunkCount: 0, reason: 'Parser unavailable' });
    expect(result.stages.map(stage => stage.stage)).toEqual(['uploaded', 'failed']);
    await expect(repo.listDocuments({ tenantId: 'tenant-1', knowledgeBaseId: 'kb-1' })).resolves.toMatchObject({
      items: [
        {
          id: 'doc-parser-fail',
          status: 'failed',
          errorMessage: 'Parser unavailable',
          metadata: expect.objectContaining({ ingestionStages: result.stages })
        }
      ]
    });
  });

  it('marks the document failed when embedding count does not match chunk count and skips vector upsert', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const upsert = vi.fn(async () => ({ inserted: 1 }));
    const service = new KnowledgeIngestionService({
      repo,
      parser: {
        parse: async () => ({ title: 'Mismatch.md', text: 'a'.repeat(1300), metadata: {} })
      },
      embedder: {
        embedTexts: async () => [[0.1]]
      },
      vectorStore: {
        upsert,
        search: async () => ({ matches: [] }),
        deleteByDocumentId: async () => ({ deleted: 0 })
      },
      now
    });

    const result = await service.processUploadedDocument({
      tenantId: 'tenant-1',
      knowledgeBaseId: 'kb-1',
      documentId: 'doc-mismatch',
      fileName: 'Mismatch.md',
      bytes: Buffer.from('mismatch')
    });

    expect(result).toMatchObject({
      status: 'failed',
      chunkCount: 0,
      reason: 'Embedding count does not match chunk count.'
    });
    expect(result.stages.map(stage => stage.stage)).toEqual(['uploaded', 'parsed', 'chunked', 'embedded', 'failed']);
    expect(upsert).not.toHaveBeenCalled();
    const documents = await repo.listDocuments({ tenantId: 'tenant-1', knowledgeBaseId: 'kb-1' });
    expect(documents.items).toHaveLength(1);
    expect(documents.items[0]).toMatchObject({
      id: 'doc-mismatch',
      status: 'failed',
      errorMessage: 'Embedding count does not match chunk count.'
    });
  });

  it('marks the document failed when vector upsert throws', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const service = new KnowledgeIngestionService({
      repo,
      parser: {
        parse: async () => ({ title: 'Vector.md', text: 'vector text', metadata: {} })
      },
      embedder: {
        embedTexts: async texts => texts.map(() => [0.1])
      },
      vectorStore: {
        upsert: async () => {
          throw new Error('Vector store unavailable');
        },
        search: async () => ({ matches: [] }),
        deleteByDocumentId: async () => ({ deleted: 0 })
      },
      now
    });

    const result = await service.processUploadedDocument({
      tenantId: 'tenant-1',
      knowledgeBaseId: 'kb-1',
      documentId: 'doc-vector-fail',
      fileName: 'Vector.md',
      bytes: Buffer.from('vector')
    });

    expect(result).toMatchObject({ status: 'failed', chunkCount: 0, reason: 'Vector store unavailable' });
    expect(result.stages.map(stage => stage.stage)).toEqual(['uploaded', 'parsed', 'chunked', 'embedded', 'failed']);
    const documents = await repo.listDocuments({ tenantId: 'tenant-1', knowledgeBaseId: 'kb-1' });
    expect(documents.items).toHaveLength(1);
    expect(documents.items[0]).toMatchObject({
      id: 'doc-vector-fail',
      status: 'failed',
      errorMessage: 'Vector store unavailable',
      metadata: expect.objectContaining({ ingestionStages: result.stages })
    });
    await expect(repo.listChunks({ tenantId: 'tenant-1', documentId: 'doc-vector-fail' })).resolves.toMatchObject({
      items: []
    });
  });

  it('rejects duplicate document ids before parsing', async () => {
    const repo = new InMemoryKnowledgeRepository();
    await repo.createDocument({
      id: 'doc-duplicate',
      tenantId: 'tenant-1',
      knowledgeBaseId: 'kb-1',
      title: 'Already processed',
      status: 'ready',
      createdAt: '2026-05-01T08:00:00.000Z',
      updatedAt: '2026-05-01T08:00:00.000Z'
    });
    const parse = vi.fn(async () => ({ title: 'Duplicate.md', text: 'duplicate', metadata: {} }));
    const embedTexts = vi.fn(async () => [[0.1]]);
    const upsert = vi.fn(async () => ({ inserted: 1 }));
    const service = new KnowledgeIngestionService({
      repo,
      parser: { parse },
      embedder: { embedTexts },
      vectorStore: {
        upsert,
        search: async () => ({ matches: [] }),
        deleteByDocumentId: async () => ({ deleted: 0 })
      },
      now
    });

    const result = await service.processUploadedDocument({
      tenantId: 'tenant-1',
      knowledgeBaseId: 'kb-1',
      documentId: 'doc-duplicate',
      fileName: 'Duplicate.md',
      bytes: Buffer.from('duplicate')
    });

    expect(result).toMatchObject({
      status: 'failed',
      chunkCount: 0,
      reason: 'Document has already been processed.'
    });
    expect(parse).not.toHaveBeenCalled();
    expect(embedTexts).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('chunks long text with stable ordinals', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const text = 'a'.repeat(2600);
    const service = new KnowledgeIngestionService({
      repo,
      parser: {
        parse: async () => ({ title: 'Long.md', text, metadata: {} })
      },
      embedder: {
        embedTexts: async texts => texts.map((_, index) => [index])
      },
      vectorStore: {
        upsert: async input => ({ inserted: input.chunks.length }),
        search: async () => ({ matches: [] }),
        deleteByDocumentId: async () => ({ deleted: 0 })
      },
      now
    });

    const result = await service.processUploadedDocument({
      tenantId: 'tenant-1',
      knowledgeBaseId: 'kb-1',
      documentId: 'doc-long',
      fileName: 'Long.md',
      bytes: Buffer.from('long')
    });

    expect(result).toMatchObject({ status: 'indexed', chunkCount: 3 });
    await expect(repo.listChunks({ tenantId: 'tenant-1', documentId: 'doc-long' })).resolves.toMatchObject({
      items: [
        { id: 'doc-long-chunk-0001', ordinal: 0, embedding: [0] },
        { id: 'doc-long-chunk-0002', ordinal: 1, embedding: [1] },
        { id: 'doc-long-chunk-0003', ordinal: 2, embedding: [2] }
      ]
    });
  });

  it('chunks text without exceeding max length and preserves 160 character overlap', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const text = Array.from({ length: 2500 }, (_, index) => String.fromCharCode(97 + (index % 26))).join('');
    const service = new KnowledgeIngestionService({
      repo,
      parser: {
        parse: async () => ({ title: 'Boundary.md', text, metadata: {} })
      },
      embedder: {
        embedTexts: async texts => texts.map((_, index) => [index])
      },
      vectorStore: {
        upsert: async input => ({ inserted: input.chunks.length }),
        search: async () => ({ matches: [] }),
        deleteByDocumentId: async () => ({ deleted: 0 })
      },
      now
    });

    await service.processUploadedDocument({
      tenantId: 'tenant-1',
      knowledgeBaseId: 'kb-1',
      documentId: 'doc-boundary',
      fileName: 'Boundary.md',
      bytes: Buffer.from('boundary')
    });

    const chunks = (await repo.listChunks({ tenantId: 'tenant-1', documentId: 'doc-boundary' })).items;
    expect(chunks.every(chunk => chunk.text.length <= 1200)).toBe(true);
    expect(chunks[0]!.text.slice(-160)).toBe(chunks[1]!.text.slice(0, 160));
    expect(chunks[1]!.text.slice(-160)).toBe(chunks[2]!.text.slice(0, 160));
    const reconstructed =
      chunks[0]!.text +
      chunks
        .slice(1)
        .map(chunk => chunk.text.slice(160))
        .join('');
    expect(reconstructed).toBe(text);
  });
});
