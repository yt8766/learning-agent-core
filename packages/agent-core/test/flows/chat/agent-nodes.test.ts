import { describe, expect, it, vi } from 'vitest';

import { ActionIntent, AgentRole, type SkillCard, type ToolDefinition } from '@agent/shared';

import { ExecutorAgent } from '../../../src/flows/chat/nodes/executor-node';
import { ResearchAgent } from '../../../src/flows/chat/nodes/research-node';
import { ReviewerAgent } from '../../../src/flows/chat/nodes/reviewer-node';

const WEB_SEARCH_TOOL: ToolDefinition = {
  name: 'webSearchPrime',
  description: 'Search the web',
  family: 'browser',
  category: 'research',
  riskLevel: 'low',
  requiresApproval: false,
  timeoutMs: 1000,
  sandboxProfile: 'workspace-readonly',
  capabilityType: 'local-tool',
  isReadOnly: true,
  isConcurrencySafe: true,
  isDestructive: false,
  supportsStreamingDispatch: true,
  permissionScope: 'readonly',
  inputSchema: {}
};

const WEB_READER_TOOL: ToolDefinition = {
  ...WEB_SEARCH_TOOL,
  name: 'webReader',
  description: 'Read a webpage'
};

const RUN_TERMINAL_TOOL: ToolDefinition = {
  ...WEB_SEARCH_TOOL,
  name: 'run_terminal',
  description: 'Run a terminal command',
  family: 'terminal',
  category: 'action',
  riskLevel: 'high',
  requiresApproval: true,
  sandboxProfile: 'workspace-write',
  isReadOnly: false,
  isConcurrencySafe: false,
  supportsStreamingDispatch: false,
  permissionScope: 'workspace-write'
};

function createContext(overrides: Record<string, unknown> = {}) {
  const tools = [WEB_SEARCH_TOOL, WEB_READER_TOOL, RUN_TERMINAL_TOOL];
  const sandboxExecute = vi.fn(async (request: { toolName: string; input?: Record<string, unknown> }) => {
    if (request.toolName === 'webSearchPrime') {
      return {
        ok: true,
        outputSummary: '找到官方网页结果',
        rawOutput: {
          results: [
            { url: 'https://www.bing.com/search?q=test', title: 'Search result page' },
            { url: 'https://docs.example.com/runtime', title: 'Runtime docs', sourceType: 'web' }
          ]
        },
        durationMs: 8,
        exitCode: 0
      };
    }

    if (request.toolName === 'webReader') {
      return {
        ok: true,
        outputSummary: '已读取网页正文',
        rawOutput: {
          url: String(request.input?.url ?? ''),
          title: 'Runtime docs',
          summary: '网页正文强调运行时治理与执行恢复。',
          sourceType: 'document',
          trustClass: 'official'
        },
        durationMs: 6,
        exitCode: 0
      };
    }

    return {
      ok: true,
      outputSummary: 'sandbox executed',
      rawOutput: { request },
      durationMs: 1,
      exitCode: 0
    };
  });

  const context = {
    taskId: 'task-1',
    goal: '帮我看看最新的 runtime 文档',
    flow: 'chat',
    executionMode: 'execute',
    externalSources: [
      {
        sourceType: 'web',
        sourceUrl: 'https://docs.example.com/runtime',
        trustClass: 'official',
        summary: '官方 runtime 文档'
      }
    ],
    memoryRepository: {
      search: vi.fn(async () => []),
      append: vi.fn(),
      getById: vi.fn()
    },
    memorySearchService: {
      search: vi.fn(async () => ({
        memories: [],
        rules: []
      }))
    },
    skillRegistry: {
      list: vi.fn(async () => []),
      getById: vi.fn(async () => undefined)
    },
    approvalService: {
      evaluate: vi.fn((intent: ActionIntent, tool?: { requiresApproval?: boolean }) => ({
        requiresApproval:
          intent === ActionIntent.WRITE_FILE ||
          intent === ActionIntent.CALL_EXTERNAL_API ||
          Boolean(tool?.requiresApproval),
        reason: '需要审批',
        reasonCode: 'requires_approval_tool_policy'
      })),
      evaluateWithClassifier: vi.fn(async (intent: ActionIntent, tool?: { requiresApproval?: boolean }) => ({
        requiresApproval:
          intent === ActionIntent.WRITE_FILE ||
          intent === ActionIntent.CALL_EXTERNAL_API ||
          Boolean(tool?.requiresApproval),
        reason: '需要审批',
        reasonCode: 'requires_approval_tool_policy'
      }))
    },
    toolRegistry: {
      list: vi.fn(() => tools),
      get: vi.fn((name: string) => tools.find(tool => tool.name === name)),
      getForIntent: vi.fn((intent: ActionIntent) => {
        switch (intent) {
          case ActionIntent.CALL_EXTERNAL_API:
            return WEB_SEARCH_TOOL;
          case ActionIntent.WRITE_FILE:
            return RUN_TERMINAL_TOOL;
          default:
            return WEB_SEARCH_TOOL;
        }
      })
    },
    sandbox: {
      execute: sandboxExecute
    },
    llm: {
      isConfigured: vi.fn(() => false),
      generateText: vi.fn(),
      streamText: vi.fn(),
      generateObject: vi.fn()
    },
    thinking: {
      manager: false,
      research: false,
      executor: false,
      reviewer: false
    },
    ...overrides
  };

  return { context, sandboxExecute };
}

describe('chat agent nodes', () => {
  it('ExecutorAgent follows web search with webReader for browse-style workflows', async () => {
    const { context, sandboxExecute } = createContext({
      goal: '帮我打开 runtime 首页并总结重点',
      workflowPreset: {
        id: 'browse',
        displayName: 'Browse',
        allowedCapabilities: ['webSearchPrime', 'webReader']
      }
    });
    const agent = new ExecutorAgent(context as never);

    const result = await agent.run('检查 runtime 文档', '先读官方网页');

    expect(result.requiresApproval).toBe(false);
    expect(result.toolName).toBe('webSearchPrime');
    expect(result.summary).toContain('找到官方网页结果；已读取网页正文');
    expect(result.executionResult?.rawOutput).toEqual(
      expect.objectContaining({
        followedBy: {
          toolName: 'webReader',
          url: 'https://docs.example.com/runtime'
        }
      })
    );
    expect(sandboxExecute).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        toolName: 'webSearchPrime',
        input: expect.objectContaining({
          query: '帮我打开 runtime 首页并总结重点',
          freshnessHint: 'general'
        })
      })
    );
    expect(sandboxExecute).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        toolName: 'webReader',
        input: expect.objectContaining({
          url: 'https://docs.example.com/runtime'
        })
      })
    );
  });

  it('ExecutorAgent returns approval metadata when the selected route requires approval', async () => {
    const { context, sandboxExecute } = createContext({
      goal: '/qa 帮我回归测试',
      workflowPreset: {
        id: 'qa',
        displayName: 'QA',
        allowedCapabilities: ['run_terminal']
      },
      currentWorker: {
        id: 'worker-qa',
        ministry: 'bingbu-ops',
        kind: 'company',
        displayName: 'QA Worker',
        supportedCapabilities: ['terminal'],
        reviewPolicy: 'none'
      },
      mcpClientManager: {
        describeToolRoute: vi.fn(() => ({
          serverId: 'sandbox-terminal',
          capabilityId: 'cap-terminal',
          requiresApproval: true
        })),
        invokeTool: vi.fn(),
        hasCapability: vi.fn(() => false)
      }
    });
    const agent = new ExecutorAgent(context as never);

    const result = await agent.run('执行 QA', '先跑一轮基础测试');

    expect(result).toMatchObject({
      toolName: 'run_terminal',
      requiresApproval: true,
      serverId: 'sandbox-terminal',
      capabilityId: 'cap-terminal',
      approvalReasonCode: 'requires_approval_tool_policy'
    });
    expect(result.approvalPreview).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: 'Command', value: 'pnpm exec vitest --help' })])
    );
    expect(sandboxExecute).not.toHaveBeenCalled();
  });

  it('ResearchAgent falls back to chat-skill summary when no llm is configured', async () => {
    const chatSkill: SkillCard = {
      id: 'persona-chat',
      name: '聊天人格',
      description: '用于聊天和角色设定',
      status: 'stable',
      applicableGoals: ['角色扮演', '聊天'],
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
      steps: [],
      constraints: [],
      successSignals: []
    } as SkillCard;
    const memory = {
      id: 'memory-1',
      summary: '过去的聊天 persona 研究',
      tags: ['research-job', 'auto-persist'],
      content: 'content'
    };
    const { context } = createContext({
      goal: '请扮演一个严谨的架构师和我聊天',
      memorySearchService: {
        search: vi.fn(async () => ({
          memories: [memory],
          rules: []
        }))
      },
      skillRegistry: {
        list: vi.fn(async () => [chatSkill])
      }
    });
    const agent = new ResearchAgent(context as never);

    const result = await agent.run('研究聊天 persona 资料');

    expect(result.summary).toContain('已找到 1 个与聊天/角色设定相关的技能');
    expect(result.memories).toEqual([memory]);
    expect(result.skills).toEqual([chatSkill]);
    expect(agent.getState().longTermMemoryRefs).toEqual(['memory-1']);
    expect(agent.getState().status).toBe('completed');
  });

  it('ReviewerAgent blocks unexecuted work and records baseline notes', async () => {
    const { context } = createContext();
    const agent = new ReviewerAgent(context as never);

    const result = await agent.review(undefined, '等待人工审批后继续');

    expect(result.review.decision).toBe('blocked');
    expect(result.evaluation.success).toBe(false);
    expect(result.evaluation.shouldCreateRule).toBe(true);
    expect(result.evaluation.notes).toEqual(expect.arrayContaining([expect.stringContaining('需要人工审批')]));
    expect(agent.getState().status).toBe('failed');
  });

  it('ReviewerAgent accepts llm review overrides when execution completed', async () => {
    const { context } = createContext({
      llm: {
        isConfigured: vi.fn(() => true),
        generateText: vi.fn(),
        streamText: vi.fn(),
        generateObject: vi.fn(async () => ({
          decision: 'approved',
          quality: 'high',
          shouldRetry: false,
          shouldWriteMemory: true,
          shouldCreateRule: false,
          shouldExtractSkill: true,
          notes: ['执行质量高，可以沉淀技能。']
        }))
      }
    });
    const agent = new ReviewerAgent(context as never);

    const result = await agent.review(
      {
        ok: true,
        outputSummary: '执行成功',
        durationMs: 10,
        exitCode: 0
      },
      '执行成功并产出结果'
    );

    expect(result.review.decision).toBe('approved');
    expect(result.evaluation).toMatchObject({
      success: true,
      quality: 'high',
      shouldCreateRule: false,
      shouldExtractSkill: true
    });
    expect(result.evaluation.notes).toEqual(['执行质量高，可以沉淀技能。']);
  });
});
