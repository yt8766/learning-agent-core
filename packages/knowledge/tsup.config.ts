import { defineConfig } from 'tsup';

const entry = ['src/index.ts', 'src/core/index.ts'];

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
