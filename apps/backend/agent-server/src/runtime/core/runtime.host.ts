import { createDefaultPlatformRuntime, createDefaultPlatformRuntimeOptions } from '@agent/platform-runtime';
import { ModelInvocationFacade } from '@agent/runtime';
import { SkillArtifactFetcher } from '@agent/skill-runtime';
import type { LlmProviderOptions, ModelInvocationRequest, ProviderUsage } from '@agent/core';

import { RemoteSkillDiscoveryService } from '../skills/remote-skill-discovery.service';
import { SkillSourceSyncService } from '../skills/skill-source-sync.service';

function resolveInvocationRole(modeProfile: 'direct-reply' | 'runtime-task'): LlmProviderOptions['role'] {
  return modeProfile === 'direct-reply' ? 'manager' : 'manager';
}

function resolveInvocationProviderOptions(
  request: ModelInvocationRequest,
  modelId: string,
  onUsage?: (usage: ProviderUsage) => void
): LlmProviderOptions {
  return {
    role: resolveInvocationRole(request.modeProfile),
    modelId,
    temperature: typeof request.contextHints.temperature === 'number' ? request.contextHints.temperature : undefined,
    maxTokens: typeof request.contextHints.maxTokens === 'number' ? request.contextHints.maxTokens : undefined,
    budgetState: {
      costConsumedUsd: request.budgetSnapshot.costConsumedUsd,
      costBudgetUsd: request.budgetSnapshot.costBudgetUsd,
      fallbackModelId: request.budgetSnapshot.fallbackModelId
    },
    ...(onUsage ? { onUsage } : {})
  };
}

function isInvocationTokenSink(value: unknown): value is (token: string, metadata?: { model?: string }) => void {
  return typeof value === 'function';
}

function isInvocationTokenEstimator(
  value: unknown
): value is (
  messages: Parameters<NonNullable<RuntimeHost['runtime']['llmProvider']['estimateTokens']>>[0],
  options: LlmProviderOptions
) => Promise<number> | number {
  return typeof value === 'function';
}

function resolveInvocationTokenSink(
  request: ModelInvocationRequest
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
      estimateTokens: ({ request, messages, modelId }) => {
        const estimator = this.runtime.llmProvider.estimateTokens;
        if (!isInvocationTokenEstimator(estimator)) {
          return undefined;
        }
        return estimator(messages, resolveInvocationProviderOptions(request, modelId));
      },
      execute: async ({ request, messages, modelId }) => {
        const onToken = resolveInvocationTokenSink(request);
        let latestUsage: ProviderUsage | undefined;
        const outputText = await this.runtime.llmProvider.streamText(
          messages,
          resolveInvocationProviderOptions(request, modelId, usage => {
            latestUsage = usage;
          }),
          (token, metadata) => {
            onToken?.(token, metadata);
          }
        );

        return {
          providerId: this.runtime.llmProvider.providerId,
          outputText: String(outputText),
          usage: latestUsage
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
