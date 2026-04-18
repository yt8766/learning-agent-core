import { defineConfig } from 'tsup';

const entry = [
  'src/index.ts',
  'src/agents/base-agent.ts',
  'src/runtime/agent-runtime-context.ts',
  'src/runtime/streaming-execution.ts'
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
