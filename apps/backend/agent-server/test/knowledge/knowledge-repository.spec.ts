import { describe, expect, it } from 'vitest';

import type {
  KnowledgeBaseRecord,
  KnowledgeChatMessageRecord,
  KnowledgeChunkRecord,
  KnowledgeDocumentRecord,
  KnowledgeEvalRunRecord,
  KnowledgeTraceRecord
} from '../../src/knowledge/interfaces/knowledge-records.types';
import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';

const now = '2026-05-01T09:00:00.000Z';

describe('InMemoryKnowledgeRepository', () => {
  it('stores knowledge records by tenant and parent identifiers', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const base: KnowledgeBaseRecord = {
      id: 'kb-1',
      tenantId: 'tenant-1',
      name: '前端知识库',
      description: 'Frontend docs',
      visibility: 'workspace',
      status: 'active',
      tags: ['frontend'],
      createdBy: 'user-1',
      createdAt: now,
      updatedAt: now
    };
    const otherTenantBase: KnowledgeBaseRecord = {
      ...base,
      id: 'kb-other',
      tenantId: 'tenant-2',
      name: 'Other tenant'
    };
    const document: KnowledgeDocumentRecord = {
      id: 'doc-1',
      tenantId: 'tenant-1',
      knowledgeBaseId: 'kb-1',
      title: 'RAG知识框架.pptx',
      status: 'uploaded',
      createdAt: now,
      updatedAt: now
    };
    const otherTenantDocument: KnowledgeDocumentRecord = { ...document, id: 'doc-other', tenantId: 'tenant-2' };
    const chunk: KnowledgeChunkRecord = {
      id: 'chunk-1',
      tenantId: 'tenant-1',
      documentId: 'doc-1',
      knowledgeBaseId: 'kb-1',
      text: '常见的评测内容有检索评测、生成评测、端到端评测。',
      createdAt: now,
      updatedAt: now
    };
    const otherTenantChunk: KnowledgeChunkRecord = { ...chunk, id: 'chunk-other', tenantId: 'tenant-2' };
    const chatMessage: KnowledgeChatMessageRecord = {
      id: 'message-1',
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      role: 'user',
      content: '如何设计知识库评测系统？',
      createdAt: now,
      updatedAt: now
    };
    const otherTenantChatMessage: KnowledgeChatMessageRecord = {
      ...chatMessage,
      id: 'message-other',
      tenantId: 'tenant-2'
    };
    const evalRun: KnowledgeEvalRunRecord = {
      id: 'eval-run-1',
      tenantId: 'tenant-1',
      datasetId: 'dataset-1',
      status: 'succeeded',
      metrics: { recallAtK: 0.86 },
      createdAt: now,
      updatedAt: now
    };
    const otherTenantEvalRun: KnowledgeEvalRunRecord = { ...evalRun, id: 'eval-run-other', tenantId: 'tenant-2' };
    const trace: KnowledgeTraceRecord = {
      id: 'trace-1',
      tenantId: 'tenant-1',
      knowledgeBaseIds: ['kb-1'],
      operation: 'vector trace succeeded',
      status: 'succeeded',
      spans: [{ id: 'span-1', name: 'retrieval', attributes: { topK: 8 } }],
      createdAt: now,
      updatedAt: now
    };
    const otherTenantTrace: KnowledgeTraceRecord = { ...trace, id: 'trace-other', tenantId: 'tenant-2' };

    await repo.createKnowledgeBase(base);
    await repo.createKnowledgeBase(otherTenantBase);
    await repo.createDocument(document);
    await repo.createDocument(otherTenantDocument);
    await repo.createChunk(chunk);
    await repo.createChunk(otherTenantChunk);
    await repo.createChatMessage(chatMessage);
    await repo.createChatMessage(otherTenantChatMessage);
    await repo.createEvalRun(evalRun);
    await repo.createEvalRun(otherTenantEvalRun);
    await repo.createTrace(trace);
    await repo.createTrace(otherTenantTrace);

    await expect(repo.listKnowledgeBases({ tenantId: 'tenant-1' })).resolves.toMatchObject({
      items: [{ id: 'kb-1' }]
    });
    await expect(repo.listKnowledgeBases({ tenantId: 'tenant-2' })).resolves.toMatchObject({
      items: [{ id: 'kb-other' }]
    });
    await expect(repo.listDocuments({ tenantId: 'tenant-1', knowledgeBaseId: 'kb-1' })).resolves.toMatchObject({
      items: [{ id: 'doc-1', title: 'RAG知识框架.pptx', status: 'uploaded' }]
    });
    await expect(repo.listDocuments({ tenantId: 'tenant-1', knowledgeBaseId: 'kb-1' })).resolves.toHaveProperty(
      'items.length',
      1
    );
    await expect(repo.listChunks({ tenantId: 'tenant-1', documentId: 'doc-1' })).resolves.toMatchObject({
      items: [{ id: 'chunk-1' }]
    });
    await expect(repo.listChunks({ tenantId: 'tenant-1', documentId: 'doc-1' })).resolves.toHaveProperty(
      'items.length',
      1
    );
    await expect(repo.listChunks({ tenantId: 'tenant-1', knowledgeBaseId: 'kb-1' })).resolves.toMatchObject({
      items: [{ id: 'chunk-1' }]
    });
    await expect(repo.listChunks({ tenantId: 'tenant-1', knowledgeBaseId: 'kb-1' })).resolves.toHaveProperty(
      'items.length',
      1
    );
    await expect(
      repo.listChatMessages({ tenantId: 'tenant-1', conversationId: 'conversation-1' })
    ).resolves.toMatchObject({
      items: [{ id: 'message-1' }]
    });
    await expect(
      repo.listChatMessages({ tenantId: 'tenant-1', conversationId: 'conversation-1' })
    ).resolves.toHaveProperty('items.length', 1);
    await expect(repo.listEvalRuns({ tenantId: 'tenant-1', datasetId: 'dataset-1' })).resolves.toMatchObject({
      items: [{ id: 'eval-run-1', status: 'succeeded' }]
    });
    await expect(repo.listEvalRuns({ tenantId: 'tenant-1', datasetId: 'dataset-1' })).resolves.toHaveProperty(
      'items.length',
      1
    );
    await expect(repo.listTraces({ tenantId: 'tenant-1', knowledgeBaseId: 'kb-1' })).resolves.toMatchObject({
      items: [{ id: 'trace-1', operation: 'vector trace succeeded', status: 'succeeded' }]
    });
    await expect(repo.listTraces({ tenantId: 'tenant-1', knowledgeBaseId: 'kb-1' })).resolves.toHaveProperty(
      'items.length',
      1
    );
    await expect(repo.getTrace({ tenantId: 'tenant-1', id: 'trace-1' })).resolves.toMatchObject({
      id: 'trace-1',
      operation: 'vector trace succeeded',
      status: 'succeeded'
    });
    await expect(repo.getTrace({ tenantId: 'tenant-2', id: 'trace-1' })).resolves.toBeUndefined();
  });

  it('accepts production document, eval run, and trace statuses', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const readyDocument: KnowledgeDocumentRecord = {
      id: 'doc-ready',
      tenantId: 'tenant-1',
      knowledgeBaseId: 'kb-1',
      title: 'Ready document',
      status: 'ready',
      createdAt: now,
      updatedAt: now
    };
    const canceledEvalRun: KnowledgeEvalRunRecord = {
      id: 'eval-run-canceled',
      tenantId: 'tenant-1',
      datasetId: 'dataset-1',
      status: 'canceled',
      createdAt: now,
      updatedAt: now
    };
    const failedTrace: KnowledgeTraceRecord = {
      id: 'trace-failed',
      tenantId: 'tenant-1',
      knowledgeBaseIds: ['kb-1'],
      operation: 'vector trace failed',
      status: 'failed',
      createdAt: now,
      updatedAt: now
    };

    await repo.createDocument(readyDocument);
    await repo.createEvalRun(canceledEvalRun);
    await repo.createTrace(failedTrace);

    await expect(repo.listDocuments({ tenantId: 'tenant-1', knowledgeBaseId: 'kb-1' })).resolves.toMatchObject({
      items: [{ id: 'doc-ready', status: 'ready' }]
    });
    await expect(repo.listEvalRuns({ tenantId: 'tenant-1', datasetId: 'dataset-1' })).resolves.toMatchObject({
      items: [{ id: 'eval-run-canceled', status: 'canceled' }]
    });
    await expect(repo.listTraces({ tenantId: 'tenant-1', knowledgeBaseId: 'kb-1' })).resolves.toMatchObject({
      items: [{ id: 'trace-failed', operation: 'vector trace failed', status: 'failed' }]
    });
  });

  it('copies records on write and read so external mutation cannot pollute storage', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const record: KnowledgeTraceRecord = {
      id: 'trace-1',
      tenantId: 'tenant-1',
      knowledgeBaseIds: ['kb-1'],
      operation: 'vector trace succeeded',
      status: 'succeeded',
      spans: [{ id: 'span-1', name: 'retrieval', attributes: { topK: 8 } }],
      createdAt: now,
      updatedAt: now
    };

    await repo.createTrace(record);
    record.operation = 'mutated-before-read';
    record.spans[0]!.attributes = { topK: 1 };

    const firstRead = await repo.listTraces({ tenantId: 'tenant-1', knowledgeBaseId: 'kb-1' });
    firstRead.items[0]!.operation = 'mutated-after-read';
    firstRead.items[0]!.spans[0]!.attributes = { topK: 2 };

    const secondRead = await repo.listTraces({ tenantId: 'tenant-1', knowledgeBaseId: 'kb-1' });

    expect(secondRead.items[0]).toMatchObject({
      operation: 'vector trace succeeded',
      spans: [{ attributes: { topK: 8 } }]
    });
  });
});
