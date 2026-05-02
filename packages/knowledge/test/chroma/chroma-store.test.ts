import { describe, it, expect, vi } from 'vitest';

import { ChromaVectorStoreAdapter } from '../../src/adapters/chroma/stores/chroma-vector-store.adapter';
import { mapVectorMetadataToChromaMetadata } from '../../src/adapters/chroma/shared/chroma-metadata.mapper';
import { AdapterError } from '../../src/adapters/shared/errors/adapter-error';
import type { ChromaClientLike, ChromaCollectionLike } from '../../src/adapters/chroma/shared/chroma-collection';

function makeCollection(): { mock: ChromaCollectionLike; upsert: ReturnType<typeof vi.fn> } {
  const upsert = vi.fn().mockResolvedValue(undefined);
  return { mock: { upsert } as ChromaCollectionLike, upsert };
}

function makeClient(collection: ChromaCollectionLike): ChromaClientLike {
  return { getOrCreateCollection: vi.fn().mockResolvedValue(collection) };
}

const baseVectors = [
  { id: 'v1', values: [0.1, 0.2, 0.3], metadata: { content: 'hello', source: 'file.md' } },
  { id: 'v2', values: [0.4, 0.5, 0.6], metadata: { content: 'world', source: 'file.md' } }
];

describe('ChromaVectorStoreAdapter', () => {
  it('should skip upsert for empty vectors', async () => {
    const { mock, upsert } = makeCollection();
    const adapter = new ChromaVectorStoreAdapter({ collectionName: 'test', client: makeClient(mock) });
    await adapter.upsert([]);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('should call collection.upsert with correct ids and embeddings', async () => {
    const { mock, upsert } = makeCollection();
    const adapter = new ChromaVectorStoreAdapter({ collectionName: 'test', client: makeClient(mock) });
    await adapter.upsert(baseVectors);
    expect(upsert).toHaveBeenCalledOnce();
    const args = upsert.mock.calls[0]![0];
    expect(args.ids).toEqual(['v1', 'v2']);
    expect(args.embeddings[0]).toEqual([0.1, 0.2, 0.3]);
  });

  it('should throw AdapterError for mismatched dimensions', async () => {
    const { mock } = makeCollection();
    const adapter = new ChromaVectorStoreAdapter({ collectionName: 'test', client: makeClient(mock) });
    const bad = [
      { id: 'v1', values: [0.1, 0.2], metadata: {} },
      { id: 'v2', values: [0.3], metadata: {} }
    ];
    await expect(adapter.upsert(bad)).rejects.toThrow(AdapterError);
  });
});

describe('mapVectorMetadataToChromaMetadata', () => {
  it('should pass through string/number/boolean', () => {
    const result = mapVectorMetadataToChromaMetadata({ a: 'x', b: 1, c: true });
    expect(result).toEqual({ a: 'x', b: 1, c: true });
  });

  it('should JSON.stringify nested objects', () => {
    const result = mapVectorMetadataToChromaMetadata({ nested: { x: 1 } });
    expect(typeof result['nested']).toBe('string');
  });

  it('should skip null values', () => {
    const result = mapVectorMetadataToChromaMetadata({ n: null });
    expect(result).not.toHaveProperty('n');
  });
});
