export type ChromaClientOptions = {
  path?: string;
  ssl?: boolean;
  host?: string;
  port?: number;
  fetchOptions?: RequestInit;
};

export type ChromaClientLike = {
  getOrCreateCollection(params: {
    name: string;
    metadata?: Record<string, unknown>;
    embeddingFunction?: null;
  }): Promise<ChromaCollectionLike>;
};

export type ChromaCollectionLike = {
  upsert(params: {
    ids: string[];
    embeddings: number[][];
    metadatas?: Record<string, string | number | boolean>[];
    documents?: string[];
  }): Promise<void>;
};

export async function createChromaClient(options?: ChromaClientOptions): Promise<ChromaClientLike> {
  const { ChromaClient } = await import('chromadb');
  const { path, ...rest } = options ?? {};
  return new ChromaClient(path ? { path, ...rest } : rest) as unknown as ChromaClientLike;
}

export async function getOrCreateChromaCollection(
  client: ChromaClientLike,
  collectionName: string,
  metadata?: Record<string, unknown>
): Promise<ChromaCollectionLike> {
  return client.getOrCreateCollection({ name: collectionName, metadata, embeddingFunction: null });
}
