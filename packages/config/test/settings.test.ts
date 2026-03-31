import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadSettings } from '../src/settings';

/** 与 settings.findWorkspaceRoot 一致：从启动时的 cwd 向上找 pnpm-workspace.yaml（避免硬编码盘符与目录名） */
function resolveMonorepoRootFromCwd(): string {
  let current = resolve(process.cwd());
  while (true) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new Error('无法定位 monorepo 根：从 process.cwd() 向上未找到 pnpm-workspace.yaml');
    }
    current = parent;
  }
}

const REPO_ROOT = resolveMonorepoRootFromCwd();
const BACKEND_AGENT_SERVER_CWD = join(REPO_ROOT, 'apps', 'backend', 'agent-server');

const ORIGINAL_CWD = process.cwd();

function toPosixPath(p: string): string {
  return p.replace(/\\/g, '/');
}

describe('loadSettings', () => {
  afterEach(() => {
    process.chdir(ORIGINAL_CWD);
  });

  it('从后端目录启动时仍然把数据路径解析到仓库根级 data 目录', () => {
    process.chdir(BACKEND_AGENT_SERVER_CWD);

    const settings = loadSettings({ PORT: '3000' } as NodeJS.ProcessEnv);

    expect(toPosixPath(settings.workspaceRoot)).toBe(toPosixPath(REPO_ROOT));
    expect(toPosixPath(settings.tasksStateFilePath)).toBe(
      toPosixPath(join(REPO_ROOT, 'data', 'runtime', 'tasks-state.json'))
    );
    expect(toPosixPath(settings.memoryFilePath)).toBe(toPosixPath(join(REPO_ROOT, 'data', 'memory', 'records.jsonl')));
    expect(toPosixPath(settings.skillsRoot)).toBe(toPosixPath(join(REPO_ROOT, 'data', 'skills')));
  });

  it('保留显式传入的绝对路径配置', () => {
    const settings = loadSettings({
      PORT: '3001',
      TASKS_STATE_FILE_PATH: 'D:/custom/runtime/tasks.json',
      MEMORY_FILE_PATH: 'D:/custom/memory/records.jsonl'
    } as NodeJS.ProcessEnv);

    expect(settings.port).toBe(3001);
    expect(settings.tasksStateFilePath.replace(/\\/g, '/')).toBe('D:/custom/runtime/tasks.json');
    expect(settings.memoryFilePath.replace(/\\/g, '/')).toBe('D:/custom/memory/records.jsonl');
  });

  it('支持 research MCP 的 HTTP 配置', () => {
    const settings = loadSettings({
      ZHIPU_API_KEY: 'platform-token',
      MCP_RESEARCH_HTTP_ENDPOINT: 'https://mcp.example.com/research',
      MCP_RESEARCH_HTTP_API_KEY: 'secret-token',
      MCP_STDIO_SESSION_IDLE_TTL_MS: '60000',
      MCP_STDIO_SESSION_MAX_COUNT: '6',
      PROVIDER_AUDIT_PRIMARY: 'zhipu',
      ZHIPU_USAGE_AUDIT_HTTP_ENDPOINT: 'https://audit.example.com/zhipu',
      OPENAI_USAGE_AUDIT_HTTP_ENDPOINT: 'https://audit.example.com/openai'
    } as NodeJS.ProcessEnv);

    expect(settings.mcp.bigmodelApiKey).toBe('platform-token');
    expect(settings.mcp.webSearchEndpoint).toBe('https://open.bigmodel.cn/api/mcp/web_search_prime/mcp');
    expect(settings.mcp.webReaderEndpoint).toBe('https://open.bigmodel.cn/api/mcp/web_reader/mcp');
    expect(settings.mcp.zreadEndpoint).toBe('https://open.bigmodel.cn/api/mcp/zread/mcp');
    expect(settings.mcp.researchHttpEndpoint).toBe('https://mcp.example.com/research');
    expect(settings.mcp.researchHttpApiKey).toBe('secret-token');
    expect(settings.mcp.stdioSessionIdleTtlMs).toBe(60000);
    expect(settings.mcp.stdioSessionMaxCount).toBe(6);
    expect(settings.providerAudit.primaryProvider).toBe('zhipu');
    expect(settings.providerAudit.adapters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'zhipu',
          endpoint: 'https://audit.example.com/zhipu',
          source: 'zhipu-http'
        }),
        expect.objectContaining({
          provider: 'openai',
          endpoint: 'https://audit.example.com/openai',
          source: 'openai-http'
        })
      ])
    );
  });

  it('支持显式 workspaceRoot 和 overrides 注入', () => {
    const settings = loadSettings({
      workspaceRoot: REPO_ROOT,
      env: {
        PORT: '4000'
      } as NodeJS.ProcessEnv,
      overrides: {
        memoryFilePath: 'tmp/personal-memory.jsonl',
        skillsRoot: 'tmp/personal-skills'
      }
    });

    expect(settings.port).toBe(4000);
    expect(toPosixPath(settings.memoryFilePath)).toBe(toPosixPath(join(REPO_ROOT, 'tmp', 'personal-memory.jsonl')));
    expect(toPosixPath(settings.skillsRoot)).toBe(toPosixPath(join(REPO_ROOT, 'tmp', 'personal-skills')));
  });

  it('显式传入后端子目录作为 workspaceRoot 时，仍会自动提升到 monorepo 根并读取根 .env', () => {
    const settings = loadSettings({
      workspaceRoot: BACKEND_AGENT_SERVER_CWD,
      env: {
        PORT: '4100'
      } as NodeJS.ProcessEnv
    });

    expect(toPosixPath(settings.workspaceRoot)).toBe(toPosixPath(REPO_ROOT));
    expect(settings.zhipuApiKey).toBeTruthy();
    expect(toPosixPath(settings.tasksStateFilePath)).toBe(
      toPosixPath(join(REPO_ROOT, 'data', 'runtime', 'tasks-state.json'))
    );
  });

  it('personal profile applies isolated data paths and relaxed policy defaults', () => {
    const settings = loadSettings({
      workspaceRoot: REPO_ROOT,
      profile: 'personal',
      env: {} as NodeJS.ProcessEnv
    });

    expect(settings.profile).toBe('personal');
    expect(toPosixPath(settings.memoryFilePath)).toBe(
      toPosixPath(join(REPO_ROOT, 'data', 'agent-personal', 'memory', 'records.jsonl'))
    );
    expect(settings.policy.approvalMode).toBe('auto');
    expect(settings.policy.sourcePolicyMode).toBe('open-web-allowed');
    expect(settings.policy.memoryPolicy.localFirst).toBe(true);
    expect(settings.policy.learningPolicy.autoLearnPreferences).toBe(true);
    expect(settings.policy.learningPolicy.autoLearnHeuristics).toBe(true);
    expect(settings.policy.learningPolicy.autoLearnTaskExperience).toBe(true);
    expect(settings.policy.approvalPolicy.safeWriteAutoApprove).toBe(true);
    expect(settings.policy.approvalPolicy.destructiveActionRequireApproval).toBe(true);
    expect(settings.policy.suggestionPolicy.expertAdviceDefault).toBe(true);
    expect(settings.policy.suggestionPolicy.autoSearchSkillsOnGap).toBe(true);
    expect(settings.policy.budget.stepBudget).toBe(12);
    expect(settings.policy.budget.maxCostPerTaskUsd).toBe(1);
    expect(settings.policy.budget.fallbackModelId).toBe('glm-4.7-flash');
    expect(settings.contextStrategy.ragTopK).toBe(4);
    expect(settings.contextStrategy.recentTurns).toBe(10);
  });

  it('company profile keeps learning and approval defaults conservative', () => {
    const settings = loadSettings({
      workspaceRoot: REPO_ROOT,
      profile: 'company',
      env: {} as NodeJS.ProcessEnv
    });

    expect(settings.policy.memoryPolicy.localFirst).toBe(true);
    expect(settings.policy.learningPolicy.autoLearnPreferences).toBe(true);
    expect(settings.policy.learningPolicy.autoLearnHeuristics).toBe(false);
    expect(settings.policy.learningPolicy.autoLearnTaskExperience).toBe(false);
    expect(settings.policy.approvalPolicy.safeWriteAutoApprove).toBe(false);
    expect(settings.policy.approvalPolicy.destructiveActionRequireApproval).toBe(true);
    expect(settings.policy.suggestionPolicy.expertAdviceDefault).toBe(true);
    expect(settings.policy.suggestionPolicy.autoSearchSkillsOnGap).toBe(true);
  });

  it('支持 runtime background 开关与轮询配置', () => {
    const settings = loadSettings({
      workspaceRoot: REPO_ROOT,
      env: {
        RUNTIME_BACKGROUND_ENABLED: 'false',
        RUNTIME_BACKGROUND_WORKER_POOL_SIZE: '4',
        RUNTIME_BACKGROUND_LEASE_TTL_MS: '45000',
        RUNTIME_BACKGROUND_HEARTBEAT_MS: '15000',
        RUNTIME_BACKGROUND_POLL_MS: '5000',
        RUNTIME_BACKGROUND_RUNNER_ID_PREFIX: 'worker'
      } as NodeJS.ProcessEnv
    });

    expect(settings.runtimeBackground).toEqual({
      enabled: false,
      workerPoolSize: 4,
      leaseTtlMs: 45000,
      heartbeatMs: 15000,
      pollMs: 5000,
      runnerIdPrefix: 'worker'
    });
  });
});
