import { createDefaultPlatformRuntime, createDefaultPlatformRuntimeOptions } from '@agent/platform-runtime';
import { ModelInvocationFacade } from '@agent/runtime';
import { SkillArtifactFetcher } from '@agent/skill';
import type { LlmProviderOptions, ModelInvocationRequest, ProviderUsage } from '@agent/core';
import type { KnowledgeSearchService, VectorSearchProvider } from '@agent/knowledge';

import { RemoteSkillDiscoveryService } from '../skills/remote-skill-discovery.service';
import { SkillSourceSyncService } from '../skills/skill-source-sync.service';
import {
  createRuntimeKnowledgeProviderFactory,
  createRuntimeKnowledgeSearchBridge,
  createRuntimeKnowledgeSearchService,
  createRuntimeKnowledgeSearchStatus,
  createRuntimeKnowledgeSearchStatusWithHealth,
  type RuntimeKnowledgeProviderFactoryConfig
} from './runtime-knowledge-search-factory';
import { createRuntimeKnowledgeProviderOptionsFromEnv } from './runtime-knowledge-provider-config';
import {
  createOfficialAgentRegistry,
  createOfficialRuntimeAgentDependencies,
  listSubgraphDescriptors,
  listWorkflowPresets,
  listWorkflowVersions
} from '../agents';

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
    thinking: request.contextHints.thinking === false ? false : undefined,
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

export interface RuntimeHostOptions {
  keywordSearchService?: KnowledgeSearchService;
  knowledgeVectorSearchProvider?: VectorSearchProvider;
  knowledgeProviderConfig?: RuntimeKnowledgeProviderFactoryConfig;
  env?: NodeJS.ProcessEnv;
}

export class RuntimeHost {
  constructor(private readonly options: RuntimeHostOptions = {}) {}

  private readonly agentRegistry = createOfficialAgentRegistry();
  private readonly agentDependencies = createOfficialRuntimeAgentDependencies({
    agentRegistry: this.agentRegistry
  });
  private readonly configuredKnowledgeProviderOptions = createRuntimeKnowledgeProviderOptionsFromEnv(this.options.env);
  private readonly configuredKeywordSearchService =
    this.options.keywordSearchService ?? this.configuredKnowledgeProviderOptions.keywordSearchService;
  private readonly configuredKnowledgeVectorSearchProvider =
    this.options.knowledgeVectorSearchProvider ?? this.configuredKnowledgeProviderOptions.knowledgeVectorSearchProvider;
  private readonly knowledgeProviderConfig =
    this.options.knowledgeProviderConfig ?? this.configuredKnowledgeProviderOptions.config;

  readonly platformRuntime = createDefaultPlatformRuntime({
    ...createDefaultPlatformRuntimeOptions({
      workspaceRoot: process.cwd(),
      createKnowledgeSearchService: ({ settings }) =>
        createRuntimeKnowledgeSearchBridge(
          createRuntimeKnowledgeSearchService({
            settings,
            keywordSearchService: this.configuredKeywordSearchService,
            knowledgeVectorSearchProvider: this.configuredKnowledgeVectorSearchProvider,
            config: this.knowledgeProviderConfig
          })
        )
    }),
    agentRegistry: this.agentRegistry,
    agentDependencies: this.agentDependencies,
    metadata: {
      listWorkflowPresets,
      listSubgraphDescriptors,
      listWorkflowVersions
    }
  });

  readonly runtime = this.platformRuntime.runtime;

  readonly settings = this.runtime.settings;
  readonly knowledgeVectorSearchProvider =
    this.configuredKnowledgeVectorSearchProvider ?? resolveRuntimeKnowledgeVectorSearchProvider(this.runtime);
  private readonly knowledgeSearchFactory = createRuntimeKnowledgeProviderFactory({
    settings: this.settings,
    config: this.knowledgeProviderConfig,
    keywordSearchService: this.configuredKeywordSearchService,
    knowledgeVectorSearchProvider: this.knowledgeVectorSearchProvider
  });
  readonly knowledgeSearchService = this.knowledgeSearchFactory.searchService;
  readonly knowledgeSearchStatus = createRuntimeKnowledgeSearchStatus(this.knowledgeSearchFactory);
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
    return this.platformRuntime.metadata.listWorkflowPresets?.() ?? [];
  }

  listSubgraphDescriptors() {
    return this.platformRuntime.metadata.listSubgraphDescriptors?.() ?? [];
  }

  listWorkflowVersions() {
    return this.platformRuntime.metadata.listWorkflowVersions?.() ?? [];
  }

  getKnowledgeSearchStatus() {
    return createRuntimeKnowledgeSearchStatusWithHealth(this.knowledgeSearchFactory);
  }
}

function resolveRuntimeKnowledgeVectorSearchProvider(runtime: unknown): VectorSearchProvider | undefined {
  const candidate = (runtime as { knowledgeVectorSearchProvider?: unknown }).knowledgeVectorSearchProvider;
  return isVectorSearchProvider(candidate) ? candidate : undefined;
}

function isVectorSearchProvider(value: unknown): value is VectorSearchProvider {
  return (
    typeof value === 'object' &&
    value !== null &&
    'searchSimilar' in value &&
    typeof (value as { searchSimilar?: unknown }).searchSimilar === 'function'
  );
}
