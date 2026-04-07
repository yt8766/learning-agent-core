import { vi } from 'vitest';

import { ActionIntent } from '@agent/shared';

import { AgentOrchestrator } from '../src/graphs/main/main.graph';

export const createRuntimeRepository = (snapshot?: any) => ({
  load: vi.fn(
    async () =>
      snapshot ?? {
        tasks: [],
        learningJobs: [],
        pendingExecutions: [],
        chatSessions: [],
        chatMessages: [],
        chatEvents: [],
        chatCheckpoints: []
      }
  ),
  save: vi.fn(async () => undefined)
});

export const createLlmProvider = (): {
  isConfigured: () => boolean;
  generateText: () => Promise<string>;
  streamText: () => Promise<string>;
  generateObject: ReturnType<typeof vi.fn>;
} => ({
  isConfigured: vi.fn(() => false),
  generateText: vi.fn(async () => ''),
  streamText: vi.fn(async () => ''),
  generateObject: vi.fn()
});

export const createOrchestrator = (
  snapshot?: any,
  options?: { memorySearchResults?: any[]; ruleSearchResults?: any[] }
) => {
  return new AgentOrchestrator({
    memoryRepository: {
      append: vi.fn(),
      search: vi.fn(async () => options?.memorySearchResults ?? []),
      getById: vi.fn()
    } as never,
    memorySearchService: {
      search: vi.fn(async () => ({
        memories: options?.memorySearchResults ?? [],
        rules: options?.ruleSearchResults ?? []
      }))
    } as never,
    skillRegistry: {
      publishToLab: vi.fn(),
      list: vi.fn(async () => []),
      getById: vi.fn(),
      recordExecutionResult: vi.fn(async () => undefined),
      promote: vi.fn(),
      disable: vi.fn()
    } as never,
    approvalService: {
      requiresApproval: vi.fn((intent: ActionIntent, tool?: { requiresApproval?: boolean }) => {
        return (
          intent === ActionIntent.WRITE_FILE ||
          intent === ActionIntent.CALL_EXTERNAL_API ||
          Boolean(tool?.requiresApproval)
        );
      }),
      getDefaultDecision: vi.fn((intent: ActionIntent, tool?: { requiresApproval?: boolean }) =>
        intent === ActionIntent.WRITE_FILE ||
        intent === ActionIntent.CALL_EXTERNAL_API ||
        Boolean(tool?.requiresApproval)
          ? 'pending'
          : 'approved'
      ),
      evaluate: vi.fn((intent: ActionIntent, tool?: { requiresApproval?: boolean }) => {
        const requiresApproval =
          intent === ActionIntent.WRITE_FILE ||
          intent === ActionIntent.CALL_EXTERNAL_API ||
          Boolean(tool?.requiresApproval);
        return {
          requiresApproval,
          reason: requiresApproval ? 'mock approval required' : 'mock policy auto approved',
          reasonCode: requiresApproval ? 'requires_approval_tool_policy' : 'approved_by_policy'
        };
      }),
      evaluateWithClassifier: vi.fn(async (intent: ActionIntent, tool?: { requiresApproval?: boolean }) => {
        const requiresApproval =
          intent === ActionIntent.WRITE_FILE ||
          intent === ActionIntent.CALL_EXTERNAL_API ||
          Boolean(tool?.requiresApproval);
        return {
          requiresApproval,
          reason: requiresApproval ? 'mock approval required' : 'mock policy auto approved',
          reasonCode: requiresApproval ? 'requires_approval_tool_policy' : 'approved_by_policy'
        };
      })
    } as never,
    runtimeStateRepository: createRuntimeRepository(snapshot) as never,
    llmProvider: createLlmProvider() as never,
    ruleRepository: { list: vi.fn(), append: vi.fn() } as never,
    sandboxExecutor: {
      execute: vi.fn(async (request: { toolName: string; input?: Record<string, unknown> }) => {
        if (request.toolName === 'webSearchPrime') {
          const query = typeof request.input?.query === 'string' ? request.input.query : '智能搜索';
          const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
          return {
            ok: true,
            outputSummary: '已检索到可引用网页结果',
            rawOutput: {
              query,
              results: [
                {
                  url: 'https://docs.example.com/product-plan-review',
                  title: '产品规划评审方法',
                  summary: '关于产品规划评审、商业闭环和风险识别的结构化文章。',
                  sourceType: 'web',
                  trustClass: 'official',
                  fetchedAt: '2026-03-28T00:00:00.000Z'
                },
                {
                  url: searchUrl,
                  title: 'Bing 搜索结果',
                  summary: '开放网页搜索结果页，可继续扩展研究。',
                  sourceType: 'web_search_result',
                  trustClass: 'official',
                  fetchedAt: '2026-03-28T00:00:00.000Z'
                }
              ]
            },
            durationMs: 1,
            exitCode: 0
          };
        }

        if (request.toolName === 'collect_research_source') {
          const url =
            typeof request.input?.url === 'string'
              ? request.input.url
              : 'https://www.bing.com/search?q=%E6%99%BA%E8%83%BD%E6%90%9C%E7%B4%A2';
          return {
            ok: true,
            outputSummary: '已抓取研究来源摘要',
            rawOutput: {
              url,
              summary: '已从搜索结果中提取结构化摘要。',
              sourceType: 'web',
              trustClass: 'official',
              fetchedAt: '2026-03-28T00:00:00.000Z'
            },
            durationMs: 1,
            exitCode: 0
          };
        }

        if (request.toolName === 'webReader') {
          const url =
            typeof request.input?.url === 'string' ? request.input.url : 'https://docs.example.com/product-plan-review';
          return {
            ok: true,
            outputSummary: '已读取网页正文并提炼可引用依据',
            rawOutput: {
              url,
              title: '产品规划评审方法',
              summary: '网页正文强调先看业务闭环、转化效率、风险与资金路径，而不是只堆功能点。',
              sourceType: 'document',
              trustClass: 'official',
              fetchedAt: '2026-03-28T00:00:00.000Z'
            },
            durationMs: 1,
            exitCode: 0
          };
        }

        return {
          ok: true,
          outputSummary: 'sandbox executed',
          durationMs: 1,
          exitCode: 0
        };
      })
    } as never
  }) as any;
};
