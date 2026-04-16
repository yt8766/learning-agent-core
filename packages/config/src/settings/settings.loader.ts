import { buildDailyTechBriefingConfig } from './daily-tech-briefing';
import {
  buildProviderAuditAdapters,
  findWorkspaceRoot,
  normalizeProviderBaseUrl,
  parseProvidersConfig,
  parseRoutingConfig,
  resolveRuntimeEnv
} from './settings.helpers';
import { resolveSettingsPaths, buildMergedOverrides } from './settings-paths';
import type { LoadSettingsOptions, RuntimeSettings } from './settings.types';

export function loadSettings(input: NodeJS.ProcessEnv | LoadSettingsOptions = process.env): RuntimeSettings {
  const options =
    'env' in input || 'workspaceRoot' in input || 'overrides' in input
      ? (input as LoadSettingsOptions)
      : { env: input as NodeJS.ProcessEnv };
  const profile = options.profile ?? options.overrides?.profile ?? 'platform';
  const overrides = buildMergedOverrides(profile, options.overrides);
  const workspaceRoot = findWorkspaceRoot(options.workspaceRoot ?? overrides.workspaceRoot ?? process.cwd());
  const runtimeEnv = resolveRuntimeEnv(options.env ?? process.env, workspaceRoot);
  const zhipuModels: RuntimeSettings['zhipuModels'] = {
    manager: runtimeEnv.ZHIPU_MANAGER_MODEL ?? 'glm-5',
    research: runtimeEnv.ZHIPU_RESEARCH_MODEL ?? 'glm-5.1',
    executor: runtimeEnv.ZHIPU_EXECUTOR_MODEL ?? 'glm-4.6',
    reviewer: runtimeEnv.ZHIPU_REVIEWER_MODEL ?? 'glm-4.7'
  };
  const providers = overrides.providers ?? parseProvidersConfig(runtimeEnv, workspaceRoot, zhipuModels);
  const routing = overrides.routing ?? parseRoutingConfig(runtimeEnv, zhipuModels);

  return {
    profile,
    workspaceRoot,
    ...resolveSettingsPaths(overrides, runtimeEnv, workspaceRoot),
    port: overrides.port ?? Number(runtimeEnv.PORT ?? 3000),
    llmProvider: overrides.llmProvider ?? 'zhipu',
    zhipuApiKey: overrides.zhipuApiKey ?? runtimeEnv.ZHIPU_API_KEY ?? '',
    zhipuApiBaseUrl:
      normalizeProviderBaseUrl(overrides.zhipuApiBaseUrl ?? runtimeEnv.ZHIPU_API_BASE_URL, 'zhipu') ?? '',
    zhipuModels: overrides.zhipuModels ?? zhipuModels,
    zhipuThinking: overrides.zhipuThinking ?? {
      manager: runtimeEnv.ZHIPU_MANAGER_THINKING === 'false' ? false : true,
      research: runtimeEnv.ZHIPU_RESEARCH_THINKING === 'true',
      executor: runtimeEnv.ZHIPU_EXECUTOR_THINKING === 'true',
      reviewer: runtimeEnv.ZHIPU_REVIEWER_THINKING === 'false' ? false : true
    },
    providers,
    routing,
    policy: {
      approvalMode: overrides.policy?.approvalMode ?? 'balanced',
      skillInstallMode: overrides.policy?.skillInstallMode ?? 'manual',
      learningMode: overrides.policy?.learningMode ?? 'controlled',
      sourcePolicyMode: overrides.policy?.sourcePolicyMode ?? 'controlled-first',
      memoryPolicy: {
        localFirst: overrides.policy?.memoryPolicy?.localFirst ?? true
      },
      learningPolicy: {
        autoLearnPreferences: overrides.policy?.learningPolicy?.autoLearnPreferences ?? true,
        autoLearnHeuristics: overrides.policy?.learningPolicy?.autoLearnHeuristics ?? false,
        autoLearnTaskExperience: overrides.policy?.learningPolicy?.autoLearnTaskExperience ?? false,
        requireConfirmationOnConflict: overrides.policy?.learningPolicy?.requireConfirmationOnConflict ?? true
      },
      approvalPolicy: {
        safeWriteAutoApprove: overrides.policy?.approvalPolicy?.safeWriteAutoApprove ?? false,
        destructiveActionRequireApproval: overrides.policy?.approvalPolicy?.destructiveActionRequireApproval ?? true
      },
      suggestionPolicy: {
        expertAdviceDefault: overrides.policy?.suggestionPolicy?.expertAdviceDefault ?? true,
        autoSearchSkillsOnGap: overrides.policy?.suggestionPolicy?.autoSearchSkillsOnGap ?? true
      },
      budget: {
        stepBudget: overrides.policy?.budget?.stepBudget ?? 8,
        retryBudget: overrides.policy?.budget?.retryBudget ?? 1,
        sourceBudget: overrides.policy?.budget?.sourceBudget ?? 8,
        maxCostPerTaskUsd: overrides.policy?.budget?.maxCostPerTaskUsd ?? 2,
        fallbackModelId: overrides.policy?.budget?.fallbackModelId ?? 'glm-5.1'
      }
    },
    contextStrategy: {
      maxTokens: Number(runtimeEnv.CONTEXT_MAX_TOKENS ?? overrides.contextStrategy?.maxTokens ?? 12000),
      recentTurns: Number(runtimeEnv.CONTEXT_RECENT_TURNS ?? overrides.contextStrategy?.recentTurns ?? 10),
      summaryInterval: Number(runtimeEnv.CONTEXT_SUMMARY_INTERVAL ?? overrides.contextStrategy?.summaryInterval ?? 8),
      ragTopK: Number(runtimeEnv.CONTEXT_RAG_TOP_K ?? overrides.contextStrategy?.ragTopK ?? 4),
      compressionModel:
        runtimeEnv.CONTEXT_COMPRESSION_MODEL ?? overrides.contextStrategy?.compressionModel ?? zhipuModels.research,
      compressionEnabled:
        runtimeEnv.CONTEXT_COMPRESSION_ENABLED != null
          ? runtimeEnv.CONTEXT_COMPRESSION_ENABLED !== 'false'
          : (overrides.contextStrategy?.compressionEnabled ?? true),
      compressionMessageThreshold: Number(
        runtimeEnv.CONTEXT_COMPRESSION_MESSAGE_THRESHOLD ?? overrides.contextStrategy?.compressionMessageThreshold ?? 15
      ),
      compressionKeepRecentMessages: Number(
        runtimeEnv.CONTEXT_COMPRESSION_KEEP_RECENT_MESSAGES ??
          overrides.contextStrategy?.compressionKeepRecentMessages ??
          5
      ),
      compressionKeepLeadingMessages: Number(
        runtimeEnv.CONTEXT_COMPRESSION_KEEP_LEADING_MESSAGES ??
          overrides.contextStrategy?.compressionKeepLeadingMessages ??
          10
      ),
      compressionMaxSummaryChars: Number(
        runtimeEnv.CONTEXT_COMPRESSION_MAX_SUMMARY_CHARS ??
          overrides.contextStrategy?.compressionMaxSummaryChars ??
          1200
      )
    },
    runtimeBackground: {
      enabled:
        runtimeEnv.RUNTIME_BACKGROUND_ENABLED != null
          ? runtimeEnv.RUNTIME_BACKGROUND_ENABLED !== 'false'
          : (overrides.runtimeBackground?.enabled ?? true),
      workerPoolSize: Number(
        runtimeEnv.RUNTIME_BACKGROUND_WORKER_POOL_SIZE ?? overrides.runtimeBackground?.workerPoolSize ?? 2
      ),
      leaseTtlMs: Number(
        runtimeEnv.RUNTIME_BACKGROUND_LEASE_TTL_MS ?? overrides.runtimeBackground?.leaseTtlMs ?? 30_000
      ),
      heartbeatMs: Number(
        runtimeEnv.RUNTIME_BACKGROUND_HEARTBEAT_MS ?? overrides.runtimeBackground?.heartbeatMs ?? 10_000
      ),
      pollMs: Number(runtimeEnv.RUNTIME_BACKGROUND_POLL_MS ?? overrides.runtimeBackground?.pollMs ?? 3_000),
      runnerIdPrefix:
        runtimeEnv.RUNTIME_BACKGROUND_RUNNER_ID_PREFIX ?? overrides.runtimeBackground?.runnerIdPrefix ?? 'runtime'
    },
    dailyTechBriefing: buildDailyTechBriefingConfig(runtimeEnv, overrides, zhipuModels),
    embeddings: {
      provider: 'glm',
      model: 'Embedding-3',
      dimensions: Number(runtimeEnv.KNOWLEDGE_EMBEDDING_DIMENSIONS ?? 0),
      endpoint: runtimeEnv.KNOWLEDGE_EMBEDDING_ENDPOINT ?? '',
      apiKey:
        runtimeEnv.KNOWLEDGE_EMBEDDING_API_KEY ?? runtimeEnv.MCP_BIGMODEL_API_KEY ?? runtimeEnv.ZHIPU_API_KEY ?? ''
    },
    mcp: {
      bigmodelApiKey: runtimeEnv.MCP_BIGMODEL_API_KEY ?? runtimeEnv.ZHIPU_API_KEY ?? '',
      webSearchEndpoint: runtimeEnv.MCP_BIGMODEL_WEB_SEARCH_ENDPOINT ?? '',
      webReaderEndpoint: runtimeEnv.MCP_BIGMODEL_WEB_READER_ENDPOINT ?? '',
      zreadEndpoint: runtimeEnv.MCP_BIGMODEL_ZREAD_ENDPOINT ?? '',
      researchHttpEndpoint: runtimeEnv.MCP_RESEARCH_HTTP_ENDPOINT ?? '',
      researchHttpApiKey: runtimeEnv.MCP_RESEARCH_HTTP_API_KEY ?? '',
      visionMode: runtimeEnv.MCP_BIGMODEL_VISION_MODE === 'ZAI' ? 'ZAI' : 'ZHIPU',
      stdioSessionIdleTtlMs: Number(runtimeEnv.MCP_STDIO_SESSION_IDLE_TTL_MS ?? 300000),
      stdioSessionMaxCount: Number(runtimeEnv.MCP_STDIO_SESSION_MAX_COUNT ?? 4)
    },
    providerAudit: {
      primaryProvider: runtimeEnv.PROVIDER_AUDIT_PRIMARY ?? 'zhipu',
      adapters: buildProviderAuditAdapters(runtimeEnv)
    }
  };
}
