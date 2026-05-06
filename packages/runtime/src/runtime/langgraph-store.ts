import type { LangGraphStoreConfig } from '@agent/config';
import { InMemoryStore } from '@langchain/langgraph';
import type { BaseStore } from '@langchain/langgraph';
import { PostgresStore } from '@langchain/langgraph-checkpoint-postgres/store';

export interface LangGraphStoreEmbeddingProvider {
  embedQuery(text: string): Promise<number[]>;
  embedDocuments(texts: string[]): Promise<number[][]>;
}

export interface LangGraphStoreHandle {
  provider: LangGraphStoreConfig['provider'];
  store: BaseStore;
  initialize: () => Promise<void>;
  close: () => Promise<void>;
}

export interface CreateLangGraphStoreParams {
  config: LangGraphStoreConfig;
  embeddingProvider?: LangGraphStoreEmbeddingProvider;
  embeddingDimensions?: number;
}

export function createLangGraphStore(params: CreateLangGraphStoreParams): LangGraphStoreHandle {
  const index = buildLangGraphStoreIndex(params);

  if (params.config.provider !== 'postgres') {
    return {
      provider: 'memory',
      store: new InMemoryStore(
        index
          ? ({
              index
            } as ConstructorParameters<typeof InMemoryStore>[0])
          : undefined
      ),
      async initialize() {},
      async close() {}
    };
  }

  const connectionString = params.config.postgres?.connectionString;
  if (!connectionString) {
    throw new Error('LANGGRAPH_STORE_POSTGRES_URI is required when LANGGRAPH_STORE=postgres.');
  }

  const store = PostgresStore.fromConnString(connectionString, {
    schema: params.config.postgres?.schema ?? 'public',
    ...(index
      ? {
          index: {
            dims: index.dims,
            embed: index.embeddings,
            fields: index.fields,
            distanceMetric: params.config.semanticSearch.distanceMetric
          }
        }
      : {})
  });

  return {
    provider: 'postgres',
    store: store as unknown as BaseStore,
    async initialize() {
      if (params.config.postgres?.setupOnInitialize !== false) {
        await store.setup();
      }
    },
    async close() {
      await store.stop();
    }
  };
}

function buildLangGraphStoreIndex(params: CreateLangGraphStoreParams) {
  if (!params.config.semanticSearch.enabled) {
    return undefined;
  }
  if (!params.embeddingProvider || !params.embeddingDimensions || params.embeddingDimensions <= 0) {
    return undefined;
  }

  return {
    dims: params.embeddingDimensions,
    embeddings: params.embeddingProvider,
    fields: params.config.semanticSearch.fields
  };
}
