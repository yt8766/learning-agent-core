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
});
