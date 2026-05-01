import { describe, expect, it } from 'vitest';

import type { KnowledgeChunk } from '../src/contracts';
import { InMemoryKnowledgeChunkRepository } from '../src/repositories/knowledge-chunk.repository';

describe('InMemoryKnowledgeChunkRepository', () => {
  it('returns existing chunks by ids in input order and skips missing ids', async () => {
    const c1 = createChunk('c1');
    const c2 = createChunk('c2');
    const repository = new InMemoryKnowledgeChunkRepository([c1, c2]);

    await expect(repository.getByIds(['c2', 'missing', 'c1'])).resolves.toEqual([c2, c1]);
  });
});

function createChunk(id: string): KnowledgeChunk {
  return {
    id,
    sourceId: 'source-1',
    documentId: 'doc-1',
    chunkIndex: id === 'c1' ? 0 : 1,
    content: `content ${id}`,
    searchable: true,
    updatedAt: '2026-04-30T00:00:00.000Z'
  };
}
