import { describe, expect, it } from 'vitest';

import { KnowledgeMemoryRepository } from '../../src/domains/knowledge/repositories/knowledge-memory.repository';

describe('KnowledgeRepository contract', () => {
  it('creates and lists knowledge bases for an identity principal', async () => {
    const repository = new KnowledgeMemoryRepository();
    const principal = { userId: 'user_1', permissions: ['knowledge:*'] };

    const base = await repository.createBase({ name: 'Docs', ownerId: principal.userId });
    const bases = await repository.listBases({ userId: principal.userId });

    expect(bases).toContainEqual(base);
  });
});
