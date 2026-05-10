import { defineConfig } from 'tsup';

const entry = [
  'src/index.ts',
  'src/adapters/index.ts',
  'src/adapters/chroma/index.ts',
  'src/adapters/deepseek/index.ts',
  'src/adapters/glm/index.ts',
  'src/adapters/langchain/index.ts',
  'src/adapters/minimax/index.ts',
  'src/adapters/openai-compatible/index.ts',
  'src/adapters/opensearch/index.ts',
  'src/adapters/supabase/index.ts',
  'src/browser/index.ts',
  'src/client/index.ts',
  'src/contracts/index.ts',
  'src/core/index.ts',
  'src/indexing/index.ts',
  'src/node/index.ts'
];

export default defineConfig([
  {
    entry,
    format: ['cjs'],
    outDir: 'build/cjs',
    treeshake: true
  },
  {
    entry,
    format: ['esm'],
    outDir: 'build/esm',
    treeshake: true
  }
]);
