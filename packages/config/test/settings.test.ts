import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import { loadSettings, resolveActiveRoleModels } from '@agent/config';
import { parseDotEnvFile } from '../src/utils/settings-helpers';
import { loadSettings as directLoadSettings } from '../src/loaders/settings-loader';
import * as settingsExports from '../src/settings';

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
const ROOT_DOTENV = parseDotEnvFile(join(REPO_ROOT, '.env'));

const ORIGINAL_CWD = process.cwd();

function toPosixPath(p: string): string {
  return p.replace(/\\/g, '/');
}

describe('loadSettings', () => {
  afterEach(() => {
    process.chdir(ORIGINAL_CWD);
    delete process.env.SKILLS_ROOT;
    delete process.env.SKILL_RUNTIME_ROOT;
  });

  it('co-locates settings implementation under src/settings', () => {
    expect(directLoadSettings).toBe(settingsExports.loadSettings);
  });

  it('从后端目录启动时仍然把数据路径解析到仓库根级 data 目录，并尊重根 .env 覆盖', () => {
    process.chdir(BACKEND_AGENT_SERVER_CWD);

    const settings = loadSettings({ PORT: '3000' } as NodeJS.ProcessEnv);

    expect(toPosixPath(settings.workspaceRoot)).toBe(toPosixPath(REPO_ROOT));
    expect(toPosixPath(settings.tasksStateFilePath)).toBe(
      toPosixPath(join(REPO_ROOT, 'data', 'runtime', 'tasks-state.json'))
    );
    expect(toPosixPath(settings.memoryFilePath)).toBe(toPosixPath(join(REPO_ROOT, 'data', 'memory', 'records.jsonl')));
    expect(toPosixPath(settings.vectorIndexFilePath)).toBe(
      toPosixPath(join(REPO_ROOT, 'data', 'memory', 'vector-index.json'))
    );
    const expectedSkillsRoot = join(
      REPO_ROOT,
      ROOT_DOTENV.SKILL_RUNTIME_ROOT ?? ROOT_DOTENV.SKILLS_ROOT ?? 'data/skills'
    );
    expect(toPosixPath(settings.skillsRoot)).toBe(toPosixPath(expectedSkillsRoot));
    expect(toPosixPath(settings.skillPackagesRoot)).toBe(toPosixPath(join(expectedSkillsRoot, 'installed')));
    expect(toPosixPath(settings.skillReceiptsRoot)).toBe(toPosixPath(join(expectedSkillsRoot, 'receipts')));
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
      MCP_BIGMODEL_API_KEY: 'platform-token',
      KNOWLEDGE_EMBEDDING_API_KEY: 'embedding-token',
      KNOWLEDGE_EMBEDDING_ENDPOINT: 'https://mcp.example.com/embeddings',
      MCP_BIGMODEL_WEB_SEARCH_ENDPOINT: 'https://mcp.example.com/web-search',
      MCP_BIGMODEL_WEB_READER_ENDPOINT: 'https://mcp.example.com/web-reader',
      MCP_BIGMODEL_ZREAD_ENDPOINT: 'https://mcp.example.com/zread',
      MCP_RESEARCH_HTTP_ENDPOINT: 'https://mcp.example.com/research',
      MCP_RESEARCH_HTTP_API_KEY: 'secret-token',
      MCP_STDIO_SESSION_IDLE_TTL_MS: '60000',
      MCP_STDIO_SESSION_MAX_COUNT: '6',
      PROVIDER_AUDIT_PRIMARY: 'zhipu',
      ZHIPU_USAGE_AUDIT_HTTP_ENDPOINT: 'https://audit.example.com/zhipu',
      OPENAI_USAGE_AUDIT_HTTP_ENDPOINT: 'https://audit.example.com/openai'
    } as NodeJS.ProcessEnv);

    expect(settings.mcp.bigmodelApiKey).toBe('platform-token');
    expect(settings.embeddings.endpoint).toBe('https://mcp.example.com/embeddings');
    expect(settings.embeddings.apiKey).toBe('embedding-token');
    expect(settings.mcp.webSearchEndpoint).toBe('https://mcp.example.com/web-search');
    expect(settings.mcp.webReaderEndpoint).toBe('https://mcp.example.com/web-reader');
    expect(settings.mcp.zreadEndpoint).toBe('https://mcp.example.com/zread');
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

  it('supports siliconflow embedding provider via env vars', () => {
    const settings = loadSettings({
      KNOWLEDGE_EMBEDDING_PROVIDER: 'siliconflow',
      KNOWLEDGE_EMBEDDING_MODEL: 'BAAI/bge-large-zh-v1.5',
      KNOWLEDGE_EMBEDDING_ENDPOINT: 'https://api.siliconflow.cn/v1/embeddings',
      KNOWLEDGE_EMBEDDING_API_KEY: 'sf-test-key',
      KNOWLEDGE_EMBEDDING_DIMENSIONS: '1024'
    } as NodeJS.ProcessEnv);

    expect(settings.embeddings.provider).toBe('siliconflow');
    expect(settings.embeddings.model).toBe('BAAI/bge-large-zh-v1.5');
    expect(settings.embeddings.endpoint).toBe('https://api.siliconflow.cn/v1/embeddings');
    expect(settings.embeddings.apiKey).toBe('sf-test-key');
    expect(settings.embeddings.dimensions).toBe(1024);
  });

  it('defaults embedding provider to glm when env var is not set', () => {
    const settings = loadSettings({
      env: {
        ACTIVE_MODEL_PROVIDER: '',
        MINIMAX_API_KEY: '',
        KNOWLEDGE_EMBEDDING_PROVIDER: '',
        KNOWLEDGE_EMBEDDING_MODEL: ''
      } as unknown as NodeJS.ProcessEnv
    });

    expect(settings.embeddings.provider).toBe('glm');
    expect(settings.embeddings.model).toBe('Embedding-3');
  });

  it('defaults LangGraph long-term memory store to in-memory semantic search', () => {
    const settings = loadSettings({
      env: {} as NodeJS.ProcessEnv
    });

    expect(settings.langGraphStore.provider).toBe('memory');
    expect(settings.langGraphStore.semanticSearch.enabled).toBe(true);
    expect(settings.langGraphStore.semanticSearch.fields).toEqual(['$.text', '$.summary', '$.content']);
  });

  it('parses LangGraph Postgres long-term memory store with semantic search settings', () => {
    const settings = loadSettings({
      env: {
        LANGGRAPH_STORE: 'postgres',
        LANGGRAPH_STORE_POSTGRES_URI: 'postgresql://postgres:postgres@localhost:5442/postgres?sslmode=disable',
        LANGGRAPH_STORE_POSTGRES_SCHEMA: 'agent_memory',
        LANGGRAPH_STORE_POSTGRES_SETUP_ON_INITIALIZE: 'false',
        LANGGRAPH_STORE_SEMANTIC_SEARCH: 'true',
        LANGGRAPH_STORE_INDEX_FIELDS: '$.data,$.summary',
        LANGGRAPH_STORE_DISTANCE_METRIC: 'inner_product'
      } as NodeJS.ProcessEnv
    });

    expect(settings.langGraphStore).toEqual({
      provider: 'postgres',
      postgres: {
        connectionString: 'postgresql://postgres:postgres@localhost:5442/postgres?sslmode=disable',
        schema: 'agent_memory',
        setupOnInitialize: false
      },
      semanticSearch: {
        enabled: true,
        fields: ['$.data', '$.summary'],
        distanceMetric: 'inner_product'
      }
    });
  });

  it('支持显式 workspaceRoot 和 overrides 注入', () => {
    const settings = loadSettings({
      workspaceRoot: REPO_ROOT,
      env: {
        PORT: '4000'
      } as NodeJS.ProcessEnv,
      overrides: {
        memoryFilePath: 'tmp/personal-memory.jsonl',
        vectorIndexFilePath: 'tmp/personal-vector-index.json',
        skillsRoot: 'tmp/personal-skills'
      }
    });

    expect(settings.port).toBe(4000);
    expect(toPosixPath(settings.memoryFilePath)).toBe(toPosixPath(join(REPO_ROOT, 'tmp', 'personal-memory.jsonl')));
    expect(toPosixPath(settings.vectorIndexFilePath)).toBe(
      toPosixPath(join(REPO_ROOT, 'tmp', 'personal-vector-index.json'))
    );
    expect(toPosixPath(settings.skillsRoot)).toBe(toPosixPath(join(REPO_ROOT, 'tmp', 'personal-skills')));
  });

  it('allows custom provider types through explicit overrides for SDK-style extensions', () => {
    const settings = loadSettings({
      workspaceRoot: REPO_ROOT,
      env: {} as NodeJS.ProcessEnv,
      overrides: {
        providers: [
          {
            id: 'anthropic-custom',
            type: 'anthropic-custom',
            displayName: 'Anthropic Custom',
            apiKey: 'anthropic-key',
            models: ['claude-custom']
          }
        ]
      }
    });

    expect(settings.providers).toEqual([
      expect.objectContaining({
        id: 'anthropic-custom',
        type: 'anthropic-custom',
        models: ['claude-custom']
      })
    ]);
  });

  it('supports Anthropic provider defaults through env-backed provider discovery', () => {
    const settings = loadSettings({
      workspaceRoot: REPO_ROOT,
      env: {
        ANTHROPIC_API_KEY: 'anthropic-key',
        ANTHROPIC_MANAGER_MODEL: 'claude-3-7-sonnet',
        ANTHROPIC_RESEARCH_MODEL: 'claude-3-5-sonnet',
        ANTHROPIC_EXECUTOR_MODEL: 'claude-3-5-haiku',
        ANTHROPIC_REVIEWER_MODEL: 'claude-3-7-sonnet'
      } as NodeJS.ProcessEnv
    });

    expect(settings.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'anthropic',
          type: 'anthropic',
          apiKey: 'anthropic-key',
          models: ['claude-3-7-sonnet', 'claude-3-5-sonnet', 'claude-3-5-haiku']
        })
      ])
    );
  });

  it('显式传入后端子目录作为 workspaceRoot 时，仍会自动提升到 monorepo 根并读取根 .env', () => {
    return (async () => {
      const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-config-root-'));
      const backendRoot = join(workspaceRoot, 'apps', 'backend', 'agent-server');

      try {
        await mkdir(backendRoot, { recursive: true });
        await writeFile(join(workspaceRoot, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n', 'utf8');
        await writeFile(join(workspaceRoot, '.env'), 'ZHIPU_API_KEY=test-zhipu-key\n', 'utf8');

        const settings = loadSettings({
          workspaceRoot: backendRoot,
          env: {
            PORT: '4100'
          } as NodeJS.ProcessEnv
        });

        expect(toPosixPath(settings.workspaceRoot)).toBe(toPosixPath(workspaceRoot));
        expect(settings.zhipuApiKey).toBe('test-zhipu-key');
        expect(toPosixPath(settings.tasksStateFilePath)).toBe(
          toPosixPath(join(workspaceRoot, 'data', 'runtime', 'tasks-state.json'))
        );
        expect(toPosixPath(settings.skillsRoot)).toBe(toPosixPath(join(workspaceRoot, 'data', 'skills')));
      } finally {
        await rm(workspaceRoot, { recursive: true, force: true });
      }
    })();
  });

  it('personal profile applies isolated data paths and relaxed policy defaults', () => {
    const settings = loadSettings({
      workspaceRoot: REPO_ROOT,
      profile: 'personal',
      env: {
        ACTIVE_MODEL_PROVIDER: '',
        MINIMAX_API_KEY: ''
      } as unknown as NodeJS.ProcessEnv
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
    expect(settings.policy.budget.fallbackModelId).toBe('glm-5.1');
    expect(settings.contextStrategy.ragTopK).toBe(4);
    expect(settings.contextStrategy.recentTurns).toBe(10);
    expect(toPosixPath(settings.skillsRoot)).toBe(toPosixPath(join(REPO_ROOT, 'data', 'agent-personal', 'skills')));
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
    expect(toPosixPath(settings.skillsRoot)).toBe(toPosixPath(join(REPO_ROOT, 'data', 'agent-work', 'skills')));
  });

  it('context strategy applies conversation compression defaults and supports env overrides', () => {
    const defaults = loadSettings({
      workspaceRoot: REPO_ROOT,
      env: {} as NodeJS.ProcessEnv
    });

    expect(defaults.contextStrategy.compressionEnabled).toBe(true);
    expect(defaults.contextStrategy.compressionMessageThreshold).toBe(15);
    expect(defaults.contextStrategy.compressionKeepRecentMessages).toBe(5);
    expect(defaults.contextStrategy.compressionKeepLeadingMessages).toBe(10);
    expect(defaults.contextStrategy.compressionMaxSummaryChars).toBe(1200);

    const overridden = loadSettings({
      workspaceRoot: REPO_ROOT,
      env: {
        CONTEXT_COMPRESSION_ENABLED: 'false',
        CONTEXT_COMPRESSION_MESSAGE_THRESHOLD: '22',
        CONTEXT_COMPRESSION_KEEP_RECENT_MESSAGES: '7',
        CONTEXT_COMPRESSION_KEEP_LEADING_MESSAGES: '4',
        CONTEXT_COMPRESSION_MAX_SUMMARY_CHARS: '800'
      } as NodeJS.ProcessEnv
    });

    expect(overridden.contextStrategy.compressionEnabled).toBe(false);
    expect(overridden.contextStrategy.compressionMessageThreshold).toBe(22);
    expect(overridden.contextStrategy.compressionKeepRecentMessages).toBe(7);
    expect(overridden.contextStrategy.compressionKeepLeadingMessages).toBe(4);
    expect(overridden.contextStrategy.compressionMaxSummaryChars).toBe(800);
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

  it('defaults LangGraph checkpoints to memory and supports Postgres env configuration', () => {
    const defaults = loadSettings({
      workspaceRoot: REPO_ROOT,
      env: {} as NodeJS.ProcessEnv
    });

    expect(defaults.langGraphCheckpointer).toEqual({
      provider: 'memory',
      postgres: {
        connectionString: undefined,
        schema: 'public',
        setupOnInitialize: true
      }
    });

    const postgres = loadSettings({
      workspaceRoot: REPO_ROOT,
      env: {
        LANGGRAPH_CHECKPOINTER: 'postgres',
        LANGGRAPH_POSTGRES_URI: 'postgresql://postgres:postgres@localhost:5442/postgres?sslmode=disable',
        LANGGRAPH_POSTGRES_SCHEMA: 'agent_runtime',
        LANGGRAPH_POSTGRES_SETUP_ON_INITIALIZE: 'false'
      } as NodeJS.ProcessEnv
    });

    expect(postgres.langGraphCheckpointer).toEqual({
      provider: 'postgres',
      postgres: {
        connectionString: 'postgresql://postgres:postgres@localhost:5442/postgres?sslmode=disable',
        schema: 'agent_runtime',
        setupOnInitialize: false
      }
    });
  });

  it('supports MiniMax provider defaults through env-backed provider discovery', () => {
    const settings = loadSettings({
      workspaceRoot: REPO_ROOT,
      env: {
        ACTIVE_MODEL_PROVIDER: '',
        MINIMAX_API_KEY: 'minimax-key',
        MINIMAX_BASE_URL: 'https://api.minimaxi.com/v1/',
        MINIMAX_MANAGER_MODEL: '',
        MINIMAX_RESEARCH_MODEL: '',
        MINIMAX_EXECUTOR_MODEL: '',
        MINIMAX_REVIEWER_MODEL: '',
        MINIMAX_DIALOG_MODEL: '',
        MINIMAX_PROVIDER_ID: '',
        MINIMAX_PROVIDER_NAME: ''
      } as unknown as NodeJS.ProcessEnv
    });

    expect(settings.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'minimax',
          type: 'minimax',
          displayName: 'MiniMax',
          apiKey: 'minimax-key',
          baseUrl: 'https://api.minimaxi.com/v1',
          roleModels: {
            manager: 'MiniMax-M2.7',
            research: 'MiniMax-M2.5',
            executor: 'MiniMax-M2.5-highspeed',
            reviewer: 'MiniMax-M2.7-highspeed'
          },
          models: ['MiniMax-M2.7', 'MiniMax-M2.5', 'MiniMax-M2.5-highspeed', 'MiniMax-M2.7-highspeed', 'M2-her']
        })
      ])
    );
  });

  it('defaults MiniMax chat providers to the official global OpenAI-compatible endpoint', () => {
    const settings = loadSettings({
      workspaceRoot: REPO_ROOT,
      env: {
        ACTIVE_MODEL_PROVIDER: '',
        MINIMAX_API_KEY: 'minimax-key',
        MINIMAX_BASE_URL: '',
        MINIMAX_MANAGER_MODEL: '',
        MINIMAX_RESEARCH_MODEL: '',
        MINIMAX_EXECUTOR_MODEL: '',
        MINIMAX_REVIEWER_MODEL: '',
        MINIMAX_DIALOG_MODEL: '',
        MINIMAX_PROVIDER_ID: '',
        MINIMAX_PROVIDER_NAME: ''
      } as unknown as NodeJS.ProcessEnv
    });

    expect(settings.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'minimax',
          type: 'minimax',
          baseUrl: 'https://api.minimax.io/v1'
        })
      ])
    );
  });

  it('supports overriding MiniMax role models through env', () => {
    const settings = loadSettings({
      workspaceRoot: REPO_ROOT,
      env: {
        MINIMAX_API_KEY: 'minimax-key',
        MINIMAX_MANAGER_MODEL: 'MiniMax-M2.7-highspeed',
        MINIMAX_RESEARCH_MODEL: 'MiniMax-M2.7',
        MINIMAX_EXECUTOR_MODEL: 'MiniMax-M2.5',
        MINIMAX_REVIEWER_MODEL: 'M2-her',
        MINIMAX_DIALOG_MODEL: 'M2-her'
      } as NodeJS.ProcessEnv
    });

    const minimaxProvider = settings.providers.find(provider => provider.id === 'minimax');
    expect(minimaxProvider).toEqual(
      expect.objectContaining({
        roleModels: {
          manager: 'MiniMax-M2.7-highspeed',
          research: 'MiniMax-M2.7',
          executor: 'MiniMax-M2.5',
          reviewer: 'M2-her'
        }
      })
    );
    expect(minimaxProvider?.models).toEqual(['MiniMax-M2.7-highspeed', 'MiniMax-M2.7', 'MiniMax-M2.5', 'M2-her']);
  });

  it('supports ACTIVE_MODEL_PROVIDER=minimax to switch default routed models', () => {
    const settings = loadSettings({
      workspaceRoot: REPO_ROOT,
      env: {
        ZHIPU_API_KEY: 'zhipu-key',
        MINIMAX_API_KEY: 'minimax-key',
        ACTIVE_MODEL_PROVIDER: 'minimax',
        MINIMAX_MANAGER_MODEL: '',
        MINIMAX_RESEARCH_MODEL: '',
        MINIMAX_EXECUTOR_MODEL: '',
        MINIMAX_REVIEWER_MODEL: ''
      } as unknown as NodeJS.ProcessEnv
    });

    expect(settings.routing).toEqual({
      manager: {
        primary: 'minimax/MiniMax-M2.7',
        fallback: undefined
      },
      research: {
        primary: 'minimax/MiniMax-M2.5',
        fallback: undefined
      },
      executor: {
        primary: 'minimax/MiniMax-M2.5-highspeed',
        fallback: undefined
      },
      reviewer: {
        primary: 'minimax/MiniMax-M2.7-highspeed',
        fallback: undefined
      }
    });
  });

  it('keeps explicit MODEL_ROUTE_* values ahead of ACTIVE_MODEL_PROVIDER', () => {
    const settings = loadSettings({
      workspaceRoot: REPO_ROOT,
      env: {
        ZHIPU_API_KEY: 'zhipu-key',
        MINIMAX_API_KEY: 'minimax-key',
        ACTIVE_MODEL_PROVIDER: 'minimax',
        MODEL_ROUTE_MANAGER_PRIMARY: 'zhipu/glm-5.1',
        MINIMAX_MANAGER_MODEL: '',
        MINIMAX_RESEARCH_MODEL: '',
        MINIMAX_EXECUTOR_MODEL: '',
        MINIMAX_REVIEWER_MODEL: ''
      } as unknown as NodeJS.ProcessEnv
    });

    expect(settings.routing.manager?.primary).toBe('zhipu/glm-5.1');
    expect(settings.routing.research?.primary).toBe('minimax/MiniMax-M2.5');
  });

  it('支持每日技术情报简报配置与 env override', () => {
    const defaults = loadSettings({
      workspaceRoot: REPO_ROOT,
      env: {
        DAILY_TECH_BRIEFING_ENABLED: undefined,
        DAILY_TECH_BRIEFING_SCHEDULE: undefined,
        DAILY_TECH_BRIEFING_SEND_EMPTY_DIGEST: undefined,
        DAILY_TECH_BRIEFING_MAX_ITEMS_PER_CATEGORY: undefined,
        DAILY_TECH_BRIEFING_DUPLICATE_WINDOW_DAYS: undefined,
        DAILY_TECH_BRIEFING_MAX_NON_CRITICAL_ITEMS_PER_CATEGORY: undefined,
        DAILY_TECH_BRIEFING_MAX_CRITICAL_ITEMS_PER_CATEGORY: undefined,
        DAILY_TECH_BRIEFING_MAX_TOTAL_ITEMS_PER_CATEGORY: undefined,
        DAILY_TECH_BRIEFING_SEND_ONLY_DELTA: undefined,
        DAILY_TECH_BRIEFING_RESEND_ONLY_ON_MATERIAL_CHANGE: undefined,
        DAILY_TECH_BRIEFING_LARK_DIGEST_MODE: undefined,
        DAILY_TECH_BRIEFING_LARK_DETAIL_MODE: undefined,
        DAILY_TECH_BRIEFING_SOURCE_POLICY: undefined,
        DAILY_TECH_BRIEFING_WEBHOOK_ENV_VAR: undefined,
        DAILY_TECH_BRIEFING_TRANSLATION_ENABLED: undefined,
        DAILY_TECH_BRIEFING_TRANSLATION_MODEL: undefined,
        DAILY_TECH_BRIEFING_AI_LOOKBACK_DAYS: undefined,
        DAILY_TECH_BRIEFING_FRONTEND_LOOKBACK_DAYS: undefined,
        DAILY_TECH_BRIEFING_SECURITY_LOOKBACK_DAYS: undefined,
        DAILY_TECH_BRIEFING_FRONTEND_SECURITY_ENABLED: undefined,
        DAILY_TECH_BRIEFING_FRONTEND_SECURITY_INTERVAL_HOURS: undefined,
        DAILY_TECH_BRIEFING_FRONTEND_SECURITY_LOOKBACK_DAYS: undefined,
        DAILY_TECH_BRIEFING_GENERAL_SECURITY_ENABLED: undefined,
        DAILY_TECH_BRIEFING_GENERAL_SECURITY_INTERVAL_HOURS: undefined,
        DAILY_TECH_BRIEFING_GENERAL_SECURITY_LOOKBACK_DAYS: undefined,
        DAILY_TECH_BRIEFING_DEVTOOL_SECURITY_ENABLED: undefined,
        DAILY_TECH_BRIEFING_DEVTOOL_SECURITY_INTERVAL_HOURS: undefined,
        DAILY_TECH_BRIEFING_DEVTOOL_SECURITY_LOOKBACK_DAYS: undefined,
        DAILY_TECH_BRIEFING_AI_TECH_ENABLED: undefined,
        DAILY_TECH_BRIEFING_AI_TECH_INTERVAL_HOURS: undefined,
        DAILY_TECH_BRIEFING_FRONTEND_TECH_ENABLED: undefined,
        DAILY_TECH_BRIEFING_FRONTEND_TECH_INTERVAL_HOURS: undefined,
        DAILY_TECH_BRIEFING_BACKEND_TECH_ENABLED: undefined,
        DAILY_TECH_BRIEFING_BACKEND_TECH_INTERVAL_HOURS: undefined,
        DAILY_TECH_BRIEFING_BACKEND_TECH_LOOKBACK_DAYS: undefined,
        DAILY_TECH_BRIEFING_CLOUD_INFRA_TECH_ENABLED: undefined,
        DAILY_TECH_BRIEFING_CLOUD_INFRA_TECH_INTERVAL_HOURS: undefined,
        DAILY_TECH_BRIEFING_CLOUD_INFRA_TECH_LOOKBACK_DAYS: undefined,
        LARK_BOT_WEBHOOK_URL: undefined
      } as NodeJS.ProcessEnv
    });

    expect(defaults.dailyTechBriefing).toEqual(
      expect.objectContaining({
        enabled: true,
        sendEmptyDigest: true,
        duplicateWindowDays: 7,
        maxCriticalItemsPerCategory: 20,
        maxTotalItemsPerCategory: 30,
        sendOnlyDelta: true,
        resendOnlyOnMaterialChange: true,
        larkDigestMode: 'dual',
        webhookEnvVar: 'LARK_BOT_WEBHOOK_URL',
        translationEnabled: true,
        translationModel: defaults.zhipuModels.research,
        categories: expect.objectContaining({
          frontendSecurity: expect.objectContaining({ baseIntervalHours: 4, lookbackDays: 3 }),
          generalSecurity: expect.objectContaining({ baseIntervalHours: 4 }),
          devtoolSecurity: expect.objectContaining({ baseIntervalHours: 4, lookbackDays: 7 }),
          aiTech: expect.objectContaining({ baseIntervalHours: 24, lookbackDays: 7 }),
          frontendTech: expect.objectContaining({ baseIntervalHours: 24, lookbackDays: 7 })
        })
      })
    );

    const overridden = loadSettings({
      workspaceRoot: REPO_ROOT,
      env: {
        DAILY_TECH_BRIEFING_ENABLED: 'false',
        DAILY_TECH_BRIEFING_SCHEDULE: 'weekday 10:30',
        DAILY_TECH_BRIEFING_SEND_EMPTY_DIGEST: 'false',
        DAILY_TECH_BRIEFING_MAX_ITEMS_PER_CATEGORY: '3',
        DAILY_TECH_BRIEFING_DUPLICATE_WINDOW_DAYS: '5',
        DAILY_TECH_BRIEFING_MAX_NON_CRITICAL_ITEMS_PER_CATEGORY: '8',
        DAILY_TECH_BRIEFING_MAX_CRITICAL_ITEMS_PER_CATEGORY: '15',
        DAILY_TECH_BRIEFING_MAX_TOTAL_ITEMS_PER_CATEGORY: '18',
        DAILY_TECH_BRIEFING_SEND_ONLY_DELTA: 'false',
        DAILY_TECH_BRIEFING_RESEND_ONLY_ON_MATERIAL_CHANGE: 'false',
        DAILY_TECH_BRIEFING_LARK_DIGEST_MODE: 'interactive-card',
        DAILY_TECH_BRIEFING_SOURCE_POLICY: 'official-only',
        DAILY_TECH_BRIEFING_WEBHOOK_ENV_VAR: 'CUSTOM_LARK_WEBHOOK',
        DAILY_TECH_BRIEFING_TRANSLATION_ENABLED: 'false',
        DAILY_TECH_BRIEFING_TRANSLATION_MODEL: 'glm-4.6',
        DAILY_TECH_BRIEFING_AI_LOOKBACK_DAYS: '3',
        DAILY_TECH_BRIEFING_FRONTEND_LOOKBACK_DAYS: '5',
        DAILY_TECH_BRIEFING_SECURITY_LOOKBACK_DAYS: '21'
      } as NodeJS.ProcessEnv
    });

    expect(overridden.dailyTechBriefing).toEqual({
      enabled: false,
      schedule: 'weekday 10:30',
      sendEmptyDigest: false,
      maxItemsPerCategory: 3,
      duplicateWindowDays: 5,
      maxNonCriticalItemsPerCategory: 8,
      maxCriticalItemsPerCategory: 15,
      maxTotalItemsPerCategory: 18,
      sendOnlyDelta: false,
      resendOnlyOnMaterialChange: false,
      larkDigestMode: 'interactive-card',
      larkDetailMode: 'detailed',
      sourcePolicy: 'official-only',
      webhookEnvVar: 'CUSTOM_LARK_WEBHOOK',
      webhookUrl: undefined,
      translationEnabled: false,
      translationModel: 'glm-4.6',
      aiLookbackDays: 3,
      frontendLookbackDays: 5,
      securityLookbackDays: 21,
      categories: {
        frontendSecurity: {
          enabled: true,
          baseIntervalHours: 4,
          lookbackDays: 3,
          adaptivePolicy: { hotThresholdRuns: 2, cooldownEmptyRuns: 6, allowedIntervalHours: [2, 4, 8] }
        },
        generalSecurity: {
          enabled: true,
          baseIntervalHours: 4,
          lookbackDays: 21,
          adaptivePolicy: { hotThresholdRuns: 2, cooldownEmptyRuns: 6, allowedIntervalHours: [2, 4, 8] }
        },
        devtoolSecurity: {
          enabled: true,
          baseIntervalHours: 4,
          lookbackDays: 7,
          adaptivePolicy: { hotThresholdRuns: 2, cooldownEmptyRuns: 6, allowedIntervalHours: [2, 4, 8] }
        },
        aiTech: {
          enabled: true,
          baseIntervalHours: 24,
          lookbackDays: 3,
          adaptivePolicy: { hotThresholdRuns: 2, cooldownEmptyRuns: 6, allowedIntervalHours: [12, 24, 48] }
        },
        frontendTech: {
          enabled: true,
          baseIntervalHours: 24,
          lookbackDays: 5,
          adaptivePolicy: { hotThresholdRuns: 2, cooldownEmptyRuns: 6, allowedIntervalHours: [12, 24, 48] }
        },
        backendTech: {
          enabled: true,
          baseIntervalHours: 24,
          lookbackDays: 7,
          adaptivePolicy: { hotThresholdRuns: 2, cooldownEmptyRuns: 6, allowedIntervalHours: [12, 24, 48] }
        },
        cloudInfraTech: {
          enabled: true,
          baseIntervalHours: 24,
          lookbackDays: 7,
          adaptivePolicy: { hotThresholdRuns: 2, cooldownEmptyRuns: 6, allowedIntervalHours: [12, 24, 48] }
        }
      }
    });
  });

  describe('resolveActiveRoleModels', () => {
    it('returns zhipu models when ACTIVE_MODEL_PROVIDER is not set', () => {
      const settings = loadSettings({
        workspaceRoot: REPO_ROOT,
        env: {
          ZHIPU_API_KEY: 'zhipu-key',
          ACTIVE_MODEL_PROVIDER: '',
          MINIMAX_API_KEY: ''
        } as NodeJS.ProcessEnv
      });

      const activeModels = resolveActiveRoleModels(settings);
      expect(activeModels.manager).toBe('glm-5');
      expect(activeModels.research).toBe('glm-5.1');
      expect(activeModels.executor).toBe('glm-4.6');
      expect(activeModels.reviewer).toBe('glm-4.7');
    });

    it('returns minimax models when ACTIVE_MODEL_PROVIDER=minimax', () => {
      const settings = loadSettings({
        workspaceRoot: REPO_ROOT,
        env: {
          ZHIPU_API_KEY: 'zhipu-key',
          MINIMAX_API_KEY: 'minimax-key',
          ACTIVE_MODEL_PROVIDER: 'minimax',
          MINIMAX_MANAGER_MODEL: '',
          MINIMAX_RESEARCH_MODEL: '',
          MINIMAX_EXECUTOR_MODEL: '',
          MINIMAX_REVIEWER_MODEL: ''
        } as unknown as NodeJS.ProcessEnv
      });

      const activeModels = resolveActiveRoleModels(settings);
      expect(activeModels.manager).toBe('MiniMax-M2.7');
      expect(activeModels.research).toBe('MiniMax-M2.5');
      expect(activeModels.executor).toBe('MiniMax-M2.5-highspeed');
      expect(activeModels.reviewer).toBe('MiniMax-M2.7-highspeed');
    });

    it('respects explicit MODEL_ROUTE_* overrides over ACTIVE_MODEL_PROVIDER', () => {
      const settings = loadSettings({
        workspaceRoot: REPO_ROOT,
        env: {
          ZHIPU_API_KEY: 'zhipu-key',
          MINIMAX_API_KEY: 'minimax-key',
          ACTIVE_MODEL_PROVIDER: 'minimax',
          MODEL_ROUTE_MANAGER_PRIMARY: 'zhipu/glm-5.1',
          MINIMAX_MANAGER_MODEL: '',
          MINIMAX_RESEARCH_MODEL: '',
          MINIMAX_EXECUTOR_MODEL: '',
          MINIMAX_REVIEWER_MODEL: ''
        } as unknown as NodeJS.ProcessEnv
      });

      const activeModels = resolveActiveRoleModels(settings);
      expect(activeModels.manager).toBe('glm-5.1');
      expect(activeModels.research).toBe('MiniMax-M2.5');
    });

    it('fallbackModelId defaults to active provider model instead of hardcoded glm', () => {
      const settings = loadSettings({
        workspaceRoot: REPO_ROOT,
        env: {
          MINIMAX_API_KEY: 'minimax-key',
          ACTIVE_MODEL_PROVIDER: 'minimax',
          ZHIPU_API_KEY: '',
          MINIMAX_MANAGER_MODEL: '',
          MINIMAX_RESEARCH_MODEL: '',
          MINIMAX_EXECUTOR_MODEL: '',
          MINIMAX_REVIEWER_MODEL: ''
        } as unknown as NodeJS.ProcessEnv
      });

      const activeModels = resolveActiveRoleModels(settings);
      expect(activeModels.manager).not.toContain('glm');
      expect(settings.policy.budget.fallbackModelId).toBe('MiniMax-M2.5');
    });
  });
});
