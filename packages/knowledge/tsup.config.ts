import { defineConfig } from 'tsup';

const entry = [
  'src/index.ts',
  'src/core/index.ts',
  'src/client/index.ts',
  'src/browser/index.ts',
  'src/node/index.ts',
  'src/adapters/index.ts',
  'src/adapters/langchain/index.ts',
  'src/adapters/minimax/index.ts',
  'src/adapters/glm/index.ts',
  'src/adapters/deepseek/index.ts',
  'src/adapters/openai-compatible/index.ts'
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
