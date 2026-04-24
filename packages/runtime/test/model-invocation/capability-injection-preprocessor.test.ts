import { ModelInvocationRequestSchema, type ModelInvocationRequest, type PreprocessDecision } from '@agent/core';
import { describe, expect, it, vi } from 'vitest';

import { FixedModelInvocationPipeline } from '../../src/runtime/model-invocation/model-invocation-pipeline';
import { capabilityInjectionPreprocessor } from '../../src/runtime/model-invocation/preprocessors/capability-injection-preprocessor';

const createRequest = (overrides: Partial<ModelInvocationRequest> = {}): ModelInvocationRequest =>
  ModelInvocationRequestSchema.parse({
    invocationId: 'invoke-1',
    taskId: 'task-1',
    sessionId: 'session-1',
    modeProfile: 'runtime-task',
    stage: 'main',
    messages: [{ role: 'user', content: 'hello runtime pipeline' }],
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
    usage: { totalTokens: 42 },
    deliveryMeta: { transport: 'provider' }
  });

describe('CapabilityInjectionPreprocessor', () => {
  it('rejects all capability hints for direct-reply mode instead of silently allowing them', async () => {
    const providerExecute = createProviderExecute();
    const pipeline = new FixedModelInvocationPipeline({
      provider: { execute: providerExecute }
    });

    const result = await pipeline.invoke(
      createRequest({
        modeProfile: 'direct-reply',
        capabilityHints: {
          skills: ['briefing'],
          tools: ['terminal'],
          mcp: ['docs.search']
        },
        traceContext: {
          traceId: 'trace-direct',
          cacheStatus: 'shadow-attempt'
        }
      })
    );

    expect(providerExecute).not.toHaveBeenCalled();
    expect(result.finalOutput).toEqual({
      kind: 'text',
      text: 'direct-reply mode rejected requested capability hints'
    });
    expect(result.traceSummary).toEqual({
      stage: 'main',
      modeProfile: 'direct-reply',
      modelId: 'gpt-test',
      budgetDecision: 'allow',
      cacheStatus: 'bypass',
      capabilityPlan: {
        selectedSkills: [],
        selectedTools: [],
        selectedMcpCapabilities: [],
        rejectedCandidates: ['briefing', 'terminal', 'docs.search'],
        reasons: ['direct-reply mode does not permit capability injection'],
        riskFlags: []
      },
      preprocessors: ['input-normalize', 'capability-injection', 'context-assemble', 'budget-estimate'],
      traceMeta: {
        stage: 'main',
        denied: true
      }
    });
  });

  it('selects requested tools and MCP capabilities for runtime-task mode', async () => {
    const providerExecute = createProviderExecute();
    const pipeline = new FixedModelInvocationPipeline({
      provider: { execute: providerExecute }
    });

    await pipeline.invoke(
      createRequest({
        capabilityHints: {
          tools: ['terminal'],
          mcp: ['docs.search']
        }
      })
    );

    expect(providerExecute).toHaveBeenCalledTimes(1);
    expect(providerExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: expect.objectContaining({
          capabilityInjectionPlan: expect.objectContaining({
            selectedTools: ['terminal'],
            selectedMcpCapabilities: ['docs.search'],
            rejectedCandidates: []
          })
        })
      })
    );
  });

  it('short-circuits provider execution on cache hits after preprocessors run', async () => {
    const providerExecute = createProviderExecute();
    const cacheHitPreprocessor = {
      name: 'cache-hit',
      run(decision: PreprocessDecision): PreprocessDecision {
        return {
          ...decision,
          cacheDecision: {
            status: 'hit',
            cacheKey: 'cache-key-1',
            cachedText: 'cached provider output'
          }
        };
      }
    };
    const pipeline = new FixedModelInvocationPipeline({
      provider: { execute: providerExecute },
      preprocessors: [cacheHitPreprocessor]
    });

    const result = await pipeline.invoke(createRequest());

    expect(providerExecute).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        finalOutput: {
          kind: 'text',
          text: 'cached provider output'
        },
        traceSummary: {
          stage: 'main',
          modeProfile: 'runtime-task',
          modelId: 'gpt-test',
          budgetDecision: 'allow',
          cacheStatus: 'hit',
          capabilityPlan: {
            selectedSkills: [],
            selectedTools: [],
            selectedMcpCapabilities: [],
            rejectedCandidates: [],
            reasons: [],
            riskFlags: []
          },
          preprocessors: [
            'cache-hit',
            'input-normalize',
            'capability-injection',
            'context-assemble',
            'budget-estimate'
          ],
          traceMeta: {
            stage: 'main'
          }
        },
        deliveryMeta: {
          cacheKey: 'cache-key-1',
          delivery: 'cache-hit'
        }
      })
    );
  });
});

describe('capabilityInjectionPreprocessor', () => {
  it('preserves an existing capability plan when no hints are supplied', async () => {
    const request = createRequest();

    const decision: PreprocessDecision = {
      allowExecution: true,
      resolvedModelId: 'gpt-test',
      resolvedMessages: request.messages,
      budgetDecision: {
        status: 'allow',
        estimatedInputTokens: 0
      },
      capabilityInjectionPlan: {
        selectedSkills: [],
        selectedTools: ['existing-tool'],
        selectedMcpCapabilities: [],
        rejectedCandidates: [],
        reasons: [],
        riskFlags: []
      },
      cacheDecision: {
        status: 'bypass'
      },
      traceMeta: {
        stage: request.stage
      }
    };

    const nextDecision = await capabilityInjectionPreprocessor.run(decision, {
      request,
      profile: {
        id: request.modeProfile,
        buildSystemMessages: () => []
      }
    });

    expect(nextDecision.capabilityInjectionPlan.selectedTools).toEqual(['existing-tool']);
    expect(nextDecision.capabilityInjectionPlan.selectedMcpCapabilities).toEqual([]);
  });

  it('records rejected skill and tool hints for direct-reply mode', async () => {
    const request = createRequest({
      modeProfile: 'direct-reply',
      capabilityHints: {
        skills: ['briefing'],
        tools: ['terminal']
      }
    });

    const decision: PreprocessDecision = {
      allowExecution: true,
      resolvedModelId: 'gpt-test',
      resolvedMessages: request.messages,
      budgetDecision: {
        status: 'allow',
        estimatedInputTokens: 0
      },
      capabilityInjectionPlan: {
        selectedSkills: [],
        selectedTools: [],
        selectedMcpCapabilities: [],
        rejectedCandidates: [],
        reasons: [],
        riskFlags: []
      },
      cacheDecision: {
        status: 'bypass'
      },
      traceMeta: {
        stage: request.stage
      }
    };

    const nextDecision = await capabilityInjectionPreprocessor.run(decision, {
      request,
      profile: {
        id: request.modeProfile,
        buildSystemMessages: () => []
      }
    });

    expect(nextDecision.allowExecution).toBe(false);
    expect(nextDecision.denyReason).toBe('direct-reply mode rejected requested capability hints');
    expect(nextDecision.capabilityInjectionPlan.rejectedCandidates).toEqual(['briefing', 'terminal']);
    expect(nextDecision.capabilityInjectionPlan.reasons).toEqual([
      'direct-reply mode does not permit capability injection'
    ]);
  });
});
