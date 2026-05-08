import type { FactoryProvider } from '@nestjs/common';

import { KNOWLEDGE_REPOSITORY } from '../knowledge-domain.tokens';
import { KnowledgeMemoryRepository } from '../repositories/knowledge-memory.repository';
import {
  PostgresKnowledgeRepository,
  type PostgresKnowledgeClient
} from '../repositories/knowledge-postgres.repository';
import type { KnowledgeRepository } from '../repositories/knowledge.repository';
import { createKnowledgeDatabaseClient } from './knowledge-database.provider';
import { KNOWLEDGE_SCHEMA_SQL } from './knowledge-schema.sql';

export type KnowledgeRepositoryBackend = 'memory' | 'postgres';

export interface KnowledgeRepositoryProviderOptions {
  backend?: KnowledgeRepositoryBackend;
  databaseUrl?: string;
  createClient?: () => PostgresKnowledgeClient;
}

export class KnowledgeRepositoryConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KnowledgeRepositoryConfigError';
  }
}

export type KnowledgeRepositoryProvider = FactoryProvider<KnowledgeRepository> & {
  useFactory: () => Promise<KnowledgeRepository>;
};

export function createKnowledgeRepositoryProvider(
  options: KnowledgeRepositoryProviderOptions = {}
): KnowledgeRepositoryProvider {
  return {
    provide: KNOWLEDGE_REPOSITORY,
    useFactory: async () => {
      const backend = resolveRepositoryBackend(options.backend);
      if (backend === 'memory') {
        return new KnowledgeMemoryRepository();
      }

      const databaseUrl = options.databaseUrl ?? readEnv('DATABASE_URL');
      if (!databaseUrl) {
        throw new KnowledgeRepositoryConfigError('KNOWLEDGE_REPOSITORY=postgres requires DATABASE_URL');
      }

      const client = options.createClient?.() ?? createKnowledgeDatabaseClient({ databaseUrl });
      await client.query(KNOWLEDGE_SCHEMA_SQL);
      return new PostgresKnowledgeRepository(client);
    }
  };
}

function resolveRepositoryBackend(configured?: KnowledgeRepositoryBackend): KnowledgeRepositoryBackend {
  if (configured) {
    return configured;
  }

  const value = readEnv('KNOWLEDGE_REPOSITORY');
  if (!value || value === 'memory') {
    return 'memory';
  }
  if (value === 'postgres') {
    return 'postgres';
  }

  throw new KnowledgeRepositoryConfigError(`Unsupported KNOWLEDGE_REPOSITORY backend: ${value}`);
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}
