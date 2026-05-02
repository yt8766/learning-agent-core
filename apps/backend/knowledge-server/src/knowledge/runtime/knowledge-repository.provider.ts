import type { FactoryProvider } from '@nestjs/common';

import { KNOWLEDGE_REPOSITORY } from '../knowledge.tokens';
import { InMemoryKnowledgeRepository } from '../repositories/knowledge-memory.repository';
import {
  PostgresKnowledgeRepository,
  type PostgresKnowledgeClient
} from '../repositories/knowledge-postgres.repository';
import type { KnowledgeRepository } from '../repositories/knowledge.repository';
import { createKnowledgeDatabaseClient } from './knowledge-database.provider';

export interface KnowledgeRepositoryProviderOptions {
  databaseUrl?: string;
  createClient?: () => PostgresKnowledgeClient;
}

export type KnowledgeRepositoryProvider = FactoryProvider<KnowledgeRepository> & {
  useFactory: () => KnowledgeRepository;
};

export function createKnowledgeRepositoryProvider(
  options: KnowledgeRepositoryProviderOptions
): KnowledgeRepositoryProvider {
  return {
    provide: KNOWLEDGE_REPOSITORY,
    useFactory: () => {
      if (!options.databaseUrl) {
        return new InMemoryKnowledgeRepository();
      }

      return new PostgresKnowledgeRepository(
        options.createClient?.() ?? createKnowledgeDatabaseClient({ databaseUrl: options.databaseUrl })
      );
    }
  };
}
