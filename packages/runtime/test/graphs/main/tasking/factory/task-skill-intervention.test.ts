import { describe, expect, it, vi, beforeEach } from 'vitest';

import { TaskStatus } from '@agent/core';

vi.mock('../../../../../src/capabilities/capability-pool', () => ({
  mergeCapabilityStateFromSkillSearch: vi.fn(() => ({
    capabilityAttachments: [],
    connectorRefs: []
  }))
}));

vi.mock('../../../../../src/flows/approval/risk-interrupts', () => ({
  extendInterruptWithRiskMetadata: vi.fn(record => record),
  extendPendingApprovalWithRiskMetadata: vi.fn(record => record)
}));

import { applyLocalSkillSuggestions } from '../../../../../src/graphs/main/tasking/factory/task-skill-intervention';

function makeTask(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'task-1',
    status: TaskStatus.QUEUED,
    goal: 'test goal',
    skillSearch: undefined,
    usedInstalledSkills: [],
    externalSources: [],
    approvals: [],
    interruptHistory: [],
    activeInterrupt: undefined,
    pendingApproval: undefined,
    currentNode: 'init',
    currentStep: 'init',
    queueState: { status: 'queued', startedAt: null, lastTransitionAt: '2026-05-10' },
    ...overrides
  };
}

function makeCallbacks(): any {
  return {
    addTrace: vi.fn(),
    addProgressDelta: vi.fn(),
    markSubgraph: vi.fn(),
    attachTool: vi.fn(),
    recordToolUsage: vi.fn()
  };
}

function makeParams(overrides: Record<string, unknown> = {}) {
  return {
    task: makeTask(),
    taskId: 'task-1',
    runId: 'run-1',
    now: '2026-05-10T00:00:00.000Z',
    normalizedGoal: 'test goal',
    requestedHints: undefined,
    specialistDomain: 'coding' as const,
    resolveLocalSkillSuggestions: vi.fn().mockResolvedValue({
      capabilityGapDetected: false,
      suggestions: [],
      status: 'none'
    }),
    callbacks: makeCallbacks(),
    ...overrides
  };
}

describe('applyLocalSkillSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets skillSearch on task from resolved suggestions', async () => {
    const skillSearch = {
      capabilityGapDetected: false,
      suggestions: [],
      status: 'none'
    };
    const params = makeParams({
      resolveLocalSkillSuggestions: vi.fn().mockResolvedValue(skillSearch)
    });

    await applyLocalSkillSuggestions(params as any);

    expect(params.task.skillSearch).toBe(skillSearch);
  });

  it('adds external sources when suggestions exist', async () => {
    const skillSearch = {
      capabilityGapDetected: false,
      suggestions: [
        {
          id: 's1',
          displayName: 'Test Skill',
          availability: 'available',
          sourceId: 'src-1',
          kind: 'local',
          score: 0.9,
          reason: 'match'
        },
        {
          id: 's2',
          displayName: 'Test Skill 2',
          availability: 'blocked',
          sourceId: 'src-2',
          kind: 'local',
          score: 0.8,
          reason: 'match'
        }
      ],
      status: 'found'
    };
    const params = makeParams({
      resolveLocalSkillSuggestions: vi.fn().mockResolvedValue(skillSearch)
    });

    await applyLocalSkillSuggestions(params as any);

    expect(params.task.externalSources.length).toBeGreaterThan(0);
  });

  it('runs pre-execution skill intervention when resolver provided', async () => {
    const skillSearch = {
      capabilityGapDetected: false,
      suggestions: [],
      status: 'none'
    };
    const intervention = {
      skillSearch: { ...skillSearch, status: 'intervened' },
      usedInstalledSkills: ['skill-1'],
      traceSummary: 'intervention applied',
      progressSummary: 'done'
    };
    const params = makeParams({
      resolveLocalSkillSuggestions: vi.fn().mockResolvedValue(skillSearch),
      resolvePreExecutionSkillIntervention: vi.fn().mockResolvedValue(intervention)
    });

    await applyLocalSkillSuggestions(params as any);

    expect(params.task.skillSearch.status).toBe('intervened');
    expect(params.task.usedInstalledSkills).toContain('skill-1');
    expect(params.callbacks.addTrace).toHaveBeenCalledWith(
      expect.anything(),
      'skill_runtime_intervention',
      'intervention applied',
      expect.anything()
    );
  });

  it('sets WAITING_APPROVAL when intervention has pending approval', async () => {
    const skillSearch = {
      capabilityGapDetected: true,
      suggestions: [
        {
          id: 's1',
          displayName: 'Test',
          availability: 'available',
          sourceId: 'src-1',
          kind: 'local',
          score: 0.9,
          reason: 'match'
        }
      ],
      status: 'found'
    };
    const intervention = {
      skillSearch,
      pendingApproval: { toolName: 'remote-skill', reason: 'install', preview: [] },
      pendingExecution: { receiptId: 'receipt-1', skillDisplayName: 'Remote Skill' }
    };
    const params = makeParams({
      resolveLocalSkillSuggestions: vi.fn().mockResolvedValue(skillSearch),
      resolvePreExecutionSkillIntervention: vi.fn().mockResolvedValue(intervention)
    });

    await applyLocalSkillSuggestions(params as any);

    expect(params.task.status).toBe(TaskStatus.WAITING_APPROVAL);
    expect(params.task.currentNode).toBe('approval_gate');
    expect(params.task.currentStep).toBe('waiting_skill_install_approval');
  });

  it('skips pre-execution intervention when deferPreExecutionSkillIntervention is true', async () => {
    const resolvePreExecution = vi.fn();
    const params = makeParams({
      resolvePreExecutionSkillIntervention: resolvePreExecution,
      deferPreExecutionSkillIntervention: true
    });

    await applyLocalSkillSuggestions(params as any);

    expect(resolvePreExecution).not.toHaveBeenCalled();
  });

  it('adds trace for capability gap detected', async () => {
    const skillSearch = {
      capabilityGapDetected: true,
      suggestions: [
        {
          id: 's1',
          displayName: 'Test',
          availability: 'available',
          sourceId: 'src-1',
          kind: 'local',
          score: 0.9,
          reason: 'match'
        }
      ],
      status: 'found'
    };
    const params = makeParams({
      resolveLocalSkillSuggestions: vi.fn().mockResolvedValue(skillSearch)
    });

    await applyLocalSkillSuggestions(params as any);

    expect(params.callbacks.addTrace).toHaveBeenCalledWith(
      expect.anything(),
      'research',
      expect.stringContaining('能力缺口'),
      expect.anything()
    );
  });

  it('adds trace for non-gap suggestions', async () => {
    const skillSearch = {
      capabilityGapDetected: false,
      suggestions: [
        {
          id: 's1',
          displayName: 'Test',
          availability: 'available',
          sourceId: 'src-1',
          kind: 'local',
          score: 0.9,
          reason: 'match'
        }
      ],
      status: 'found'
    };
    const params = makeParams({
      resolveLocalSkillSuggestions: vi.fn().mockResolvedValue(skillSearch)
    });

    await applyLocalSkillSuggestions(params as any);

    expect(params.callbacks.addTrace).toHaveBeenCalledWith(
      expect.anything(),
      'research',
      expect.stringContaining('候选'),
      expect.anything()
    );
  });

  it('records interrupt history when pending approval', async () => {
    const skillSearch = {
      capabilityGapDetected: true,
      suggestions: [
        {
          id: 's1',
          displayName: 'Test',
          availability: 'available',
          sourceId: 'src-1',
          kind: 'local',
          score: 0.9,
          reason: 'match'
        }
      ],
      status: 'found'
    };
    const intervention = {
      skillSearch,
      pendingApproval: { toolName: 'remote-skill', reason: 'install' },
      pendingExecution: { receiptId: 'receipt-1', skillDisplayName: 'Remote Skill' }
    };
    const params = makeParams({
      resolveLocalSkillSuggestions: vi.fn().mockResolvedValue(skillSearch),
      resolvePreExecutionSkillIntervention: vi.fn().mockResolvedValue(intervention)
    });

    await applyLocalSkillSuggestions(params as any);

    expect(params.task.interruptHistory.length).toBeGreaterThan(0);
  });

  it('handles no intervention resolver gracefully', async () => {
    const params = makeParams({ resolvePreExecutionSkillIntervention: undefined });

    await applyLocalSkillSuggestions(params as any);

    expect(params.task.skillSearch).toBeDefined();
  });
});
