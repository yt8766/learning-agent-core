import { describe, expect, it } from 'vitest';

import { KnowledgeService } from '../../src/knowledge/knowledge.service';
import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';

describe('KnowledgeService permissions', () => {
  async function createService() {
    const repository = new InMemoryKnowledgeRepository();
    const service = new KnowledgeService(repository);
    const base = await service.createBase({ userId: 'owner_1' }, { name: 'Engineering KB', description: 'Notes' });
    return { service, base };
  }

  it('creates a base and makes the creator owner', async () => {
    const { service } = await createService();

    await expect(service.listBases({ userId: 'owner_1' })).resolves.toMatchObject({
      bases: [expect.objectContaining({ name: 'Engineering KB' })]
    });
  });

  it('allows owners to add viewers', async () => {
    const { service, base } = await createService();

    await service.addMember({ userId: 'owner_1' }, base.id, { userId: 'viewer_1', role: 'viewer' });

    await expect(service.listMembers({ userId: 'owner_1' }, base.id)).resolves.toMatchObject({
      members: expect.arrayContaining([expect.objectContaining({ userId: 'viewer_1', role: 'viewer' })])
    });
  });

  it('rejects viewers when adding members', async () => {
    const { service, base } = await createService();
    await service.addMember({ userId: 'owner_1' }, base.id, { userId: 'viewer_1', role: 'viewer' });

    await expect(
      service.addMember({ userId: 'viewer_1' }, base.id, { userId: 'other_1', role: 'viewer' })
    ).rejects.toMatchObject({ code: 'knowledge_permission_denied' });
  });
});
