import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { readJson } from 'fs-extra';

import { RuntimeTechBriefingService } from '../../../src/runtime/briefing/briefing.service';
import { appendBriefingFeedback } from '../../../src/runtime/briefing/briefing-storage';
import { getStorageRoot } from '../../../src/runtime/briefing/briefing-paths';

describe('RuntimeTechBriefingService', () => {
  let workspaceRoot = '';

  afterEach(async () => {
    if (workspaceRoot) {
      await rm(workspaceRoot, { recursive: true, force: true });
      workspaceRoot = '';
    }
    delete process.env.LARK_BOT_WEBHOOK_URL;
  });

  it('会初始化默认 schedule 并在 Bree 触发后发送多条分类消息', async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'runtime-tech-briefing-'));
    process.env.LARK_BOT_WEBHOOK_URL = 'https://lark.example.com/webhook';
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => mockFetchResponse(String(input)));
    const service = new RuntimeTechBriefingService(() => ({
      settings: {
        workspaceRoot,
        zhipuApiKey: 'test-key',
        zhipuApiBaseUrl: 'https://zhipu.test/api/paas/v4',
        zhipuModels: {
          manager: 'glm-5',
          research: 'glm-4.7-flashx',
          executor: 'glm-4.6',
          reviewer: 'glm-4.7'
        },
        providers: [],
        dailyTechBriefing: {
          enabled: true,
          schedule: 'daily 11:00',
          sendEmptyDigest: true,
          maxItemsPerCategory: 2,
          duplicateWindowDays: 7,
          maxNonCriticalItemsPerCategory: 10,
          maxCriticalItemsPerCategory: 20,
          maxTotalItemsPerCategory: 30,
          sendOnlyDelta: true,
          resendOnlyOnMaterialChange: true,
          larkDigestMode: 'dual',
          sourcePolicy: 'tiered-authority',
          webhookEnvVar: 'LARK_BOT_WEBHOOK_URL',
          webhookUrl: 'https://lark.example.com/webhook',
          translationEnabled: true,
          translationModel: 'glm-4.7-flashx',
          aiLookbackDays: 7,
          frontendLookbackDays: 7,
          securityLookbackDays: 7
        }
      },
      fetchImpl: fetchImpl as typeof fetch,
      translateText: vi.fn(async input => ({
        title: `中文：${input.title}`,
        summary: `中文化整理：${input.summary}`
      }))
    }));

    const schedule = await service.initializeSchedule();
    const run = await service.runScheduled(new Date('2026-04-01T11:00:00.000Z'));
    if (!run) {
      throw new Error('expected scheduled briefing run');
    }
    const persistedSchedule = await readJson(
      join(getStorageRoot(workspaceRoot), 'schedules', 'daily-tech-briefing-frontend-security.json')
    );

    expect(schedule).toHaveLength(7);
    expect(persistedSchedule.lastRunAt).toBe('2026-04-01T11:00:00.000Z');
    expect(persistedSchedule.nextRunAt).toBeTruthy();
    expect(run.categories).toHaveLength(7);
    expect(run.categories.map(item => item.category)).toEqual([
      'frontend-security',
      'general-security',
      'devtool-security',
      'ai-tech',
      'frontend-tech',
      'backend-tech',
      'cloud-infra-tech'
    ]);
    expect(fetchImpl.mock.calls.length).toBeGreaterThanOrEqual(4);
    const larkCalls = fetchImpl.mock.calls.filter(([url]) => String(url) === 'https://lark.example.com/webhook');
    expect(larkCalls.length).toBe(1);
    expect(run.categories.every(item => item.status === 'sent' || item.status === 'empty')).toBe(true);
    const firstBody = JSON.parse(String((larkCalls[0]?.[1] as RequestInit | undefined)?.body ?? '{}')) as {
      card?: {
        header?: { title?: { content?: string } };
        elements?: Array<{ content?: string; tag?: string }>;
      };
    };
    const firstContent = firstBody.card?.elements?.find(item => typeof item.content === 'string')?.content ?? '';
    expect(firstBody.card?.header?.title?.content).toContain('每日技术情报简报');
    expect(firstBody.card?.elements?.length ?? 0).toBeGreaterThan(6);
    expect(firstBody.card?.elements?.some(item => item.tag === 'column_set')).toBe(true);
    expect(JSON.stringify(firstBody.card)).toContain('前端安全情报');
    expect(JSON.stringify(firstBody.card)).toContain('Agent / DevTool 安全情报');
    expect(JSON.stringify(firstBody.card)).toContain('AI 新技术情报');
    expect(JSON.stringify(firstBody.card)).toContain('前端新技术情报');
    expect(JSON.stringify(firstBody.card)).toContain('通用安全情报');
    expect(JSON.stringify(firstBody.card)).toContain('后端/全栈新技术');
    expect(JSON.stringify(firstBody.card)).toContain('云原生与基础设施');
    const serializedCard = JSON.stringify(firstBody.card);
    expect(serializedCard).toContain('Datadog Security Labs / axios');
    expect(serializedCard).toContain('受影响版本');
    expect(serializedCard).toContain('1.14.1, 0.30.4');
    expect(serializedCard).toContain('Node.js Security Releases');
    expect(serializedCard).toContain('Chrome 146');
    expect(serializedCard).toContain('WebAssembly');
    expect(serializedCard).toMatch(/Claude Code|workspace trust|源码|泄露|Responses API/);
    expect(serializedCard).toContain('MCP');
    expect(serializedCard).toContain('LangGraph');
    expect(serializedCard).toContain('Hugging Face');
    expect(serializedCard).toContain('LangSmith');
    expect(serializedCard).toContain('核心模型演进与发布');
    expect(serializedCard).toContain('框架、工具与平台');
    expect(serializedCard).toContain('Gemini 3 Deep Think');
    expect(serializedCard).toContain('Agent Middleware');
    expect(serializedCard).not.toContain('LL COOL J');
    expect(serializedCard).not.toContain('live personal translator');
    expect(serializedCard).toContain('查看原文');
  });

  it('单个分类失败时不会阻断其余分类发送', async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'runtime-tech-briefing-failure-'));
    process.env.LARK_BOT_WEBHOOK_URL = 'https://lark.example.com/webhook';
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('huggingface.co/blog/feed.xml')) {
        return new Response('upstream error', { status: 500 });
      }
      return mockFetchResponse(url);
    });
    const service = new RuntimeTechBriefingService(() => ({
      settings: {
        workspaceRoot,
        zhipuApiKey: 'test-key',
        zhipuApiBaseUrl: 'https://zhipu.test/api/paas/v4',
        zhipuModels: {
          manager: 'glm-5',
          research: 'glm-4.7-flashx',
          executor: 'glm-4.6',
          reviewer: 'glm-4.7'
        },
        providers: [],
        dailyTechBriefing: {
          enabled: true,
          schedule: 'daily 11:00',
          sendEmptyDigest: true,
          maxItemsPerCategory: 2,
          duplicateWindowDays: 7,
          maxNonCriticalItemsPerCategory: 10,
          maxCriticalItemsPerCategory: 20,
          maxTotalItemsPerCategory: 30,
          sendOnlyDelta: true,
          resendOnlyOnMaterialChange: true,
          larkDigestMode: 'dual',
          sourcePolicy: 'tiered-authority',
          webhookEnvVar: 'LARK_BOT_WEBHOOK_URL',
          webhookUrl: 'https://lark.example.com/webhook',
          translationEnabled: true,
          translationModel: 'glm-4.7-flashx',
          aiLookbackDays: 7,
          frontendLookbackDays: 7,
          securityLookbackDays: 7
        }
      },
      fetchImpl: fetchImpl as typeof fetch,
      translateText: vi.fn(async input => ({
        title: `中文：${input.title}`,
        summary: `中文化整理：${input.summary}`
      }))
    }));

    const run = await service.runNow(new Date('2026-04-01T11:00:00.000Z'));

    expect(run.status).toBe('sent');
    expect(run.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'frontend-security', sent: true }),
        expect.objectContaining({ category: 'devtool-security' }),
        expect.objectContaining({ category: 'ai-tech', sent: true }),
        expect.objectContaining({ category: 'frontend-tech', sent: true })
      ])
    );
  });

  it('同一分钟重复触发同一分类时只执行一次，避免多实例 scheduler 重复发送', async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'runtime-tech-briefing-duplicate-schedule-'));
    process.env.LARK_BOT_WEBHOOK_URL = 'https://lark.example.com/webhook';
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => mockFetchResponse(String(input)));
    const service = new RuntimeTechBriefingService(() => ({
      settings: {
        workspaceRoot,
        zhipuApiKey: 'test-key',
        zhipuApiBaseUrl: 'https://zhipu.test/api/paas/v4',
        zhipuModels: {
          manager: 'glm-5',
          research: 'glm-4.7-flashx',
          executor: 'glm-4.6',
          reviewer: 'glm-4.7'
        },
        providers: [],
        dailyTechBriefing: {
          enabled: true,
          schedule: 'daily every 1 minute',
          sendEmptyDigest: true,
          maxItemsPerCategory: 2,
          duplicateWindowDays: 7,
          maxNonCriticalItemsPerCategory: 10,
          maxCriticalItemsPerCategory: 20,
          maxTotalItemsPerCategory: 30,
          sendOnlyDelta: true,
          resendOnlyOnMaterialChange: true,
          larkDigestMode: 'dual',
          sourcePolicy: 'tiered-authority',
          webhookEnvVar: 'LARK_BOT_WEBHOOK_URL',
          webhookUrl: 'https://lark.example.com/webhook',
          translationEnabled: true,
          translationModel: 'glm-4.7-flashx',
          aiLookbackDays: 7,
          frontendLookbackDays: 7,
          securityLookbackDays: 7
        }
      },
      fetchImpl: fetchImpl as typeof fetch,
      translateText: vi.fn(async input => ({
        title: `中文：${input.title}`,
        summary: `中文化整理：${input.summary}`
      }))
    }));

    const now = new Date('2026-04-01T11:00:01.000Z');
    const firstRun = await service.runScheduled(now, ['backend-tech']);
    const callsAfterFirstRun = fetchImpl.mock.calls.length;
    const secondRun = await service.runScheduled(new Date('2026-04-01T11:00:30.000Z'), ['backend-tech']);

    expect(firstRun).toEqual(
      expect.objectContaining({ categories: [expect.objectContaining({ category: 'backend-tech' })] })
    );
    expect(secondRun).toBeNull();
    expect(fetchImpl.mock.calls.length).toBe(callsAfterFirstRun);
  });

  it('单个安全来源失败时不会让前端安全情报整类失败', async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'runtime-tech-briefing-security-source-failure-'));
    process.env.LARK_BOT_WEBHOOK_URL = 'https://lark.example.com/webhook';
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('axios.com/2026/03/31/anthropic-leaked-source-code-ai')) {
        return new Response('forbidden', { status: 403 });
      }
      return mockFetchResponse(url);
    });
    const service = new RuntimeTechBriefingService(() => ({
      settings: {
        workspaceRoot,
        zhipuApiKey: 'test-key',
        zhipuApiBaseUrl: 'https://zhipu.test/api/paas/v4',
        zhipuModels: {
          manager: 'glm-5',
          research: 'glm-4.7-flashx',
          executor: 'glm-4.6',
          reviewer: 'glm-4.7'
        },
        providers: [],
        dailyTechBriefing: {
          enabled: true,
          schedule: 'daily 11:00',
          sendEmptyDigest: true,
          maxItemsPerCategory: 3,
          duplicateWindowDays: 7,
          maxNonCriticalItemsPerCategory: 10,
          maxCriticalItemsPerCategory: 20,
          maxTotalItemsPerCategory: 30,
          sendOnlyDelta: true,
          resendOnlyOnMaterialChange: true,
          larkDigestMode: 'dual',
          sourcePolicy: 'tiered-authority',
          webhookEnvVar: 'LARK_BOT_WEBHOOK_URL',
          webhookUrl: 'https://lark.example.com/webhook',
          translationEnabled: true,
          translationModel: 'glm-4.7-flashx',
          aiLookbackDays: 7,
          frontendLookbackDays: 7,
          securityLookbackDays: 7
        }
      },
      fetchImpl: fetchImpl as typeof fetch,
      translateText: vi.fn(async input => ({
        title: `中文：${input.title}`,
        summary: `中文化整理：${input.summary}`
      }))
    }));

    const run = await service.runNow(new Date('2026-04-01T11:00:00.000Z'));
    const security = run.categories.find(item => item.category === 'frontend-security');

    expect(security).toEqual(
      expect.objectContaining({
        category: 'frontend-security',
        sent: true
      })
    );
    expect(security?.status).toBe('sent');
    expect(security?.itemCount).toBeGreaterThan(0);
  });

  it('不会把旧发布但近期更新的 GitHub Advisory 误判为最近七天情报', async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'runtime-tech-briefing-stale-github-advisory-'));
    process.env.LARK_BOT_WEBHOOK_URL = 'https://lark.example.com/webhook';
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('docs.apifox.com/8392582m0')) {
        return new Response('not found', { status: 404 });
      }
      if (url.includes('advisories.gitlab.com/pkg/npm/%40anthropic-ai/claude-code/CVE-2026-33068')) {
        return new Response('not found', { status: 404 });
      }
      if (url.includes('theverge.com/ai-artificial-intelligence/904776/anthropic-claude-source-code-leak')) {
        return new Response('forbidden', { status: 403 });
      }
      if (url.includes('securitylabs.datadoghq.com/articles/axios-npm-supply-chain-compromise')) {
        return new Response('not found', { status: 404 });
      }
      if (url.includes('businessinsights.bitdefender.com/technical-advisory-axios-npm-supply-chain-attack')) {
        return new Response('not found', { status: 404 });
      }
      if (url.includes('cn-sec.com/archives/5140833.html')) {
        return new Response('not found', { status: 404 });
      }
      if (url.includes('finance.sina.com.cn/tech/digi/2026-03-31/doc-inhswicu3324323.shtml')) {
        return new Response('not found', { status: 404 });
      }
      return mockFetchResponse(url);
    });
    const service = new RuntimeTechBriefingService(() => ({
      settings: {
        workspaceRoot,
        zhipuApiKey: 'test-key',
        zhipuApiBaseUrl: 'https://zhipu.test/api/paas/v4',
        zhipuModels: {
          manager: 'glm-5',
          research: 'glm-4.7-flashx',
          executor: 'glm-4.6',
          reviewer: 'glm-4.7'
        },
        providers: [],
        dailyTechBriefing: {
          enabled: true,
          schedule: 'daily 11:00',
          sendEmptyDigest: true,
          maxItemsPerCategory: 3,
          duplicateWindowDays: 7,
          maxNonCriticalItemsPerCategory: 10,
          maxCriticalItemsPerCategory: 20,
          maxTotalItemsPerCategory: 30,
          sendOnlyDelta: true,
          resendOnlyOnMaterialChange: true,
          larkDigestMode: 'dual',
          sourcePolicy: 'tiered-authority',
          webhookEnvVar: 'LARK_BOT_WEBHOOK_URL',
          webhookUrl: 'https://lark.example.com/webhook',
          translationEnabled: true,
          translationModel: 'glm-4.7-flashx',
          aiLookbackDays: 7,
          frontendLookbackDays: 7,
          securityLookbackDays: 7
        }
      },
      fetchImpl: fetchImpl as typeof fetch,
      translateText: vi.fn(async input => ({
        title: `中文：${input.title}`,
        summary: `中文化整理：${input.summary}`
      }))
    }));

    const run = await service.runNow(new Date('2026-04-01T11:00:00.000Z'));
    const security = run.categories.find(item => item.category === 'frontend-security');

    expect(security?.status).toBe('sent');
    expect(
      security?.displayedItems?.some(
        item =>
          item.sourceName === 'GitHub Advisory / axios' ||
          /ssrf and credential leakage/i.test(item.cleanTitle ?? item.title)
      )
    ).toBe(false);
  });

  it('会根据反馈偏好轻量提升更可执行的技术条目排序', async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'runtime-tech-briefing-preference-rank-'));
    process.env.LARK_BOT_WEBHOOK_URL = 'https://lark.example.com/webhook';
    await appendBriefingFeedback(workspaceRoot, {
      id: 'feedback-1',
      messageKey: 'seed-message',
      category: 'backend-tech',
      feedbackType: 'helpful',
      reasonTag: 'useful-actionable',
      createdAt: '2026-04-01T00:00:00.000Z'
    });
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => mockFetchResponse(String(input)));
    const service = new RuntimeTechBriefingService(() => ({
      settings: {
        workspaceRoot,
        zhipuApiKey: 'test-key',
        zhipuApiBaseUrl: 'https://zhipu.test/api/paas/v4',
        zhipuModels: {
          manager: 'glm-5',
          research: 'glm-4.7-flashx',
          executor: 'glm-4.6',
          reviewer: 'glm-4.7'
        },
        providers: [],
        dailyTechBriefing: {
          enabled: true,
          schedule: 'daily 11:00',
          sendEmptyDigest: true,
          maxItemsPerCategory: 6,
          duplicateWindowDays: 7,
          maxNonCriticalItemsPerCategory: 10,
          maxCriticalItemsPerCategory: 20,
          maxTotalItemsPerCategory: 30,
          sendOnlyDelta: true,
          resendOnlyOnMaterialChange: true,
          larkDigestMode: 'dual',
          sourcePolicy: 'tiered-authority',
          webhookEnvVar: 'LARK_BOT_WEBHOOK_URL',
          webhookUrl: 'https://lark.example.com/webhook',
          translationEnabled: true,
          translationModel: 'glm-4.7-flashx',
          aiLookbackDays: 7,
          frontendLookbackDays: 7,
          securityLookbackDays: 7
        }
      },
      fetchImpl: fetchImpl as typeof fetch,
      translateText: vi.fn(async input => ({
        title: input.title,
        summary: input.summary
      }))
    }));

    const run = await service.runNow(new Date('2026-04-01T11:00:00.000Z'));
    const backendTech = run.categories.find(item => item.category === 'backend-tech');

    expect(
      backendTech?.displayedItems?.some(item => item.recommendedAction && item.recommendedAction !== 'watch')
    ).toBe(true);
    expect(backendTech?.displayedItems?.[0]?.recommendedAction).not.toBe('ignore');
    expect(backendTech?.displayedItems?.[0]?.whyItMatters).toBeTruthy();
  });

  it('第二轮会抑制 7 天窗口内的同主题重复消息', async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'runtime-tech-briefing-dedupe-'));
    process.env.LARK_BOT_WEBHOOK_URL = 'https://lark.example.com/webhook';
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => mockFetchResponse(String(input)));
    const service = new RuntimeTechBriefingService(() => ({
      settings: {
        workspaceRoot,
        zhipuApiKey: 'test-key',
        zhipuApiBaseUrl: 'https://zhipu.test/api/paas/v4',
        zhipuModels: {
          manager: 'glm-5',
          research: 'glm-4.7-flashx',
          executor: 'glm-4.6',
          reviewer: 'glm-4.7'
        },
        providers: [],
        dailyTechBriefing: {
          enabled: true,
          schedule: 'daily 11:00',
          sendEmptyDigest: true,
          maxItemsPerCategory: 3,
          duplicateWindowDays: 7,
          maxNonCriticalItemsPerCategory: 10,
          maxCriticalItemsPerCategory: 20,
          maxTotalItemsPerCategory: 30,
          sendOnlyDelta: true,
          resendOnlyOnMaterialChange: true,
          larkDigestMode: 'dual',
          sourcePolicy: 'tiered-authority',
          webhookEnvVar: 'LARK_BOT_WEBHOOK_URL',
          webhookUrl: 'https://lark.example.com/webhook',
          translationEnabled: false,
          translationModel: 'glm-4.7-flashx',
          aiLookbackDays: 7,
          frontendLookbackDays: 7,
          securityLookbackDays: 7
        }
      },
      fetchImpl: fetchImpl as typeof fetch
    }));

    const firstRun = await service.runNow(new Date('2026-04-01T11:00:00.000Z'));
    const secondRun = await service.runNow(new Date('2026-04-01T12:00:00.000Z'));

    expect(firstRun.digest?.newCount).toBeGreaterThan(0);
    expect(secondRun.digest?.crossRunSuppressedCount).toBeGreaterThan(0);
  });

  it('配置 BigModel MCP 搜索能力时会补充调用 webSearchPrime 发现白名单来源', async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'runtime-tech-briefing-mcp-search-'));
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/news/rss.xml') || url.includes('/blog/feed.xml') || url.includes('/rss/')) {
        return new Response('<?xml version="1.0" encoding="UTF-8"?><rss><channel></channel></rss>', { status: 200 });
      }
      return mockFetchResponse(url);
    });
    const invokeTool = vi.fn(async () => ({
      ok: true,
      rawOutput: {
        results: [
          {
            url: 'https://openai.com/news/new-realtime-api-update',
            title: 'OpenAI ships a new realtime API update',
            summary: 'Latest API release for realtime agents and multimodal orchestration.',
            fetchedAt: '2026-04-01T00:00:00.000Z'
          },
          {
            url: 'https://example.com/marketing-post',
            title: 'Marketing post',
            summary: 'Should be filtered out because source is not on the allowlist.'
          }
        ]
      }
    }));
    const service = new RuntimeTechBriefingService(() => ({
      settings: {
        workspaceRoot,
        zhipuApiKey: 'test-key',
        zhipuApiBaseUrl: 'https://zhipu.test/api/paas/v4',
        zhipuModels: {
          manager: 'glm-5',
          research: 'glm-4.7-flashx',
          executor: 'glm-4.6',
          reviewer: 'glm-4.7'
        },
        providers: [],
        dailyTechBriefing: {
          enabled: true,
          schedule: 'daily 11:00',
          sendEmptyDigest: true,
          maxItemsPerCategory: 3,
          duplicateWindowDays: 7,
          maxNonCriticalItemsPerCategory: 10,
          maxCriticalItemsPerCategory: 20,
          maxTotalItemsPerCategory: 30,
          sendOnlyDelta: true,
          resendOnlyOnMaterialChange: true,
          larkDigestMode: 'dual',
          sourcePolicy: 'tiered-authority',
          webhookEnvVar: 'LARK_BOT_WEBHOOK_URL',
          translationEnabled: false,
          translationModel: 'glm-4.7-flashx',
          aiLookbackDays: 7,
          frontendLookbackDays: 7,
          securityLookbackDays: 7
        }
      },
      fetchImpl: fetchImpl as typeof fetch,
      mcpClientManager: {
        hasCapability: vi.fn((capabilityId: string) => capabilityId === 'webSearchPrime'),
        invokeTool: invokeTool as never
      }
    }));

    const run = await service.runNow(new Date('2026-04-01T11:00:00.000Z'), ['ai-tech']);
    const aiCategory = run.categories.find(item => item.category === 'ai-tech');

    expect(invokeTool).toHaveBeenCalledWith(
      'webSearchPrime',
      expect.objectContaining({
        input: expect.objectContaining({
          query: expect.stringContaining('OpenAI')
        })
      })
    );
    expect(
      aiCategory?.displayedItems?.some(item => item.url === 'https://openai.com/news/new-realtime-api-update')
    ).toBe(true);
    expect(aiCategory?.displayedItems?.some(item => item.url === 'https://example.com/marketing-post')).toBe(false);
  });

  it('空前端安全分类不会发送空卡片', async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'runtime-tech-briefing-empty-security-'));
    process.env.LARK_BOT_WEBHOOK_URL = 'https://lark.example.com/webhook';
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => mockFetchResponse(String(input)));
    const service = new RuntimeTechBriefingService(() => ({
      settings: {
        workspaceRoot,
        zhipuApiKey: 'test-key',
        zhipuApiBaseUrl: 'https://zhipu.test/api/paas/v4',
        zhipuModels: {
          manager: 'glm-5',
          research: 'glm-4.7-flashx',
          executor: 'glm-4.6',
          reviewer: 'glm-4.7'
        },
        providers: [],
        dailyTechBriefing: {
          enabled: true,
          schedule: 'daily 11:00',
          sendEmptyDigest: true,
          maxItemsPerCategory: 2,
          duplicateWindowDays: 7,
          maxNonCriticalItemsPerCategory: 10,
          maxCriticalItemsPerCategory: 20,
          maxTotalItemsPerCategory: 30,
          sendOnlyDelta: true,
          resendOnlyOnMaterialChange: true,
          larkDigestMode: 'dual',
          sourcePolicy: 'tiered-authority',
          webhookEnvVar: 'LARK_BOT_WEBHOOK_URL',
          webhookUrl: 'https://lark.example.com/webhook',
          translationEnabled: false,
          translationModel: 'glm-4.7-flashx',
          aiLookbackDays: 7,
          frontendLookbackDays: 7,
          securityLookbackDays: 7
        }
      },
      fetchImpl: fetchImpl as typeof fetch
    }));

    const run = await service.runNow(new Date('2026-04-03T06:09:57.257Z'), ['frontend-security']);

    expect(run.categories[0]).toEqual(
      expect.objectContaining({
        category: 'frontend-security',
        status: 'empty',
        sent: false,
        itemCount: 0
      })
    );
    const larkCalls = fetchImpl.mock.calls.filter(([url]) => String(url) === 'https://lark.example.com/webhook');
    expect(larkCalls).toHaveLength(0);
  });

  it('backend-tech 在重复窗口内不会因为高优先级展示而重复发送', async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'runtime-tech-briefing-backend-dedupe-'));
    process.env.LARK_BOT_WEBHOOK_URL = 'https://lark.example.com/webhook';
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => mockFetchResponse(String(input)));
    const service = new RuntimeTechBriefingService(() => ({
      settings: {
        workspaceRoot,
        zhipuApiKey: 'test-key',
        zhipuApiBaseUrl: 'https://zhipu.test/api/paas/v4',
        zhipuModels: {
          manager: 'glm-5',
          research: 'glm-4.7-flashx',
          executor: 'glm-4.6',
          reviewer: 'glm-4.7'
        },
        providers: [],
        dailyTechBriefing: {
          enabled: true,
          schedule: 'daily 11:00',
          sendEmptyDigest: true,
          maxItemsPerCategory: 5,
          duplicateWindowDays: 7,
          maxNonCriticalItemsPerCategory: 10,
          maxCriticalItemsPerCategory: 20,
          maxTotalItemsPerCategory: 30,
          sendOnlyDelta: true,
          resendOnlyOnMaterialChange: true,
          larkDigestMode: 'dual',
          sourcePolicy: 'tiered-authority',
          webhookEnvVar: 'LARK_BOT_WEBHOOK_URL',
          webhookUrl: 'https://lark.example.com/webhook',
          translationEnabled: false,
          translationModel: 'glm-4.7-flashx',
          aiLookbackDays: 7,
          frontendLookbackDays: 7,
          securityLookbackDays: 7
        }
      },
      fetchImpl: fetchImpl as typeof fetch
    }));

    const firstRun = await service.runNow(new Date('2026-04-03T06:09:57.258Z'), ['backend-tech']);
    const secondRun = await service.runNow(new Date('2026-04-03T06:19:57.258Z'), ['backend-tech']);

    expect(firstRun.categories[0]?.itemCount).toBeGreaterThan(0);
    expect(secondRun.categories[0]).toEqual(
      expect.objectContaining({
        category: 'backend-tech',
        status: 'empty',
        sent: false,
        itemCount: 0
      })
    );
    expect(secondRun.categories[0]?.crossRunSuppressedCount).toBeGreaterThan(0);
  });
});

function mockFetchResponse(url: string) {
  if (url.includes('services.nvd.nist.gov')) {
    return Promise.resolve(
      new Response(
        JSON.stringify({
          vulnerabilities: []
        }),
        { status: 200 }
      )
    );
  }

  if (url.includes('docs.apifox.com/8392582m0')) {
    return Promise.resolve(
      new Response(
        `
        <html>
          <head><title>Apifox 安全公告</title></head>
          <body>
            <article>
              <h1>Apifox 官方安全公告：2026 年 3 月 26 日前端脚本被注入恶意代码</h1>
              <p>2026年3月26日，Apifox 官方通报 CDN 分发的前端脚本曾被注入恶意 JavaScript，影响范围集中在控制台与调试链路。</p>
              <p>官方建议所有用户立即完成缓存清理、重置敏感凭证，并核查最近一周的访问记录。</p>
            </article>
          </body>
        </html>`,
        { status: 200 }
      )
    );
  }

  if (url.includes('nodejs.org/en/blog/vulnerability/march-2026-security-releases')) {
    return Promise.resolve(
      new Response(
        `
        <html>
          <head><title>Node.js Security Releases - March 2026</title></head>
          <body>
            <article>
              <h1>Node.js Security Releases - March 2026</h1>
              <p>2026-03-31</p>
              <p>Node.js released security fixes for 25.x, 24.x, 22.x, and 20.x lines, including TLS handshake crash handling and HashDoS-related hardening.</p>
              <p>Projects running SSR, BFF, or other public Node.js services should upgrade to the patched versions immediately.</p>
            </article>
          </body>
        </html>`,
        { status: 200 }
      )
    );
  }

  if (url.includes('chromereleases.googleblog.com/2026/03/stable-channel-update-for-desktop_31.html')) {
    return Promise.resolve(
      new Response(
        `
        <html>
          <head><title>Stable Channel Update for Desktop</title></head>
          <body>
            <article>
              <h1>Chrome 146 stable channel update fixes 21 security bugs</h1>
              <p>March 31, 2026</p>
              <p>Google fixed multiple high severity issues including WebGL and WebCodecs use-after-free vulnerabilities.</p>
            </article>
          </body>
        </html>`,
        { status: 200 }
      )
    );
  }

  if (url.includes('v8.dev/blog/wasm-memory-corruption-fix')) {
    return Promise.resolve(
      new Response(
        `
        <html>
          <head><title>Fixing a WebAssembly memory corruption issue in V8</title></head>
          <body>
            <article>
              <h1>Fixing a WebAssembly memory corruption issue in V8</h1>
              <p>2026-03-30</p>
              <p>V8 fixed a WebAssembly out-of-bounds read and write issue that could impact sandbox guarantees for complex wasm workloads.</p>
            </article>
          </body>
        </html>`,
        { status: 200 }
      )
    );
  }

  if (url.includes('advisories.gitlab.com/pkg/npm/%40anthropic-ai/claude-code/CVE-2026-33068')) {
    return Promise.resolve(
      new Response(
        `
        <html>
          <head><title>CVE-2026-21852 - Claude Code</title></head>
          <body>
            <article>
              <h1>CVE-2026-21852: Claude Code may expose sensitive information from workspace trust configuration</h1>
              <p>March 31, 2026</p>
              <p>Improper trust boundary handling can expose repository-level secrets and developer workstation metadata.</p>
            </article>
          </body>
        </html>`,
        { status: 200 }
      )
    );
  }

  if (url.includes('github.com/advisories/GHSA-mcp-path-traversal-2026')) {
    return Promise.resolve(
      new Response(
        `
        <html>
          <head><title>GitHub Advisory Database - GHSA-mcp-path-traversal-2026</title></head>
          <body>
            <article>
              <h1>Custom MCP servers may allow path traversal and arbitrary file read via crafted uri parameters</h1>
              <p>Published Mar 29, 2026</p>
              <p>Advisory warns that stdio-based MCP servers exposing local filesystem resources can be abused with ../../ sequences if uri input is not normalized and constrained to a trusted root.</p>
            </article>
          </body>
        </html>`,
        { status: 200 }
      )
    );
  }

  if (url.includes('blog.langchain.com/langgraph-memory-checkpoint-vulnerability')) {
    return Promise.resolve(
      new Response(
        `
        <html>
          <head><title>LangGraph memory checkpoint vulnerability</title></head>
          <body>
            <article>
              <h1>LangGraph Checkpointer can be stressed by malicious persisted state payloads</h1>
              <p>2026-04-01</p>
              <p>LangChain Security Blog describes denial-of-service and deserialization edge cases affecting SqliteSaver and PostgresSaver when large or malicious prompt state is replayed.</p>
            </article>
          </body>
        </html>`,
        { status: 200 }
      )
    );
  }

  if (url.includes('huggingface.co/blog/spaces-env-exposure-security')) {
    return Promise.resolve(
      new Response(
        `
        <html>
          <head><title>Spaces environment variable exposure advisory</title></head>
          <body>
            <article>
              <h1>Hugging Face Spaces advisory on environment variable exposure in Gradio demos</h1>
              <p>2026-03-30</p>
              <p>Hugging Face warns that some Spaces demos could expose environment configuration and secrets through debugging surfaces if not properly isolated.</p>
            </article>
          </body>
        </html>`,
        { status: 200 }
      )
    );
  }

  if (url.includes('docs.smith.langchain.com/changelog/team-project-permission-fix')) {
    return Promise.resolve(
      new Response(
        `
        <html>
          <head><title>LangSmith changelog permission fix</title></head>
          <body>
            <article>
              <h1>LangSmith fixes a team project permission visibility bug</h1>
              <p>2026-03-31</p>
              <p>LangSmith fixed a project permission issue that could allow certain team members to view traces outside intended project boundaries.</p>
            </article>
          </body>
        </html>`,
        { status: 200 }
      )
    );
  }

  if (url.includes('github.com/advisories/GHSA-4hjh-wcwx-xvwj')) {
    return Promise.resolve(
      new Response(
        `
        <html>
          <head><title>GitHub Advisory Database - GHSA-4hjh-wcwx-xvwj</title></head>
          <body>
            <article>
              <h1>axios vulnerable to SSRF and credential leakage via absolute URL handling</h1>
              <p>Published Sep 12, 2025</p>
              <p>Updated Jan 16, 2026</p>
              <p>GitHub Advisory Database notes that affected axios versions may allow server-side request forgery and credential leakage when unsafe absolute URLs are accepted.</p>
            </article>
          </body>
        </html>`,
        { status: 200 }
      )
    );
  }

  if (url.includes('theverge.com/ai-artificial-intelligence/904776/anthropic-claude-source-code-leak')) {
    return Promise.resolve(
      new Response(
        `
        <html>
          <head><title>Anthropic source map exposure</title></head>
          <body>
            <article>
              <h1>Anthropic source map exposure raised developer toolchain leak concerns</h1>
              <p>March 31, 2026</p>
              <p>Axios reported that published packages exposed source maps and internal implementation details, increasing the risk of reverse engineering.</p>
            </article>
          </body>
        </html>`,
        { status: 200 }
      )
    );
  }

  if (url.includes('securitylabs.datadoghq.com/articles/axios-npm-supply-chain-compromise')) {
    return Promise.resolve(
      new Response(
        `
        <html>
          <head><title>Axios npm supply chain compromise - Datadog Security Labs</title></head>
          <body>
            <article>
              <h1>Axios npm package was compromised in a supply chain attack</h1>
              <p>March 31, 2026</p>
              <p>Datadog Security Labs observed malicious axios releases 1.14.1 and 0.30.4 pulling plain-crypto-js via postinstall to deploy a cross-platform RAT.</p>
            </article>
          </body>
        </html>`,
        { status: 200 }
      )
    );
  }

  if (url.includes('businessinsights.bitdefender.com/technical-advisory-axios-npm-supply-chain-attack')) {
    return Promise.resolve(
      new Response(
        `
        <html>
          <head><title>Technical Advisory: axios npm supply chain attack</title></head>
          <body>
            <article>
              <h1>Technical Advisory: axios npm supply chain attack deploys cross-platform RAT</h1>
              <p>March 31, 2026</p>
              <p>Bitdefender confirmed compromised axios releases and advised immediate version pinning, token rotation, and host triage for postinstall execution artifacts.</p>
            </article>
          </body>
        </html>`,
        { status: 200 }
      )
    );
  }

  if (url.includes('cn-sec.com/archives/5140833.html')) {
    return Promise.resolve(
      new Response(
        `
        <html>
          <head><title>axios 疑似遭遇供应链投毒 - CN-SEC</title></head>
          <body>
            <article>
              <h1>axios 疑似遭遇供应链投毒，恶意版本通过 npm 发布</h1>
              <p>2026年3月31日</p>
              <p>社区监测显示攻击者通过被盗 npm 账号发布恶意 axios 版本，植入 plain-crypto-js 与 postinstall 远控链路。</p>
            </article>
          </body>
        </html>`,
        { status: 200 }
      )
    );
  }

  if (url.includes('finance.sina.com.cn/tech/digi/2026-03-31/doc-inhswicu3324323.shtml')) {
    return Promise.resolve(
      new Response(
        `
        <html>
          <head><title>axios 疑似被供应链攻击 - IT之家</title></head>
          <body>
            <article>
              <h1>知名网络请求库 axios 疑似被供应链攻击</h1>
              <p>2026年3月31日</p>
              <p>报道提到恶意版本 axios@1.14.1 与 axios@0.30.4 在 package.json 中加入伪装依赖，并通过 postinstall 下载执行跨平台木马。</p>
            </article>
          </body>
        </html>`,
        { status: 200 }
      )
    );
  }

  if (url.includes('lark.example.com/webhook')) {
    return Promise.resolve(new Response(JSON.stringify({ code: 0, msg: 'ok' }), { status: 200 }));
  }

  return Promise.resolve(new Response(buildFeedXml(url), { status: 200 }));
}

function buildFeedXml(url: string) {
  if (url.includes('openai.com/news/rss.xml')) {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Responses API adds agent orchestration tracing and tool sandbox controls</title>
            <link>https://openai.com/index/responses-api-agent-tracing</link>
            <pubDate>Tue, 31 Mar 2026 08:00:00 GMT</pubDate>
            <description>OpenAI introduces new agent workflow tracing, tool execution controls, and SDK updates for production orchestration.</description>
          </item>
          <item>
            <title>Accelerating the next phase of AI</title>
            <link>https://openai.com/index/accelerating-the-next-phase-ai</link>
            <pubDate>Mon, 30 Mar 2026 08:00:00 GMT</pubDate>
            <description>OpenAI raises new funding to expand global infrastructure.</description>
          </item>
        </channel>
      </rss>`;
  }

  if (url.includes('huggingface.co/blog/feed.xml')) {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <feed>
        <entry>
          <title>smolagents adds multi-agent workflow and tool execution runtime</title>
          <link href="https://huggingface.co/blog/smolagents-runtime" />
          <updated>2026-03-30T08:00:00Z</updated>
          <summary>New workflow runtime and agent orchestration improvements for multi-agent execution.</summary>
        </entry>
      </feed>`;
  }

  if (url.includes('anthropic.com/news/rss.xml')) {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Claude API adds tool use tracing and structured agent handoff</title>
            <link>https://www.anthropic.com/news/claude-api-tool-use-tracing</link>
            <pubDate>Sun, 29 Mar 2026 08:00:00 GMT</pubDate>
            <description>Anthropic adds tracing, structured handoff, and better tool execution controls for agent workflows.</description>
          </item>
        </channel>
      </rss>`;
  }

  if (url.includes('mistral.ai/news/rss.xml')) {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Mistral launches reasoning model with lower-latency API controls</title>
            <link>https://mistral.ai/news/reasoning-model-api-controls</link>
            <pubDate>Sat, 28 Mar 2026 08:00:00 GMT</pubDate>
            <description>New reasoning model, API controls, and inference options for production agent systems.</description>
          </item>
        </channel>
      </rss>`;
  }

  if (url.includes('blog.langchain.com/rss/')) {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>LangChain introduces Agent Middleware for runtime control and observability</title>
            <link>https://blog.langchain.com/agent-middleware-runtime-control</link>
            <pubDate>Fri, 27 Mar 2026 08:00:00 GMT</pubDate>
            <description>LangChain adds middleware hooks for agent execution, policy interception, observability, and runtime extensions.</description>
          </item>
        </channel>
      </rss>`;
  }

  if (url.includes('vercel.com/changelog/rss.xml')) {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>AI SDK adds streaming tool calls and structured outputs</title>
            <link>https://vercel.com/changelog/ai-sdk-streaming-tool-calls</link>
            <pubDate>Tue, 31 Mar 2026 07:00:00 GMT</pubDate>
            <description>Vercel AI SDK adds tool call streaming, structured outputs, and better provider integration for agent apps.</description>
          </item>
        </channel>
      </rss>`;
  }

  if (url.includes('hnrss.org/newest?q=AI+agent+LLM+OpenAI+Anthropic+LangChain')) {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Show HN: Open-source agent eval harness with workflow tracing</title>
            <link>https://news.ycombinator.com/item?id=44000001</link>
            <pubDate>Tue, 31 Mar 2026 06:00:00 GMT</pubDate>
            <description>Community discussion with links to benchmark details and GitHub repo.</description>
          </item>
        </channel>
      </rss>`;
  }

  if (url.includes('blog.google/technology/ai/rss/')) {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Google launches Gemini 3 Deep Think and Gemini 3.1 Flash Live</title>
            <link>https://blog.google/technology/ai/gemini-deep-think-flash-live/</link>
            <pubDate>Tue, 31 Mar 2026 16:00:00 GMT</pubDate>
            <description>Google AI Blog details deep reasoning upgrades for Gemini 3 Deep Think and low-latency audio generation for Gemini 3.1 Flash Live.</description>
          </item>
          <item>
            <title>Watch James Manyika talk AI and creativity with LL COOL J.</title>
            <link>https://blog.google/technology/ai/james-manyika-creativity-ll-cool-j/</link>
            <pubDate>Tue, 31 Mar 2026 12:00:00 GMT</pubDate>
            <description>In the latest episode James Manyika talks about creativity and culture.</description>
          </item>
          <item>
            <title>Transform your headphones into a live personal translator on iOS.</title>
            <link>https://blog.google/technology/ai/live-translator-ios-headphones/</link>
            <pubDate>Tue, 31 Mar 2026 10:00:00 GMT</pubDate>
            <description>Google Translate helps more users with a live personal translator on iOS headphones.</description>
          </item>
        </channel>
      </rss>`;
  }

  if (url.includes('nextjs.org/feed.xml')) {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Next.js Across Platforms: Adapters, OpenNext, and Our Commitments</title>
            <link>https://nextjs.org/blog/nextjs-across-platforms</link>
            <pubDate>Tue, 31 Mar 2026 08:00:00 GMT</pubDate>
            <description>Stable Adapter API, adapter test suite, and clearer deployment commitments across platforms.</description>
          </item>
        </channel>
      </rss>`;
  }

  if (url.includes('react.dev/feed.xml')) {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <feed>
        <entry>
          <title>React Compiler roadmap and RSC integration updates</title>
          <link href="https://react.dev/blog/react-compiler-roadmap" />
          <updated>2026-03-29T08:00:00Z</updated>
          <summary>React team shares compiler rollout, RSC alignment, and migration notes for production apps.</summary>
        </entry>
      </feed>`;
  }

  if (url.includes('vite.dev/blog.rss')) {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Vite 8 release candidate improves SSR and plugin container performance</title>
            <link>https://vite.dev/blog/vite-8-rc</link>
            <pubDate>Sat, 28 Mar 2026 08:00:00 GMT</pubDate>
            <description>SSR pipeline and plugin container improvements for larger frontend applications.</description>
          </item>
        </channel>
      </rss>`;
  }

  if (url.includes('eslint.org/feed.xml')) {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>ESLint v10 completes Flat Config migration and JSX tracking improvements</title>
            <link>https://eslint.org/blog/2026/04/eslint-v10-flat-config</link>
            <pubDate>Wed, 01 Apr 2026 08:00:00 GMT</pubDate>
            <description>ESLint v10 removes legacy eslintrc support, defaults teams to Flat Config, and improves JSX tracking for monorepos.</description>
          </item>
        </channel>
      </rss>`;
  }

  if (url.includes('astro.build/rss.xml')) {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Astro 6.0 ships with Vite Environment API integration</title>
            <link>https://astro.build/blog/astro-6-vite-environment-api</link>
            <pubDate>Sat, 28 Mar 2026 08:00:00 GMT</pubDate>
            <description>Astro 6 aligns dev and production SSR behavior through Vite's new Environment API and adds native fonts support.</description>
          </item>
        </channel>
      </rss>`;
  }

  if (url.includes('web.dev/feed.xml')) {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Baseline adds new Web API compatibility milestone</title>
            <link>https://web.dev/baseline-api-milestone</link>
            <pubDate>Mon, 30 Mar 2026 08:00:00 GMT</pubDate>
            <description>Baseline and browser compatibility guidance for new Web API rollout across major engines.</description>
          </item>
        </channel>
      </rss>`;
  }

  if (url.includes('www.smashingmagazine.com/feed/')) {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Light-Dark Mode Switching For Images</title>
            <link>https://www.smashingmagazine.com/2026/03/light-dark-images/</link>
            <pubDate>Tue, 31 Mar 2026 08:00:00 GMT</pubDate>
            <description>light-dark() now helps switch image assets for dark mode without media-query heavy CSS or JavaScript listeners.</description>
          </item>
        </channel>
      </rss>`;
  }

  if (url.includes('css-tricks.com/feed/')) {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Using light-dark() for image assets in design systems</title>
            <link>https://css-tricks.com/light-dark-image-assets/</link>
            <pubDate>Mon, 30 Mar 2026 08:00:00 GMT</pubDate>
            <description>Design systems can use native CSS light-dark() support to simplify dark mode image switching.</description>
          </item>
        </channel>
      </rss>`;
  }

  if (url.includes('frontendfoc.us/rss')) {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Frontend Focus highlights Vite 8, Astro 6, and ESLint v10</title>
            <link>https://frontendfoc.us/issues/999</link>
            <pubDate>Wed, 01 Apr 2026 08:00:00 GMT</pubDate>
            <description>Weekly roundup covering Environment API adoption, Flat Config migration, and browser platform changes.</description>
          </item>
        </channel>
      </rss>`;
  }

  if (url.includes('developer.chrome.com/static/blog/feed.xml')) {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Chrome introduces new View Transition and Web Platform diagnostics</title>
            <link>https://developer.chrome.com/blog/view-transition-diagnostics</link>
            <pubDate>Sun, 29 Mar 2026 08:00:00 GMT</pubDate>
            <description>New diagnostics and platform capabilities for complex app transitions and performance debugging.</description>
          </item>
        </channel>
      </rss>`;
  }

  if (url.includes('blog.cloudflare.com/rss/')) {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Cloudflare Workers adapter improves Next.js edge deployment consistency</title>
            <link>https://blog.cloudflare.com/nextjs-workers-adapter</link>
            <pubDate>Sat, 28 Mar 2026 08:00:00 GMT</pubDate>
            <description>Adapter and edge deployment improvements for Next.js apps running on Workers.</description>
          </item>
        </channel>
      </rss>`;
  }

  if (url.includes('vercel.com/blog/rss.xml')) {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Vercel previews better adapter testing for multi-platform Next.js deploys</title>
            <link>https://vercel.com/blog/nextjs-adapter-testing</link>
            <pubDate>Fri, 27 Mar 2026 08:00:00 GMT</pubDate>
            <description>Adapter test suite and deployment consistency updates for multi-platform Next.js applications.</description>
          </item>
        </channel>
      </rss>`;
  }

  if (url.includes('hnrss.org/newest?q=React+Vite+Next.js+TypeScript+Web+Platform')) {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Show HN: Deep dive into Next.js adapter internals and deployment tradeoffs</title>
            <link>https://news.ycombinator.com/item?id=44000002</link>
            <pubDate>Tue, 31 Mar 2026 06:00:00 GMT</pubDate>
            <description>Community thread linking benchmark data, GitHub repo, and deployment notes for adapters.</description>
          </item>
        </channel>
      </rss>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>TypeScript tooling update for editor and build workflows</title>
            <link>${url.replace(/feed\.xml|rss\.xml|feed\/|blog\.rss|feed\.?$/i, '')}post-1</link>
            <pubDate>Tue, 31 Mar 2026 08:00:00 GMT</pubDate>
            <description>Official release notes with tooling, API, workflow, and platform updates.</description>
          </item>
        </channel>
      </rss>`;
}
