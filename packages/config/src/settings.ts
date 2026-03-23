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
    }
  };
}
