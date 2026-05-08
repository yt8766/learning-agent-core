import { describe, expect, it, vi } from 'vitest';

import { AuthSeedService } from '../../src/auth/auth-seed.service';
import { PasswordHasherProvider } from '../../src/auth/password-hasher.provider';
import { InMemoryAuthRepository } from '../../src/auth/repositories/auth-memory.repository';

vi.setConfig({ testTimeout: 20_000 });

describe('AuthSeedService', () => {
  it('creates the configured admin account when it is missing', async () => {
    const repository = new InMemoryAuthRepository();
    const hasher = new PasswordHasherProvider();
    const service = new AuthSeedService(repository, hasher, {
      adminUsername: 'admin',
      adminPassword: 'rust123@',
      adminDisplayName: 'Admin'
    });

    await service.onModuleInit();

    const user = await repository.findUserByUsername('admin');
    expect(user).toMatchObject({
      id: 'user_admin',
      username: 'admin',
      displayName: 'Admin',
      roles: ['admin'],
      status: 'enabled'
    });
    expect(user?.passwordHash).not.toBe('rust123@');
    await expect(hasher.verify('rust123@', user?.passwordHash ?? '')).resolves.toBe(true);
  });

  it('does not overwrite an existing admin account', async () => {
    const repository = new InMemoryAuthRepository();
    const hasher = new PasswordHasherProvider();
    const originalHash = await hasher.hash('custom-password');
    await repository.createUser({
      id: 'user_admin',
      username: 'admin',
      displayName: 'Custom Admin',
      roles: ['admin'],
      status: 'enabled',
      passwordHash: originalHash
    });
    const service = new AuthSeedService(repository, hasher, {
      adminUsername: 'admin',
      adminPassword: 'rust123@',
      adminDisplayName: 'Admin'
    });

    await service.onModuleInit();

    const user = await repository.findUserByUsername('admin');
    expect(user).toMatchObject({
      displayName: 'Custom Admin',
      passwordHash: originalHash
    });
  });

  it('skips seeding when admin password is not configured', async () => {
    const repository = new InMemoryAuthRepository();
    const service = new AuthSeedService(repository, new PasswordHasherProvider(), {
      adminUsername: 'admin',
      adminPassword: '',
      adminDisplayName: 'Admin'
    });

    await service.onModuleInit();

    await expect(repository.findUserByUsername('admin')).resolves.toBeUndefined();
  });
});
