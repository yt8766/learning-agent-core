import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ActionIntent, TaskStatus } from '@agent/core';

vi.mock('@langchain/langgraph', () => ({
  interrupt: vi.fn(() => ({ action: 'approve', payload: {} }))
}));

vi.mock('../../../src/bridges/supervisor-runtime-bridge', () => ({
  markExecutionStepBlocked: vi.fn(),
  markExecutionStepResumed: vi.fn()
}));

vi.mock('../../../src/flows/approval/interrupt-idempotency', () => ({
  recordPendingInterruptOnce: vi.fn(() => true),
  recordPendingApprovalOnce: vi.fn(() => true)
}));

vi.mock('../../../src/flows/approval/risk-interrupts', () => ({
  extendInterruptWithRiskMetadata: vi.fn(record => record),
  extendPendingApprovalWithRiskMetadata: vi.fn(record => record)
}));

import { handleResearchSkillIntervention } from '../../../src/flows/approval/research-skill-interruption';
import { interrupt } from '@langchain/langgraph';

function makeTask(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'task-1',
    status: TaskStatus.RUNNING,
    goal: 'test goal',
    currentMinistry: 'hubu-search',
    currentNode: 'research',
    currentStep: 'research',
    usedInstalledSkills: [],
    approvals: [],
    interruptHistory: [],
    activeInterrupt: undefined,
    pendingApproval: undefined,
    pendingAction: undefined,
    skillSearch: {
      capabilityGapDetected: true,
      suggestions: [{ id: 's1', displayName: 'Test Skill' }],
      status: 'found'
    },
    ...overrides
  };
}

function makeCallbacks(overrides: Record<string, unknown> = {}): any {
  return {
    attachTool: vi.fn(),
    recordToolUsage: vi.fn(),
    addTrace: vi.fn(),
    addProgressDelta: vi.fn(),
    setSubTaskStatus: vi.fn(),
    persistAndEmitTask: vi.fn().mockResolvedValue(undefined),
    transitionQueueState: vi.fn(),
    registerPendingExecution: vi.fn(),
    resolveRuntimeSkillIntervention: vi.fn().mockResolvedValue(undefined),
    resolveSkillInstallInterruptResume: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe('handleResearchSkillIntervention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (interrupt as any).mockReturnValue({ action: 'approve', payload: {} });
  });

  it('returns not interrupted when no capability gap', async () => {
    const task = makeTask({
      skillSearch: { capabilityGapDetected: false, suggestions: [], status: 'none' }
    });
    const callbacks = makeCallbacks();
    const result = await handleResearchSkillIntervention(task, callbacks, 'hubu-search');

    expect(result).toEqual({ interrupted: false });
  });

  it('returns not interrupted when no suggestions', async () => {
    const task = makeTask({
      skillSearch: { capabilityGapDetected: true, suggestions: [], status: 'found' }
    });
    const callbacks = makeCallbacks();
    const result = await handleResearchSkillIntervention(task, callbacks, 'hubu-search');

    expect(result).toEqual({ interrupted: false });
  });

  it('returns not interrupted when usedInstalledSkills is non-empty', async () => {
    const task = makeTask({ usedInstalledSkills: ['skill-1'] });
    const callbacks = makeCallbacks();
    const result = await handleResearchSkillIntervention(task, callbacks, 'hubu-search');

    expect(result).toEqual({ interrupted: false });
  });

  it('returns not interrupted when resolveRuntimeSkillIntervention returns undefined', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks({
      resolveRuntimeSkillIntervention: vi.fn().mockResolvedValue(undefined)
    });
    const result = await handleResearchSkillIntervention(task, callbacks, 'hubu-search');

    expect(result).toEqual({ interrupted: false });
  });

  it('returns not interrupted when resolved has no pendingApproval', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks({
      resolveRuntimeSkillIntervention: vi.fn().mockResolvedValue({
        traceSummary: 'resolved',
        progressSummary: 'done'
      })
    });
    const result = await handleResearchSkillIntervention(task, callbacks, 'hubu-search');

    expect(result).toEqual({ interrupted: false });
  });

  it('sets task to WAITING_APPROVAL when skill install needs approval', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks({
      resolveRuntimeSkillIntervention: vi.fn().mockResolvedValue({
        pendingApproval: { toolName: 'remote-skill', reason: 'install needed', preview: [] },
        pendingExecution: { receiptId: 'receipt-1', skillDisplayName: 'Remote Skill' }
      })
    });

    // Mock interrupt to reject so the function completes
    (interrupt as any).mockReturnValue({ action: 'reject', feedback: 'denied' });

    await handleResearchSkillIntervention(task, callbacks, 'hubu-search');

    expect(task.status).toBe(TaskStatus.BLOCKED);
    expect(task.currentNode).toBe('approval_gate');
    expect(task.currentStep).toBe('waiting_skill_install_approval');
  });

  it('blocks task when approval is rejected', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks({
      resolveRuntimeSkillIntervention: vi.fn().mockResolvedValue({
        pendingApproval: { toolName: 'remote-skill', reason: 'install needed' },
        pendingExecution: { receiptId: 'receipt-1', skillDisplayName: 'Remote Skill' }
      })
    });

    (interrupt as any).mockReturnValue({ action: 'reject', feedback: 'not allowed' });

    const result = await handleResearchSkillIntervention(task, callbacks, 'hubu-search');

    expect(result).toEqual({
      interrupted: true,
      statePatch: expect.objectContaining({
        currentStep: 'research',
        approvalRequired: true,
        resumeFromApproval: false,
        shouldRetry: false
      })
    });
    expect(task.status).toBe(TaskStatus.BLOCKED);
    expect(task.approvalFeedback).toBe('not allowed');
  });

  it('blocks task when interrupt returns undefined (no resume)', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks({
      resolveRuntimeSkillIntervention: vi.fn().mockResolvedValue({
        pendingApproval: { toolName: 'remote-skill', reason: 'install needed' },
        pendingExecution: { receiptId: 'receipt-1', skillDisplayName: 'Remote Skill' }
      })
    });

    (interrupt as any).mockReturnValue(undefined);

    const result = await handleResearchSkillIntervention(task, callbacks, 'hubu-search');

    expect(result.interrupted).toBe(true);
    expect(task.status).toBe(TaskStatus.BLOCKED);
  });

  it('resumes task when approval is granted', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks({
      resolveRuntimeSkillIntervention: vi.fn().mockResolvedValue({
        pendingApproval: { toolName: 'remote-skill', reason: 'install needed' },
        pendingExecution: { receiptId: 'receipt-1', skillDisplayName: 'Remote Skill' }
      }),
      resolveSkillInstallInterruptResume: vi.fn().mockResolvedValue({
        usedInstalledSkills: ['remote-skill'],
        traceSummary: 'skill installed',
        progressSummary: 'done'
      })
    });

    (interrupt as any).mockReturnValue({ action: 'approve', payload: { actor: 'user-1' } });

    const result = await handleResearchSkillIntervention(task, callbacks, 'hubu-search');

    expect(result).toEqual({ interrupted: false });
    expect(task.status).toBe(TaskStatus.RUNNING);
    expect(task.pendingApproval).toBeUndefined();
    expect(task.activeInterrupt).toBeUndefined();
  });

  it('records tool usage on first pending interrupt', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks({
      resolveRuntimeSkillIntervention: vi.fn().mockResolvedValue({
        pendingApproval: { toolName: 'remote-skill', reason: 'install needed' },
        pendingExecution: { receiptId: 'receipt-1', skillDisplayName: 'Remote Skill' }
      })
    });

    (interrupt as any).mockReturnValue({ action: 'reject' });

    await handleResearchSkillIntervention(task, callbacks, 'hubu-search');

    expect(callbacks.attachTool).toHaveBeenCalledWith(
      task,
      expect.objectContaining({
        toolName: 'remote-skill',
        attachedBy: 'runtime'
      })
    );
    expect(callbacks.recordToolUsage).toHaveBeenCalledWith(
      task,
      expect.objectContaining({
        toolName: 'remote-skill',
        status: 'blocked'
      })
    );
  });

  it('merges usedInstalledSkills from resolved intervention', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks({
      resolveRuntimeSkillIntervention: vi.fn().mockResolvedValue({
        usedInstalledSkills: ['pre-installed-skill'],
        pendingApproval: { toolName: 'remote-skill', reason: 'install needed' },
        pendingExecution: { receiptId: 'receipt-1', skillDisplayName: 'Remote Skill' }
      })
    });

    (interrupt as any).mockReturnValue({ action: 'reject' });

    await handleResearchSkillIntervention(task, callbacks, 'hubu-search');

    expect(task.usedInstalledSkills).toContain('pre-installed-skill');
  });

  it('sets interrupt kind to skill-install', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks({
      resolveRuntimeSkillIntervention: vi.fn().mockResolvedValue({
        pendingApproval: { toolName: 'remote-skill', reason: 'install needed' },
        pendingExecution: { receiptId: 'receipt-1', skillDisplayName: 'Remote Skill' }
      })
    });

    (interrupt as any).mockReturnValue({ action: 'reject' });

    await handleResearchSkillIntervention(task, callbacks, 'hubu-search');

    expect(interrupt).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'skill-install',
        intent: ActionIntent.INSTALL_SKILL
      })
    );
  });

  it('uses researchMinistry when task.currentMinistry is undefined', async () => {
    const task = makeTask({ currentMinistry: undefined });
    const callbacks = makeCallbacks({
      resolveRuntimeSkillIntervention: vi.fn().mockResolvedValue({
        pendingApproval: { toolName: 'remote-skill', reason: 'install needed' },
        pendingExecution: { receiptId: 'receipt-1', skillDisplayName: 'Remote Skill' }
      })
    });

    (interrupt as any).mockReturnValue({ action: 'reject' });

    await handleResearchSkillIntervention(task, callbacks, 'hubu-search');

    expect(task.pendingAction.requestedBy).toBe('hubu-search');
  });
});
