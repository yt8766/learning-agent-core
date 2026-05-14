import { createRequire } from 'node:module';

import type { BaseStore } from '@langchain/langgraph';

interface PostgresStoreInstance extends BaseStore {
  setup(): Promise<void>;
  stop(): Promise<void>;
}

interface PostgresStoreModule {
  PostgresStore: {
    fromConnString(
      connectionString: string,
      options?: {
        schema?: string;
        index?: unknown;
        [key: string]: unknown;
      }
    ): PostgresStoreInstance;
  };
}

export function loadPostgresStoreModule(): PostgresStoreModule {
  const require = createRequire(__filename);
  return require('@langchain/langgraph-checkpoint-postgres/store') as PostgresStoreModule;
}
