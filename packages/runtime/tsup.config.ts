import { defineConfig } from 'tsup';

const entry = [
  'src/index.ts',
  'src/agents/index.ts',
  'src/agents/agent-registry.ts',
  'src/agents/base-agent.ts',
  'src/agents/planner-strategy.ts',
  'src/governance/approval/index.ts',
  'src/governance/runtime-governance/index.ts',
  'src/memory/index.ts',
  'src/media/index.ts',
  'src/runtime/agent-runtime-context.ts',
  'src/runtime/streaming-execution.ts',
  'src/sandbox/index.ts',
  'src/sandbox/sandbox-executor-utils.ts',
  'src/watchdog/index.ts'
];

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
