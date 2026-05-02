import { describe, expect, it } from 'vitest';

import { InMemoryAuthRepository } from '../../src/auth/repositories/auth-memory.repository';
import { PostgresAuthRepository } from '../../src/auth/repositories/auth-postgres.repository';
import { createAuthRepositoryProvider } from '../../src/auth/runtime/auth-repository.provider';

describe('createAuthRepositoryProvider', () => {
  it('uses memory when DATABASE_URL is absent', async () => {
    const provider = createAuthRepositoryProvider({ databaseUrl: undefined });
    const repository = await provider.useFactory();

    expect(repository).toBeInstanceOf(InMemoryAuthRepository);
  });

  it('uses postgres when DATABASE_URL is configured', async () => {
    const provider = createAuthRepositoryProvider({
      databaseUrl: 'postgres://user:pass@localhost:5432/auth',
      createClient: () => ({ query: async () => ({ rows: [] }) })
    });
    const repository = await provider.useFactory();

    expect(repository).toBeInstanceOf(PostgresAuthRepository);
  });
});
