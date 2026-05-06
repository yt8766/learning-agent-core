import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { KnowledgeRagService } from '../../src/knowledge/knowledge-rag.service';
import type { KnowledgeTraceRecord } from '../../src/knowledge/interfaces/knowledge-records.types';
import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';

const now = '2026-05-01T09:00:00.000Z';

describe('KnowledgeRagService', () => {
  it('returns citations, saves chat messages, and writes a succeeded trace when chunks match', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const service = new KnowledgeRagService({ repo, clock: () => now });

    await repo.createChunk({
      id: 'chunk-rag',
      tenantId: 'ws_1',
      knowledgeBaseId: 'kb-rag',
      documentId: 'doc-rag',
      text: 'RAG 对话必须先检索上下文，再基于引用生成答案。',
      createdAt: now,
      updatedAt: now
    });

    const result = await service.answer({
      conversationId: 'conv-rag',
      knowledgeBaseId: 'kb-rag',
      message: 'RAG 如何检索上下文生成答案？'
    });

    expect(result.conversationId).toBe('conv-rag');
    expect(result.assistantMessage.content).toContain('RAG 对话必须先检索上下文');
    expect(result.citations).toMatchObject([
      {
        chunkId: 'chunk-rag',
        documentId: 'doc-rag',
        text: 'RAG 对话必须先检索上下文，再基于引用生成答案。'
      }
    ]);
    expect(result.retrieval.matches).toHaveLength(1);

    await expect(repo.listChatMessages({ tenantId: 'ws_1', conversationId: 'conv-rag' })).resolves.toMatchObject({
      items: [
        { role: 'user', content: 'RAG 如何检索上下文生成答案？' },
        { role: 'assistant', citations: [{ chunkId: 'chunk-rag' }] }
      ]
    });
    await expect(repo.listTraces({ tenantId: 'ws_1', knowledgeBaseId: 'kb-rag' })).resolves.toMatchObject({
      items: [
        {
          operation: 'rag.chat',
          status: 'succeeded',
          knowledgeBaseIds: ['kb-rag'],
          conversationId: 'conv-rag',
          messageId: result.assistantMessage.id,
          spans: [{ name: 'retrieval' }, { name: 'generation' }, { name: 'persist' }]
        }
      ]
    });
  });

  it('returns a stable no-evidence answer and a succeeded trace when retrieval has no matches', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const service = new KnowledgeRagService({ repo, clock: () => now });

    await repo.createChunk({
      id: 'chunk-other',
      tenantId: 'ws_1',
      knowledgeBaseId: 'kb-rag',
      documentId: 'doc-other',
      text: '审批流需要记录审批人和状态。',
      createdAt: now,
      updatedAt: now
    });

    const result = await service.answer({
      conversationId: 'conv-empty',
      knowledgeBaseId: 'kb-rag',
      message: '如何配置火星基地能源系统？'
    });

    expect(result.answer).toBe('未在当前知识库中找到足够依据。');
    expect(result.citations).toEqual([]);
    expect(result.retrieval.matches).toEqual([]);
    await expect(repo.listTraces({ tenantId: 'ws_1', knowledgeBaseId: 'kb-rag' })).resolves.toMatchObject({
      items: [{ operation: 'rag.chat', status: 'succeeded' }]
    });
  });

  it('rejects an empty message without writing messages', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const service = new KnowledgeRagService({ repo, clock: () => now });

    await expect(
      service.answer({ conversationId: 'conv-empty', knowledgeBaseId: 'kb-rag', message: '   ' })
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(repo.listChatMessages({ tenantId: 'ws_1', conversationId: 'conv-empty' })).resolves.toMatchObject({
      items: []
    });
  });

  it('rethrows the original generator error when failed trace persistence also fails', async () => {
    const repo = new TraceFailingKnowledgeRepository();
    const generatorError = new Error('generator exploded');
    const service = new KnowledgeRagService({
      repo,
      clock: () => now,
      generator: {
        async generate() {
          throw generatorError;
        }
      }
    });

    await expect(
      service.answer({ conversationId: 'conv-generator-fail', knowledgeBaseId: 'kb-rag', message: 'RAG 会失败吗？' })
    ).rejects.toBe(generatorError);
  });

  it('does not leave assistant metadata pointing at a trace that failed to persist', async () => {
    const repo = new TraceFailingKnowledgeRepository();
    const service = new KnowledgeRagService({ repo, clock: () => now });

    await repo.createChunk({
      id: 'chunk-trace-fail',
      tenantId: 'ws_1',
      knowledgeBaseId: 'kb-rag',
      documentId: 'doc-rag',
      text: 'trace 写入失败时 assistant 不应提前指向 traceId。',
      createdAt: now,
      updatedAt: now
    });

    await expect(
      service.answer({
        conversationId: 'conv-trace-fail',
        knowledgeBaseId: 'kb-rag',
        message: 'trace 写入失败时 assistant 如何处理？'
      })
    ).rejects.toThrow('trace persistence failed');

    const messages = await repo.listChatMessages({ tenantId: 'ws_1', conversationId: 'conv-trace-fail' });
    const assistantMessages = messages.items.filter(message => message.role === 'assistant');
    expect(assistantMessages.every(message => message.metadata?.traceId === undefined)).toBe(true);
  });

  it('projects citations and trace metadata without raw chunk payloads or sensitive metadata', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const service = new KnowledgeRagService({ repo, clock: () => now });
    const longText = `RAG 安全引用 ${'长文本'.repeat(160)}`;
    const longQuestion = `RAG 安全引用问题 ${'很长'.repeat(160)}`;

    await repo.createChunk({
      id: 'chunk-projection',
      tenantId: 'ws_1',
      knowledgeBaseId: 'kb-rag',
      documentId: 'doc-projection',
      text: longText,
      metadata: {
        title: '安全引用标题',
        sourceUri: 'https://example.test/doc',
        tags: ['security', 'rag'],
        raw: { html: '<article>full raw payload</article>' },
        vendor: { provider: 'vector-db' },
        secret: 'secret-value',
        token: 'token-value',
        password: 'password-value',
        embedding: [0.1, 0.2, 0.3]
      },
      createdAt: now,
      updatedAt: now
    });

    const result = await service.answer({
      conversationId: 'conv-projection',
      knowledgeBaseId: 'kb-rag',
      message: longQuestion
    });

    const [citation] = result.citations;
    expect(citation).toMatchObject({
      chunkId: 'chunk-projection',
      documentId: 'doc-projection',
      title: '安全引用标题',
      metadata: {
        title: '安全引用标题',
        sourceUri: 'https://example.test/doc',
        tags: ['security', 'rag']
      }
    });
    expect(citation?.text.length).toBeLessThanOrEqual(240);
    expect(citation?.quote.length).toBeLessThanOrEqual(160);
    expect(citation?.contentPreview.length).toBeLessThanOrEqual(120);
    expect(citation?.metadata).not.toHaveProperty('raw');
    expect(citation?.metadata).not.toHaveProperty('vendor');
    expect(citation?.metadata).not.toHaveProperty('secret');
    expect(citation?.metadata).not.toHaveProperty('token');
    expect(citation?.metadata).not.toHaveProperty('password');
    expect(citation?.metadata).not.toHaveProperty('embedding');

    const traces = await repo.listTraces({ tenantId: 'ws_1', knowledgeBaseId: 'kb-rag' });
    const [trace] = traces.items;
    expect(trace?.metadata?.questionPreview).toBeTypeOf('string');
    expect(String(trace?.metadata?.questionPreview).length).toBeLessThanOrEqual(240);
    expect(trace?.metadata?.answerPreview).toBeTypeOf('string');
    expect(String(trace?.metadata?.answerPreview).length).toBeLessThanOrEqual(240);
    expect(trace?.metadata).not.toHaveProperty('question');
    expect(trace?.metadata).not.toHaveProperty('answer');
    expect(trace?.metadata).not.toHaveProperty('citations');
    expect(trace?.metadata?.citationSummaries).toMatchObject([
      {
        chunkId: 'chunk-projection',
        documentId: 'doc-projection',
        title: '安全引用标题'
      }
    ]);
  });
});

class TraceFailingKnowledgeRepository extends InMemoryKnowledgeRepository {
  async createTrace(_record: KnowledgeTraceRecord): Promise<KnowledgeTraceRecord> {
    throw new Error('trace persistence failed');
  }
}
