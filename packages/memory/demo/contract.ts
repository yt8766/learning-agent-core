import { DefaultMemorySearchService, FileMemoryRepository } from '../src/index.js';
import * as contractRepositoryExports from '../src/contracts/memory-repository.js';
import * as contractSearchExports from '../src/contracts/memory-search-service.js';
import * as repositoryExports from '../src/repositories/index.js';
import * as searchExports from '../src/search/index.js';

console.log(
  JSON.stringify(
    {
      repositoryHostAligned: FileMemoryRepository === repositoryExports.FileMemoryRepository,
      repositoryContractAligned: FileMemoryRepository === contractRepositoryExports.FileMemoryRepository,
      searchHostAligned: DefaultMemorySearchService === searchExports.DefaultMemorySearchService,
      searchContractAligned: DefaultMemorySearchService === contractSearchExports.DefaultMemorySearchService
    },
    null,
    2
  )
);
