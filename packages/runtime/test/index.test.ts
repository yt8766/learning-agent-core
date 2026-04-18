import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  BaseAgent,
  createAgentGraph,
  createApprovalRecoveryGraph,
  createLearningGraph,
  describeConnectorProfilePolicy,
  LearningFlow,
  ModelRoutingPolicy
} from '../src';
import { AgentRuntime as CanonicalAgentRuntime } from '../src/contracts/agent-runtime';
import { describeConnectorProfilePolicy as canonicalDescribeConnectorProfilePolicy } from '../src/contracts/profile-policy';
import { ModelRoutingPolicy as CanonicalModelRoutingPolicy } from '../src/contracts/model-routing-policy';
import { SessionCoordinator as CanonicalSessionCoordinator } from '../src/contracts/session-coordinator';
import { WorkerRegistry as CanonicalWorkerRegistry } from '../src/contracts/worker-registry';
import { BaseAgent as BaseAgentSubpath } from '../src/agents/base-agent';
import { AgentRuntime, SessionCoordinator, WorkerRegistry } from '../src';
import { generateObjectWithRetry, generateTextWithRetry, streamTextWithRetry, withLlmRetry } from '../src';
import { StreamingExecutionCoordinator } from '../src/runtime/streaming-execution';
import {
  generateObjectWithRetry as canonicalGenerateObjectWithRetry,
  generateTextWithRetry as canonicalGenerateTextWithRetry,
  streamTextWithRetry as canonicalStreamTextWithRetry,
  withLlmRetry as canonicalWithLlmRetry
} from '../src/runtime/llm-facade';

describe('@agent/runtime', () => {
  it('exports stable runtime mainline entrypoints', () => {
    expect(BaseAgent).toBeTypeOf('function');
    expect(createAgentGraph).toBeTypeOf('function');
    expect(createApprovalRecoveryGraph).toBeTypeOf('function');
    expect(createLearningGraph).toBeTypeOf('function');
    expect(LearningFlow).toBeTypeOf('function');
    expect(AgentRuntime).toBe(CanonicalAgentRuntime);
    expect(SessionCoordinator).toBe(CanonicalSessionCoordinator);
    expect(WorkerRegistry).toBe(CanonicalWorkerRegistry);
    expect(describeConnectorProfilePolicy).toBe(canonicalDescribeConnectorProfilePolicy);
    expect(ModelRoutingPolicy).toBe(CanonicalModelRoutingPolicy);
  });

  it('keeps cycle-safe subpath entrypoints available for agent packages', () => {
    expect(BaseAgentSubpath).toBe(BaseAgent);
    expect(StreamingExecutionCoordinator).toBeTypeOf('function');
  });

  it('re-exports llm facade helpers directly from the runtime host', () => {
    expect(generateObjectWithRetry).toBe(canonicalGenerateObjectWithRetry);
    expect(generateTextWithRetry).toBe(canonicalGenerateTextWithRetry);
    expect(streamTextWithRetry).toBe(canonicalStreamTextWithRetry);
    expect(withLlmRetry).toBe(canonicalWithLlmRetry);
  });

  it('removes the transitional runtime llm contract facade file', () => {
    expect(existsSync(new URL('../src/contracts/llm-facade.ts', import.meta.url))).toBe(false);
  });
});
