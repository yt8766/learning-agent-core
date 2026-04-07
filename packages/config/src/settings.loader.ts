import { DEFAULT_DATA_PATHS, buildProfileOverrides, mergeNormalizedPolicy } from './settings.defaults';
import {
  buildProviderAuditAdapters,
  findWorkspaceRoot,
  normalizeProviderBaseUrl,
  parseProvidersConfig,
  parseRoutingConfig,
  resolveFromWorkspaceRoot,
  resolveRuntimeEnv
} from './settings.helpers';
import type { LoadSettingsOptions, PolicyConfig, RuntimeSettings, RuntimeSettingsOverrides } from './settings.types';

function buildMergedOverrides(
  profile: RuntimeSettings['profile'],
  overrides: RuntimeSettingsOverrides | undefined
): RuntimeSettingsOverrides {
  const profileOverrides = buildProfileOverrides(profile);
  const normalizedPolicy: Partial<PolicyConfig> = mergeNormalizedPolicy(profileOverrides.policy, overrides?.policy);

  return {
    ...profileOverrides,
    ...overrides,
    policy: normalizedPolicy
  };
}

function buildDailyTechBriefingCategoryConfig(
  runtimeEnv: NodeJS.ProcessEnv,
  overrides: RuntimeSettingsOverrides['dailyTechBriefing'] | undefined
) {
  return {
    frontendSecurity: {
      enabled:
        runtimeEnv.DAILY_TECH_BRIEFING_FRONTEND_SECURITY_ENABLED != null
          ? runtimeEnv.DAILY_TECH_BRIEFING_FRONTEND_SECURITY_ENABLED !== 'false'
          : (overrides?.categories?.frontendSecurity?.enabled ?? true),
      baseIntervalHours: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_FRONTEND_SECURITY_INTERVAL_HOURS ??
          overrides?.categories?.frontendSecurity?.baseIntervalHours ??
          4
      ),
      lookbackDays: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_FRONTEND_SECURITY_LOOKBACK_DAYS ??
          overrides?.categories?.frontendSecurity?.lookbackDays ??
          3
      ),
      adaptivePolicy: {
        hotThresholdRuns: 2,
        cooldownEmptyRuns: 6,
        allowedIntervalHours: [2, 4, 8]
      }
    },
    generalSecurity: {
      enabled:
        runtimeEnv.DAILY_TECH_BRIEFING_GENERAL_SECURITY_ENABLED != null
          ? runtimeEnv.DAILY_TECH_BRIEFING_GENERAL_SECURITY_ENABLED !== 'false'
          : (overrides?.categories?.generalSecurity?.enabled ?? true),
      baseIntervalHours: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_GENERAL_SECURITY_INTERVAL_HOURS ??
          overrides?.categories?.generalSecurity?.baseIntervalHours ??
          4
      ),
      lookbackDays: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_GENERAL_SECURITY_LOOKBACK_DAYS ??
          runtimeEnv.DAILY_TECH_BRIEFING_SECURITY_LOOKBACK_DAYS ??
          overrides?.categories?.generalSecurity?.lookbackDays ??
          overrides?.securityLookbackDays ??
          7
      ),
      adaptivePolicy: {
        hotThresholdRuns: 2,
        cooldownEmptyRuns: 6,
        allowedIntervalHours: [2, 4, 8]
      }
    },
    devtoolSecurity: {
      enabled:
        runtimeEnv.DAILY_TECH_BRIEFING_DEVTOOL_SECURITY_ENABLED != null
          ? runtimeEnv.DAILY_TECH_BRIEFING_DEVTOOL_SECURITY_ENABLED !== 'false'
          : (overrides?.categories?.devtoolSecurity?.enabled ?? true),
      baseIntervalHours: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_DEVTOOL_SECURITY_INTERVAL_HOURS ??
          overrides?.categories?.devtoolSecurity?.baseIntervalHours ??
          4
      ),
      lookbackDays: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_DEVTOOL_SECURITY_LOOKBACK_DAYS ??
          overrides?.categories?.devtoolSecurity?.lookbackDays ??
          7
      ),
      adaptivePolicy: {
        hotThresholdRuns: 2,
        cooldownEmptyRuns: 6,
        allowedIntervalHours: [2, 4, 8]
      }
    },
    aiTech: {
      enabled:
        runtimeEnv.DAILY_TECH_BRIEFING_AI_TECH_ENABLED != null
          ? runtimeEnv.DAILY_TECH_BRIEFING_AI_TECH_ENABLED !== 'false'
          : (overrides?.categories?.aiTech?.enabled ?? true),
      baseIntervalHours: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_AI_TECH_INTERVAL_HOURS ?? overrides?.categories?.aiTech?.baseIntervalHours ?? 24
      ),
      lookbackDays: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_AI_LOOKBACK_DAYS ??
          overrides?.categories?.aiTech?.lookbackDays ??
          overrides?.aiLookbackDays ??
          7
      ),
      adaptivePolicy: {
        hotThresholdRuns: 2,
        cooldownEmptyRuns: 6,
        allowedIntervalHours: [12, 24, 48]
      }
    },
    frontendTech: {
      enabled:
        runtimeEnv.DAILY_TECH_BRIEFING_FRONTEND_TECH_ENABLED != null
          ? runtimeEnv.DAILY_TECH_BRIEFING_FRONTEND_TECH_ENABLED !== 'false'
          : (overrides?.categories?.frontendTech?.enabled ?? true),
      baseIntervalHours: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_FRONTEND_TECH_INTERVAL_HOURS ??
          overrides?.categories?.frontendTech?.baseIntervalHours ??
          24
      ),
      lookbackDays: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_FRONTEND_LOOKBACK_DAYS ??
          overrides?.categories?.frontendTech?.lookbackDays ??
          overrides?.frontendLookbackDays ??
          7
      ),
      adaptivePolicy: {
        hotThresholdRuns: 2,
        cooldownEmptyRuns: 6,
        allowedIntervalHours: [12, 24, 48]
      }
    },
    backendTech: {
      enabled:
        runtimeEnv.DAILY_TECH_BRIEFING_BACKEND_TECH_ENABLED != null
          ? runtimeEnv.DAILY_TECH_BRIEFING_BACKEND_TECH_ENABLED !== 'false'
          : (overrides?.categories?.backendTech?.enabled ?? true),
      baseIntervalHours: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_BACKEND_TECH_INTERVAL_HOURS ??
          overrides?.categories?.backendTech?.baseIntervalHours ??
          24
      ),
      lookbackDays: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_BACKEND_TECH_LOOKBACK_DAYS ??
          overrides?.categories?.backendTech?.lookbackDays ??
          7
      ),
      adaptivePolicy: {
        hotThresholdRuns: 2,
        cooldownEmptyRuns: 6,
        allowedIntervalHours: [12, 24, 48]
      }
    },
    cloudInfraTech: {
      enabled:
        runtimeEnv.DAILY_TECH_BRIEFING_CLOUD_INFRA_TECH_ENABLED != null
          ? runtimeEnv.DAILY_TECH_BRIEFING_CLOUD_INFRA_TECH_ENABLED !== 'false'
          : (overrides?.categories?.cloudInfraTech?.enabled ?? true),
      baseIntervalHours: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_CLOUD_INFRA_TECH_INTERVAL_HOURS ??
          overrides?.categories?.cloudInfraTech?.baseIntervalHours ??
          24
      ),
      lookbackDays: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_CLOUD_INFRA_TECH_LOOKBACK_DAYS ??
          overrides?.categories?.cloudInfraTech?.lookbackDays ??
          7
      ),
      adaptivePolicy: {
        hotThresholdRuns: 2,
        cooldownEmptyRuns: 6,
        allowedIntervalHours: [12, 24, 48]
      }
    }
  };
}

function resolveSettingsPaths(
  overrides: RuntimeSettingsOverrides,
  runtimeEnv: NodeJS.ProcessEnv,
  workspaceRoot: string
) {
  return {
    memoryFilePath: resolveFromWorkspaceRoot(
      overrides.memoryFilePath ?? runtimeEnv.MEMORY_FILE_PATH ?? DEFAULT_DATA_PATHS.memoryFilePath,
      workspaceRoot
    ),
    rulesFilePath: resolveFromWorkspaceRoot(
      overrides.rulesFilePath ?? runtimeEnv.RULES_FILE_PATH ?? DEFAULT_DATA_PATHS.rulesFilePath,
      workspaceRoot
    ),
    vectorIndexFilePath: resolveFromWorkspaceRoot(
      overrides.vectorIndexFilePath ?? runtimeEnv.VECTOR_INDEX_FILE_PATH ?? DEFAULT_DATA_PATHS.vectorIndexFilePath,
      workspaceRoot
    ),
    tasksStateFilePath: resolveFromWorkspaceRoot(
      overrides.tasksStateFilePath ?? runtimeEnv.TASKS_STATE_FILE_PATH ?? DEFAULT_DATA_PATHS.tasksStateFilePath,
      workspaceRoot
    ),
    semanticCacheFilePath: resolveFromWorkspaceRoot(
      overrides.semanticCacheFilePath ??
        runtimeEnv.SEMANTIC_CACHE_FILE_PATH ??
        DEFAULT_DATA_PATHS.semanticCacheFilePath,
      workspaceRoot
    ),
    skillsRoot: resolveFromWorkspaceRoot(
      overrides.skillsRoot ?? runtimeEnv.SKILLS_ROOT ?? DEFAULT_DATA_PATHS.skillsRoot,
      workspaceRoot
    ),
    pluginsLabRoot: resolveFromWorkspaceRoot(
      overrides.pluginsLabRoot ?? runtimeEnv.PLUGINS_LAB_ROOT ?? DEFAULT_DATA_PATHS.pluginsLabRoot,
      workspaceRoot
    ),
    skillSourcesRoot: resolveFromWorkspaceRoot(
      overrides.skillSourcesRoot ?? runtimeEnv.SKILL_SOURCES_ROOT ?? DEFAULT_DATA_PATHS.skillSourcesRoot,
      workspaceRoot
    ),
    skillPackagesRoot: resolveFromWorkspaceRoot(
      overrides.skillPackagesRoot ?? runtimeEnv.SKILL_PACKAGES_ROOT ?? DEFAULT_DATA_PATHS.skillPackagesRoot,
      workspaceRoot
    ),
    skillReceiptsRoot: resolveFromWorkspaceRoot(
      overrides.skillReceiptsRoot ?? runtimeEnv.SKILL_RECEIPTS_ROOT ?? DEFAULT_DATA_PATHS.skillReceiptsRoot,
      workspaceRoot
    ),
    skillInternalRoot: resolveFromWorkspaceRoot(
      overrides.skillInternalRoot ?? runtimeEnv.SKILL_INTERNAL_ROOT ?? DEFAULT_DATA_PATHS.skillInternalRoot,
      workspaceRoot
    ),
    registryFilePath: resolveFromWorkspaceRoot(
      overrides.registryFilePath ?? runtimeEnv.SKILL_REGISTRY_FILE_PATH ?? DEFAULT_DATA_PATHS.registryFilePath,
      workspaceRoot
    ),
    knowledgeRoot: resolveFromWorkspaceRoot(
      overrides.knowledgeRoot ?? runtimeEnv.KNOWLEDGE_ROOT ?? DEFAULT_DATA_PATHS.knowledgeRoot,
      workspaceRoot
    )
  };
}

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
    research: runtimeEnv.ZHIPU_RESEARCH_MODEL ?? 'glm-4.7-flashx',
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
        fallbackModelId: overrides.policy?.budget?.fallbackModelId ?? 'glm-4.7-flash'
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
    dailyTechBriefing: {
      enabled:
        runtimeEnv.DAILY_TECH_BRIEFING_ENABLED != null
          ? runtimeEnv.DAILY_TECH_BRIEFING_ENABLED !== 'false'
          : (overrides.dailyTechBriefing?.enabled ?? true),
      schedule: runtimeEnv.DAILY_TECH_BRIEFING_SCHEDULE ?? overrides.dailyTechBriefing?.schedule ?? 'daily 11:00',
      sendEmptyDigest:
        runtimeEnv.DAILY_TECH_BRIEFING_SEND_EMPTY_DIGEST != null
          ? runtimeEnv.DAILY_TECH_BRIEFING_SEND_EMPTY_DIGEST !== 'false'
          : (overrides.dailyTechBriefing?.sendEmptyDigest ?? true),
      maxItemsPerCategory: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_MAX_ITEMS_PER_CATEGORY ?? overrides.dailyTechBriefing?.maxItemsPerCategory ?? 5
      ),
      duplicateWindowDays: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_DUPLICATE_WINDOW_DAYS ?? overrides.dailyTechBriefing?.duplicateWindowDays ?? 7
      ),
      maxNonCriticalItemsPerCategory: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_MAX_NON_CRITICAL_ITEMS_PER_CATEGORY ??
          overrides.dailyTechBriefing?.maxNonCriticalItemsPerCategory ??
          overrides.dailyTechBriefing?.maxItemsPerCategory ??
          runtimeEnv.DAILY_TECH_BRIEFING_MAX_ITEMS_PER_CATEGORY ??
          10
      ),
      maxCriticalItemsPerCategory: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_MAX_CRITICAL_ITEMS_PER_CATEGORY ??
          overrides.dailyTechBriefing?.maxCriticalItemsPerCategory ??
          20
      ),
      maxTotalItemsPerCategory: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_MAX_TOTAL_ITEMS_PER_CATEGORY ??
          overrides.dailyTechBriefing?.maxTotalItemsPerCategory ??
          30
      ),
      sendOnlyDelta:
        runtimeEnv.DAILY_TECH_BRIEFING_SEND_ONLY_DELTA != null
          ? runtimeEnv.DAILY_TECH_BRIEFING_SEND_ONLY_DELTA !== 'false'
          : (overrides.dailyTechBriefing?.sendOnlyDelta ?? true),
      resendOnlyOnMaterialChange:
        runtimeEnv.DAILY_TECH_BRIEFING_RESEND_ONLY_ON_MATERIAL_CHANGE != null
          ? runtimeEnv.DAILY_TECH_BRIEFING_RESEND_ONLY_ON_MATERIAL_CHANGE !== 'false'
          : (overrides.dailyTechBriefing?.resendOnlyOnMaterialChange ?? true),
      larkDigestMode:
        runtimeEnv.DAILY_TECH_BRIEFING_LARK_DIGEST_MODE === 'markdown-summary' ||
        runtimeEnv.DAILY_TECH_BRIEFING_LARK_DIGEST_MODE === 'interactive-card'
          ? runtimeEnv.DAILY_TECH_BRIEFING_LARK_DIGEST_MODE
          : (overrides.dailyTechBriefing?.larkDigestMode ?? 'dual'),
      larkDetailMode:
        runtimeEnv.DAILY_TECH_BRIEFING_LARK_DETAIL_MODE === 'summary' ||
        runtimeEnv.DAILY_TECH_BRIEFING_LARK_DETAIL_MODE === 'detailed'
          ? runtimeEnv.DAILY_TECH_BRIEFING_LARK_DETAIL_MODE
          : (overrides.dailyTechBriefing?.larkDetailMode ?? 'detailed'),
      sourcePolicy:
        runtimeEnv.DAILY_TECH_BRIEFING_SOURCE_POLICY === 'official-only' ||
        overrides.dailyTechBriefing?.sourcePolicy === 'official-only'
          ? 'official-only'
          : 'tiered-authority',
      webhookEnvVar:
        runtimeEnv.DAILY_TECH_BRIEFING_WEBHOOK_ENV_VAR ??
        overrides.dailyTechBriefing?.webhookEnvVar ??
        'LARK_BOT_WEBHOOK_URL',
      webhookUrl:
        runtimeEnv[
          runtimeEnv.DAILY_TECH_BRIEFING_WEBHOOK_ENV_VAR ??
            overrides.dailyTechBriefing?.webhookEnvVar ??
            'LARK_BOT_WEBHOOK_URL'
        ] ?? overrides.dailyTechBriefing?.webhookUrl,
      translationEnabled:
        runtimeEnv.DAILY_TECH_BRIEFING_TRANSLATION_ENABLED != null
          ? runtimeEnv.DAILY_TECH_BRIEFING_TRANSLATION_ENABLED !== 'false'
          : (overrides.dailyTechBriefing?.translationEnabled ?? true),
      translationModel:
        runtimeEnv.DAILY_TECH_BRIEFING_TRANSLATION_MODEL ??
        overrides.dailyTechBriefing?.translationModel ??
        zhipuModels.research,
      aiLookbackDays: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_AI_LOOKBACK_DAYS ?? overrides.dailyTechBriefing?.aiLookbackDays ?? 7
      ),
      frontendLookbackDays: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_FRONTEND_LOOKBACK_DAYS ?? overrides.dailyTechBriefing?.frontendLookbackDays ?? 7
      ),
      securityLookbackDays: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_SECURITY_LOOKBACK_DAYS ?? overrides.dailyTechBriefing?.securityLookbackDays ?? 7
      ),
      categories: buildDailyTechBriefingCategoryConfig(runtimeEnv, overrides.dailyTechBriefing)
    },
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
