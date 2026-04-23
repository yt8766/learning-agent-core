import { createDefaultPlatformRuntime, createDefaultPlatformRuntimeOptions } from '@agent/platform-runtime';
import { ModelInvocationFacade } from '@agent/runtime';
import { SkillArtifactFetcher } from '@agent/skill-runtime';
import type { LlmProviderOptions } from '@agent/core';

import { RemoteSkillDiscoveryService } from '../skills/remote-skill-discovery.service';
import { SkillSourceSyncService } from '../skills/skill-source-sync.service';

function resolveInvocationRole(modeProfile: 'direct-reply' | 'runtime-task'): LlmProviderOptions['role'] {
  return modeProfile === 'direct-reply' ? 'manager' : 'manager';
}

function isInvocationTokenSink(value: unknown): value is (token: string, metadata?: { model?: string }) => void {
  return typeof value === 'function';
}

function resolveInvocationTokenSink(
  request: Parameters<ModelInvocationFacade['invoke']>[0]
): ((token: string, metadata?: { model?: string }) => void) | undefined {
  const { onToken } = request.contextHints as {
    onToken?: ((token: string, metadata?: { model?: string }) => void) | unknown;
  };

  return isInvocationTokenSink(onToken) ? onToken : undefined;
}

export class RuntimeHost {
  readonly platformRuntime = createDefaultPlatformRuntime({
    ...createDefaultPlatformRuntimeOptions({
      workspaceRoot: process.cwd()
    })
  });

  readonly runtime = this.platformRuntime.runtime;

  readonly settings = this.runtime.settings;
  readonly memoryRepository = this.runtime.memoryRepository;
  readonly ruleRepository = this.runtime.ruleRepository;
  readonly skillRegistry = this.runtime.skillRegistry;
  readonly runtimeStateRepository = this.runtime.runtimeStateRepository;
  readonly toolRegistry = this.runtime.toolRegistry;
  readonly llmProvider = this.runtime.llmProvider;
  readonly modelInvocationFacade = new ModelInvocationFacade({
    provider: {
      execute: async ({ request, messages, modelId }) => {
        const onToken = resolveInvocationTokenSink(request);
        const outputText = await this.runtime.llmProvider.streamText(
          messages,
          {
            role: resolveInvocationRole(request.modeProfile),
            modelId,
            temperature:
              typeof request.contextHints.temperature === 'number' ? request.contextHints.temperature : undefined,
            maxTokens: typeof request.contextHints.maxTokens === 'number' ? request.contextHints.maxTokens : undefined,
            budgetState: {
              costConsumedUsd: request.budgetSnapshot.costConsumedUsd,
              costBudgetUsd: request.budgetSnapshot.costBudgetUsd,
              fallbackModelId: request.budgetSnapshot.fallbackModelId
            }
          },
          (token, metadata) => {
            onToken?.(token, metadata);
          }
        );

        return {
          outputText: String(outputText)
        };
      }
    }
  });
  readonly mcpServerRegistry = this.runtime.mcpServerRegistry;
  readonly mcpCapabilityRegistry = this.runtime.mcpCapabilityRegistry;
  readonly mcpClientManager = this.runtime.mcpClientManager;
  readonly orchestrator = this.runtime.orchestrator;
  readonly sessionCoordinator = this.runtime.sessionCoordinator;
  readonly skillSourceSyncService = new SkillSourceSyncService({
    workspaceRoot: this.settings.workspaceRoot,
    profile: this.settings.profile
  });
  readonly remoteSkillDiscoveryService = new RemoteSkillDiscoveryService();
  readonly skillArtifactFetcher = new SkillArtifactFetcher(this.settings.workspaceRoot);

  listWorkflowPresets() {
    return this.platformRuntime.metadata.listWorkflowPresets();
  }

  listSubgraphDescriptors() {
    return this.platformRuntime.metadata.listSubgraphDescriptors();
  }

  listWorkflowVersions() {
    return this.platformRuntime.metadata.listWorkflowVersions();
  }
}
