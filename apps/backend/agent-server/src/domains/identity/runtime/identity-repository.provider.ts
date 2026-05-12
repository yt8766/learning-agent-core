import type { FactoryProvider } from '@nestjs/common';
import { Pool } from 'pg';

import { IDENTITY_SCHEMA_SQL } from '../../../infrastructure/database/schemas/identity-schema.sql';
import { IDENTITY_REPOSITORY, type IdentityRepository } from '../repositories/identity.repository';
import { IdentityMemoryRepository } from '../repositories/identity-memory.repository';
import { IdentityPostgresRepository, type PostgresIdentityClient } from '../repositories/identity-postgres.repository';

export type IdentityRepositoryBackend = 'memory' | 'postgres';

export interface IdentityRepositoryProviderOptions {
  backend?: IdentityRepositoryBackend;
  databaseUrl?: string;
  createClient?: () => PostgresIdentityClient;
}

export class IdentityRepositoryConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdentityRepositoryConfigError';
  }
}

export type IdentityRepositoryProvider = FactoryProvider<IdentityRepository> & {
  useFactory: () => Promise<IdentityRepository>;
};

export function createIdentityRepositoryProvider(
  options: IdentityRepositoryProviderOptions = {}
): IdentityRepositoryProvider {
  return {
    provide: IDENTITY_REPOSITORY,
    useFactory: async () => {
      const backend = resolveIdentityRepositoryBackend(options.backend);
      if (backend === 'memory') {
        return new IdentityMemoryRepository();
      }

      const databaseUrl = options.databaseUrl ?? readEnv('IDENTITY_DATABASE_URL') ?? readEnv('DATABASE_URL');
      if (!databaseUrl) {
        throw new IdentityRepositoryConfigError(
          'IDENTITY_REPOSITORY=postgres requires IDENTITY_DATABASE_URL or DATABASE_URL'
        );
      }

      const client = options.createClient?.() ?? new Pool({ connectionString: databaseUrl });
      await client.query(IDENTITY_SCHEMA_SQL);
      return new IdentityPostgresRepository(client);
    }
  };
}

function resolveIdentityRepositoryBackend(configured?: IdentityRepositoryBackend): IdentityRepositoryBackend {
  if (configured) {
    return configured;
  }

  const value = readEnv('IDENTITY_REPOSITORY');
  if (!value || value === 'memory') {
    return 'memory';
  }
  if (value === 'postgres') {
    return 'postgres';
  }

  throw new IdentityRepositoryConfigError(`Unsupported IDENTITY_REPOSITORY backend: ${value}`);
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}
