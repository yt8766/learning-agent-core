import { describe, expect, it } from 'vitest';

import { InMemoryAuthRepository } from '../../src/auth/repositories/auth-memory.repository';
import { PostgresAuthRepository } from '../../src/auth/repositories/auth-postgres.repository';
import { AUTH_SCHEMA_SQL } from '../../src/auth/runtime/auth-schema.sql';
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

  it('initializes postgres schema before exposing the repository', async () => {
    const queries: string[] = [];
    const provider = createAuthRepositoryProvider({
      databaseUrl: 'postgres://user:pass@localhost:5432/auth',
      createClient: () => ({
        query: async (sql: string) => {
          queries.push(sql);
          return { rows: [] };
        }
      })
    });

    await provider.useFactory();

    expect(queries).toEqual([AUTH_SCHEMA_SQL]);
  });
});
