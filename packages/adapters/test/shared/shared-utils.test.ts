import { describe, it, expect } from 'vitest';

import { normalizeMetadata, mergeMetadata } from '../../src/shared/metadata/normalize-metadata';
import { mergeMetadata as mergeMetadataFn } from '../../src/shared/metadata/merge-metadata';
import { stableId, documentId, chunkId } from '../../src/shared/ids/stable-id';
import { AdapterError } from '../../src/shared/errors/adapter-error';
import { validateVectorDimensions } from '../../src/shared/validation/vector-dimensions';

describe('normalizeMetadata', () => {
  it('should convert Date to ISO string', () => {
    const date = new Date('2024-01-01T00:00:00.000Z');
    expect(normalizeMetadata({ updatedAt: date })).toEqual({ updatedAt: '2024-01-01T00:00:00.000Z' });
  });

  it('should convert URL to string', () => {
    expect(normalizeMetadata({ url: new URL('https://example.com') })).toEqual({ url: 'https://example.com/' });
  });

  it('should convert bigint to string', () => {
    expect(normalizeMetadata({ size: BigInt('9007199254740993') })).toEqual({ size: '9007199254740993' });
  });

  it('should remove undefined and function values', () => {
    const result = normalizeMetadata({ a: undefined, b: () => {}, c: Symbol(), d: 'keep' });
    expect(result).toEqual({ d: 'keep' });
  });

  it('should keep null, string, number, boolean as-is', () => {
    expect(normalizeMetadata({ a: null, b: 'str', c: 42, d: true })).toEqual({ a: null, b: 'str', c: 42, d: true });
  });

  it('should recursively normalize nested objects', () => {
    const date = new Date('2024-01-01T00:00:00.000Z');
    expect(normalizeMetadata({ nested: { date } })).toEqual({ nested: { date: '2024-01-01T00:00:00.000Z' } });
  });
});

describe('mergeMetadata', () => {
  it('should merge multiple sources', () => {
    expect(mergeMetadataFn({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it('should handle null/undefined sources gracefully', () => {
    expect(mergeMetadataFn(null, undefined, { c: 3 })).toEqual({ c: 3 });
  });

  it('should let later sources override earlier ones', () => {
    expect(mergeMetadataFn({ x: 1 }, { x: 2 })).toEqual({ x: 2 });
  });
});

describe('stableId', () => {
  it('should produce same id for same input', () => {
    expect(stableId('a', 'b')).toBe(stableId('a', 'b'));
  });

  it('should produce different ids for different input', () => {
    expect(stableId('a', 'b')).not.toBe(stableId('b', 'a'));
  });

  it('documentId should be deterministic', () => {
    expect(documentId('/path/to/file.md')).toBe(documentId('/path/to/file.md'));
  });

  it('chunkId should incorporate index', () => {
    expect(chunkId('doc1', 0)).not.toBe(chunkId('doc1', 1));
  });
});

describe('AdapterError', () => {
  it('should have correct name and adapter name', () => {
    const err = new AdapterError('TestAdapter', 'something failed', new Error('root'));
    expect(err.name).toBe('AdapterError');
    expect(err.adapterName).toBe('TestAdapter');
    expect(err.message).toBe('something failed');
    expect(err.cause).toBeInstanceOf(Error);
  });
});

describe('validateVectorDimensions', () => {
  it('should pass for empty array', () => {
    expect(() => validateVectorDimensions([], 'test')).not.toThrow();
  });

  it('should pass for consistent dimensions', () => {
    const vectors = [
      { id: 'v1', values: [0.1, 0.2, 0.3] },
      { id: 'v2', values: [0.4, 0.5, 0.6] }
    ];
    expect(() => validateVectorDimensions(vectors, 'test')).not.toThrow();
  });

  it('should throw for mismatched dimensions', () => {
    const vectors = [
      { id: 'v1', values: [0.1, 0.2, 0.3] },
      { id: 'v2', values: [0.4, 0.5] }
    ];
    expect(() => validateVectorDimensions(vectors, 'test')).toThrow(AdapterError);
  });

  it('should throw for non-finite values', () => {
    const vectors = [{ id: 'v1', values: [0.1, Infinity, 0.3] }];
    expect(() => validateVectorDimensions(vectors, 'test')).toThrow(AdapterError);
  });
});
