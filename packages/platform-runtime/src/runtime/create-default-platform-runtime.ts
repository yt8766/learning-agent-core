import {
  AgentRuntime,
  getRuntimeAgentDependencies,
  type AgentRuntimeOptions,
  type AgentRegistry
} from '@agent/runtime';

import type { PlatformRuntimeFacade } from '../contracts';
import type { PlatformRuntimeMetadata } from '../contracts/platform-runtime-facade';
import { StaticAgentRegistry } from '../registries';
import { XingbuClassifier } from '../classifiers';
import { createPlatformRuntime } from './create-platform-runtime';

export interface CreateDefaultPlatformRuntimeOptions extends AgentRuntimeOptions {
  readonly agentDependencies?: NonNullable<AgentRuntimeOptions['agentDependencies']>;
  readonly agentRegistry?: AgentRegistry;
  readonly metadata?: PlatformRuntimeMetadata;
}

export function createDefaultPlatformRuntime(
  options: CreateDefaultPlatformRuntimeOptions
): PlatformRuntimeFacade<AgentRuntime> {
  const agentRegistry = options.agentRegistry ?? new StaticAgentRegistry();
  const agentDependencies = options.agentDependencies ?? getRuntimeAgentDependencies();

  return createPlatformRuntime({
    runtime: new AgentRuntime({
      ...options,
      agentDependencies,
      createApprovalClassifier:
        options.approvalClassifier || options.createApprovalClassifier
          ? options.createApprovalClassifier
          : llm => new XingbuClassifier(llm).classify
    }),
    agentRegistry,
    agentDependencies,
    metadata: options.metadata
  });
}
