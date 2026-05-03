import { ModelInvocationRequestSchema, ModelInvocationResultSchema, type ModelInvocationRequest } from '@agent/core';
import { describe, expect, it, vi } from 'vitest';

import { ModelInvocationFacade, type ModelInvocationPreprocessor } from '../../src';

const createRequest = (overrides: Partial<ModelInvocationRequest> = {}): ModelInvocationRequest =>
  ModelInvocationRequestSchema.parse({
    invocationId: 'invoke-1',
    taskId: 'task-1',
    sessionId: 'session-1',
    modeProfile: 'runtime-task',
    stage: 'main',
    messages: [{ role: 'user', content: 'hello runtime facade' }],
    requestedModelId: 'gpt-test',
    contextHints: { requestSource: 'unit-test' },
    capabilityHints: {},
    budgetSnapshot: {
      costConsumedUsd: 0,
      costBudgetUsd: 1,
      tokenConsumed: 0,
      tokenBudget: 4000,
      fallbackModelId: 'gpt-fallback'
    },
    traceContext: { traceId: 'trace-1' },
    ...overrides
  });

const createProviderExecute = () =>
  vi.fn().mockResolvedValue({
    outputText: 'provider output',
    usage: { totalTokens: 42 }
  });

describe('ModelInvocationFacade', () => {
  it('runs preprocessors before provider execution and returns ModelInvocationResult', async () => {
    const providerExecute = createProviderExecute();
    const facade = new ModelInvocationFacade({
      provider: { execute: providerExecute }
    });

    const request = createRequest();
    const result = await facade.invoke(request);

    expect(providerExecute).toHaveBeenCalledTimes(1);
    expect(providerExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        request,
        modelId: 'gpt-test',
        messages: [
          { role: 'system', content: 'profile:runtime-task' },
          { role: 'user', content: 'hello runtime facade' }
        ]
      })
    );

    expect(result).toEqual(
      expect.objectContaining({
        finalOutput: {
          kind: 'text',
          text: 'provider output'
        },
        invocationRecordId: 'invoke-1',
        taskUsageSnapshot: {
          totalTokens: 42
        }
      })
    );

    expect(ModelInvocationResultSchema.parse(result)).toEqual(result);
  });

  it('switches to the fallback model when final resolved messages exceed budget', async () => {
    const providerExecute = createProviderExecute();
    const facade = new ModelInvocationFacade({
      provider: { execute: providerExecute }
    });

    await facade.invoke(
      createRequest({
        messages: [{ role: 'user', content: 'a' }],
        budgetSnapshot: {
          costConsumedUsd: 0,
          costBudgetUsd: 1,
          tokenConsumed: 0,
          tokenBudget: 4,
          fallbackModelId: 'gpt-fallback'
        }
      })
    );

    expect(providerExecute).toHaveBeenCalledTimes(1);
    expect(providerExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: 'gpt-fallback',
        decision: expect.objectContaining({
          budgetDecision: expect.objectContaining({
            status: 'fallback',
            fallbackModelId: 'gpt-fallback'
          })
        }),
        messages: [
          { role: 'system', content: 'profile:runtime-task' },
          { role: 'user', content: 'a' }
        ]
      })
    );
  });

  it('denies execution without fallback when final resolved messages exceed budget', async () => {
    const providerExecute = createProviderExecute();
    const facade = new ModelInvocationFacade({
      provider: { execute: providerExecute }
    });

    const result = await facade.invoke(
      createRequest({
        messages: [{ role: 'user', content: 'a' }],
        budgetSnapshot: {
          costConsumedUsd: 0,
          costBudgetUsd: 1,
          tokenConsumed: 0,
          tokenBudget: 4
        }
      })
    );

    expect(providerExecute).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        finalOutput: {
          kind: 'text',
          text: 'token budget exceeded'
        },
        traceSummary: expect.objectContaining({
          traceMeta: expect.objectContaining({
            denied: true
          })
        })
      })
    );
  });

  it('switches to the fallback model when cost budget is exhausted before execution', async () => {
    const providerExecute = createProviderExecute();
    const facade = new ModelInvocationFacade({
      provider: { execute: providerExecute }
    });

    await facade.invoke(
      createRequest({
        budgetSnapshot: {
          costConsumedUsd: 1,
          costBudgetUsd: 1,
          tokenConsumed: 0,
          tokenBudget: 4000,
          fallbackModelId: 'gpt-fallback'
        }
      })
    );

    expect(providerExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: 'gpt-fallback',
        decision: expect.objectContaining({
          budgetDecision: expect.objectContaining({
            status: 'fallback',
            fallbackModelId: 'gpt-fallback'
          })
        })
      })
    );
  });

  it('denies execution without fallback when cost budget is exhausted before execution', async () => {
    const providerExecute = createProviderExecute();
    const facade = new ModelInvocationFacade({
      provider: { execute: providerExecute }
    });

    const result = await facade.invoke(
      createRequest({
        budgetSnapshot: {
          costConsumedUsd: 1,
          costBudgetUsd: 1,
          tokenConsumed: 0,
          tokenBudget: 4000
        }
      })
    );

    expect(providerExecute).not.toHaveBeenCalled();
    expect(result.finalOutput).toEqual({
      kind: 'text',
      text: 'cost budget exceeded'
    });
  });

  it('routes profile-specific system messages for direct-reply and runtime-task', async () => {
    const providerExecute = createProviderExecute();
    const facade = new ModelInvocationFacade({
      provider: { execute: providerExecute }
    });

    await facade.invoke(
      createRequest({
        invocationId: 'invoke-direct',
        modeProfile: 'direct-reply'
      })
    );
    await facade.invoke(
      createRequest({
        invocationId: 'invoke-runtime',
        modeProfile: 'runtime-task'
      })
    );

    expect(providerExecute).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        messages: [{ role: 'user', content: 'hello runtime facade' }]
      })
    );
    expect(providerExecute).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        messages: [
          { role: 'system', content: 'profile:runtime-task' },
          { role: 'user', content: 'hello runtime facade' }
        ]
      })
    );
  });

  it('merges profile and request system messages before provider execution', async () => {
    const providerExecute = createProviderExecute();
    const facade = new ModelInvocationFacade({
      provider: { execute: providerExecute }
    });

    await facade.invoke(
      createRequest({
        modeProfile: 'direct-reply',
        messages: [
          { role: 'system', content: '用户指定的直连回复规则' },
          { role: 'user', content: 'hello runtime facade' }
        ]
      })
    );

    const messages = providerExecute.mock.calls[0]?.[0].messages;
    const systemMessages = messages.filter(message => message.role === 'system');

    expect(systemMessages).toHaveLength(1);
    expect(systemMessages[0]?.content).toBe('用户指定的直连回复规则');
    expect(messages).toEqual([
      expect.objectContaining({ role: 'system' }),
      { role: 'user', content: 'hello runtime facade' }
    ]);
  });

  it('counts system messages in the budget estimate', async () => {
    const providerExecute = createProviderExecute();
    const facade = new ModelInvocationFacade({
      provider: { execute: providerExecute }
    });

    const result = await facade.invoke(
      createRequest({
        messages: [{ role: 'user', content: 'tiny' }],
        budgetSnapshot: {
          costConsumedUsd: 0,
          costBudgetUsd: 1,
          tokenConsumed: 0,
          tokenBudget: 5
        }
      })
    );

    expect(providerExecute).not.toHaveBeenCalled();
    expect(result.finalOutput).toEqual({
      kind: 'text',
      text: 'token budget exceeded'
    });
  });

  it('prefers provider token estimates over the character heuristic when available', async () => {
    const providerExecute = createProviderExecute();
    const estimateTokens = vi.fn().mockResolvedValue(11);
    const facade = new ModelInvocationFacade({
      provider: {
        execute: providerExecute,
        estimateTokens
      }
    });

    await facade.invoke(
      createRequest({
        messages: [{ role: 'user', content: 'ok' }],
        budgetSnapshot: {
          costConsumedUsd: 0,
          costBudgetUsd: 1,
          tokenConsumed: 0,
          tokenBudget: 10,
          fallbackModelId: 'gpt-fallback'
        }
      })
    );

    expect(estimateTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: 'gpt-test',
        messages: [
          { role: 'system', content: 'profile:runtime-task' },
          { role: 'user', content: 'ok' }
        ]
      })
    );
    expect(providerExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: 'gpt-fallback',
        decision: expect.objectContaining({
          budgetDecision: expect.objectContaining({
            status: 'fallback',
            estimatedInputTokens: 11
          })
        })
      })
    );
  });

  it('keeps composed preprocessor message rewrites instead of resetting to the raw request', async () => {
    const providerExecute = createProviderExecute();
    const rewritePreprocessor: ModelInvocationPreprocessor = {
      name: 'rewrite-before-normalize',
      run(decision) {
        return {
          ...decision,
          resolvedMessages: decision.resolvedMessages.map(message => ({
            ...message,
            content: `${message.content} ::rewritten   `
          }))
        };
      }
    };
    const facade = new ModelInvocationFacade({
      provider: { execute: providerExecute },
      preprocessors: [rewritePreprocessor]
    });

    await facade.invoke(
      createRequest({
        messages: [{ role: 'user', content: '  hello runtime facade  ' }]
      })
    );

    expect(providerExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: 'system', content: 'profile:runtime-task' },
          { role: 'user', content: 'hello runtime facade   ::rewritten' }
        ]
      })
    );
  });

  it('accepts facade-level custom profiles and preprocessors that align with pipeline options', async () => {
    const providerExecute = createProviderExecute();
    const prependPreprocessor: ModelInvocationPreprocessor = {
      name: 'prepend-custom',
      run(decision) {
        return {
          ...decision,
          resolvedMessages: decision.resolvedMessages.map(message => ({
            ...message,
            content: `custom:${message.content}`
          }))
        };
      }
    };
    const facade = new ModelInvocationFacade({
      provider: { execute: providerExecute },
      preprocessors: [prependPreprocessor],
      profiles: [
        {
          id: 'runtime-task',
          buildSystemMessages() {
            return [{ role: 'system', content: 'profile:custom-runtime-task' }];
          }
        },
        {
          id: 'direct-reply',
          buildSystemMessages() {
            return [{ role: 'system', content: 'profile:custom-direct-reply' }];
          }
        }
      ]
    });

    await facade.invoke(createRequest());

    expect(providerExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: 'system', content: 'profile:custom-runtime-task' },
          { role: 'user', content: 'custom:hello runtime facade' }
        ]
      })
    );
  });
});
