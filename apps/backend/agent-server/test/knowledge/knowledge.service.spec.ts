import { describe, expect, it } from 'vitest';

import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';
import { KnowledgeService } from '../../src/knowledge/knowledge.service';

const now = '2026-05-01T09:00:00.000Z';

describe('KnowledgeService', () => {
  it('returns dashboard overview stub data', () => {
    const service = new KnowledgeService();

    const result = service.getDashboardOverview();

    expect(result.knowledgeBaseCount).toBeGreaterThan(0);
    expect(result.todayQuestionCount).toBeGreaterThan(0);
  });

  it('keeps non-auth chat stub behavior without repository or rag service', async () => {
    const service = new KnowledgeService();

    const result = await service.chat({ conversationId: 'conversation_custom', message: 'hello' });

    expect(result.conversationId).toBe('conversation_custom');
    expect(result.userMessage.content).toBe('hello');
  });

  it('routes chat through RAG when repository is available', async () => {
    const repository = new InMemoryKnowledgeRepository();
    const service = new KnowledgeService(repository);

    await repository.createChunk({
      id: 'chunk-service-rag',
      tenantId: 'ws_1',
      knowledgeBaseId: 'kb-service',
      documentId: 'doc-service',
      text: 'KnowledgeService 应调用 RAG 主链生成回答。',
      createdAt: now,
      updatedAt: now
    });

    const result = await service.chat({
      conversationId: 'conv-service',
      knowledgeBaseId: 'kb-service',
      message: 'KnowledgeService 应该调用什么主链？'
    });

    expect(result.answer).toContain('KnowledgeService 应调用 RAG 主链');
    expect(result.citations).toMatchObject([{ chunkId: 'chunk-service-rag' }]);
  });

  it('ignores body tenant and creator spoofing when routing public chat through RAG', async () => {
    const repository = new InMemoryKnowledgeRepository();
    const service = new KnowledgeService(repository);

    await repository.createChunk({
      id: 'chunk-safe-tenant',
      tenantId: 'ws_1',
      knowledgeBaseId: 'kb-service',
      documentId: 'doc-safe',
      text: 'tenantneedle 隔离租户上下文必须来自服务端默认工作区。',
      createdAt: now,
      updatedAt: now
    });
    await repository.createChunk({
      id: 'chunk-evil-tenant',
      tenantId: 'tenant-evil',
      knowledgeBaseId: 'kb-service',
      documentId: 'doc-evil',
      text: 'tenantneedle 隔离租户上下文不应来自请求体伪造租户。',
      createdAt: now,
      updatedAt: now
    });

    const result = await service.chat({
      conversationId: 'conv-spoof',
      tenantId: 'tenant-evil',
      createdBy: 'user-evil',
      knowledgeBaseId: 'kb-service',
      message: 'tenantneedle'
    });

    expect(result.citations).toMatchObject([{ chunkId: 'chunk-safe-tenant' }]);
    await expect(
      repository.listChatMessages({ tenantId: 'ws_1', conversationId: 'conv-spoof' })
    ).resolves.toMatchObject({
      items: [{ role: 'user' }, { role: 'assistant' }]
    });
    await expect(
      repository.listChatMessages({ tenantId: 'tenant-evil', conversationId: 'conv-spoof' })
    ).resolves.toMatchObject({ items: [] });
    await expect(repository.listTraces({ tenantId: 'ws_1', knowledgeBaseId: 'kb-service' })).resolves.toMatchObject({
      items: [{ metadata: { createdBy: 'user_demo' } }]
    });
  });

  it('returns repository knowledge bases for the MVP tenant when records exist', async () => {
    const repository = new InMemoryKnowledgeRepository();
    const service = new KnowledgeService(repository);

    await repository.createKnowledgeBase({
      id: 'kb-repo',
      tenantId: 'ws_1',
      name: 'Repository Knowledge Base',
      description: 'Loaded from repository',
      visibility: 'private',
      status: 'active',
      tags: ['repo'],
      createdBy: 'user-1',
      createdAt: now,
      updatedAt: now
    });

    await expect(service.listKnowledgeBases()).resolves.toMatchObject({
      items: [
        {
          id: 'kb-repo',
          workspaceId: 'ws_1',
          name: 'Repository Knowledge Base',
          tags: ['repo'],
          visibility: 'private',
          status: 'active',
          createdBy: 'user-1'
        }
      ],
      total: 1
    });
  });

  it('falls back to fixture knowledge bases when the repository is empty', async () => {
    const service = new KnowledgeService(new InMemoryKnowledgeRepository());

    const result = await service.listKnowledgeBases();

    expect(result.items[0]?.id).toBe('kb_frontend');
    expect(result.total).toBeGreaterThan(0);
  });
});
