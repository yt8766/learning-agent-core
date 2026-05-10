import { describe, expect, it } from 'vitest';

import {
  PostgresKnowledgeRepository,
  type PostgresKnowledgeClient
} from '../../src/domains/knowledge/repositories/knowledge-postgres.repository';

describe('PostgresKnowledgeRepository', () => {
  it('creates a knowledge base and owner membership through the repository contract', async () => {
    const client = new ScriptedPostgresClient([
      {
        rows: [
          {
            id: 'kb_1',
            name: 'Engineering',
            description: '',
            created_by_user_id: 'user_1',
            status: 'active',
            created_at: now,
            updated_at: now
          }
        ]
      },
      {
        rows: [
          {
            knowledge_base_id: 'kb_1',
            user_id: 'user_1',
            role: 'owner',
            created_at: now,
            updated_at: now
          }
        ]
      }
    ]);
    const repository = new PostgresKnowledgeRepository(client);

    await expect(
      repository.createBase({ id: 'kb_1', name: 'Engineering', description: '', createdByUserId: 'user_1' })
    ).resolves.toMatchObject({ id: 'kb_1', createdByUserId: 'user_1' });
    expect(client.calls.map(call => call.values)).toEqual([
      ['kb_1', 'Engineering', '', 'user_1'],
      ['kb_1', 'user_1', 'owner']
    ]);
  });

  it('persists chat messages only after confirming conversation ownership', async () => {
    const client = new ScriptedPostgresClient([
      { rows: [{ id: 'conv_1' }] },
      {
        rows: [
          {
            id: 'msg_1',
            conversation_id: 'conv_1',
            user_id: 'user_1',
            role: 'assistant',
            content: 'answer',
            model_profile_id: null,
            trace_id: 'trace_1',
            citations: JSON.stringify([]),
            route: JSON.stringify({ selectedKnowledgeBaseIds: ['kb_1'], reason: 'legacy-ids' }),
            diagnostics: JSON.stringify({
              normalizedQuery: 'answer',
              queryVariants: ['answer'],
              retrievalMode: 'keyword-only',
              hitCount: 1,
              contextChunkCount: 1
            }),
            feedback: null,
            created_at: now
          }
        ]
      },
      { rows: [] }
    ]);
    const repository = new PostgresKnowledgeRepository(client);

    await expect(
      repository.appendChatMessage({
        conversationId: 'conv_1',
        userId: 'user_1',
        role: 'assistant',
        content: 'answer',
        traceId: 'trace_1',
        citations: [],
        route: { requestedMentions: [], selectedKnowledgeBaseIds: ['kb_1'], reason: 'legacy-ids' },
        diagnostics: {
          normalizedQuery: 'answer',
          queryVariants: ['answer'],
          retrievalMode: 'keyword-only',
          hitCount: 1,
          contextChunkCount: 1
        }
      })
    ).resolves.toMatchObject({
      id: 'msg_1',
      role: 'assistant',
      traceId: 'trace_1'
    });
    expect(client.calls[0]?.sql).toContain('knowledge_chat_conversations');
    expect(client.calls[1]?.values?.slice(1, 5)).toEqual(['conv_1', 'user_1', 'assistant', 'answer']);
  });

  it('persists and maps chunk metadata through the repository contract', async () => {
    const client = new ScriptedPostgresClient([
      { rows: [] },
      {
        rows: [
          {
            id: 'chunk_1',
            document_id: 'doc_1',
            ordinal: 0,
            content: 'approval policy',
            token_count: 2,
            embedding_status: 'succeeded',
            vector_index_status: 'succeeded',
            keyword_index_status: 'succeeded',
            metadata: JSON.stringify({ status: 'active', sectionId: 'sec_1' }),
            created_at: now,
            updated_at: now
          }
        ]
      },
      {
        rows: [
          {
            id: 'chunk_1',
            document_id: 'doc_1',
            ordinal: 0,
            content: 'approval policy',
            token_count: 2,
            embedding_status: 'succeeded',
            vector_index_status: 'succeeded',
            keyword_index_status: 'succeeded',
            metadata: JSON.stringify({ status: 'active', sectionId: 'sec_1' }),
            created_at: now,
            updated_at: now
          }
        ]
      }
    ]);
    const repository = new PostgresKnowledgeRepository(client);

    await expect(
      repository.saveChunks('doc_1', [
        {
          id: 'chunk_1',
          documentId: 'doc_1',
          ordinal: 0,
          content: 'approval policy',
          tokenCount: 2,
          embeddingStatus: 'succeeded',
          vectorIndexStatus: 'succeeded',
          keywordIndexStatus: 'succeeded',
          metadata: { status: 'active', sectionId: 'sec_1' },
          createdAt: now,
          updatedAt: now
        }
      ])
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'chunk_1',
        metadata: { status: 'active', sectionId: 'sec_1' }
      })
    ]);

    expect(client.calls[0]?.sql).toContain('not (id = any($2::text[]))');
    expect(client.calls[1]?.sql).toContain('metadata');
    expect(client.calls[1]?.sql).toContain('on conflict (id) do update');
    expect(client.calls[1]?.values?.[8]).toBe(JSON.stringify({ status: 'active', sectionId: 'sec_1' }));
    await expect(repository.listChunks('doc_1')).resolves.toEqual([
      expect.objectContaining({
        id: 'chunk_1',
        metadata: { status: 'active', sectionId: 'sec_1' }
      })
    ]);
    expect(client.calls[2]?.sql).toContain('metadata');
  });
});

const now = '2026-05-07T00:00:00.000Z';

class ScriptedPostgresClient implements PostgresKnowledgeClient {
  readonly calls: Array<{ sql: string; values?: unknown[] }> = [];

  constructor(private readonly results: Array<{ rows: Array<Record<string, unknown>> }>) {}

  async query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }> {
    this.calls.push({ sql, values });
    const result = this.results.shift();
    if (!result) {
      throw new Error(`No scripted result for query: ${sql}`);
    }
    return result;
  }
}
