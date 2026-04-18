import { describe, expect, it } from 'vitest';

import {
  BingbuOpsMinistry,
  ExecutionActionSchema,
  ExecutorAgent,
  GongbuCodeMinistry,
  GONGBU_EXECUTION_SYSTEM_PROMPT
} from '../src';
import { ExecutorAgent as canonicalExecutorAgent } from '../src/flows/chat/nodes/executor-node';
import { BingbuOpsMinistry as canonicalBingbuOpsMinistry } from '../src/flows/ministries/bingbu-ops-ministry';
import { GongbuCodeMinistry as canonicalGongbuCodeMinistry } from '../src/flows/ministries/gongbu-code-ministry';
import { GONGBU_EXECUTION_SYSTEM_PROMPT as canonicalExecutionPrompt } from '../src/flows/ministries/gongbu-code/prompts/execution-prompts';
import { ExecutionActionSchema as canonicalExecutionActionSchema } from '../src/flows/ministries/gongbu-code/schemas/execution-action-schema';

describe('@agent/agents-coder root exports', () => {
  it('keeps stable coder entrypoints wired to canonical hosts', () => {
    expect(ExecutorAgent).toBe(canonicalExecutorAgent);
    expect(GongbuCodeMinistry).toBe(canonicalGongbuCodeMinistry);
    expect(BingbuOpsMinistry).toBe(canonicalBingbuOpsMinistry);
    expect(ExecutionActionSchema).toBe(canonicalExecutionActionSchema);
    expect(GONGBU_EXECUTION_SYSTEM_PROMPT).toBe(canonicalExecutionPrompt);
    expect(ExecutorAgent).toBeTypeOf('function');
    expect(GongbuCodeMinistry).toBeTypeOf('function');
    expect(BingbuOpsMinistry).toBeTypeOf('function');
    expect(ExecutionActionSchema.safeParse({}).success).toBe(false);
    expect(GONGBU_EXECUTION_SYSTEM_PROMPT).toContain('只输出符合 Schema 的 JSON');
  });
});
