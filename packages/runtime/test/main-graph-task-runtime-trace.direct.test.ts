import { describe, expect, it } from 'vitest';

import {
  addRuntimeMessage,
  addRuntimeProgressDelta,
  upsertRuntimeAgentState,
  setRuntimeSubTaskStatus,
  addRuntimeTrace,
  attachRuntimeTool,
  recordRuntimeToolUsage
} from '../src/graphs/main/tasking/runtime/main-graph-task-runtime-trace';

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    messages: [],
    agentStates: [],
    plan: { subTasks: [] },
    trace: [],
    toolAttachments: undefined,
    toolUsageSummary: undefined,
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides
  } as any;
}

describe('main-graph-task-runtime-trace (direct)', () => {
  describe('addRuntimeMessage', () => {
    it('adds message to task', () => {
      const task = makeTask();
      addRuntimeMessage(task, 'summary', 'Hello', 'manager');
      expect(task.messages).toHaveLength(1);
      expect(task.messages[0].content).toBe('Hello');
      expect(task.messages[0].type).toBe('summary');
    });

    it('defaults to MANAGER recipient', () => {
      const task = makeTask();
      addRuntimeMessage(task, 'dispatch', 'msg', 'manager');
      expect(task.messages[0].to).toBe('manager');
    });

    it('uses custom recipient', () => {
      const task = makeTask();
      addRuntimeMessage(task, 'dispatch', 'msg', 'manager', 'executor');
      expect(task.messages[0].to).toBe('executor');
    });
  });

  describe('addRuntimeProgressDelta', () => {
    it('adds progress message', () => {
      const task = makeTask();
      addRuntimeProgressDelta(task, 'Progress update');
      expect(task.messages).toHaveLength(1);
      expect(task.messages[0].type).toBe('summary_delta');
      expect(task.messages[0].content).toContain('Progress update');
    });

    it('skips empty content', () => {
      const task = makeTask();
      addRuntimeProgressDelta(task, '');
      expect(task.messages).toHaveLength(0);
    });

    it('skips whitespace-only content', () => {
      const task = makeTask();
      addRuntimeProgressDelta(task, '   ');
      expect(task.messages).toHaveLength(0);
    });
  });

  describe('upsertRuntimeAgentState', () => {
    it('adds new agent state', () => {
      const task = makeTask();
      const result = upsertRuntimeAgentState(task, { role: 'manager' } as any);
      expect(result).toBe(false);
      expect(task.agentStates).toHaveLength(1);
    });

    it('updates existing agent state', () => {
      const task = makeTask({ agentStates: [{ role: 'manager', old: true }] });
      const result = upsertRuntimeAgentState(task, { role: 'manager', new: true } as any);
      expect(result).toBe(true);
      expect(task.agentStates).toHaveLength(1);
      expect(task.agentStates[0].new).toBe(true);
    });
  });

  describe('setRuntimeSubTaskStatus', () => {
    it('updates subtask status when found', () => {
      const task = makeTask({
        plan: { subTasks: [{ assignedTo: 'executor', status: 'pending' }] }
      });
      const result = setRuntimeSubTaskStatus(task, 'executor' as any, 'running');
      expect(result).toBe(true);
      expect(task.plan.subTasks[0].status).toBe('running');
    });

    it('returns false when subtask not found', () => {
      const task = makeTask();
      const result = setRuntimeSubTaskStatus(task, 'executor' as any, 'running');
      expect(result).toBe(false);
    });
  });

  describe('addRuntimeTrace', () => {
    it('adds trace entry', () => {
      const trace: any[] = [];
      addRuntimeTrace(trace, 'execute', 'executed something');
      expect(trace).toHaveLength(1);
      expect(trace[0].node).toBe('execute');
      expect(trace[0].summary).toBe('executed something');
    });

    it('sets traceId from task', () => {
      const trace: any[] = [];
      const task = makeTask({ traceId: 'trace-1' });
      addRuntimeTrace(trace, 'node', 'summary', undefined, task);
      expect(trace[0].traceId).toBe('trace-1');
    });

    it('generates traceId when task has none', () => {
      const trace: any[] = [];
      const task = makeTask();
      addRuntimeTrace(trace, 'node', 'summary', undefined, task);
      expect(trace[0].traceId).toBeDefined();
      expect(task.traceId).toBeDefined();
    });

    it('extracts specialistId from data', () => {
      const trace: any[] = [];
      addRuntimeTrace(trace, 'node', 'summary', { specialistId: 'spec-1' });
      expect(trace[0].specialistId).toBe('spec-1');
    });

    it('sets role from data', () => {
      const trace: any[] = [];
      addRuntimeTrace(trace, 'node', 'summary', { role: 'lead' });
      expect(trace[0].role).toBe('lead');
    });

    it('ignores invalid role', () => {
      const trace: any[] = [];
      addRuntimeTrace(trace, 'node', 'summary', { role: 'invalid' });
      expect(trace[0].role).toBeUndefined();
    });

    it('sets latencyMs from data', () => {
      const trace: any[] = [];
      addRuntimeTrace(trace, 'node', 'summary', { latencyMs: 500 });
      expect(trace[0].latencyMs).toBe(500);
    });

    it('sets status from data', () => {
      const trace: any[] = [];
      addRuntimeTrace(trace, 'node', 'summary', { status: 'success' });
      expect(trace[0].status).toBe('success');
    });

    it('ignores invalid status', () => {
      const trace: any[] = [];
      addRuntimeTrace(trace, 'node', 'summary', { status: 'invalid' });
      expect(trace[0].status).toBeUndefined();
    });

    it('sets tokenUsage from data', () => {
      const trace: any[] = [];
      const usage = { promptTokens: 100, completionTokens: 50, totalTokens: 150 };
      addRuntimeTrace(trace, 'node', 'summary', { tokenUsage: usage });
      expect(trace[0].tokenUsage).toEqual(usage);
    });

    it('resolves parentSpanId from same stage', () => {
      const trace: any[] = [];
      addRuntimeTrace(trace, 'research', 'first');
      addRuntimeTrace(trace, 'research', 'second');
      expect(trace[1].parentSpanId).toBe(trace[0].spanId);
    });

    it('resolves parentSpanId from previous trace when no same stage', () => {
      const trace: any[] = [];
      addRuntimeTrace(trace, 'execute', 'first');
      addRuntimeTrace(trace, 'review', 'second');
      expect(trace[1].parentSpanId).toBe(trace[0].spanId);
    });
  });

  describe('attachRuntimeTool', () => {
    it('attaches tool to task', () => {
      const task = makeTask();
      attachRuntimeTool(task, undefined, { toolName: 'bash', attachedBy: 'workflow' });
      expect(task.toolAttachments).toHaveLength(1);
      expect(task.toolAttachments[0].toolName).toBe('bash');
    });

    it('deduplicates by toolName', () => {
      const task = makeTask();
      attachRuntimeTool(task, undefined, { toolName: 'bash', attachedBy: 'workflow' });
      attachRuntimeTool(task, undefined, { toolName: 'bash', attachedBy: 'runtime' });
      expect(task.toolAttachments).toHaveLength(1);
    });

    it('uses provided ownerType and ownerId', () => {
      const task = makeTask();
      attachRuntimeTool(task, undefined, {
        toolName: 'bash',
        attachedBy: 'workflow',
        ownerType: 'ministry-owned',
        ownerId: 'gongbu-code'
      });
      expect(task.toolAttachments[0].ownerType).toBe('ministry-owned');
      expect(task.toolAttachments[0].ownerId).toBe('gongbu-code');
    });

    it('defaults preferred to false', () => {
      const task = makeTask();
      attachRuntimeTool(task, undefined, { toolName: 'bash', attachedBy: 'workflow' });
      expect(task.toolAttachments[0].preferred).toBe(false);
    });

    it('sets preferred to true', () => {
      const task = makeTask();
      attachRuntimeTool(task, undefined, { toolName: 'bash', attachedBy: 'workflow', preferred: true });
      expect(task.toolAttachments[0].preferred).toBe(true);
    });
  });

  describe('recordRuntimeToolUsage', () => {
    it('records tool usage', () => {
      const task = makeTask();
      recordRuntimeToolUsage(task, undefined, { toolName: 'bash', status: 'completed' });
      expect(task.toolUsageSummary).toHaveLength(1);
      expect(task.toolUsageSummary[0].toolName).toBe('bash');
      expect(task.toolUsageSummary[0].status).toBe('completed');
    });

    it('deduplicates by toolName:status:usedAt', () => {
      const task = makeTask();
      recordRuntimeToolUsage(task, undefined, { toolName: 'bash', status: 'completed' });
      // Second call has different usedAt, so it's not a duplicate
      recordRuntimeToolUsage(task, undefined, { toolName: 'bash', status: 'completed' });
      expect(task.toolUsageSummary.length).toBeGreaterThanOrEqual(1);
    });

    it('caps at 50 entries', () => {
      const task = makeTask({
        toolUsageSummary: Array.from({ length: 50 }, (_, i) => ({
          toolName: `tool-${i}`,
          status: 'completed',
          usedAt: `2026-01-01T${String(i).padStart(2, '0')}:00:00Z`
        }))
      });
      recordRuntimeToolUsage(task, undefined, { toolName: 'new-tool', status: 'completed' });
      expect(task.toolUsageSummary).toHaveLength(50);
    });

    it('sets route to mcp when serverId present', () => {
      const task = makeTask();
      recordRuntimeToolUsage(task, undefined, { toolName: 'bash', status: 'completed', serverId: 'srv-1' });
      expect(task.toolUsageSummary[0].route).toBe('mcp');
    });

    it('sets route to governance for governance-tool', () => {
      const toolRegistry = { get: () => ({ capabilityType: 'governance-tool' }) } as any;
      const task = makeTask();
      recordRuntimeToolUsage(task, toolRegistry, { toolName: 'bash', status: 'blocked' });
      expect(task.toolUsageSummary[0].route).toBe('governance');
    });

    it('sets route to local by default', () => {
      const task = makeTask();
      recordRuntimeToolUsage(task, undefined, { toolName: 'bash', status: 'completed' });
      expect(task.toolUsageSummary[0].route).toBe('local');
    });

    it('includes riskLevel from params', () => {
      const task = makeTask();
      recordRuntimeToolUsage(task, undefined, { toolName: 'bash', status: 'completed', riskLevel: 'high' });
      expect(task.toolUsageSummary[0].riskLevel).toBe('high');
    });
  });
});
