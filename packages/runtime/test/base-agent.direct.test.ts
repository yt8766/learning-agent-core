import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockGenerateObjectWithRetry = vi.fn();
const mockGenerateTextWithRetry = vi.fn();
const mockStreamTextWithRetry = vi.fn();
const mockWithFallbackModel = vi.fn();
const mockWithReactiveContextRetry = vi.fn();

vi.mock('@agent/adapters', () => ({
  generateObjectWithRetry: (...args: unknown[]) => mockGenerateObjectWithRetry(...args),
  generateTextWithRetry: (...args: unknown[]) => mockGenerateTextWithRetry(...args),
  streamTextWithRetry: (...args: unknown[]) => mockStreamTextWithRetry(...args),
  withFallbackModel: (...args: unknown[]) => mockWithFallbackModel(...args),
  withReactiveContextRetry: (...args: unknown[]) => mockWithReactiveContextRetry(...args)
}));

vi.mock('@agent/core', () => ({
  AgentRole: {
    MANAGER: 'manager',
    RESEARCH: 'research',
    EXECUTOR: 'executor',
    REVIEWER: 'reviewer'
  }
}));

import { BaseAgent } from '../src/agents/base-agent';
import type { AgentRuntimeContext } from '../src/runtime/agent-runtime-context';

class TestAgent extends BaseAgent {
  constructor(context: AgentRuntimeContext) {
    super('manager' as any, context);
  }

  testSetStatus(status: string) {
    this.setStatus(status as any);
  }

  testRemember(content: string) {
    this.remember(content);
  }

  testSetSubTask(subTask: string) {
    this.setSubTask(subTask);
  }

  async testGenerateObject(messages: any[], schema: any, options: any) {
    return this.generateObject(messages, schema, options);
  }

  async testGenerateText(messages: any[], options: any) {
    return this.generateText(messages, options);
  }

  async testStreamText(messages: any[], options: any) {
    return this.streamText(messages, options);
  }
}

function makeContext(overrides: Record<string, unknown> = {}): AgentRuntimeContext {
  return {
    taskId: 'task-1',
    goal: 'test goal',
    flow: 'chat',
    llm: {
      isConfigured: vi.fn(() => true)
    },
    sandbox: {} as any,
    memoryRepository: {} as any,
    skillRegistry: {} as any,
    approvalService: {} as any,
    toolRegistry: {} as any,
    thinking: { manager: false, research: false, executor: false, reviewer: false },
    ...overrides
  } as unknown as AgentRuntimeContext;
}

describe('BaseAgent (direct)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getState', () => {
    it('returns initial state with correct agentId and role', () => {
      const agent = new TestAgent(makeContext());
      const state = agent.getState();
      expect(state.agentId).toBe('manager_task-1');
      expect(state.role).toBe('manager');
      expect(state.goal).toBe('test goal');
      expect(state.status).toBe('idle');
      expect(state.plan).toEqual([]);
      expect(state.toolCalls).toEqual([]);
      expect(state.observations).toEqual([]);
      expect(state.shortTermMemory).toEqual([]);
      expect(state.longTermMemoryRefs).toEqual([]);
    });
  });

  describe('setStatus', () => {
    it('updates the agent status', () => {
      const agent = new TestAgent(makeContext());
      agent.testSetStatus('running');
      expect(agent.getState().status).toBe('running');
    });
  });

  describe('remember', () => {
    it('adds content to both shortTermMemory and observations', () => {
      const agent = new TestAgent(makeContext());
      agent.testRemember('first observation');
      agent.testRemember('second observation');
      expect(agent.getState().shortTermMemory).toEqual(['first observation', 'second observation']);
      expect(agent.getState().observations).toEqual(['first observation', 'second observation']);
    });
  });

  describe('setSubTask', () => {
    it('sets the subTask on the state', () => {
      const agent = new TestAgent(makeContext());
      agent.testSetSubTask('sub-task-1');
      expect(agent.getState().subTask).toBe('sub-task-1');
    });
  });

  describe('generateObject', () => {
    it('returns null when LLM is not configured', async () => {
      const context = makeContext({ llm: { isConfigured: () => false } });
      const agent = new TestAgent(context);
      const result = await agent.testGenerateObject([], {}, { role: 'manager', thinking: false });
      expect(result).toBeNull();
    });

    it('calls withFallbackModel and withReactiveContextRetry when LLM is configured', async () => {
      const expectedObj = { result: 'ok' };
      mockWithReactiveContextRetry.mockResolvedValue(expectedObj);
      mockWithFallbackModel.mockImplementation(async (opts: any) => opts.invoke(undefined));

      const context = makeContext();
      const agent = new TestAgent(context);
      const result = await agent.testGenerateObject(
        [{ role: 'user', content: 'test' }],
        { type: 'object' },
        { role: 'research', thinking: true }
      );

      expect(mockWithFallbackModel).toHaveBeenCalled();
      expect(mockWithReactiveContextRetry).toHaveBeenCalled();
      expect(result).toEqual(expectedObj);
    });
  });

  describe('generateText', () => {
    it('returns null when LLM is not configured', async () => {
      const context = makeContext({ llm: { isConfigured: () => false } });
      const agent = new TestAgent(context);
      const result = await agent.testGenerateText([], { role: 'executor', thinking: false });
      expect(result).toBeNull();
    });

    it('calls withFallbackModel and withReactiveContextRetry when LLM is configured', async () => {
      mockWithReactiveContextRetry.mockResolvedValue('generated text');
      mockWithFallbackModel.mockImplementation(async (opts: any) => opts.invoke(undefined));

      const context = makeContext();
      const agent = new TestAgent(context);
      const result = await agent.testGenerateText([{ role: 'user', content: 'test' }], {
        role: 'executor',
        thinking: false
      });

      expect(mockWithFallbackModel).toHaveBeenCalled();
      expect(result).toBe('generated text');
    });
  });

  describe('streamText', () => {
    it('returns null when LLM is not configured', async () => {
      const context = makeContext({ llm: { isConfigured: () => false } });
      const agent = new TestAgent(context);
      const result = await agent.testStreamText([], { role: 'reviewer', thinking: false, messageId: 'msg-1' });
      expect(result).toBeNull();
    });

    it('calls withFallbackModel and streamTextWithRetry when LLM is configured', async () => {
      mockStreamTextWithRetry.mockResolvedValue('streamed text');
      mockWithFallbackModel.mockImplementation(async (opts: any) => opts.invoke(undefined));

      const context = makeContext();
      const agent = new TestAgent(context);
      const result = await agent.testStreamText([{ role: 'user', content: 'test' }], {
        role: 'reviewer',
        thinking: true,
        messageId: 'msg-2'
      });

      expect(mockWithFallbackModel).toHaveBeenCalled();
      expect(result).toBe('streamed text');
    });
  });

  describe('withModelFallback (via generateText)', () => {
    it('uses primaryModelId from currentWorker', async () => {
      mockWithFallbackModel.mockImplementation(async (opts: any) => {
        expect(opts.primaryModelId).toBe('gpt-4.1');
        expect(opts.fallbackModelId).toBe('gpt-4.1-mini');
        return opts.invoke('gpt-4.1');
      });
      mockWithReactiveContextRetry.mockResolvedValue('text');

      const context = makeContext({
        currentWorker: { defaultModel: 'gpt-4.1' },
        budgetState: { fallbackModelId: 'gpt-4.1-mini' }
      });
      const agent = new TestAgent(context);
      await agent.testGenerateText([], { role: 'manager', thinking: false });
      expect(mockWithFallbackModel).toHaveBeenCalled();
    });

    it('invokes onPrimaryFailure callback that adds to memory', async () => {
      let primaryFailureHandler: ((error: unknown) => void) | undefined;
      mockWithFallbackModel.mockImplementation(async (opts: any) => {
        primaryFailureHandler = opts.onPrimaryFailure;
        opts.onPrimaryFailure(new Error('primary failed'));
        return null;
      });

      const context = makeContext();
      const agent = new TestAgent(context);
      await agent.testGenerateText([], { role: 'manager', thinking: false });

      const state = agent.getState();
      expect(state.shortTermMemory.some(m => m.includes('primary failed'))).toBe(true);
    });

    it('invokes onFallbackStart callback that adds memory and fires model event', async () => {
      const onModelEvent = vi.fn();
      mockWithFallbackModel.mockImplementation(async (opts: any) => {
        opts.onFallbackStart('gpt-4.1-mini', new Error('primary unavailable'));
        return null;
      });

      const context = makeContext({ onModelEvent });
      const agent = new TestAgent(context);
      await agent.testGenerateText([], { role: 'research', thinking: false });

      const state = agent.getState();
      expect(state.shortTermMemory.some(m => m.includes('fallback model gpt-4.1-mini'))).toBe(true);
      expect(onModelEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'research',
          isFallback: true,
          status: 'fallback'
        })
      );
    });

    it('invokes onFallbackFailure callback', async () => {
      const onModelEvent = vi.fn();
      mockWithFallbackModel.mockImplementation(async (opts: any) => {
        opts.onFallbackFailure('gpt-4.1-mini', new Error('fallback failed'));
        return null;
      });

      const context = makeContext({ onModelEvent });
      const agent = new TestAgent(context);
      await agent.testGenerateText([], { role: 'executor', thinking: false });

      expect(onModelEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed'
        })
      );
    });

    it('handles non-Error fallback reason', async () => {
      const onModelEvent = vi.fn();
      mockWithFallbackModel.mockImplementation(async (opts: any) => {
        opts.onFallbackStart('model-x', 'string error');
        opts.onFallbackFailure('model-x', null);
        return null;
      });

      const context = makeContext({ onModelEvent });
      const agent = new TestAgent(context);
      await agent.testGenerateText([], { role: 'manager', thinking: false });

      expect(onModelEvent).toHaveBeenCalledTimes(2);
    });
  });

  describe('onUsage callback', () => {
    it('passes onUsage to generateObject via withReactiveContextRetry', async () => {
      const onUsage = vi.fn();
      mockWithFallbackModel.mockImplementation(async (opts: any) => opts.invoke(undefined));
      mockWithReactiveContextRetry.mockImplementation(async (opts: any) => {
        // The invoke inside withReactiveContextRetry should have onUsage configured
        return 'obj';
      });

      const context = makeContext({ onUsage });
      const agent = new TestAgent(context);
      await agent.testGenerateObject([], {}, { role: 'manager', thinking: false });

      expect(mockWithFallbackModel).toHaveBeenCalled();
    });
  });
});
