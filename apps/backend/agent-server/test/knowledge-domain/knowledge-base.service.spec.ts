import { describe, expect, it } from 'vitest';

import { KnowledgeMemoryRepository } from '../../src/domains/knowledge/repositories/knowledge-memory.repository';
import { KnowledgeBaseService } from '../../src/domains/knowledge/services/knowledge-base.service';
import { KnowledgeServiceError } from '../../src/domains/knowledge/services/knowledge-service.error';

describe('KnowledgeBaseService', () => {
  it('creates and lists bases for the current identity actor', async () => {
    const service = new KnowledgeBaseService(new KnowledgeMemoryRepository());

    const base = await service.createBase({ userId: 'user_1' }, { name: 'Docs' });
    const list = await service.listBasesResponse({ userId: 'user_1' });

    expect(list.bases).toContainEqual(base);
  });

  it('allows owners to manage members and rejects non-members', async () => {
    const service = new KnowledgeBaseService(new KnowledgeMemoryRepository());
    const base = await service.createBase({ userId: 'owner_1' }, { name: 'Docs' });

    await expect(
      service.addMember({ userId: 'owner_1' }, base.id, { userId: 'viewer_1', role: 'viewer' })
    ).resolves.toMatchObject({ userId: 'viewer_1', role: 'viewer' });
    await expect(service.listMembers({ userId: 'viewer_1' }, base.id)).resolves.toMatchObject({
      members: expect.arrayContaining([expect.objectContaining({ userId: 'viewer_1' })])
    });
    await expect(service.listMembers({ userId: 'stranger_1' }, base.id)).rejects.toThrow(KnowledgeServiceError);
  });
});
