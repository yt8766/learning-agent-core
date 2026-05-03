import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import type { ProviderSettingsRecord, RoutingPolicyRecord, RuntimeSettings } from '../schemas/settings.types';

export function findWorkspaceRoot(startDir = process.cwd()): string {
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

export function parseDotEnvFile(filePath: string): Record<string, string> {
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

export function resolveRuntimeEnv(env: NodeJS.ProcessEnv, workspaceRoot: string): NodeJS.ProcessEnv {
  const envFileValues = parseDotEnvFile(join(workspaceRoot, '.env'));
  return {
    ...envFileValues,
    ...env
  };
}

/** 在 POSIX 上 path.isAbsolute 不认为 D:/foo 为绝对路径，但配置里常见 Windows 盘符路径，CI（Linux）也需按绝对路径处理 */
export function isAbsolutePathCrossPlatform(pathValue: string): boolean {
  if (isAbsolute(pathValue)) {
    return true;
  }
  return /^[A-Za-z]:[/\\]/.test(pathValue);
}

export function resolveFromWorkspaceRoot(pathValue: string, workspaceRoot: string): string {
  if (isAbsolutePathCrossPlatform(pathValue)) {
    return pathValue;
  }

  return resolve(workspaceRoot, pathValue);
}

export function normalizeProviderBaseUrl(
  url?: string,
  providerType?: ProviderSettingsRecord['type']
): string | undefined {
  if (!url) {
    return undefined;
  }

  const trimmed = url.trim().replace(/\/+$/, '');
  if (providerType === 'zhipu') {
    return trimmed;
  }

  return trimmed;
}

export function buildProviderAuditAdapters(runtimeEnv: NodeJS.ProcessEnv) {
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
    'kimi',
    runtimeEnv.KIMI_USAGE_AUDIT_HTTP_ENDPOINT,
    runtimeEnv.KIMI_USAGE_AUDIT_HTTP_API_KEY ?? runtimeEnv.KIMI_API_KEY,
    'kimi-http'
  );
  pushAdapter(
    runtimeEnv.CUSTOM_PROVIDER_AUDIT_NAME ?? 'custom',
    runtimeEnv.CUSTOM_PROVIDER_AUDIT_HTTP_ENDPOINT,
    runtimeEnv.CUSTOM_PROVIDER_AUDIT_HTTP_API_KEY,
    'custom-http'
  );

  return adapters;
}

export function parseProvidersConfig(
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
      baseUrl: normalizeProviderBaseUrl(runtimeEnv.ZHIPU_API_BASE_URL, 'zhipu'),
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

  if (runtimeEnv.ANTHROPIC_API_KEY || runtimeEnv.ANTHROPIC_BASE_URL) {
    const anthropicRoleModels = {
      manager: runtimeEnv.ANTHROPIC_MANAGER_MODEL ?? 'claude-3-7-sonnet-latest',
      research: runtimeEnv.ANTHROPIC_RESEARCH_MODEL ?? 'claude-3-5-sonnet-latest',
      executor: runtimeEnv.ANTHROPIC_EXECUTOR_MODEL ?? 'claude-3-5-haiku-latest',
      reviewer: runtimeEnv.ANTHROPIC_REVIEWER_MODEL ?? 'claude-3-7-sonnet-latest'
    } satisfies NonNullable<ProviderSettingsRecord['roleModels']>;

    providers.push({
      id: runtimeEnv.ANTHROPIC_PROVIDER_ID ?? 'anthropic',
      type: 'anthropic',
      displayName: runtimeEnv.ANTHROPIC_PROVIDER_NAME ?? 'Anthropic',
      apiKey: runtimeEnv.ANTHROPIC_API_KEY ?? '',
      baseUrl: normalizeProviderBaseUrl(runtimeEnv.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com/v1', 'anthropic'),
      models: Array.from(new Set(Object.values(anthropicRoleModels))),
      roleModels: anthropicRoleModels
    });
  }

  if (runtimeEnv.MINIMAX_API_KEY || runtimeEnv.MINIMAX_BASE_URL) {
    const minimaxRoleModels = {
      manager: runtimeEnv.MINIMAX_MANAGER_MODEL || 'MiniMax-M2.7',
      research: runtimeEnv.MINIMAX_RESEARCH_MODEL || 'MiniMax-M2.5',
      executor: runtimeEnv.MINIMAX_EXECUTOR_MODEL || 'MiniMax-M2.5-highspeed',
      reviewer: runtimeEnv.MINIMAX_REVIEWER_MODEL || 'MiniMax-M2.7-highspeed'
    } satisfies NonNullable<ProviderSettingsRecord['roleModels']>;

    providers.push({
      id: runtimeEnv.MINIMAX_PROVIDER_ID || 'minimax',
      type: 'minimax',
      displayName: runtimeEnv.MINIMAX_PROVIDER_NAME || 'MiniMax',
      apiKey: runtimeEnv.MINIMAX_API_KEY ?? '',
      baseUrl: normalizeProviderBaseUrl(runtimeEnv.MINIMAX_BASE_URL ?? 'https://api.minimax.io/v1', 'minimax'),
      models: Array.from(new Set([...Object.values(minimaxRoleModels), runtimeEnv.MINIMAX_DIALOG_MODEL || 'M2-her'])),
      roleModels: minimaxRoleModels
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

  if (runtimeEnv.KIMI_API_KEY || runtimeEnv.KIMI_BASE_URL) {
    const kimiRoleModels = {
      manager: runtimeEnv.KIMI_MANAGER_MODEL || 'kimi-k2.6',
      research: runtimeEnv.KIMI_RESEARCH_MODEL || 'kimi-k2.6',
      executor: runtimeEnv.KIMI_EXECUTOR_MODEL || 'kimi-k2.6',
      reviewer: runtimeEnv.KIMI_REVIEWER_MODEL || 'kimi-k2.6'
    } satisfies NonNullable<ProviderSettingsRecord['roleModels']>;

    providers.push({
      id: runtimeEnv.KIMI_PROVIDER_ID || 'kimi',
      type: 'kimi',
      displayName: runtimeEnv.KIMI_PROVIDER_NAME || 'Kimi',
      apiKey: runtimeEnv.KIMI_API_KEY ?? '',
      baseUrl: normalizeProviderBaseUrl(runtimeEnv.KIMI_BASE_URL ?? 'https://api.moonshot.cn/v1', 'kimi'),
      models: Array.from(new Set(Object.values(kimiRoleModels))),
      roleModels: kimiRoleModels
    });
  }

  return providers;
}

export function parseRoutingConfig(
  runtimeEnv: NodeJS.ProcessEnv,
  zhipuModels: RuntimeSettings['zhipuModels'],
  providers: ProviderSettingsRecord[]
): Partial<Record<'manager' | 'research' | 'executor' | 'reviewer', RoutingPolicyRecord>> {
  const fallback = (value?: string): string[] | undefined =>
    value
      ?.split(',')
      .map(item => item.trim())
      .filter(Boolean);

  const activeProvider = runtimeEnv.ACTIVE_MODEL_PROVIDER?.trim();
  const activeProviderConfig =
    activeProvider && activeProvider.length > 0
      ? providers.find(provider => provider.id === activeProvider)
      : undefined;

  const resolvePrimaryModel = (role: 'manager' | 'research' | 'executor' | 'reviewer', zhipuModel: string): string => {
    const activeRoleModel = activeProviderConfig?.roleModels?.[role];
    if (activeProviderConfig?.id && activeRoleModel) {
      return `${activeProviderConfig.id}/${activeRoleModel}`;
    }
    return `zhipu/${zhipuModel}`;
  };

  return {
    manager: {
      primary: runtimeEnv.MODEL_ROUTE_MANAGER_PRIMARY ?? resolvePrimaryModel('manager', zhipuModels.manager),
      fallback: fallback(runtimeEnv.MODEL_ROUTE_MANAGER_FALLBACK)
    },
    research: {
      primary: runtimeEnv.MODEL_ROUTE_RESEARCH_PRIMARY ?? resolvePrimaryModel('research', zhipuModels.research),
      fallback: fallback(runtimeEnv.MODEL_ROUTE_RESEARCH_FALLBACK)
    },
    executor: {
      primary: runtimeEnv.MODEL_ROUTE_EXECUTOR_PRIMARY ?? resolvePrimaryModel('executor', zhipuModels.executor),
      fallback: fallback(runtimeEnv.MODEL_ROUTE_EXECUTOR_FALLBACK)
    },
    reviewer: {
      primary: runtimeEnv.MODEL_ROUTE_REVIEWER_PRIMARY ?? resolvePrimaryModel('reviewer', zhipuModels.reviewer),
      fallback: fallback(runtimeEnv.MODEL_ROUTE_REVIEWER_FALLBACK)
    }
  };
}

export type ActiveRoleModels = Record<'manager' | 'research' | 'executor' | 'reviewer', string>;

/**
 * Extracts the active model ID per role from the routing configuration.
 * When `ACTIVE_MODEL_PROVIDER=minimax`, routing.manager.primary = `minimax/MiniMax-M2.7`,
 * so this returns `MiniMax-M2.7`. Falls back to zhipuModels when routing is absent.
 */
export function resolveActiveRoleModels(settings?: RuntimeSettings | null): ActiveRoleModels {
  const roles = ['manager', 'research', 'executor', 'reviewer'] as const;
  const result = {} as ActiveRoleModels;

  for (const role of roles) {
    const primary = settings?.routing?.[role]?.primary;
    if (primary) {
      const slashIndex = primary.indexOf('/');
      result[role] = slashIndex >= 0 ? primary.slice(slashIndex + 1) : primary;
    } else {
      result[role] = settings?.zhipuModels?.[role] ?? '';
    }
  }

  return result;
}
