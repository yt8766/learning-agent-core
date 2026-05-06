import { describe, expect, it, vi } from 'vitest';

import { PasswordHasherProvider } from '../../src/auth/password-hasher.provider';
import { InMemoryAuthRepository } from '../../src/auth/repositories/auth-memory.repository';
import { UserManagementService } from '../../src/auth/user-management.service';

vi.setConfig({ testTimeout: 20_000 });

describe('UserManagementService', () => {
  async function createService() {
    const repository = new InMemoryAuthRepository();
    const hasher = new PasswordHasherProvider();
    const service = new UserManagementService(repository, hasher);

    await repository.createUser({
      id: 'user_admin',
      username: 'admin',
      displayName: 'Admin',
      roles: ['admin'],
      status: 'enabled',
      passwordHash: await hasher.hash('admin-password')
    });

    return { service };
  }

  it('creates and lists users', async () => {
    const { service } = await createService();

    const created = await service.createUser({
      username: 'knowledge',
      displayName: 'Knowledge User',
      password: 'knowledge-password',
      roles: ['knowledge_user']
    });

    expect(created.username).toBe('knowledge');
    await expect(service.listUsers()).resolves.toMatchObject({
      users: expect.arrayContaining([expect.objectContaining({ username: 'knowledge' })])
    });
  });

  it('disables and enables users', async () => {
    const { service } = await createService();

    await service.disableUser('user_admin');
    await expect(service.listUsers()).resolves.toMatchObject({
      users: [expect.objectContaining({ status: 'disabled' })]
    });

    await service.enableUser('user_admin');
    await expect(service.listUsers()).resolves.toMatchObject({
      users: [expect.objectContaining({ status: 'enabled' })]
    });
  });
});
