import { describe, expect, it } from 'vitest';

import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';

function createTestKnowledgeRepository(): InMemoryKnowledgeRepository {
  return new InMemoryKnowledgeRepository();
}

describe('KnowledgeRepository chat conversations', () => {
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
