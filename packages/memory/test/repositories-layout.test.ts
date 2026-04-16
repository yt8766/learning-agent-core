import { describe, expect, it } from 'vitest';

import {
  FileMemoryRepository,
  FileRuntimeStateRepository,
  FileUserProfileRepository,
  MemoryScrubberService,
  DefaultMemorySearchService,
  loadKnowledgeVectorDocuments,
  LocalVectorIndexRepository,
  createHttpEmbeddingProvider
} from '@agent/memory';
import * as memory from '@agent/memory';

describe('memory repositories layout', () => {
  it('co-locates repository implementations under src/repositories', () => {
    expect(FileMemoryRepository).toBe(memory.FileMemoryRepository);
    expect(FileRuntimeStateRepository).toBe(memory.FileRuntimeStateRepository);
    expect(FileUserProfileRepository).toBe(memory.FileUserProfileRepository);
  });

  it('co-locates search, vector, and embeddings implementations under their domain directories', () => {
    expect(DefaultMemorySearchService).toBe(memory.DefaultMemorySearchService);
    expect(MemoryScrubberService).toBe(memory.MemoryScrubberService);
    expect(LocalVectorIndexRepository).toBe(memory.LocalVectorIndexRepository);
    expect(loadKnowledgeVectorDocuments).toBe(memory.loadKnowledgeVectorDocuments);
    expect(createHttpEmbeddingProvider).toBe(memory.createHttpEmbeddingProvider);
  });
});
