import type { LangGraphCheckpointerConfig } from '@agent/config';
import { MemorySaver } from '@langchain/langgraph';
import type { BaseCheckpointSaver } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';

export interface LangGraphCheckpointerHandle {
  provider: LangGraphCheckpointerConfig['provider'];
  checkpointer: BaseCheckpointSaver;
  initialize: () => Promise<void>;
  close: () => Promise<void>;
}

export function createLangGraphCheckpointer(config: LangGraphCheckpointerConfig): LangGraphCheckpointerHandle {
  if (config.provider !== 'postgres') {
    return {
      provider: 'memory',
      checkpointer: new MemorySaver(),
      async initialize() {},
      async close() {}
    };
  }

  const connectionString = config.postgres?.connectionString;
  if (!connectionString) {
    throw new Error('LANGGRAPH_POSTGRES_URI is required when LANGGRAPH_CHECKPOINTER=postgres.');
  }

  const checkpointer = PostgresSaver.fromConnString(connectionString, {
    schema: config.postgres?.schema ?? 'public'
  });

  return {
    provider: 'postgres',
    checkpointer,
    async initialize() {
      if (config.postgres?.setupOnInitialize !== false) {
        await checkpointer.setup();
      }
    },
    async close() {
      await checkpointer.end();
    }
  };
}
