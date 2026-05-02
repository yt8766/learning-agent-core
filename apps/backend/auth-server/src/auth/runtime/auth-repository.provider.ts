import type { FactoryProvider } from '@nestjs/common';

import { AUTH_REPOSITORY } from '../auth.tokens';
import { InMemoryAuthRepository } from '../repositories/auth-memory.repository';
import { PostgresAuthRepository, type PostgresAuthClient } from '../repositories/auth-postgres.repository';
import type { AuthRepository } from '../repositories/auth.repository';
import { createAuthDatabaseClient } from './auth-database.provider';

export interface AuthRepositoryProviderOptions {
  databaseUrl?: string;
  createClient?: () => PostgresAuthClient;
}

export type AuthRepositoryProvider = FactoryProvider<AuthRepository> & {
  useFactory: () => AuthRepository;
};

export function createAuthRepositoryProvider(options: AuthRepositoryProviderOptions): AuthRepositoryProvider {
  return {
    provide: AUTH_REPOSITORY,
    useFactory: () => {
      if (!options.databaseUrl) {
        return new InMemoryAuthRepository();
      }

      return new PostgresAuthRepository(
        options.createClient?.() ?? createAuthDatabaseClient({ databaseUrl: options.databaseUrl })
      );
    }
  };
}
