import { Pool } from 'pg';

import type { PostgresKnowledgeClient } from '../repositories/knowledge-postgres.repository';

export interface KnowledgeDatabaseProviderOptions {
  databaseUrl: string;
}

export function createKnowledgeDatabaseClient(options: KnowledgeDatabaseProviderOptions): PostgresKnowledgeClient {
  return new Pool({ connectionString: options.databaseUrl });
}
