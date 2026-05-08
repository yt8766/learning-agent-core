import type { FactoryProvider } from '@nestjs/common';

import { KNOWLEDGE_REPOSITORY } from '../knowledge.tokens';
import { InMemoryKnowledgeRepository } from '../repositories/knowledge-memory.repository';
import {
  PostgresKnowledgeRepository,
  type PostgresKnowledgeClient
} from '../repositories/knowledge-postgres.repository';
import type { KnowledgeRepository } from '../repositories/knowledge.repository';
import { createKnowledgeDatabaseClient } from './knowledge-database.provider';
import { KNOWLEDGE_SCHEMA_SQL } from './knowledge-schema.sql';

export interface KnowledgeRepositoryProviderOptions {
  databaseUrl?: string;
  createClient?: () => PostgresKnowledgeClient;
}

export type KnowledgeRepositoryProvider = FactoryProvider<KnowledgeRepository> & {
  useFactory: () => KnowledgeRepository | Promise<KnowledgeRepository>;
};

export function createKnowledgeRepositoryProvider(
  options: KnowledgeRepositoryProviderOptions = {}
): KnowledgeRepositoryProvider {
  return {
    provide: KNOWLEDGE_REPOSITORY,
    useFactory: async () => {
      const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;
      if (!databaseUrl) {
        return new InMemoryKnowledgeRepository();
      }

      const client = options.createClient?.() ?? createKnowledgeDatabaseClient({ databaseUrl });
      await client.query(KNOWLEDGE_SCHEMA_SQL);
      return new PostgresKnowledgeRepository(client);
    }
  };
}
