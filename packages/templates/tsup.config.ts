import { defineConfig } from 'tsup';

const entry = [
  'src/index.ts',
  'src/template-registry.ts',
  'src/types.ts',
  '!src/**/*.test.ts',
  '!src/**/*.spec.ts',
  '!src/**/*.int-spec.ts',
  '!src/**/*.test.tsx',
  '!src/**/*.spec.tsx',
  '!src/**/*.int-spec.tsx'
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
