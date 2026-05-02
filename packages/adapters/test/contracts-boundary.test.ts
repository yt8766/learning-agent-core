import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const adaptersRoot = resolve(__dirname, '..');
const migratedKnowledgeAdapterDirs = ['src/chroma', 'src/langchain', 'src/opensearch', 'src/supabase'];

describe('@agent/adapters knowledge indexing boundary', () => {
  it('does not retain migrated knowledge adapter directories in @agent/adapters', () => {
    for (const relativePath of migratedKnowledgeAdapterDirs) {
      expect(existsSync(resolve(adaptersRoot, relativePath)), relativePath).toBe(false);
    }
  });
});
