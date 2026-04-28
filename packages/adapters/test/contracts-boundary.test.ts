import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const adaptersRoot = resolve(__dirname, '..');
const filesThatOwnKnowledgeIndexingAdapters = [
  'src/chroma/shared/chroma-metadata.mapper.ts',
  'src/chroma/stores/chroma-vector-store.adapter.ts',
  'src/langchain/chunkers/langchain-chunker.adapter.ts',
  'src/langchain/embedders/langchain-embedder.adapter.ts',
  'src/langchain/loaders/langchain-loader.adapter.ts',
  'src/langchain/shared/langchain-chunk.mapper.ts',
  'src/langchain/shared/langchain-document.mapper.ts',
  'src/shared/metadata/merge-metadata.ts',
  'src/shared/metadata/normalize-metadata.ts',
  'demo/chroma-upsert.ts'
];

describe('@agent/adapters knowledge indexing boundary', () => {
  it('consumes knowledge indexing contracts from @agent/knowledge instead of the removed core host', () => {
    for (const relativePath of filesThatOwnKnowledgeIndexingAdapters) {
      const source = readFileSync(resolve(adaptersRoot, relativePath), 'utf8');

      expect(source, relativePath).not.toMatch(/from ['"]@agent\/core['"]/);
    }
  });
});
