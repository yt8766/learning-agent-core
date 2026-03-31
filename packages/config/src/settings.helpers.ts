import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import type { ProviderSettingsRecord, RoutingPolicyRecord, RuntimeSettings } from './settings.types';

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
    return trimmed
      .replace('/api/coding/paas/v4/chat/completions', '/api/paas/v4/chat/completions')
      .replace('/api/coding/paas/v4', '/api/paas/v4');
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

export function parseRoutingConfig(
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
