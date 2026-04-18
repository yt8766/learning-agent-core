import { describe, expect, it } from 'vitest';

import { BaseAgent, createAgentGraph, createApprovalRecoveryGraph, createLearningGraph, LearningFlow } from '../src';
import { BaseAgent as BaseAgentSubpath } from '../src/agents/base-agent';
import { StreamingExecutionCoordinator } from '../src/runtime/streaming-execution';

describe('@agent/runtime', () => {
  it('exports stable runtime mainline entrypoints', () => {
    expect(BaseAgent).toBeTypeOf('function');
    expect(createAgentGraph).toBeTypeOf('function');
    expect(createApprovalRecoveryGraph).toBeTypeOf('function');
    expect(createLearningGraph).toBeTypeOf('function');
    expect(LearningFlow).toBeTypeOf('function');
  });

  it('keeps cycle-safe subpath entrypoints available for agent packages', () => {
    expect(BaseAgentSubpath).toBe(BaseAgent);
    expect(StreamingExecutionCoordinator).toBeTypeOf('function');
  });
});
