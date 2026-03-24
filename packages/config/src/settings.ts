import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

const DEFAULT_DATA_PATHS = {
  memoryFilePath: 'data/memory/records.jsonl',
  rulesFilePath: 'data/rules/rules.jsonl',
  tasksStateFilePath: 'data/runtime/tasks-state.json',
  skillsRoot: 'data/skills',
  pluginsLabRoot: 'data/skills/plugins-lab',
  registryFilePath: 'data/skills/registry.json'
} as const;

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
  workspaceRoot: string;
  memoryFilePath: string;
  rulesFilePath: string;
  tasksStateFilePath: string;
  skillsRoot: string;
  pluginsLabRoot: string;
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

export function loadSettings(env: NodeJS.ProcessEnv = process.env): RuntimeSettings {
  const workspaceRoot = findWorkspaceRoot();
  const runtimeEnv = resolveRuntimeEnv(env, workspaceRoot);

  return {
    workspaceRoot,
    memoryFilePath: resolveFromWorkspaceRoot(
      runtimeEnv.MEMORY_FILE_PATH ?? DEFAULT_DATA_PATHS.memoryFilePath,
      workspaceRoot
    ),
    rulesFilePath: resolveFromWorkspaceRoot(
      runtimeEnv.RULES_FILE_PATH ?? DEFAULT_DATA_PATHS.rulesFilePath,
      workspaceRoot
    ),
    tasksStateFilePath: resolveFromWorkspaceRoot(
      runtimeEnv.TASKS_STATE_FILE_PATH ?? DEFAULT_DATA_PATHS.tasksStateFilePath,
      workspaceRoot
    ),
    skillsRoot: resolveFromWorkspaceRoot(runtimeEnv.SKILLS_ROOT ?? DEFAULT_DATA_PATHS.skillsRoot, workspaceRoot),
    pluginsLabRoot: resolveFromWorkspaceRoot(
      runtimeEnv.PLUGINS_LAB_ROOT ?? DEFAULT_DATA_PATHS.pluginsLabRoot,
      workspaceRoot
    ),
    registryFilePath: resolveFromWorkspaceRoot(
      runtimeEnv.SKILL_REGISTRY_FILE_PATH ?? DEFAULT_DATA_PATHS.registryFilePath,
      workspaceRoot
    ),
    port: Number(runtimeEnv.PORT ?? 3000),
    llmProvider: 'zhipu',
    zhipuApiKey: runtimeEnv.ZHIPU_API_KEY ?? '',
    zhipuApiBaseUrl: runtimeEnv.ZHIPU_API_BASE_URL ?? 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    zhipuModels: {
      manager: runtimeEnv.ZHIPU_MANAGER_MODEL ?? 'glm-5',
      research: runtimeEnv.ZHIPU_RESEARCH_MODEL ?? 'glm-4.7-flashx',
      executor: runtimeEnv.ZHIPU_EXECUTOR_MODEL ?? 'glm-4.6',
      reviewer: runtimeEnv.ZHIPU_REVIEWER_MODEL ?? 'glm-4.7'
    },
    zhipuThinking: {
      manager: runtimeEnv.ZHIPU_MANAGER_THINKING === 'false' ? false : true,
      research: runtimeEnv.ZHIPU_RESEARCH_THINKING === 'true',
      executor: runtimeEnv.ZHIPU_EXECUTOR_THINKING === 'true',
      reviewer: runtimeEnv.ZHIPU_REVIEWER_THINKING === 'false' ? false : true
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
