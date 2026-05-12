import { describe, expect, it } from 'vitest';

import { buildTaskAudit, buildFallbackTaskPlan } from '../../../../src/runtime/domain/tasks/runtime-task-audit';

function makeSnapshot(overrides: Record<string, any> = {}) {
  return {
    governanceAudit: [],
    usageAudit: [],
    ...overrides
  } as any;
}

function makeTask(overrides: Record<string, any> = {}) {
  return {
    id: 'task-1',
    goal: 'Test goal',
    status: 'completed',
    createdAt: '2026-05-11T12:00:00.000Z',
    updatedAt: '2026-05-11T12:05:00.000Z',
    currentMinistry: 'gongbu-code',
    currentWorker: 'worker-1',
    currentStep: 'execution',
    trace: [],
    approvals: [],
    connectorRefs: [],
    usedInstalledSkills: [],
    usedCompanyWorkers: [],
    dispatches: [],
    ...overrides
  } as any;
}

describe('buildTaskAudit', () => {
  it('builds audit with empty entries when no data', () => {
    const result = buildTaskAudit('task-1', makeTask(), makeSnapshot());
    expect(result.taskId).toBe('task-1');
    expect(result.entries).toEqual([]);
    expect(result.browserReplays).toEqual([]);
  });

  it('includes governance entries for matching targets', () => {
    const task = makeTask({ connectorRefs: ['github'], currentWorker: 'worker-1' });
    const snapshot = makeSnapshot({
      governanceAudit: [
        {
          id: 'g1',
          at: '2026-05-11T12:01:00.000Z',
          targetId: 'github',
          action: 'approve',
          scope: 'connector',
          reason: 'risk',
          outcome: 'approved'
        },
        {
          id: 'g2',
          at: '2026-05-11T12:02:00.000Z',
          targetId: 'other',
          action: 'deny',
          scope: 'tool',
          reason: 'blocked',
          outcome: 'denied'
        }
      ]
    });
    const result = buildTaskAudit('task-1', task, snapshot);
    expect(result.entries.filter(e => e.type === 'governance')).toHaveLength(1);
  });

  it('includes governance entries for usedInstalledSkills', () => {
    const task = makeTask({ usedInstalledSkills: ['skill-1'] });
    const snapshot = makeSnapshot({
      governanceAudit: [
        {
          id: 'g1',
          at: '2026-05-11T12:01:00.000Z',
          targetId: 'skill-1',
          action: 'approve',
          scope: 'skill',
          reason: 'ok',
          outcome: 'approved'
        }
      ]
    });
    const result = buildTaskAudit('task-1', task, snapshot);
    expect(result.entries.filter(e => e.type === 'governance')).toHaveLength(1);
  });

  it('includes governance entries for usedCompanyWorkers', () => {
    const task = makeTask({ usedCompanyWorkers: ['cw-1'] });
    const snapshot = makeSnapshot({
      governanceAudit: [
        {
          id: 'g1',
          at: '2026-05-11T12:01:00.000Z',
          targetId: 'cw-1',
          action: 'approve',
          scope: 'worker',
          reason: 'ok',
          outcome: 'approved'
        }
      ]
    });
    const result = buildTaskAudit('task-1', task, snapshot);
    expect(result.entries.filter(e => e.type === 'governance')).toHaveLength(1);
  });

  it('includes trace entries', () => {
    const task = makeTask({
      trace: [
        { at: '2026-05-11T12:01:00.000Z', node: 'search', summary: 'Searched web', data: { query: 'test' } },
        { at: '2026-05-11T12:02:00.000Z', node: 'analyze', summary: 'Analyzed results', data: {} }
      ]
    });
    const result = buildTaskAudit('task-1', task, makeSnapshot());
    expect(result.entries.filter(e => e.type === 'trace')).toHaveLength(2);
  });

  it('includes approval entries', () => {
    const task = makeTask({
      approvals: [
        { intent: 'github push', decision: 'approved', reason: 'safe' },
        { intent: 'deploy', decision: 'denied', reason: 'risky' }
      ]
    });
    const result = buildTaskAudit('task-1', task, makeSnapshot());
    expect(result.entries.filter(e => e.type === 'approval')).toHaveLength(2);
  });

  it('includes usage audit entry when taskId matches', () => {
    const task = makeTask();
    const snapshot = makeSnapshot({
      usageAudit: [
        {
          taskId: 'task-1',
          updatedAt: '2026-05-11T12:05:00.000Z',
          totalTokens: 1000,
          totalCostUsd: 0.05,
          modelBreakdown: { 'gpt-4': { tokens: 1000 } }
        }
      ]
    });
    const result = buildTaskAudit('task-1', task, snapshot);
    expect(result.entries.filter(e => e.type === 'usage')).toHaveLength(1);
  });

  it('excludes usage audit entry when taskId does not match', () => {
    const task = makeTask();
    const snapshot = makeSnapshot({
      usageAudit: [
        {
          taskId: 'task-2',
          updatedAt: '2026-05-11T12:05:00.000Z',
          totalTokens: 1000,
          totalCostUsd: 0.05,
          modelBreakdown: {}
        }
      ]
    });
    const result = buildTaskAudit('task-1', task, snapshot);
    expect(result.entries.filter(e => e.type === 'usage')).toHaveLength(0);
  });

  it('extracts browser replays from trace data', () => {
    const task = makeTask({
      trace: [
        {
          at: '2026-05-11T12:01:00.000Z',
          summary: 'browsing',
          data: { toolName: 'browse_page', url: 'https://example.com' }
        }
      ]
    });
    const result = buildTaskAudit('task-1', task, makeSnapshot());
    expect(result.browserReplays).toHaveLength(1);
    expect(result.browserReplays[0].url).toBe('https://example.com');
  });

  it('handles missing governanceAudit in snapshot', () => {
    const task = makeTask({ currentWorker: 'w1' });
    const snapshot = { usageAudit: [] } as any;
    const result = buildTaskAudit('task-1', task, snapshot);
    expect(result.entries.filter(e => e.type === 'governance')).toHaveLength(0);
  });

  it('handles missing trace and approvals', () => {
    const task = makeTask({ trace: undefined, approvals: undefined });
    const result = buildTaskAudit('task-1', task, makeSnapshot());
    expect(result.entries).toEqual([]);
  });

  it('sorts entries by at descending', () => {
    const task = makeTask({
      trace: [
        { at: '2026-05-11T12:01:00.000Z', node: 'a', summary: 'first', data: {} },
        { at: '2026-05-11T12:03:00.000Z', node: 'b', summary: 'third', data: {} }
      ],
      approvals: [{ intent: 'x', decision: 'y', reason: 'z' }]
    });
    const snapshot = makeSnapshot({
      usageAudit: [
        {
          taskId: 'task-1',
          updatedAt: '2026-05-11T12:02:00.000Z',
          totalTokens: 100,
          totalCostUsd: 0.01,
          modelBreakdown: {}
        }
      ]
    });
    const result = buildTaskAudit('task-1', task, snapshot);
    // entries should be sorted by at descending
    for (let i = 1; i < result.entries.length; i++) {
      expect(result.entries[i - 1].at >= result.entries[i].at).toBe(true);
    }
  });
});

describe('buildFallbackTaskPlan', () => {
  it('builds plan with trace steps', () => {
    const task = makeTask({
      trace: [
        { at: '2026-05-11T12:01:00.000Z', node: 'a', summary: 'Step 1', data: {} },
        { at: '2026-05-11T12:02:00.000Z', node: 'b', summary: 'Step 2', data: {} }
      ]
    });
    const result = buildFallbackTaskPlan(task);
    expect(result.goal).toBe('Test goal');
    expect(result.steps).toContain('Step 1');
    expect(result.steps).toContain('Step 2');
    expect(result.subTasks).toHaveLength(1);
  });

  it('builds plan with route summary when no trace', () => {
    const task = makeTask({ trace: [] });
    const result = buildFallbackTaskPlan(task);
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.summary).toContain('execution');
  });

  it('handles direct-reply flow', () => {
    const task = makeTask({
      chatRoute: { flow: 'direct-reply' },
      trace: []
    });
    const result = buildFallbackTaskPlan(task);
    expect(result.summary).toContain('direct-reply');
    expect(result.subTasks[0].title).toBe('会话直答');
  });

  it('handles missing currentStep', () => {
    const task = makeTask({ currentStep: undefined, trace: [] });
    const result = buildFallbackTaskPlan(task);
    expect(result.summary).toContain('未生成');
  });

  it('maps research ministry to research role', () => {
    const task = makeTask({
      currentMinistry: 'research',
      dispatches: [],
      trace: []
    });
    const result = buildFallbackTaskPlan(task);
    expect(result.subTasks[0].assignedTo).toBe('research');
  });

  it('maps hubu-search ministry to research role', () => {
    const task = makeTask({ currentMinistry: 'hubu-search', dispatches: [], trace: [] });
    const result = buildFallbackTaskPlan(task);
    expect(result.subTasks[0].assignedTo).toBe('research');
  });

  it('maps libu-delivery ministry to research role', () => {
    const task = makeTask({ currentMinistry: 'libu-delivery', dispatches: [], trace: [] });
    const result = buildFallbackTaskPlan(task);
    expect(result.subTasks[0].assignedTo).toBe('research');
  });

  it('maps review ministry to reviewer role', () => {
    const task = makeTask({ currentMinistry: 'review', dispatches: [], trace: [] });
    const result = buildFallbackTaskPlan(task);
    expect(result.subTasks[0].assignedTo).toBe('reviewer');
  });

  it('maps xingbu-review ministry to reviewer role', () => {
    const task = makeTask({ currentMinistry: 'xingbu-review', dispatches: [], trace: [] });
    const result = buildFallbackTaskPlan(task);
    expect(result.subTasks[0].assignedTo).toBe('reviewer');
  });

  it('maps execution ministry to executor role', () => {
    const task = makeTask({ currentMinistry: 'execution', dispatches: [], trace: [] });
    const result = buildFallbackTaskPlan(task);
    expect(result.subTasks[0].assignedTo).toBe('executor');
  });

  it('maps gongbu-code ministry to executor role', () => {
    const task = makeTask({ currentMinistry: 'gongbu-code', dispatches: [], trace: [] });
    const result = buildFallbackTaskPlan(task);
    expect(result.subTasks[0].assignedTo).toBe('executor');
  });

  it('maps bingbu-ops ministry to executor role', () => {
    const task = makeTask({ currentMinistry: 'bingbu-ops', dispatches: [], trace: [] });
    const result = buildFallbackTaskPlan(task);
    expect(result.subTasks[0].assignedTo).toBe('executor');
  });

  it('defaults to manager role for unknown ministry', () => {
    const task = makeTask({ currentMinistry: 'unknown', dispatches: [], trace: [] });
    const result = buildFallbackTaskPlan(task);
    expect(result.subTasks[0].assignedTo).toBe('manager');
  });

  it('uses strategy dispatch for research role', () => {
    const task = makeTask({
      dispatches: [{ kind: 'strategy' }],
      trace: []
    });
    const result = buildFallbackTaskPlan(task);
    expect(result.subTasks[0].assignedTo).toBe('research');
  });

  it('uses ministry dispatch for executor role', () => {
    const task = makeTask({
      dispatches: [{ kind: 'ministry' }],
      trace: []
    });
    const result = buildFallbackTaskPlan(task);
    expect(result.subTasks[0].assignedTo).toBe('executor');
  });

  it('uses risk-compliance dispatch for reviewer role', () => {
    const task = makeTask({
      dispatches: [{ kind: 'ministry', specialistDomain: 'risk-compliance' }],
      trace: []
    });
    const result = buildFallbackTaskPlan(task);
    expect(result.subTasks[0].assignedTo).toBe('reviewer');
  });

  it('uses reviewer in selectedAgentId for reviewer role', () => {
    const task = makeTask({
      dispatches: [{ kind: 'ministry', selectedAgentId: 'code-reviewer' }],
      trace: []
    });
    const result = buildFallbackTaskPlan(task);
    expect(result.subTasks[0].assignedTo).toBe('reviewer');
  });

  it('uses reviewer in agentId for reviewer role', () => {
    const task = makeTask({
      dispatches: [{ kind: 'ministry', agentId: 'reviewer-agent' }],
      trace: []
    });
    const result = buildFallbackTaskPlan(task);
    expect(result.subTasks[0].assignedTo).toBe('reviewer');
  });

  it('uses requiredCapabilities for reviewer role', () => {
    const task = makeTask({
      dispatches: [{ kind: 'ministry', requiredCapabilities: ['specialist.risk-compliance'] }],
      trace: []
    });
    const result = buildFallbackTaskPlan(task);
    expect(result.subTasks[0].assignedTo).toBe('reviewer');
  });

  it('maps queued status to pending', () => {
    const task = makeTask({ status: 'queued', trace: [] });
    const result = buildFallbackTaskPlan(task);
    expect(result.subTasks[0].status).toBe('pending');
  });

  it('maps waiting_approval status to pending', () => {
    const task = makeTask({ status: 'waiting_approval', trace: [] });
    const result = buildFallbackTaskPlan(task);
    expect(result.subTasks[0].status).toBe('pending');
  });

  it('maps running status to running', () => {
    const task = makeTask({ status: 'running', trace: [] });
    const result = buildFallbackTaskPlan(task);
    expect(result.subTasks[0].status).toBe('running');
  });

  it('maps blocked status to blocked', () => {
    const task = makeTask({ status: 'blocked', trace: [] });
    const result = buildFallbackTaskPlan(task);
    expect(result.subTasks[0].status).toBe('blocked');
  });

  it('maps completed status to completed', () => {
    const task = makeTask({ status: 'completed', trace: [] });
    const result = buildFallbackTaskPlan(task);
    expect(result.subTasks[0].status).toBe('completed');
  });

  it('maps unknown status to completed', () => {
    const task = makeTask({ status: 'unknown', trace: [] });
    const result = buildFallbackTaskPlan(task);
    expect(result.subTasks[0].status).toBe('completed');
  });

  it('limits trace steps to 4', () => {
    const task = makeTask({
      trace: Array.from({ length: 10 }, (_, i) => ({
        at: `2026-05-11T12:0${i}:00.000Z`,
        node: `node-${i}`,
        summary: `Step ${i}`,
        data: {}
      }))
    });
    const result = buildFallbackTaskPlan(task);
    expect(result.steps.length).toBeLessThanOrEqual(4);
  });

  it('filters empty trace summaries', () => {
    const task = makeTask({
      trace: [
        { at: '2026-05-11T12:01:00.000Z', node: 'a', summary: '', data: {} },
        { at: '2026-05-11T12:02:00.000Z', node: 'b', summary: 'Valid step', data: {} },
        { at: '2026-05-11T12:03:00.000Z', node: 'c', summary: '  ', data: {} }
      ]
    });
    const result = buildFallbackTaskPlan(task);
    expect(result.steps).toContain('Valid step');
    expect(result.steps).not.toContain('');
  });

  it('handles fallback dispatch kind', () => {
    const task = makeTask({
      dispatches: [{ kind: 'fallback' }, { kind: 'strategy' }],
      trace: []
    });
    const result = buildFallbackTaskPlan(task);
    // fallback dispatches are skipped, strategy dispatch is found
    expect(result.subTasks[0].assignedTo).toBe('research');
  });
});
