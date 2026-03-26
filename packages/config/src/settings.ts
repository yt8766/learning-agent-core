import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

const DEFAULT_DATA_PATHS = {
  memoryFilePath: 'data/memory/records.jsonl',
  rulesFilePath: 'data/rules/rules.jsonl',
  tasksStateFilePath: 'data/runtime/tasks-state.json',
  semanticCacheFilePath: 'data/runtime/semantic-cache.json',
  skillsRoot: 'data/skills',
  pluginsLabRoot: 'data/skills/plugins-lab',
  skillSourcesRoot: 'data/skills/remote-sources',
  skillPackagesRoot: 'data/skills/installed',
  skillReceiptsRoot: 'data/skills/receipts',
  skillInternalRoot: 'data/skills/installed/internal',
  registryFilePath: 'data/skills/registry.json'
} as const;

export interface ProviderSettingsRecord {
  id: string;
  type: 'zhipu' | 'openai' | 'openai-compatible' | 'ollama' | 'anthropic';
  displayName?: string;
  apiKey?: string;
  baseUrl?: string;
  models: string[];
  roleModels?: Partial<Record<'manager' | 'research' | 'executor' | 'reviewer', string>>;
}

export interface RoutingPolicyRecord {
  primary: string;
  fallback?: string[];
}

export type RuntimeProfile = 'platform' | 'company' | 'personal' | 'cli';

export interface BudgetPolicy {
  stepBudget: number;
  retryBudget: number;
  sourceBudget: number;
  maxCostPerTaskUsd: number;
  fallbackModelId: string;
}

export interface PolicyConfig {
  approvalMode: 'strict' | 'balanced' | 'auto';
  skillInstallMode: 'manual' | 'low-risk-auto';
  learningMode: 'controlled' | 'aggressive';
  sourcePolicyMode: 'internal-only' | 'controlled-first' | 'open-web-allowed';
  budget: BudgetPolicy;
}

export interface ContextStrategy {
  maxTokens: number;
  recentTurns: number;
  summaryInterval: number;
  ragTopK: number;
  compressionModel: string;
}

export interface RuntimeSettingsOverrides {
  profile?: RuntimeProfile;
  workspaceRoot?: string;
  memoryFilePath?: string;
  rulesFilePath?: string;
  tasksStateFilePath?: string;
  semanticCacheFilePath?: string;
  skillsRoot?: string;
  pluginsLabRoot?: string;
  skillSourcesRoot?: string;
  skillPackagesRoot?: string;
  skillReceiptsRoot?: string;
  skillInternalRoot?: string;
  registryFilePath?: string;
  port?: number;
  llmProvider?: 'zhipu';
  zhipuApiKey?: string;
  zhipuApiBaseUrl?: string;
  zhipuModels?: RuntimeSettings['zhipuModels'];
  zhipuThinking?: RuntimeSettings['zhipuThinking'];
  providers?: ProviderSettingsRecord[];
  routing?: Partial<Record<'manager' | 'research' | 'executor' | 'reviewer', RoutingPolicyRecord>>;
  policy?: Partial<PolicyConfig>;
  contextStrategy?: Partial<ContextStrategy>;
}

export interface LoadSettingsOptions {
  env?: NodeJS.ProcessEnv;
  workspaceRoot?: string;
  profile?: RuntimeProfile;
  overrides?: RuntimeSettingsOverrides;
}

function findWorkspaceRoot(startDir = process.cwd()): string {
  let current = resolve(startDir);

  while (true) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return resolve(startDir);
    }

    current = parent;
  }
}

function parseDotEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {};
  }

  const raw = readFileSync(filePath, 'utf8');
  const normalized = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  const entries: Record<string, string> = {};

  for (const line of normalized.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    entries[key] = value;
  }

  return entries;
}

function resolveRuntimeEnv(env: NodeJS.ProcessEnv, workspaceRoot: string): NodeJS.ProcessEnv {
  const envFileValues = parseDotEnvFile(join(workspaceRoot, '.env'));
  return {
    ...envFileValues,
    ...env
  };
}

/** 在 POSIX 上 path.isAbsolute 不认为 D:/foo 为绝对路径，但配置里常见 Windows 盘符路径，CI（Linux）也需按绝对路径处理 */
function isAbsolutePathCrossPlatform(pathValue: string): boolean {
  if (isAbsolute(pathValue)) {
    return true;
  }
  return /^[A-Za-z]:[/\\]/.test(pathValue);
}

function resolveFromWorkspaceRoot(pathValue: string, workspaceRoot: string): string {
  if (isAbsolutePathCrossPlatform(pathValue)) {
    return pathValue;
  }

  return resolve(workspaceRoot, pathValue);
}

function normalizeProviderBaseUrl(url?: string, providerType?: ProviderSettingsRecord['type']): string | undefined {
  if (!url) {
    return undefined;
  }

  const trimmed = url.trim().replace(/\/+$/, '');
  if (providerType === 'zhipu') {
    return trimmed
      .replace('/api/coding/paas/v4/chat/completions', '/api/paas/v4/chat/completions')
      .replace('/api/coding/paas/v4', '/api/paas/v4');
  }

  return trimmed;
}

function buildProviderAuditAdapters(runtimeEnv: NodeJS.ProcessEnv) {
  const adapters: Array<{
    provider: string;
    endpoint: string;
    apiKey: string;
    source: string;
  }> = [];

  const pushAdapter = (provider: string, endpoint: string | undefined, apiKey: string | undefined, source: string) => {
    if (!endpoint) {
      return;
    }
    adapters.push({
      provider,
      endpoint,
      apiKey: apiKey ?? '',
      source
    });
  };

  pushAdapter(
    'zhipu',
    runtimeEnv.ZHIPU_USAGE_AUDIT_HTTP_ENDPOINT,
    runtimeEnv.ZHIPU_USAGE_AUDIT_HTTP_API_KEY ?? runtimeEnv.ZHIPU_API_KEY,
    'zhipu-http'
  );
  pushAdapter(
    'openai',
    runtimeEnv.OPENAI_USAGE_AUDIT_HTTP_ENDPOINT,
    runtimeEnv.OPENAI_USAGE_AUDIT_HTTP_API_KEY ?? runtimeEnv.OPENAI_API_KEY,
    'openai-http'
  );
  pushAdapter(
    'anthropic',
    runtimeEnv.ANTHROPIC_USAGE_AUDIT_HTTP_ENDPOINT,
    runtimeEnv.ANTHROPIC_USAGE_AUDIT_HTTP_API_KEY ?? runtimeEnv.ANTHROPIC_API_KEY,
    'anthropic-http'
  );
  pushAdapter(
    runtimeEnv.CUSTOM_PROVIDER_AUDIT_NAME ?? 'custom',
    runtimeEnv.CUSTOM_PROVIDER_AUDIT_HTTP_ENDPOINT,
    runtimeEnv.CUSTOM_PROVIDER_AUDIT_HTTP_API_KEY,
    'custom-http'
  );

  return adapters;
}

export interface RuntimeSettings {
  profile: RuntimeProfile;
  workspaceRoot: string;
  memoryFilePath: string;
  rulesFilePath: string;
  tasksStateFilePath: string;
  semanticCacheFilePath: string;
  skillsRoot: string;
  pluginsLabRoot: string;
  skillSourcesRoot: string;
  skillPackagesRoot: string;
  skillReceiptsRoot: string;
  skillInternalRoot: string;
  registryFilePath: string;
  port: number;
  llmProvider: 'zhipu';
  zhipuApiKey: string;
  zhipuApiBaseUrl: string;
  zhipuModels: {
    manager: string;
    research: string;
    executor: string;
    reviewer: string;
  };
  zhipuThinking: {
    manager: boolean;
    research: boolean;
    executor: boolean;
    reviewer: boolean;
  };
  providers: ProviderSettingsRecord[];
  routing: Partial<Record<'manager' | 'research' | 'executor' | 'reviewer', RoutingPolicyRecord>>;
  policy: PolicyConfig;
  contextStrategy: ContextStrategy;
  mcp: {
    bigmodelApiKey: string;
    webSearchEndpoint: string;
    webReaderEndpoint: string;
    zreadEndpoint: string;
    researchHttpEndpoint: string;
    researchHttpApiKey: string;
    visionMode: 'ZHIPU' | 'ZAI';
    stdioSessionIdleTtlMs: number;
    stdioSessionMaxCount: number;
  };
  providerAudit: {
    primaryProvider: string;
    adapters: Array<{
      provider: string;
      endpoint: string;
      apiKey: string;
      source: string;
    }>;
  };
}

function buildProfileOverrides(profile: RuntimeProfile): RuntimeSettingsOverrides {
  switch (profile) {
    case 'company':
      return {
        memoryFilePath: 'data/agent-work/memory/records.jsonl',
        rulesFilePath: 'data/agent-work/rules/rules.jsonl',
        tasksStateFilePath: 'data/agent-work/runtime/tasks-state.json',
        semanticCacheFilePath: 'data/agent-work/runtime/semantic-cache.json',
        skillsRoot: 'data/agent-work/skills',
        pluginsLabRoot: 'data/agent-work/skills/plugins-lab',
        skillSourcesRoot: 'data/agent-work/skills/remote-sources',
        skillPackagesRoot: 'data/agent-work/skills/installed',
        skillReceiptsRoot: 'data/agent-work/skills/receipts',
        skillInternalRoot: 'data/agent-work/skills/installed/internal',
        registryFilePath: 'data/agent-work/skills/registry.json',
        policy: {
          approvalMode: 'strict',
          skillInstallMode: 'manual',
          learningMode: 'controlled',
          sourcePolicyMode: 'internal-only',
          budget: {
            stepBudget: 8,
            retryBudget: 1,
            sourceBudget: 6,
            maxCostPerTaskUsd: 2,
            fallbackModelId: 'glm-4.7-flash'
          }
        }
      };
    case 'personal':
      return {
        memoryFilePath: 'data/agent-personal/memory/records.jsonl',
        rulesFilePath: 'data/agent-personal/rules/rules.jsonl',
        tasksStateFilePath: 'data/agent-personal/runtime/tasks-state.json',
        semanticCacheFilePath: 'data/agent-personal/runtime/semantic-cache.json',
        skillsRoot: 'data/agent-personal/skills',
        pluginsLabRoot: 'data/agent-personal/skills/plugins-lab',
        skillSourcesRoot: 'data/agent-personal/skills/remote-sources',
        skillPackagesRoot: 'data/agent-personal/skills/installed',
        skillReceiptsRoot: 'data/agent-personal/skills/receipts',
        skillInternalRoot: 'data/agent-personal/skills/installed/internal',
        registryFilePath: 'data/agent-personal/skills/registry.json',
        policy: {
          approvalMode: 'auto',
          skillInstallMode: 'low-risk-auto',
          learningMode: 'aggressive',
          sourcePolicyMode: 'open-web-allowed',
          budget: {
            stepBudget: 12,
            retryBudget: 2,
            sourceBudget: 12,
            maxCostPerTaskUsd: 1,
            fallbackModelId: 'glm-4.7-flash'
          }
        }
      };
    case 'cli':
      return {
        policy: {
          approvalMode: 'balanced',
          skillInstallMode: 'manual',
          learningMode: 'controlled',
          sourcePolicyMode: 'controlled-first',
          budget: {
            stepBudget: 6,
            retryBudget: 1,
            sourceBudget: 4,
            maxCostPerTaskUsd: 1.5,
            fallbackModelId: 'glm-4.7-flash'
          }
        }
      };
    case 'platform':
    default:
      return {
        policy: {
          approvalMode: 'balanced',
          skillInstallMode: 'manual',
          learningMode: 'controlled',
          sourcePolicyMode: 'controlled-first',
          budget: {
            stepBudget: 8,
            retryBudget: 1,
            sourceBudget: 8,
            maxCostPerTaskUsd: 2,
            fallbackModelId: 'glm-4.7-flash'
          }
        }
      };
  }
}

function parseProvidersConfig(
  runtimeEnv: NodeJS.ProcessEnv,
  workspaceRoot: string,
  zhipuModels: RuntimeSettings['zhipuModels']
): ProviderSettingsRecord[] {
  const configPath = runtimeEnv.PROVIDERS_CONFIG_PATH;
  if (configPath) {
    try {
      const resolvedPath = resolveFromWorkspaceRoot(configPath, workspaceRoot);
      const raw = readFileSync(resolvedPath, 'utf8');
      const parsed = JSON.parse(raw) as { providers?: ProviderSettingsRecord[] } | ProviderSettingsRecord[];
      const providers = Array.isArray(parsed) ? parsed : parsed.providers;
      if (Array.isArray(providers) && providers.length > 0) {
        return providers;
      }
    } catch {
      // Fall through to env-backed defaults when external config cannot be read.
    }
  }

  const providers: ProviderSettingsRecord[] = [];
  if (runtimeEnv.ZHIPU_API_KEY) {
    providers.push({
      id: 'zhipu',
      type: 'zhipu',
      displayName: 'ZhiPu',
      apiKey: runtimeEnv.ZHIPU_API_KEY,
      baseUrl: normalizeProviderBaseUrl(
        runtimeEnv.ZHIPU_API_BASE_URL ?? 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        'zhipu'
      ),
      models: Array.from(new Set(Object.values(zhipuModels))),
      roleModels: zhipuModels
    });
  }

  if (runtimeEnv.OPENAI_API_KEY) {
    providers.push({
      id: 'openai',
      type: 'openai',
      displayName: 'OpenAI',
      apiKey: runtimeEnv.OPENAI_API_KEY,
      models: [
        runtimeEnv.OPENAI_MANAGER_MODEL,
        runtimeEnv.OPENAI_RESEARCH_MODEL,
        runtimeEnv.OPENAI_EXECUTOR_MODEL,
        runtimeEnv.OPENAI_REVIEWER_MODEL
      ].filter((value): value is string => Boolean(value))
    });
  }

  if (runtimeEnv.OPENAI_COMPATIBLE_API_KEY || runtimeEnv.OPENAI_COMPATIBLE_BASE_URL) {
    providers.push({
      id: runtimeEnv.OPENAI_COMPATIBLE_PROVIDER_ID ?? 'openai-compatible',
      type: 'openai-compatible',
      displayName: runtimeEnv.OPENAI_COMPATIBLE_PROVIDER_NAME ?? 'OpenAI Compatible',
      apiKey: runtimeEnv.OPENAI_COMPATIBLE_API_KEY ?? '',
      baseUrl: normalizeProviderBaseUrl(runtimeEnv.OPENAI_COMPATIBLE_BASE_URL, 'openai-compatible'),
      models: [
        runtimeEnv.OPENAI_COMPATIBLE_MANAGER_MODEL,
        runtimeEnv.OPENAI_COMPATIBLE_RESEARCH_MODEL,
        runtimeEnv.OPENAI_COMPATIBLE_EXECUTOR_MODEL,
        runtimeEnv.OPENAI_COMPATIBLE_REVIEWER_MODEL
      ].filter((value): value is string => Boolean(value))
    });
  }

  if (runtimeEnv.OLLAMA_BASE_URL || runtimeEnv.OLLAMA_MODEL) {
    providers.push({
      id: 'ollama',
      type: 'ollama',
      displayName: 'Ollama',
      apiKey: runtimeEnv.OLLAMA_API_KEY ?? '',
      baseUrl: normalizeProviderBaseUrl(runtimeEnv.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1', 'ollama'),
      models: [runtimeEnv.OLLAMA_MODEL ?? 'qwen2.5']
    });
  }

  return providers;
}

function parseRoutingConfig(
  runtimeEnv: NodeJS.ProcessEnv,
  zhipuModels: RuntimeSettings['zhipuModels']
): Partial<Record<'manager' | 'research' | 'executor' | 'reviewer', RoutingPolicyRecord>> {
  const fallback = (value?: string): string[] | undefined =>
    value
      ?.split(',')
      .map(item => item.trim())
      .filter(Boolean);

  return {
    manager: {
      primary: runtimeEnv.MODEL_ROUTE_MANAGER_PRIMARY ?? `zhipu/${zhipuModels.manager}`,
      fallback: fallback(runtimeEnv.MODEL_ROUTE_MANAGER_FALLBACK)
    },
    research: {
      primary: runtimeEnv.MODEL_ROUTE_RESEARCH_PRIMARY ?? `zhipu/${zhipuModels.research}`,
      fallback: fallback(runtimeEnv.MODEL_ROUTE_RESEARCH_FALLBACK)
    },
    executor: {
      primary: runtimeEnv.MODEL_ROUTE_EXECUTOR_PRIMARY ?? `zhipu/${zhipuModels.executor}`,
      fallback: fallback(runtimeEnv.MODEL_ROUTE_EXECUTOR_FALLBACK)
    },
    reviewer: {
      primary: runtimeEnv.MODEL_ROUTE_REVIEWER_PRIMARY ?? `zhipu/${zhipuModels.reviewer}`,
      fallback: fallback(runtimeEnv.MODEL_ROUTE_REVIEWER_FALLBACK)
    }
  };
}

export function loadSettings(input: NodeJS.ProcessEnv | LoadSettingsOptions = process.env): RuntimeSettings {
  const options =
    'env' in input || 'workspaceRoot' in input || 'overrides' in input
      ? (input as LoadSettingsOptions)
      : { env: input as NodeJS.ProcessEnv };
  const profile = options.profile ?? options.overrides?.profile ?? 'platform';
  const profileOverrides = buildProfileOverrides(profile);
  const normalizedPolicy: Partial<PolicyConfig> = {
    ...profileOverrides.policy,
    ...options.overrides?.policy,
    budget: {
      stepBudget: options.overrides?.policy?.budget?.stepBudget ?? profileOverrides.policy?.budget?.stepBudget ?? 8,
      retryBudget: options.overrides?.policy?.budget?.retryBudget ?? profileOverrides.policy?.budget?.retryBudget ?? 1,
      sourceBudget:
        options.overrides?.policy?.budget?.sourceBudget ?? profileOverrides.policy?.budget?.sourceBudget ?? 8,
      maxCostPerTaskUsd:
        options.overrides?.policy?.budget?.maxCostPerTaskUsd ?? profileOverrides.policy?.budget?.maxCostPerTaskUsd ?? 2,
      fallbackModelId:
        options.overrides?.policy?.budget?.fallbackModelId ??
        profileOverrides.policy?.budget?.fallbackModelId ??
        'glm-4.7-flash'
    }
  };
  const mergedOverrides = {
    ...profileOverrides,
    ...options.overrides,
    policy: normalizedPolicy
  };
  const workspaceRoot = findWorkspaceRoot(options.workspaceRoot ?? mergedOverrides.workspaceRoot ?? process.cwd());
  const runtimeEnv = resolveRuntimeEnv(options.env ?? process.env, workspaceRoot);
  const zhipuModels: RuntimeSettings['zhipuModels'] = {
    manager: runtimeEnv.ZHIPU_MANAGER_MODEL ?? 'glm-5',
    research: runtimeEnv.ZHIPU_RESEARCH_MODEL ?? 'glm-4.7-flashx',
    executor: runtimeEnv.ZHIPU_EXECUTOR_MODEL ?? 'glm-4.6',
    reviewer: runtimeEnv.ZHIPU_REVIEWER_MODEL ?? 'glm-4.7'
  };
  const overrides = mergedOverrides;
  const providers = overrides.providers ?? parseProvidersConfig(runtimeEnv, workspaceRoot, zhipuModels);
  const routing = overrides.routing ?? parseRoutingConfig(runtimeEnv, zhipuModels);

  return {
    profile,
    workspaceRoot,
    memoryFilePath: resolveFromWorkspaceRoot(
      overrides.memoryFilePath ?? runtimeEnv.MEMORY_FILE_PATH ?? DEFAULT_DATA_PATHS.memoryFilePath,
      workspaceRoot
    ),
    rulesFilePath: resolveFromWorkspaceRoot(
      overrides.rulesFilePath ?? runtimeEnv.RULES_FILE_PATH ?? DEFAULT_DATA_PATHS.rulesFilePath,
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
    port: overrides.port ?? Number(runtimeEnv.PORT ?? 3000),
    llmProvider: overrides.llmProvider ?? 'zhipu',
    zhipuApiKey: overrides.zhipuApiKey ?? runtimeEnv.ZHIPU_API_KEY ?? '',
    zhipuApiBaseUrl:
      normalizeProviderBaseUrl(
        overrides.zhipuApiBaseUrl ??
          runtimeEnv.ZHIPU_API_BASE_URL ??
          'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        'zhipu'
      ) ?? 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
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
        runtimeEnv.CONTEXT_COMPRESSION_MODEL ?? overrides.contextStrategy?.compressionModel ?? zhipuModels.research
    },
    mcp: {
      bigmodelApiKey: runtimeEnv.MCP_BIGMODEL_API_KEY ?? runtimeEnv.ZHIPU_API_KEY ?? '',
      webSearchEndpoint:
        runtimeEnv.MCP_BIGMODEL_WEB_SEARCH_ENDPOINT ?? 'https://open.bigmodel.cn/api/mcp/web_search_prime/mcp',
      webReaderEndpoint:
        runtimeEnv.MCP_BIGMODEL_WEB_READER_ENDPOINT ?? 'https://open.bigmodel.cn/api/mcp/web_reader/mcp',
      zreadEndpoint: runtimeEnv.MCP_BIGMODEL_ZREAD_ENDPOINT ?? 'https://open.bigmodel.cn/api/mcp/zread/mcp',
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
