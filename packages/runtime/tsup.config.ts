import { defineConfig } from 'tsup';

const entry = ['src/index.ts'];

export default defineConfig([
  {
    entry,
    format: ['cjs'],
    outDir: 'build/cjs',
    clean: true,
    treeshake: true
  },
  {
    entry,
    format: ['esm'],
    outDir: 'build/esm',
    clean: true,
    treeshake: true
  }
]);
