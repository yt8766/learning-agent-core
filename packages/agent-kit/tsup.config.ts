import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs'],
    outDir: 'build/cjs',
    treeshake: true
  },
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    outDir: 'build/esm',
    treeshake: true
  }
]);
