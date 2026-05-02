import { describe, expect, it } from 'vitest';

import { PostgresKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-postgres.repository';

describe('PostgresKnowledgeRepository', () => {
  it('maps knowledge base rows', async () => {
    const repository = new PostgresKnowledgeRepository({
      query: async () => ({
        rows: [
          {
            id: 'kb_1',
            name: 'Engineering KB',
            description: 'Notes',
            created_by_user_id: 'user_1',
            status: 'active',
            created_at: '2026-05-02T12:00:00.000Z',
            updated_at: '2026-05-02T12:00:00.000Z'
          }
        ]
      })
    });

    await expect(repository.listBasesForUser('user_1')).resolves.toMatchObject([
      { id: 'kb_1', name: 'Engineering KB' }
    ]);
  });
});
