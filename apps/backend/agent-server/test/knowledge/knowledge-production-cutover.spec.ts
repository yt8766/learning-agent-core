import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import type { KnowledgeSqlClient } from '../../src/knowledge/repositories/knowledge-sql-client';
import { KnowledgeModule } from '../../src/knowledge/knowledge.module';
import { KNOWLEDGE_SQL_CLIENT } from '../../src/knowledge/knowledge-provider.module';
import { KnowledgeService } from '../../src/knowledge/knowledge.service';
import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';

const now = '2026-05-01T09:00:00.000Z';

describe('knowledge production cutover', () => {
  it('disables fixture fallback through KnowledgeModule factory in postgres repository mode', async () => {
    const previousRepository = process.env.KNOWLEDGE_REPOSITORY;
    const previousDatabaseUrl = process.env.DATABASE_URL;
    const sqlClient: KnowledgeSqlClient = {
      query: async () => ({ rows: [] })
    };

    try {
      process.env.KNOWLEDGE_REPOSITORY = 'postgres';
      process.env.DATABASE_URL = 'postgres://localhost/knowledge';

      const moduleRef = await Test.createTestingModule({
        imports: [KnowledgeModule]
      })
        .overrideProvider(KNOWLEDGE_SQL_CLIENT)
        .useValue(sqlClient)
        .compile();

      const service = moduleRef.get(KnowledgeService);

      await expect(service.listKnowledgeBases()).resolves.toEqual({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20
      });
      await expect(service.listDocuments()).resolves.toEqual({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20
      });

      await moduleRef.close();
    } finally {
      restoreEnvValue('KNOWLEDGE_REPOSITORY', previousRepository);
      restoreEnvValue('DATABASE_URL', previousDatabaseUrl);
    }
  });

  it('throws NotFoundException for unknown fixture knowledge base ids even in demo fallback mode', async () => {
    const service = new KnowledgeService();

    await expect(service.getKnowledgeBase('kb_missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns an empty knowledge base page instead of fixture records when fixture fallback is disabled', async () => {
    const service = new KnowledgeService(
      new InMemoryKnowledgeRepository(),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        fixtureFallback: false
      }
    );

    await expect(service.listKnowledgeBases()).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20
    });
  });

  it('throws NotFoundException for a missing knowledge base when fixture fallback is disabled', async () => {
    const service = new KnowledgeService(
      new InMemoryKnowledgeRepository(),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        fixtureFallback: false
      }
    );

    await expect(service.getKnowledgeBase('kb_frontend')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns an empty document page instead of fixture records when fixture fallback is disabled', async () => {
    const service = new KnowledgeService(
      new InMemoryKnowledgeRepository(),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        fixtureFallback: false
      }
    );

    await expect(service.listDocuments()).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20
    });
    await expect(service.getDocument('doc_frontend_conventions')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('routes chat through the repository-backed RAG path instead of the fixture response', async () => {
    const repository = new InMemoryKnowledgeRepository();
    const service = new KnowledgeService(repository, undefined, undefined, undefined, undefined, {
      fixtureFallback: false
    });

    await repository.createChunk({
      id: 'chunk-production-cutover',
      tenantId: 'ws_1',
      knowledgeBaseId: 'kb-production',
      documentId: 'doc-production',
      text: 'productionneedle 来自真实 repository chunk，不应返回 fixture 回答。',
      createdAt: now,
      updatedAt: now
    });

    const result = await service.chat({
      conversationId: 'conv-production-cutover',
      knowledgeBaseId: 'kb-production',
      message: 'productionneedle'
    });

    expect(result.answer).toContain('productionneedle');
    expect(result.answer).not.toContain('默认使用顶层静态 import');
    expect(result.citations).toMatchObject([{ chunkId: 'chunk-production-cutover' }]);
    await expect(
      repository.listChatMessages({ tenantId: 'ws_1', conversationId: 'conv-production-cutover' })
    ).resolves.toMatchObject({
      items: [{ role: 'user' }, { role: 'assistant' }]
    });
  });

  it('uses repository-backed observability and eval lists instead of fixture pages', async () => {
    const service = new KnowledgeService(
      new InMemoryKnowledgeRepository(),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        fixtureFallback: false
      }
    );

    await expect(service.getObservabilityMetrics()).resolves.toMatchObject({
      traceCount: 0,
      questionCount: 0
    });
    await expect(service.listTraces()).resolves.toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
    await expect(service.listEvalDatasets()).resolves.toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
    await expect(service.listEvalRuns()).resolves.toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
  });
});

function restoreEnvValue(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
