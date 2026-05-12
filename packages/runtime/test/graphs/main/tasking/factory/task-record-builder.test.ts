import { describe, expect, it, vi } from 'vitest';
import { TaskStatus } from '@agent/core';

import { buildTaskRecord } from '../../../../../src/graphs/main/tasking/factory/task-record-builder';

vi.mock('@agent/config', () => ({ loadSettings: vi.fn(() => ({})) }));
vi.mock('../../../../../src/agents', () => ({
  derivePlannerStrategyRecord: vi.fn(() => ({ strategy: 'default' }))
}));

function makeParams(overrides: Record<string, unknown> = {}) {
  const now = '2026-05-10T00:00:00.000Z';
  return {
    dto: {
      goal: 'test goal',
      lineage: undefined,
      sessionId: 'sess-1',
      conversationCompression: undefined,
      requestedHints: undefined
    } as any,
    settings: {
      policy: {
        budget: {
          stepBudget: 8,
          retryBudget: 2,
          sourceBudget: 8,
          maxCostPerTaskUsd: 1.0
        }
      }
    } as any,
    now,
    taskId: 'task-001',
    runId: 'run-001',
    createQueueState: vi.fn(() => ({
      status: 'queued',
      sessionId: 'sess-1',
      createdAt: now,
      startedAt: null,
      lastTransitionAt: now
    })),
    requestedMode: 'execute' as const,
    workflowResolution: {
      normalizedGoal: 'normalized test goal',
      preset: {
        id: 'skill-1',
        displayName: 'general',
        requiredMinistries: ['libu-governance', 'hubu-search', 'gongbu-code', 'xingbu-review'],
        outputContract: { type: 'text' }
      }
    },
    enrichedTaskContext: 'enriched context',
    specialistRoute: {
      specialistLead: { domain: 'coding' as const, reason: 'test' },
      supportingSpecialists: [],
      contextSlicesBySpecialist: [],
      initialChatRoute: { flow: 'full-pipeline', adapter: 'default', priority: 50, reason: 'default', graph: 'main' }
    },
    orchestrationGovernance: {
      contextSummary: 'ctx summary',
      dispatchOrder: ['research', 'execute', 'review'],
      noiseGuards: [],
      strategySummary: 'strat',
      ministrySummary: 'min',
      fallbackSummary: 'fb',
      adjustedRouteConfidence: 0.9
    },
    executionPlan: {
      tokenBudget: 10000,
      softBudgetThreshold: 0.8,
      hardBudgetThreshold: 0.95,
      strategyCounselors: [],
      executionMinistries: []
    },
    initialChatRoute: { flow: 'full-pipeline', adapter: 'default', priority: 50, reason: 'default', graph: 'main' },
    entryDecision: { requestedMode: 'execute' as const, decidedAt: now },
    capabilityState: {
      capabilityAttachments: [],
      connectorRefs: []
    },
    knowledgeReuse: {
      memories: [],
      reusedMemoryIds: [],
      reusedRuleIds: [],
      evidence: []
    },
    ...overrides
  };
}

describe('buildTaskRecord', () => {
  it('creates a task with correct base fields', () => {
    const params = makeParams();
    const { task, traceId } = buildTaskRecord(params);

    expect(task.id).toBe('task-001');
    expect(task.runId).toBe('run-001');
    expect(task.goal).toBe('normalized test goal');
    expect(task.context).toBe('enriched context');
    expect(task.status).toBe(TaskStatus.QUEUED);
    expect(task.sessionId).toBe('sess-1');
    expect(typeof traceId).toBe('string');
  });

  it('initializes traceId as a UUID', () => {
    const params = makeParams();
    const { traceId } = buildTaskRecord(params);
    expect(traceId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('initializes skill and workflow fields', () => {
    const params = makeParams();
    const { task } = buildTaskRecord(params);

    expect(task.skillId).toBe('skill-1');
    expect(task.skillStage).toBe('skill_resolved');
    expect(task.resolvedWorkflow).toBeDefined();
    expect(task.resolvedWorkflow?.displayName).toBe('general');
  });

  it('initializes mode gate state from requested mode', () => {
    const params = makeParams();
    const { task } = buildTaskRecord(params);

    expect(task.modeGateState.requestedMode).toBe('execute');
    expect(task.modeGateState.activeMode).toBe('execute');
  });

  it('sets plan mode correctly', () => {
    const params = makeParams({ requestedMode: 'plan' });
    const { task } = buildTaskRecord(params);

    expect(task.modeGateState.requestedMode).toBe('plan');
    expect(task.modeGateState.activeMode).toBe('plan');
    expect(task.modeGateState.reason).toContain('计划模式');
  });

  it('sets imperial_direct mode correctly', () => {
    const params = makeParams({ requestedMode: 'imperial_direct' });
    const { task } = buildTaskRecord(params);

    expect(task.modeGateState.requestedMode).toBe('imperial_direct');
    expect(task.modeGateState.activeMode).toBe('imperial_direct');
    expect(task.modeGateState.reason).toContain('特旨直达');
  });

  it('initializes budget state from settings', () => {
    const params = makeParams();
    const { task } = buildTaskRecord(params);

    expect(task.budgetState.stepBudget).toBe(8);
    expect(task.budgetState.sourceBudget).toBe(8);
    expect(task.budgetState.tokenBudget).toBe(10000);
    expect(task.budgetState.overBudget).toBe(false);
  });

  it('initializes empty arrays for traces, approvals, messages', () => {
    const params = makeParams();
    const { task } = buildTaskRecord(params);

    expect(task.trace).toEqual([]);
    expect(task.approvals).toEqual([]);
    expect(task.agentStates).toEqual([]);
    expect(task.messages).toEqual([]);
  });

  it('initializes retry and revision state', () => {
    const params = makeParams();
    const { task } = buildTaskRecord(params);

    expect(task.retryCount).toBe(0);
    expect(task.maxRetries).toBe(2);
    expect(task.revisionCount).toBe(0);
    expect(task.maxRevisions).toBe(2);
    expect(task.revisionState).toBe('idle');
  });

  it('initializes knowledge-related state', () => {
    const params = makeParams();
    const { task } = buildTaskRecord(params);

    expect(task.knowledgeIngestionState.status).toBe('idle');
    expect(task.knowledgeIndexState.indexStatus).toBe('building');
    expect(task.knowledgeIndexState.searchableDocumentCount).toBe(0);
  });

  it('initializes sandbox state', () => {
    const params = makeParams();
    const { task } = buildTaskRecord(params);

    expect(task.sandboxState.status).toBe('idle');
    expect(task.sandboxState.attempt).toBe(0);
    expect(task.sandboxState.maxAttempts).toBe(2);
  });

  it('initializes guardrail and blackboard states', () => {
    const params = makeParams();
    const { task } = buildTaskRecord(params);

    expect(task.guardrailState.verdict).toBe('pass_through');
    expect(task.blackboardState.visibleScopes).toContain('supervisor');
  });

  it('initializes LLM usage tracking', () => {
    const params = makeParams();
    const { task } = buildTaskRecord(params);

    expect(task.llmUsage.promptTokens).toBe(0);
    expect(task.llmUsage.completionTokens).toBe(0);
    expect(task.llmUsage.totalTokens).toBe(0);
  });

  it('uses knowledge reuse evidence for external sources', () => {
    const evidence = [
      {
        id: 'ev-1',
        taskId: 'task-001',
        sourceType: 'memory',
        trustClass: 'internal',
        summary: 'test evidence',
        createdAt: '2026-05-10T00:00:00.000Z'
      }
    ];
    const params = makeParams({
      knowledgeReuse: {
        memories: [],
        reusedMemoryIds: ['mem-1'],
        reusedRuleIds: ['rule-1'],
        evidence
      }
    });
    const { task } = buildTaskRecord(params);

    expect(task.externalSources).toHaveLength(1);
    expect(task.reusedMemories).toEqual(['mem-1']);
    expect(task.reusedRules).toEqual(['rule-1']);
  });

  it('sets context filter state compression fields from dto', () => {
    const params = makeParams({
      dto: {
        goal: 'test goal',
        lineage: undefined,
        sessionId: 'sess-1',
        conversationCompression: {
          summary: 'compressed',
          source: 'auto',
          condensedMessageCount: 5
        },
        requestedHints: undefined
      }
    });
    const { task } = buildTaskRecord(params);

    expect(task.contextFilterState.filteredContextSlice.compressionApplied).toBe(true);
    expect(task.contextFilterState.filteredContextSlice.compressedMessageCount).toBe(5);
  });

  it('falls back to default budget when settings have no policy', () => {
    const params = makeParams({ settings: {} });
    const { task } = buildTaskRecord(params);

    expect(task.budgetState.stepBudget).toBe(8);
    expect(task.budgetState.sourceBudget).toBe(8);
  });

  it('creates queue state via callback', () => {
    const params = makeParams();
    const { task } = buildTaskRecord(params);

    expect(params.createQueueState).toHaveBeenCalledWith('sess-1', params.now);
    expect(task.queueState).toBeDefined();
  });
});
