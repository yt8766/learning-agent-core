declare module '@langchain/langgraph-checkpoint-postgres/store' {
  import type { BaseStore } from '@langchain/langgraph';

  export class PostgresStore extends BaseStore {
    static fromConnString(
      connectionString: string,
      options?: {
        schema?: string;
        index?: unknown;
        [key: string]: unknown;
      }
    ): PostgresStore;

    setup(): Promise<void>;
    stop(): Promise<void>;
  }
}
