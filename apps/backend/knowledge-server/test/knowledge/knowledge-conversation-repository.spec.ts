import { describe, expect, it } from 'vitest';

import {
  CreateKnowledgeChatMessageRecordInputSchema,
  KnowledgeChatMessageRecordSchema
} from '../../src/knowledge/domain/knowledge-document.schemas';
import { mapChatMessage } from '../../src/knowledge/repositories/knowledge-postgres.mappers';
import { PostgresKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-postgres.repository';
import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';

function createTestKnowledgeRepository(): InMemoryKnowledgeRepository {
  return new InMemoryKnowledgeRepository();
}

describe('KnowledgeRepository chat conversations', () => {
  it('maps postgres chat message rows through the message schema', () => {
    expect(
      mapChatMessage({
        id: 'msg_1',
        conversation_id: 'conv_1',
        user_id: 'user_1',
        role: 'assistant',
        content: '依据如下。',
        model_profile_id: 'coding-pro',
        trace_id: 'trace_1',
        citations: JSON.stringify([
          {
            id: 'citation_1',
            documentId: 'doc_1',
            chunkId: 'chunk_1',
            title: 'Core',
            quote: 'PreRetrievalPlanner',
            score: 0.91
          }
        ]),
        route: JSON.stringify({
          requestedMentions: ['kb_core'],
          selectedKnowledgeBaseIds: ['kb_core'],
          reason: 'explicit_mention'
        }),
        diagnostics: JSON.stringify({
          planner: {
            queryVariants: ['PreRetrievalPlanner'],
            selectedKnowledgeBaseIds: ['kb_core'],
            routingDecisions: [],
            confidence: 0.9,
            fallbackApplied: false
          },
          retrieval: {
            effectiveSearchMode: 'vector',
            executedQueries: [{ query: 'PreRetrievalPlanner', mode: 'vector', hitCount: 1 }],
            vectorHitCount: 1,
            keywordHitCount: 0,
            finalHitCount: 1
          },
          generation: {
            provider: 'openai-compatible',
            model: 'answer-coding',
            tokens: { input: 10, output: 20 },
            durationMs: 300
          }
        }),
        feedback: JSON.stringify({ rating: 'positive', comment: ' helpful ' }),
        created_at: '2026-05-03T00:00:00.000Z'
      })
    ).toMatchObject({
      role: 'assistant',
      citations: [expect.objectContaining({ chunkId: 'chunk_1' })],
      diagnostics: expect.objectContaining({
        retrieval: expect.objectContaining({ finalHitCount: 1 })
      })
    });
  });

  it('rejects invalid postgres chat message diagnostics during mapping', () => {
    expect(() =>
      mapChatMessage({
        id: 'msg_1',
        conversation_id: 'conv_1',
        user_id: 'user_1',
        role: 'assistant',
        content: '依据如下。',
        citations: '[]',
        diagnostics: JSON.stringify({
          retrieval: {
            effectiveSearchMode: 'vector',
            executedQueries: [],
            vectorHitCount: -1,
            keywordHitCount: 0,
            finalHitCount: 0
          }
        }),
        created_at: '2026-05-03T00:00:00.000Z'
      })
    ).toThrow();
  });

  it('rejects invalid postgres chat message route during mapping', () => {
    expect(() =>
      mapChatMessage({
        id: 'msg_1',
        conversation_id: 'conv_1',
        user_id: 'user_1',
        role: 'assistant',
        content: '依据如下。',
        citations: '[]',
        route: JSON.stringify({
          requestedMentions: ['kb_core'],
          selectedKnowledgeBaseIds: ['kb_core'],
          reason: 'raw_vendor_reason'
        }),
        created_at: '2026-05-03T00:00:00.000Z'
      })
    ).toThrow();
  });

  it('filters postgres chat messages by owner message rows and stable ordering', async () => {
    const queries: string[] = [];
    const repository = new PostgresKnowledgeRepository({
      query: async sql => {
        queries.push(sql);
        return { rows: [] };
      }
    });

    await repository.listChatMessages('conv_1', 'user_1');

    expect(queries[0]).toContain('m.user_id = $2');
    expect(queries[0]).toContain('order by m.created_at asc, m.id asc');
  });

  it('parses assistant chat message records with citations and diagnostics', () => {
    expect(
      KnowledgeChatMessageRecordSchema.parse({
        id: 'msg_1',
        conversationId: 'conv_1',
        userId: 'user_1',
        role: 'assistant',
        content: '依据如下。',
        modelProfileId: 'coding-pro',
        citations: [
          {
            id: 'citation_1',
            documentId: 'doc_1',
            chunkId: 'chunk_1',
            title: 'Core',
            quote: 'PreRetrievalPlanner',
            score: 0.91
          }
        ],
        diagnostics: {
          retrieval: {
            effectiveSearchMode: 'vector',
            executedQueries: [{ query: 'PreRetrievalPlanner', mode: 'vector', hitCount: 1 }],
            vectorHitCount: 1,
            keywordHitCount: 0,
            finalHitCount: 1
          }
        },
        createdAt: '2026-05-03T00:00:00.000Z'
      })
    ).toMatchObject({
      role: 'assistant',
      citations: [expect.objectContaining({ chunkId: 'chunk_1' })],
      diagnostics: expect.any(Object)
    });
  });

  it('persists current RAG response route and flat diagnostics projections', async () => {
    const repository = createTestKnowledgeRepository();
    const conversation = await repository.createChatConversation({
      userId: 'user_1',
      title: '当前 RAG 响应契约',
      activeModelProfileId: 'coding-pro'
    });

    await repository.appendChatMessage({
      conversationId: conversation.id,
      userId: 'user_1',
      role: 'assistant',
      content: '依据如下。',
      modelProfileId: 'coding-pro',
      citations: [],
      route: {
        requestedMentions: ['kb_core'],
        selectedKnowledgeBaseIds: ['kb_core'],
        reason: 'mentions'
      },
      diagnostics: {
        normalizedQuery: 'PreRetrievalPlanner',
        queryVariants: ['PreRetrievalPlanner'],
        retrievalMode: 'hybrid',
        hitCount: 1,
        contextChunkCount: 1
      }
    });

    await expect(repository.listChatMessages(conversation.id, 'user_1')).resolves.toMatchObject({
      items: [
        expect.objectContaining({
          route: expect.objectContaining({ reason: 'mentions' }),
          diagnostics: expect.objectContaining({ retrievalMode: 'hybrid', hitCount: 1 })
        })
      ]
    });
  });

  it('rejects invalid chat message create input contracts', () => {
    expect(() =>
      CreateKnowledgeChatMessageRecordInputSchema.parse({
        conversationId: 'conv_1',
        userId: 'user_1',
        role: 'user',
        content: ''
      })
    ).toThrow();

    expect(() =>
      CreateKnowledgeChatMessageRecordInputSchema.parse({
        conversationId: 'conv_1',
        userId: 'user_1',
        role: 'tool',
        content: 'hello'
      })
    ).toThrow();
  });

  it('persists and lists chat conversations with messages', async () => {
    const repository = createTestKnowledgeRepository();
    const conversation = await repository.createChatConversation({
      userId: 'user_1',
      title: '检索前技术名词',
      activeModelProfileId: 'coding-pro'
    });

    await repository.appendChatMessage({
      conversationId: conversation.id,
      userId: 'user_1',
      role: 'user',
      content: '检索前技术名词',
      modelProfileId: 'coding-pro'
    });

    await repository.appendChatMessage({
      conversationId: conversation.id,
      userId: 'user_1',
      role: 'assistant',
      content: '依据如下。',
      modelProfileId: 'coding-pro',
      citations: [],
      diagnostics: {
        planner: {
          queryVariants: ['PreRetrievalPlanner'],
          selectedKnowledgeBaseIds: ['kb_core'],
          routingDecisions: [],
          confidence: 0.9,
          fallbackApplied: false
        },
        retrieval: {
          effectiveSearchMode: 'vector',
          executedQueries: [{ query: 'PreRetrievalPlanner', mode: 'vector', hitCount: 1 }],
          vectorHitCount: 1,
          keywordHitCount: 0,
          finalHitCount: 1
        }
      }
    });

    await expect(repository.listChatConversationsForUser('user_1')).resolves.toMatchObject({
      items: [expect.objectContaining({ id: conversation.id, activeModelProfileId: 'coding-pro' })]
    });
    await expect(repository.listChatMessages(conversation.id, 'user_1')).resolves.toMatchObject({
      items: [
        expect.objectContaining({ role: 'user', content: '检索前技术名词' }),
        expect.objectContaining({ role: 'assistant', diagnostics: expect.any(Object) })
      ]
    });
  });

  it('rejects appending chat messages to another user conversation', async () => {
    const repository = createTestKnowledgeRepository();
    const conversation = await repository.createChatConversation({
      userId: 'user_1',
      title: '私有会话',
      activeModelProfileId: 'coding-pro'
    });

    await expect(
      repository.appendChatMessage({
        conversationId: conversation.id,
        userId: 'user_2',
        role: 'user',
        content: '越权写入',
        modelProfileId: 'coding-pro'
      })
    ).rejects.toThrow('knowledge_chat_conversation_not_found');
  });

  it('updates message feedback in memory', async () => {
    const repository = createTestKnowledgeRepository();
    const conversation = await repository.createChatConversation({
      userId: 'user_1',
      title: 'Feedback test',
      activeModelProfileId: 'coding-pro'
    });
    const message = await repository.appendChatMessage({
      conversationId: conversation.id,
      userId: 'user_1',
      role: 'assistant',
      content: 'Answer.',
      modelProfileId: 'coding-pro'
    });

    const updated = await repository.updateMessageFeedback(message.id, { rating: 'positive', comment: 'Great!' });
    expect(updated).toMatchObject({
      id: message.id,
      feedback: { rating: 'positive', comment: 'Great!' }
    });

    const messages = await repository.listChatMessages(conversation.id, 'user_1');
    expect(messages.items[0]).toMatchObject({
      feedback: { rating: 'positive', comment: 'Great!' }
    });
  });

  it('returns undefined when updating feedback for non-existent message', async () => {
    const repository = createTestKnowledgeRepository();
    const updated = await repository.updateMessageFeedback('msg_nonexistent', { rating: 'negative' });
    expect(updated).toBeUndefined();
  });

  it('updates message feedback through postgres repository', async () => {
    const queries: { sql: string; values: unknown[] }[] = [];
    const repository = new PostgresKnowledgeRepository({
      query: async (sql, values) => {
        queries.push({ sql, values });
        return {
          rows: [
            {
              id: 'msg_1',
              conversation_id: 'conv_1',
              user_id: 'user_1',
              role: 'assistant',
              content: 'Answer.',
              model_profile_id: 'coding-pro',
              trace_id: null,
              citations: '[]',
              route: null,
              diagnostics: null,
              feedback: JSON.stringify({ rating: 'positive', category: 'helpful' }),
              created_at: '2026-05-03T00:00:00.000Z'
            }
          ]
        };
      }
    });

    const updated = await repository.updateMessageFeedback('msg_1', { rating: 'positive', category: 'helpful' });
    expect(updated).toMatchObject({
      id: 'msg_1',
      feedback: { rating: 'positive', category: 'helpful' }
    });
    expect(queries[0]!.sql).toContain('update knowledge_chat_messages');
    expect(queries[0]!.sql).toContain('feedback = $1');
    expect(queries[0]!.values).toEqual([JSON.stringify({ rating: 'positive', category: 'helpful' }), 'msg_1']);
  });

  it('returns undefined when postgres update affects no rows', async () => {
    const repository = new PostgresKnowledgeRepository({
      query: async () => ({ rows: [] })
    });

    const updated = await repository.updateMessageFeedback('msg_missing', { rating: 'negative' });
    expect(updated).toBeUndefined();
  });
});
