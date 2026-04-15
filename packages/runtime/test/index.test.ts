import { describe, expect, it } from 'vitest';

import { BaseAgent, createAgentGraph, createApprovalRecoveryGraph, createLearningGraph, LearningFlow } from '../src';

describe('@agent/runtime', () => {
  it('exports stable runtime mainline entrypoints', () => {
    expect(BaseAgent).toBeTypeOf('function');
    expect(createAgentGraph).toBeTypeOf('function');
    expect(createApprovalRecoveryGraph).toBeTypeOf('function');
    expect(createLearningGraph).toBeTypeOf('function');
    expect(LearningFlow).toBeTypeOf('function');
  });
});
