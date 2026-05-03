import { describe, expect, it } from 'vitest';

import {
  CreateKnowledgeChatMessageRecordInputSchema,
  KnowledgeChatMessageRecordSchema
} from '../../src/knowledge/domain/knowledge-document.schemas';
import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';

function createTestKnowledgeRepository(): InMemoryKnowledgeRepository {
  return new InMemoryKnowledgeRepository();
}

describe('KnowledgeRepository chat conversations', () => {
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
            vectorHitCount: 1
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
});
