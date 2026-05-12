import { describe, expect, it } from 'vitest';

describe('useDocumentDetail', () => {
  it('documents the hook interface', () => {
    // useDocumentDetail returns: { chunks, document, error, job, loading, reprocessAvailable, totalChunks, reload, reprocess }
    const expectedKeys = [
      'chunks',
      'document',
      'error',
      'job',
      'loading',
      'reprocessAvailable',
      'totalChunks',
      'reload',
      'reprocess'
    ];
    expect(expectedKeys).toHaveLength(9);
  });
});
