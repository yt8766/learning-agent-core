import type { FactoryProvider } from '@nestjs/common';

import { AUTH_REPOSITORY } from '../auth.tokens';
import { InMemoryAuthRepository } from '../repositories/auth-memory.repository';
import { PostgresAuthRepository, type PostgresAuthClient } from '../repositories/auth-postgres.repository';
import type { AuthRepository } from '../repositories/auth.repository';
import { AUTH_SCHEMA_SQL } from './auth-schema.sql';
import { createAuthDatabaseClient } from './auth-database.provider';

export interface AuthRepositoryProviderOptions {
  databaseUrl?: string;
  createClient?: () => PostgresAuthClient;
}

export type AuthRepositoryProvider = FactoryProvider<AuthRepository> & {
  useFactory: () => AuthRepository | Promise<AuthRepository>;
};

export function createAuthRepositoryProvider(options: AuthRepositoryProviderOptions = {}): AuthRepositoryProvider {
  return {
    provide: AUTH_REPOSITORY,
    useFactory: async () => {
      const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;
      if (!databaseUrl) {
        return new InMemoryAuthRepository();
      }

      const client = options.createClient?.() ?? createAuthDatabaseClient({ databaseUrl });
      await client.query(AUTH_SCHEMA_SQL);
      return new PostgresAuthRepository(client);
    }
  };
}
