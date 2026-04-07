import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { AgentRole } from '@agent/shared';

import { BaseAgent } from '../../../src/flows/chat/base-agent';

class TestAgent extends BaseAgent {
  async runGenerateText() {
    return this.generateText([{ role: 'user', content: 'hello' }], {
      role: 'manager',
      thinking: false
    });
  }

  async runGenerateObject() {
    return this.generateObject([{ role: 'user', content: 'hello' }], z.object({ ok: z.boolean() }), {
      role: 'manager',
      thinking: false
    });
  }
}

describe('BaseAgent model fallback', () => {
  it('在 429 时会自动降级到 fallback model', async () => {
    const llm = {
      isConfigured: vi.fn(() => true),
      generateText: vi
        .fn()
        .mockRejectedValueOnce(new Error('429 Too Many Requests'))
        .mockResolvedValueOnce('fallback answer'),
      generateObject: vi.fn(),
      streamText: vi.fn()
    };

    const agent = new TestAgent(AgentRole.MANAGER, {
      taskId: 'task-1',
      goal: 'test',
      flow: 'chat',
      memoryRepository: {} as never,
      skillRegistry: {} as never,
      approvalService: {} as never,
      toolRegistry: {} as never,
      sandbox: {} as never,
      llm: llm as never,
      currentWorker: {
        id: 'worker-1',
        ministry: 'libu-router',
        kind: 'core',
        displayName: 'worker',
        defaultModel: 'claude-3.5-sonnet',
        supportedCapabilities: [],
        reviewPolicy: 'none'
      },
      budgetState: {
        stepBudget: 1,
        stepsConsumed: 0,
        retryBudget: 1,
        retriesConsumed: 0,
        sourceBudget: 1,
        sourcesConsumed: 0,
        fallbackModelId: 'gpt-4o-mini'
      },
      thinking: {
        manager: false,
        research: false,
        executor: false,
        reviewer: false
      }
    });

    const result = await agent.runGenerateText();

    expect(result).toBe('fallback answer');
    expect(llm.generateText).toHaveBeenNthCalledWith(
      1,
      [{ role: 'user', content: 'hello' }],
      expect.objectContaining({ modelId: 'claude-3.5-sonnet' })
    );
    expect(llm.generateText).toHaveBeenNthCalledWith(
      2,
      [{ role: 'user', content: 'hello' }],
      expect.objectContaining({ modelId: 'gpt-4o-mini' })
    );
  });

  it('结构化输出节点也会复用 fallback model', async () => {
    const llm = {
      isConfigured: vi.fn(() => true),
      generateText: vi.fn(),
      generateObject: vi.fn().mockRejectedValueOnce(new Error('provider timeout')).mockResolvedValueOnce({ ok: true }),
      streamText: vi.fn()
    };

    const agent = new TestAgent(AgentRole.MANAGER, {
      taskId: 'task-2',
      goal: 'test',
      flow: 'chat',
      memoryRepository: {} as never,
      skillRegistry: {} as never,
      approvalService: {} as never,
      toolRegistry: {} as never,
      sandbox: {} as never,
      llm: llm as never,
      currentWorker: {
        id: 'worker-1',
        ministry: 'libu-router',
        kind: 'core',
        displayName: 'worker',
        defaultModel: 'claude-3.5-sonnet',
        supportedCapabilities: [],
        reviewPolicy: 'none'
      },
      budgetState: {
        stepBudget: 1,
        stepsConsumed: 0,
        retryBudget: 1,
        retriesConsumed: 0,
        sourceBudget: 1,
        sourcesConsumed: 0,
        fallbackModelId: 'gpt-4o-mini'
      },
      thinking: {
        manager: false,
        research: false,
        executor: false,
        reviewer: false
      }
    });

    const result = await agent.runGenerateObject();

    expect(result).toEqual({ ok: true });
    expect(llm.generateObject).toHaveBeenNthCalledWith(
      1,
      [{ role: 'user', content: 'hello' }],
      expect.anything(),
      expect.objectContaining({ modelId: 'claude-3.5-sonnet' })
    );
    expect(llm.generateObject).toHaveBeenNthCalledWith(
      2,
      [{ role: 'user', content: 'hello' }],
      expect.anything(),
      expect.objectContaining({ modelId: 'gpt-4o-mini' })
    );
  });
});
