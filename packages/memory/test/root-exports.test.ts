import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  DefaultMemorySearchService,
  FileMemoryRepository,
  LocalEmbeddingProvider,
  LocalVectorIndexRepository
} from '@agent/memory';

describe('@agent/memory root exports', () => {
  it('re-exports runtime-facing hosts from the canonical domain directories', async () => {
    const repositoryExports = (await import(new URL('../src/repositories/index.ts', import.meta.url).href)) as {
      FileMemoryRepository: unknown;
    };
    const searchExports = (await import(new URL('../src/search/index.ts', import.meta.url).href)) as {
      DefaultMemorySearchService: unknown;
    };
    const vectorExports = (await import(new URL('../src/vector/index.ts', import.meta.url).href)) as {
      LocalVectorIndexRepository: unknown;
    };
    const embeddingExports = (await import(new URL('../src/embeddings/index.ts', import.meta.url).href)) as {
      LocalEmbeddingProvider: unknown;
    };

    expect(FileMemoryRepository).toBe(repositoryExports.FileMemoryRepository);
    expect(DefaultMemorySearchService).toBe(searchExports.DefaultMemorySearchService);
    expect(LocalVectorIndexRepository).toBe(vectorExports.LocalVectorIndexRepository);
    expect(LocalEmbeddingProvider).toBe(embeddingExports.LocalEmbeddingProvider);
  });

  it('keeps contract facades aligned with their canonical hosts', async () => {
    const repositoryExports = (await import(new URL('../src/repositories/index.ts', import.meta.url).href)) as {
      FileMemoryRepository: unknown;
    };
    const searchExports = (await import(new URL('../src/search/index.ts', import.meta.url).href)) as {
      DefaultMemorySearchService: unknown;
    };
    const contractRepositoryExports = (await import(
      new URL('../src/contracts/memory-repository.ts', import.meta.url).href
    )) as {
      FileMemoryRepository: unknown;
    };
    const contractSearchExports = (await import(
      new URL('../src/contracts/memory-search-service.ts', import.meta.url).href
    )) as {
      DefaultMemorySearchService: unknown;
    };

    expect(contractRepositoryExports.FileMemoryRepository).toBe(repositoryExports.FileMemoryRepository);
    expect(contractSearchExports.DefaultMemorySearchService).toBe(searchExports.DefaultMemorySearchService);
  });

  it('retains the contract facade files as stable contract-first entrypoints', () => {
    expect(existsSync(new URL('../src/contracts/memory-repository.ts', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../src/contracts/memory-search-service.ts', import.meta.url))).toBe(true);
  });
});
