import { defineConfig } from 'tsup';

const entry = [
  'src/index.ts',
  'src/command/index.ts',
  'src/executors/connectors/connectors-executor.ts',
  'src/executors/filesystem/filesystem-executor.ts',
  'src/executors/runtime-governance/runtime-governance-executor.ts',
  'src/executors/scaffold/scaffold-executor.ts',
  'src/executors/scheduling/scheduling-executor.ts'
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
