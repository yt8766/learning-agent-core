import { describe, expect, it, vi } from 'vitest';

import {
  createIdentityRepositoryProvider,
  IdentityRepositoryConfigError
} from '../../src/domains/identity/runtime/identity-repository.provider';
import { IdentityMemoryRepository } from '../../src/domains/identity/repositories/identity-memory.repository';
import { IdentityPostgresRepository } from '../../src/domains/identity/repositories/identity-postgres.repository';

describe('createIdentityRepositoryProvider', () => {
  it('defaults to the memory repository', async () => {
    const provider = createIdentityRepositoryProvider({ backend: undefined });

    await expect(provider.useFactory()).resolves.toBeInstanceOf(IdentityMemoryRepository);
  });

  it('requires a database url for postgres identity persistence', async () => {
    const provider = createIdentityRepositoryProvider({ backend: 'postgres' });

    await expect(provider.useFactory()).rejects.toThrow(IdentityRepositoryConfigError);
  });

  it('initializes identity schema before returning the postgres repository', async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    const provider = createIdentityRepositoryProvider({
      backend: 'postgres',
      databaseUrl: 'postgres://identity',
      createClient: () => client
    });

    await expect(provider.useFactory()).resolves.toBeInstanceOf(IdentityPostgresRepository);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('identity_users'));
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('identity_refresh_tokens'));
  });
});
