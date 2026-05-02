import { describe, expect, it, vi } from 'vitest';

import { KnowledgeDocumentService } from '../../src/knowledge/knowledge-document.service';
import { KnowledgeIngestionWorker } from '../../src/knowledge/knowledge-ingestion.worker';
import { KnowledgeService } from '../../src/knowledge/knowledge.service';
import type { KnowledgeSdkRuntimeProviderValue } from '../../src/knowledge/runtime/knowledge-sdk-runtime.provider';
import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';
import { InMemoryOssStorageProvider } from '../../src/knowledge/storage/in-memory-oss-storage.provider';

const actor = { userId: 'user_1', username: 'dev', roles: ['user'] };

describe('KnowledgeDocumentService chat SDK RAG', () => {
  it('answers through the enabled SDK runtime with projected vector citations', async () => {
    const embedText = vi.fn(async ({ text }: { text: string }) => ({
      embedding: [text.length, 1],
      model: 'fake-embed'
    }));
    const search = vi.fn(async () => ({
      hits: [
        {
          id: 'chunk_1',
          score: 0.91,
          content: 'Rotate signing keys every 90 days.',
          metadata: {
            documentId: 'doc_1',
            title: 'Rotation Runbook',
            filename: 'rotation-runbook.md',
            ordinal: 7
          }
        }
      ]
    }));
    const generate = vi.fn(async () => ({
      text: 'Keys should rotate every 90 days.',
      model: 'fake-chat',
      providerId: 'fake'
    }));
    const { documents, baseId } = await createService(
      enabledSdkRuntime({
        embedText,
        search,
        generate
      })
    );

    const response = await documents.chat(actor, {
      knowledgeBaseIds: [baseId],
      message: 'How often should we rotate signing keys?'
    });

    expect(embedText).toHaveBeenCalledWith({ text: 'How often should we rotate signing keys?' });
    expect(search).toHaveBeenCalledWith({
      embedding: [40, 1],
      topK: 5,
      filters: {
        tenantId: 'default',
        knowledgeBaseId: baseId,
        query: 'How often should we rotate signing keys?'
      }
    });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system', content: expect.stringContaining('只基于') }),
          expect.objectContaining({ role: 'user', content: 'How often should we rotate signing keys?' }),
          expect.objectContaining({ content: expect.stringContaining('Rotate signing keys every 90 days.') })
        ]),
        metadata: expect.objectContaining({ knowledgeBaseIds: [baseId] })
      })
    );
    expect(response).toMatchObject({
      answer: 'Keys should rotate every 90 days.',
      citations: [
        {
          documentId: 'doc_1',
          chunkId: 'chunk_1',
          title: 'Rotation Runbook',
          quote: 'Rotate signing keys every 90 days.',
          score: 0.91
        }
      ],
      assistantMessage: {
        content: 'Keys should rotate every 90 days.',
        citations: [expect.objectContaining({ documentId: 'doc_1' })]
      }
    });
  });

  it('maps SDK vector search failures to a stable chat error code', async () => {
    const { documents, baseId } = await createService(
      enabledSdkRuntime({
        search: vi.fn(async () => {
          throw new Error('vector backend unavailable');
        })
      })
    );

    await expect(
      documents.chat(actor, {
        knowledgeBaseIds: [baseId],
        message: 'rotation policy'
      })
    ).rejects.toMatchObject({
      code: 'knowledge_chat_failed',
      message: 'vector backend unavailable'
    });
  });

  it('filters vector hits without document metadata or quote before prompting the chat provider', async () => {
    const generate = vi.fn(async () => ({
      text: '依据不足。',
      model: 'fake-chat',
      providerId: 'fake'
    }));
    const { documents, baseId } = await createService(
      enabledSdkRuntime({
        search: vi.fn(async () => ({
          hits: [
            { id: 'missing_document', score: 0.9, content: 'orphan quote', metadata: { title: 'Orphan' } },
            { id: 'missing_quote', score: 0.8, metadata: { documentId: 'doc_1', title: 'Blank' } }
          ]
        })),
        generate
      })
    );

    const response = await documents.chat(actor, {
      knowledgeBaseIds: [baseId],
      message: 'rotation policy'
    });

    expect(response.citations).toEqual([]);
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ content: expect.stringContaining('未检索到可引用片段') })
        ])
      })
    );
  });

  it('keeps the document_id metadata compatibility fallback for vector citations', async () => {
    const { documents, baseId } = await createService(
      enabledSdkRuntime({
        search: vi.fn(async () => ({
          hits: [
            {
              id: 'chunk_legacy',
              score: 0.7,
              content: 'Legacy snake case metadata quote.',
              metadata: { document_id: 'doc_legacy', filename: 'legacy.md' }
            }
          ]
        }))
      })
    );

    await expect(
      documents.chat(actor, {
        knowledgeBaseIds: [baseId],
        message: 'legacy metadata'
      })
    ).resolves.toMatchObject({
      citations: [
        expect.objectContaining({
          documentId: 'doc_legacy',
          chunkId: 'chunk_legacy',
          quote: 'Legacy snake case metadata quote.'
        })
      ]
    });
  });

  it('maps SDK chat generation failures to a stable chat error code', async () => {
    const { documents, baseId } = await createService(
      enabledSdkRuntime({
        generate: vi.fn(async () => {
          throw new Error('llm unavailable');
        })
      })
    );

    await expect(
      documents.chat(actor, {
        knowledgeBaseIds: [baseId],
        message: 'rotation policy'
      })
    ).rejects.toMatchObject({
      code: 'knowledge_chat_failed',
      message: 'llm unavailable'
    });
  });
});

async function createService(sdkRuntime: KnowledgeSdkRuntimeProviderValue) {
  const repository = new InMemoryKnowledgeRepository();
  const storage = new InMemoryOssStorageProvider();
  const knowledge = new KnowledgeService(repository);
  const worker = new KnowledgeIngestionWorker(repository, storage, disabledSdkRuntime());
  const documents = new KnowledgeDocumentService(repository, worker, storage, sdkRuntime);
  const base = await knowledge.createBase(actor, { name: 'Engineering KB', description: '' });
  return { documents, baseId: base.id };
}

function disabledSdkRuntime(): KnowledgeSdkRuntimeProviderValue {
  return {
    enabled: false,
    reason: 'missing_env',
    missingEnv: ['DATABASE_URL', 'KNOWLEDGE_CHAT_MODEL', 'KNOWLEDGE_EMBEDDING_MODEL', 'KNOWLEDGE_LLM_API_KEY'],
    runtime: null
  };
}

function enabledSdkRuntime(input: {
  embedText?: (input: { text: string }) => Promise<{ embedding: number[]; model: string }>;
  search?: (input: {
    embedding: number[];
    topK: number;
    filters?: Record<string, unknown>;
  }) => Promise<{ hits: Array<{ id: string; score: number; content?: string; metadata?: Record<string, unknown> }> }>;
  generate?: (input: unknown) => Promise<{ text: string; model: string; providerId: string }>;
}): KnowledgeSdkRuntimeProviderValue {
  return {
    enabled: true,
    runtime: {
      chatProvider: {
        providerId: 'fake',
        defaultModel: 'fake-chat',
        generate:
          input.generate ??
          (async () => ({
            text: 'generated answer',
            model: 'fake-chat',
            providerId: 'fake'
          }))
      },
      embeddingProvider: {
        providerId: 'fake',
        defaultModel: 'fake-embedding',
        embedText:
          input.embedText ??
          (async () => ({
            embedding: [1, 2],
            model: 'fake-embedding'
          })),
        embedBatch: async ({ texts }) => ({
          embeddings: texts.map((_, index) => [index + 1, index + 2]),
          model: 'fake-embedding'
        })
      },
      vectorStore: {
        upsert: async ({ records }) => ({ upsertedCount: records.length }),
        search: input.search ?? (async () => ({ hits: [] })),
        delete: async () => ({ deletedCount: 0 })
      }
    }
  };
}
