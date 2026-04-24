import { ModelInvocationRequestSchema, type PreprocessDecision, type ProviderUsage } from '@agent/core';
import { describe, expect, it } from 'vitest';

import { TraceAuditPostprocessor } from '../../src/runtime/model-invocation/postprocessors/trace-audit-postprocessor';
import { UsageBillingPostprocessor } from '../../src/runtime/model-invocation/postprocessors/usage-billing-postprocessor';
import type { ModelInvocationProviderExecuteResult } from '../../src/runtime/model-invocation/model-invocation.types';

const createRequest = (overrides: Record<string, unknown> = {}) => {
  const budgetSnapshotOverride =
    overrides.budgetSnapshot && typeof overrides.budgetSnapshot === 'object'
      ? (overrides.budgetSnapshot as Record<string, unknown>)
      : {};
  const parsed = ModelInvocationRequestSchema.parse({
    invocationId: 'invoke-usage-1',
    taskId: 'task-usage-1',
    sessionId: 'session-usage-1',
    modeProfile: 'runtime-task',
    stage: 'main',
    messages: [{ role: 'user', content: 'summarize runtime cost' }],
    requestedModelId: 'gpt-4.1',
    contextHints: {},
    capabilityHints: {},
    budgetSnapshot: {
      costConsumedCny: budgetSnapshotOverride.costConsumedCny ?? 9.11,
      costConsumedUsd: 1.25,
      costBudgetUsd: 10,
      tokenConsumed: 1200,
      tokenBudget: 20000,
      fallbackModelId: 'gpt-4.1-mini'
    },
    traceContext: {},
    ...overrides
  });
  return parsed;
};

const createDecision = (overrides: Partial<PreprocessDecision> = {}): PreprocessDecision => ({
  allowExecution: true,
  resolvedModelId: 'gpt-4.1',
  resolvedMessages: [
    { role: 'system', content: 'profile:runtime-task' },
    { role: 'user', content: 'summarize runtime cost' }
  ],
  budgetDecision: {
    status: 'fallback',
    estimatedInputTokens: 18,
    fallbackModelId: 'gpt-4.1-mini'
  },
  capabilityInjectionPlan: {
    selectedSkills: ['usage-billing'],
    selectedTools: ['terminal'],
    selectedMcpCapabilities: ['docs.search'],
    rejectedCandidates: [],
    reasons: [],
    riskFlags: []
  },
  cacheDecision: {
    status: 'hit',
    cacheKey: 'cache-key-1',
    cachedText: 'cached response'
  },
  traceMeta: {
    retry: 2
  },
  ...overrides
});

const createUsage = (overrides: Partial<ProviderUsage> = {}): ProviderUsage => ({
  promptTokens: 40,
  completionTokens: 12,
  totalTokens: 52,
  costUsd: 0.13,
  costCny: 0.94,
  ...overrides
});

const createProviderResult = (
  overrides: Partial<ModelInvocationProviderExecuteResult> = {}
): ModelInvocationProviderExecuteResult => ({
  providerId: 'openai-responses',
  outputText: 'runtime summary',
  usage: createUsage(),
  deliveryMeta: {},
  providerMeta: {},
  ...overrides
});

describe('UsageBillingPostprocessor', () => {
  it('builds invocation usage ledger output and task usage delta from canonical provider usage fields', async () => {
    const postprocessor = new UsageBillingPostprocessor();

    const result = await postprocessor.run({
      request: createRequest(),
      decision: createDecision(),
      providerResult: createProviderResult()
    });

    expect(result.invocationUsageRecord).toEqual({
      invocationId: 'invoke-usage-1',
      taskId: 'task-usage-1',
      sessionId: 'session-usage-1',
      modeProfile: 'runtime-task',
      stage: 'main',
      providerId: 'openai-responses',
      modelId: 'gpt-4.1',
      promptTokens: 40,
      completionTokens: 12,
      totalTokens: 52,
      costUsd: 0.13,
      costCny: 0.94,
      selectedSkills: ['usage-billing'],
      selectedTools: ['terminal'],
      selectedMcpCapabilities: ['docs.search'],
      cacheHit: true,
      fallback: true,
      retry: 2
    });

    expect(result.taskUsageDelta).toEqual({
      taskId: 'task-usage-1',
      sessionId: 'session-usage-1',
      invocationId: 'invoke-usage-1',
      tokenDelta: 52,
      costUsdDelta: 0.13,
      costCnyDelta: 0.94,
      totalTokenConsumed: 1252,
      totalCostConsumedUsd: 1.38,
      totalCostConsumedCny: 10.05
    });
  });

  it('defaults providerId and pricing totals when provider metadata is missing', async () => {
    const postprocessor = new UsageBillingPostprocessor();

    const result = await postprocessor.run({
      request: createRequest(),
      decision: createDecision({
        budgetDecision: {
          status: 'allow',
          estimatedInputTokens: 18
        }
      }),
      providerResult: createProviderResult({
        providerId: undefined,
        usage: createUsage({
          costUsd: undefined,
          costCny: undefined
        })
      })
    });

    expect(result.invocationUsageRecord.providerId).toBe('unknown-provider');
    expect(result.invocationUsageRecord.costUsd).toBe(0);
    expect(result.invocationUsageRecord.costCny).toBe(0);
    expect(result.invocationUsageRecord.fallback).toBe(false);
    expect(result.taskUsageDelta).toEqual({
      taskId: 'task-usage-1',
      sessionId: 'session-usage-1',
      invocationId: 'invoke-usage-1',
      tokenDelta: 52,
      costUsdDelta: 0,
      costCnyDelta: 0,
      totalTokenConsumed: 1252,
      totalCostConsumedUsd: 1.25,
      totalCostConsumedCny: 9.11
    });
  });

  it('derives CNY totals from USD usage when upstream provider billing omits costCny', async () => {
    const postprocessor = new UsageBillingPostprocessor();

    const result = await postprocessor.run({
      request: createRequest({
        budgetSnapshot: {
          costConsumedUsd: 1.25,
          costConsumedCny: undefined,
          costBudgetUsd: 10,
          tokenConsumed: 1200,
          tokenBudget: 20000,
          fallbackModelId: 'gpt-4.1-mini'
        }
      }),
      decision: createDecision({
        budgetDecision: {
          status: 'allow',
          estimatedInputTokens: 18
        }
      }),
      providerResult: createProviderResult({
        usage: createUsage({
          costUsd: 0.13,
          costCny: undefined
        })
      })
    });

    expect(result.invocationUsageRecord.costUsd).toBe(0.13);
    expect(result.invocationUsageRecord.costCny).toBe(0.936);
    expect(result.taskUsageDelta).toEqual({
      taskId: 'task-usage-1',
      sessionId: 'session-usage-1',
      invocationId: 'invoke-usage-1',
      tokenDelta: 52,
      costUsdDelta: 0.13,
      costCnyDelta: 0.936,
      totalTokenConsumed: 1252,
      totalCostConsumedUsd: 1.38,
      totalCostConsumedCny: 9.936
    });
  });

  it('rounds accumulated currency totals to six decimal places', async () => {
    const postprocessor = new UsageBillingPostprocessor();

    const result = await postprocessor.run({
      request: createRequest({
        budgetSnapshot: {
          costConsumedUsd: 1.1111114,
          costConsumedCny: 2.2222224,
          costBudgetUsd: 10,
          tokenConsumed: 1200,
          tokenBudget: 20000,
          fallbackModelId: 'gpt-4.1-mini'
        }
      }),
      decision: createDecision(),
      providerResult: createProviderResult({
        usage: createUsage({
          costUsd: 0.0000004,
          costCny: 0.0000007
        })
      })
    });

    expect(result.taskUsageDelta.totalCostConsumedUsd).toBe(1.111112);
    expect(result.taskUsageDelta.totalCostConsumedCny).toBe(2.222223);
  });
});

describe('TraceAuditPostprocessor', () => {
  it('keeps stable top-level trace fields and nests decision traceMeta instead of letting it override them', async () => {
    const postprocessor = new TraceAuditPostprocessor();

    const result = await postprocessor.run({
      request: createRequest({
        stage: 'stable-stage'
      }),
      decision: createDecision({
        traceMeta: {
          stage: 'override-attempt',
          modeProfile: 'override-profile',
          providerId: 'override-provider',
          retry: 3
        }
      }),
      providerResult: createProviderResult({
        providerId: 'canonical-provider'
      })
    });

    expect(result.traceSummary).toEqual({
      stage: 'stable-stage',
      modeProfile: 'runtime-task',
      modelId: 'gpt-4.1',
      providerId: 'canonical-provider',
      budgetDecision: 'fallback',
      cacheStatus: 'hit',
      capabilityPlan: {
        selectedSkills: ['usage-billing'],
        selectedTools: ['terminal'],
        selectedMcpCapabilities: ['docs.search'],
        rejectedCandidates: [],
        reasons: [],
        riskFlags: []
      },
      traceMeta: {
        stage: 'override-attempt',
        modeProfile: 'override-profile',
        providerId: 'override-provider',
        retry: 3
      }
    });
  });

  it('keeps traceMeta nested even when decision traceMeta contains reserved trace keys', async () => {
    const postprocessor = new TraceAuditPostprocessor();

    const result = await postprocessor.run({
      request: createRequest(),
      decision: createDecision({
        traceMeta: {
          stage: 'shadow-stage',
          cacheStatus: 'shadow-cache',
          denied: true,
          retry: 3
        }
      }),
      providerResult: createProviderResult()
    });

    expect(result.traceSummary.stage).toBe('main');
    expect(result.traceSummary.cacheStatus).toBe('hit');
    expect(result.traceSummary.traceMeta).toEqual({
      stage: 'shadow-stage',
      cacheStatus: 'shadow-cache',
      denied: true,
      retry: 3
    });
  });
});
