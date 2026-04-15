import { describe, expect, it } from 'vitest';

import {
  BingbuOpsMinistry,
  ExecutionActionSchema,
  ExecutorAgent,
  GongbuCodeMinistry,
  GONGBU_EXECUTION_SYSTEM_PROMPT
} from '../src';

describe('@agent/agents-coder', () => {
  it('exports stable coder entrypoints', () => {
    expect(ExecutorAgent).toBeTypeOf('function');
    expect(GongbuCodeMinistry).toBeTypeOf('function');
    expect(BingbuOpsMinistry).toBeTypeOf('function');
    expect(ExecutionActionSchema.safeParse({}).success).toBe(false);
    expect(GONGBU_EXECUTION_SYSTEM_PROMPT).toContain('只输出符合 Schema 的 JSON');
  });
});
