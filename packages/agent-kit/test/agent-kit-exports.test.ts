import { describe, expect, expectTypeOf, it } from 'vitest';
import type { AgentCapability, AgentDescriptor, AgentFactory, AgentProvider, AgentRegistry } from '../src';

import {
  BaseAgent,
  StreamingExecutionCoordinator,
  archivalMemorySearchByParams,
  buildFreshnessAnswerInstruction,
  buildRuntimeMemorySearchRequest,
  derivePlannerStrategyRecord
} from '../src';

describe('@agent/agent-kit', () => {
  it('exports the shared agent foundations needed by runtime and specialist packages', () => {
    expect(BaseAgent).toBeTypeOf('function');
    expect(StreamingExecutionCoordinator).toBeTypeOf('function');
    expect(archivalMemorySearchByParams).toBeTypeOf('function');
    expect(buildFreshnessAnswerInstruction).toBeTypeOf('function');
    expect(buildRuntimeMemorySearchRequest).toBeTypeOf('function');
    expect(derivePlannerStrategyRecord).toBeTypeOf('function');
    expectTypeOf<AgentCapability>().toMatchTypeOf<{
      id: string;
      displayName?: string;
    }>();
    expectTypeOf<AgentDescriptor>().toMatchTypeOf<{
      id: string;
      displayName: string;
      capabilities: readonly string[];
      capabilityDescriptors?: readonly AgentCapability[];
      source: 'official' | 'custom';
    }>();
    expectTypeOf<AgentFactory>().toMatchTypeOf<{
      createAgent: () => unknown;
    }>();
    expectTypeOf<AgentProvider>().toMatchTypeOf<{
      descriptor: AgentDescriptor;
      createAgent: () => unknown;
    }>();
    expectTypeOf<AgentRegistry>().toMatchTypeOf<{
      listAgents: () => readonly AgentDescriptor[];
      findAgentById: (agentId: string) => AgentProvider | undefined;
    }>();
  });
});
