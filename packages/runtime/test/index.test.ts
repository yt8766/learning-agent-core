import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  BaseAgent,
  createAgentGraph,
  createApprovalRecoveryGraph,
  createLearningGraph,
  describeConnectorProfilePolicy,
  LearningFlow,
  ModelRoutingPolicy,
  createMediaProviderRegistry,
  derivePlannerStrategyRecord
} from '../src';
import { AgentRuntime as CanonicalAgentRuntime } from '../src/contracts/agent-runtime';
import { describeConnectorProfilePolicy as canonicalDescribeConnectorProfilePolicy } from '../src/contracts/profile-policy';
import { ModelRoutingPolicy as CanonicalModelRoutingPolicy } from '../src/contracts/model-routing-policy';
import { SessionCoordinator as CanonicalSessionCoordinator } from '../src/contracts/session-coordinator';
import { WorkerRegistry as CanonicalWorkerRegistry } from '../src/contracts/worker-registry';
import { derivePlannerStrategyRecord as CanonicalDerivePlannerStrategyRecord } from '../src/agents/planner-strategy';
import { BaseAgent as BaseAgentSubpath } from '../src/agents/base-agent';
import { createMediaProviderRegistry as CanonicalCreateMediaProviderRegistry } from '../src/media';
import { AgentRuntime, SessionCoordinator, WorkerRegistry } from '../src';
import { generateObjectWithRetry, generateTextWithRetry, streamTextWithRetry, withLlmRetry } from '../src';
import { StreamingExecutionCoordinator } from '../src/runtime/streaming-execution';
import { runWithConcurrency as RuntimeConcurrencySubpath } from '../src/runtime/concurrency';
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
    expect(derivePlannerStrategyRecord).toBe(CanonicalDerivePlannerStrategyRecord);
    expect(createMediaProviderRegistry).toBe(CanonicalCreateMediaProviderRegistry);
  });

  it('keeps cycle-safe subpath entrypoints available for agent packages', () => {
    expect(BaseAgentSubpath).toBe(BaseAgent);
    expect(StreamingExecutionCoordinator).toBeTypeOf('function');
    expect(RuntimeConcurrencySubpath).toBeTypeOf('function');
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

  it('hosts migrated agent foundation implementations inside runtime sources', () => {
    const agentKitPackageName = ['@agent', 'agent', 'kit'].join('/').replace('/kit', '-kit');
    const runtimePackage = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
    expect(runtimePackage).not.toContain(`"${agentKitPackageName}"`);

    const migratedSources = [
      '../src/agents/base-agent.ts',
      '../src/agents/agent-registry.ts',
      '../src/agents/planner-strategy.ts',
      '../src/runtime/agent-runtime-context.ts',
      '../src/runtime/streaming-execution.ts',
      '../src/memory/active-memory-tools.ts',
      '../src/memory/runtime-memory-search.ts',
      '../src/utils/prompts/temporal-context.ts',
      '../src/media/media-provider-registry.ts'
    ];

    for (const sourcePath of migratedSources) {
      expect(readFileSync(new URL(sourcePath, import.meta.url), 'utf8')).not.toContain(agentKitPackageName);
    }
  });

  it('keeps media providers isolated by kind from the runtime host', async () => {
    const registry = createMediaProviderRegistry();
    const audioProvider = {
      providerId: 'mock',
      async listSystemVoices() {
        return { voices: [] };
      },
      async cloneVoice() {
        throw new Error('not used');
      },
      async synthesizeSpeech() {
        throw new Error('not used');
      },
      async createSpeechTask() {
        throw new Error('not used');
      },
      async getSpeechTask() {
        throw new Error('not used');
      }
    };
    const imageProvider = {
      providerId: 'mock',
      async generateImage() {
        return { assets: [], evidenceRefs: [] };
      }
    };

    registry.registerAudioProvider(audioProvider);
    registry.registerImageProvider(imageProvider);

    await expect(registry.getAudioProvider('mock')).resolves.toBe(audioProvider);
    await expect(registry.getImageProvider('mock')).resolves.toBe(imageProvider);
    await expect(registry.getVideoProvider('mock')).rejects.toThrow('Media provider not found: mock');
  });
});
