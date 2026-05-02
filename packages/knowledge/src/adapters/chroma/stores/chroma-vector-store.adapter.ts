import type { Vector, VectorStore } from '@agent/knowledge';

import { AdapterError } from '../../shared/errors/adapter-error';
import { validateVectorDimensions } from '../../shared/validation/vector-dimensions';
import { mapVectorMetadataToChromaMetadata } from '../shared/chroma-metadata.mapper';
import {
  createChromaClient,
  getOrCreateChromaCollection,
  type ChromaClientLike,
  type ChromaClientOptions,
  type ChromaCollectionLike
} from '../shared/chroma-collection';

export interface ChromaVectorStoreOptions {
  collectionName: string;
  collectionMetadata?: Record<string, unknown>;
  client?: ChromaClientLike;
  clientOptions?: ChromaClientOptions;
}

export class ChromaVectorStoreAdapter implements VectorStore {
  private collectionPromise: Promise<ChromaCollectionLike> | null = null;

  constructor(private readonly options: ChromaVectorStoreOptions) {}

  private getCollection(): Promise<ChromaCollectionLike> {
    if (!this.collectionPromise) {
      this.collectionPromise = this.initCollection().catch(err => {
        this.collectionPromise = null;
        throw err;
      });
    }
    return this.collectionPromise;
  }

  private async initCollection(): Promise<ChromaCollectionLike> {
    const client = this.options.client ?? (await createChromaClient(this.options.clientOptions));
    return getOrCreateChromaCollection(client, this.options.collectionName, this.options.collectionMetadata);
  }

  async upsert(vectors: Vector[]): Promise<void> {
    if (vectors.length === 0) return;

    validateVectorDimensions(vectors, 'ChromaVectorStoreAdapter');

    const collection = await this.getCollection().catch(err => {
      throw new AdapterError('ChromaVectorStoreAdapter', `Failed to get Chroma collection: ${String(err)}`, err);
    });

    await collection.upsert({
      ids: vectors.map(v => v.id),
      embeddings: vectors.map(v => v.values),
      metadatas: vectors.map(v => mapVectorMetadataToChromaMetadata(v.metadata)),
      documents: vectors.map(v => String(v.metadata['content'] ?? v.id))
    });
  }
}
