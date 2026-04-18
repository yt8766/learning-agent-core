import { describe, expect, it } from 'vitest';

import {
  BaseAgent,
  StreamingExecutionCoordinator,
  archivalMemorySearchByParams,
  buildFreshnessAnswerInstruction,
  buildRuntimeMemorySearchRequest
} from '../src';

describe('@agent/agent-kit', () => {
  it('exports the shared agent foundations needed by runtime and specialist packages', () => {
    expect(BaseAgent).toBeTypeOf('function');
    expect(StreamingExecutionCoordinator).toBeTypeOf('function');
    expect(archivalMemorySearchByParams).toBeTypeOf('function');
    expect(buildFreshnessAnswerInstruction).toBeTypeOf('function');
    expect(buildRuntimeMemorySearchRequest).toBeTypeOf('function');
  });
});
