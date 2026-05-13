import { describe, expect, it, vi } from 'vitest';

import { IdentityUserService } from '../../src/domains/identity/services/identity-user.service';
import type { IdentityRepository } from '../../src/domains/identity/repositories/identity.repository';

describe('IdentityUserService', () => {
  const createService = () => {
    const repository: Partial<IdentityRepository> = {
      listUsers: vi.fn().mockResolvedValue([
        { id: 'u-1', username: 'alice', displayName: 'Alice', roles: ['admin'], status: 'enabled', passwordHash: 'h1' },
        { id: 'u-2', username: 'bob', displayName: 'Bob', roles: ['viewer'], status: 'disabled', passwordHash: 'h2' }
      ]),
      createUser: vi.fn().mockImplementation(async input => input),
      updateUserStatus: vi.fn().mockImplementation(async (userId, status) => ({
        id: userId,
        username: 'alice',
        displayName: 'Alice',
        roles: ['admin'],
        status,
        passwordHash: 'h1'
      }))
    };
    const password = {
      hash: vi.fn().mockResolvedValue('hashed-password')
    };
    const service = new IdentityUserService(repository as IdentityRepository, password as never);
    return { service, repository, password };
  };

  it('listUsers returns mapped accounts', async () => {
    const { service } = createService();

    const result = await service.listUsers();

    expect(result.users).toHaveLength(2);
    expect(result.users[0]).toEqual({
      id: 'u-1',
      username: 'alice',
      displayName: 'Alice',
      roles: ['admin'],
      status: 'enabled'
    });
    expect(result.users[1]).toEqual({
      id: 'u-2',
      username: 'bob',
      displayName: 'Bob',
      roles: ['viewer'],
      status: 'disabled'
    });
  });

  it('createUser hashes password and creates user', async () => {
    const { service, repository, password } = createService();

    const result = await service.createUser({
      username: 'charlie',
      displayName: 'Charlie',
      roles: ['developer'],
      password: 'raw-password'
    });

    expect(password.hash).toHaveBeenCalledWith('raw-password');
    expect(repository.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'charlie',
        displayName: 'Charlie',
        roles: ['developer'],
        status: 'enabled',
        passwordHash: 'hashed-password'
      })
    );
    expect(result.username).toBe('charlie');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('disableUser updates status to disabled', async () => {
    const { service, repository } = createService();

    const result = await service.disableUser('u-1');

    expect(repository.updateUserStatus).toHaveBeenCalledWith('u-1', 'disabled');
    expect(result.status).toBe('disabled');
  });

  it('enableUser updates status to enabled', async () => {
    const { service, repository } = createService();

    const result = await service.enableUser('u-1');

    expect(repository.updateUserStatus).toHaveBeenCalledWith('u-1', 'enabled');
    expect(result.status).toBe('enabled');
  });
});
