import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { AgentOrchestrator } from '../src/orchestration/agent-orchestrator';

describe('runtime main graph host', () => {
  it('exports AgentOrchestrator from the runtime orchestration host', () => {
    expect(AgentOrchestrator).toBeTypeOf('function');
  });

  it('removes main graph compat wrappers once orchestration becomes canonical host', () => {
    expect(existsSync(new URL('../src/graphs/main/main.graph.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../src/graphs/main/main-graph-runtime-modules.ts', import.meta.url))).toBe(false);
  });

  it('organizes the main graph host by contracts, runtime, execution, and tasking domains', () => {
    expect(existsSync(new URL('../src/graphs/main/contracts/main-graph.types.ts', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../src/graphs/main/runtime/lifecycle/main-graph-lifecycle.ts', import.meta.url))).toBe(
      true
    );
    expect(existsSync(new URL('../src/graphs/main/runtime/lifecycle/approval/index.ts', import.meta.url))).toBe(true);
    expect(
      existsSync(
        new URL('../src/graphs/main/runtime/lifecycle/learning/main-graph-lifecycle-learning.ts', import.meta.url)
      )
    ).toBe(true);
    expect(
      existsSync(
        new URL('../src/graphs/main/runtime/lifecycle/state/main-graph-lifecycle-persistence.ts', import.meta.url)
      )
    ).toBe(true);
    expect(
      existsSync(new URL('../src/graphs/main/execution/orchestration/bridge/main-graph-bridge.ts', import.meta.url))
    ).toBe(true);
    expect(
      existsSync(
        new URL(
          '../src/graphs/main/execution/orchestration/pipeline/main-graph-pipeline-orchestrator.ts',
          import.meta.url
        )
      )
    ).toBe(true);
    expect(
      existsSync(
        new URL('../src/graphs/main/execution/orchestration/recovery/main-graph-execution-helpers.ts', import.meta.url)
      )
    ).toBe(true);
    expect(existsSync(new URL('../src/graphs/main/tasking/factory/main-graph-task-factory.ts', import.meta.url))).toBe(
      true
    );
  });
});
