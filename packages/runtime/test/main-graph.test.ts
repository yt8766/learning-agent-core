import { describe, expect, it } from 'vitest';

import { AgentOrchestrator } from '../src/graphs/main/main.graph';

describe('runtime main graph host', () => {
  it('exports AgentOrchestrator from the runtime main-graph host', () => {
    expect(AgentOrchestrator).toBeTypeOf('function');
  });
});
