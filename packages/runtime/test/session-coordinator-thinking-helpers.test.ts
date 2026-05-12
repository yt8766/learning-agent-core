import { describe, expect, it } from 'vitest';

import {
  buildSessionThoughtChain,
  buildSessionThinkState,
  buildSessionThoughtGraph
} from '../src/session/coordinator/session-coordinator-thinking-helpers';

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    goal: 'test goal',
    status: 'running',
    trace: [
      { node: 'decree_received', summary: 'received decree', at: '2026-04-16T00:00:00.000Z' },
      { node: 'research', summary: 'research done', at: '2026-04-16T00:05:00.000Z' },
      { node: 'execute', summary: 'executing', at: '2026-04-16T00:10:00.000Z' }
    ],
    currentMinistry: 'gongbu-code',
    createdAt: '2026-04-16T00:00:00.000Z',
    updatedAt: '2026-04-16T00:15:00.000Z',
    ...overrides
  } as any;
}

function makeCheckpoint(overrides: Record<string, unknown> = {}) {
  return {
    checkpointId: 'cp-1',
    sessionId: 'session-1',
    taskId: 'task-1',
    traceCursor: 0,
    recoverability: 'safe',
    ...overrides
  } as any;
}

describe('session-coordinator-thinking-helpers', () => {
  describe('buildSessionThoughtChain', () => {
    it('builds chain from task traces', () => {
      const task = makeTask();
      const chain = buildSessionThoughtChain(task, 'msg-1');
      expect(chain).toHaveLength(3);
      expect(chain[0].title).toBe('接收圣旨');
      expect(chain[1].title).toBe('户部检索');
      expect(chain[2].title).toBe('工部/兵部执行');
    });

    it('sets status to loading for last running trace', () => {
      const task = makeTask({ status: 'running' });
      const chain = buildSessionThoughtChain(task);
      expect(chain[chain.length - 1].status).toBe('loading');
      expect(chain[chain.length - 1].blink).toBe(true);
    });

    it('sets status to success for completed traces', () => {
      const task = makeTask({ status: 'completed' });
      const chain = buildSessionThoughtChain(task);
      expect(chain[chain.length - 1].status).toBe('success');
      expect(chain[chain.length - 1].blink).toBe(false);
    });

    it('sets status to error for failed task last trace', () => {
      const task = makeTask({ status: 'failed' });
      const chain = buildSessionThoughtChain(task);
      expect(chain[chain.length - 1].status).toBe('error');
    });

    it('sets status to abort for cancelled task last trace', () => {
      const task = makeTask({ status: 'cancelled' });
      const chain = buildSessionThoughtChain(task);
      expect(chain[chain.length - 1].status).toBe('abort');
    });

    it('calculates thinking duration', () => {
      const task = makeTask();
      const chain = buildSessionThoughtChain(task);
      expect(chain[0].thinkingDurationMs).toBeDefined();
      expect(chain[0].thinkingDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('includes messageId in chain items', () => {
      const task = makeTask();
      const chain = buildSessionThoughtChain(task, 'msg-1');
      expect(chain[0].messageId).toBe('msg-1');
    });

    it('handles empty trace', () => {
      const task = makeTask({ trace: [] });
      const chain = buildSessionThoughtChain(task);
      expect(chain).toHaveLength(0);
    });

    it('handles review node with different ministries', () => {
      const task = makeTask({
        trace: [{ node: 'review', summary: 'reviewing', at: '2026-04-16T00:00:00.000Z' }],
        currentMinistry: 'xingbu-review'
      });
      const chain = buildSessionThoughtChain(task);
      expect(chain[0].title).toBe('刑部/礼部审查');
    });

    it('handles review node with libu-delivery ministry', () => {
      const task = makeTask({
        trace: [{ node: 'review', summary: 'delivering', at: '2026-04-16T00:00:00.000Z' }],
        currentMinistry: 'libu-delivery'
      });
      const chain = buildSessionThoughtChain(task);
      expect(chain[0].description).toContain('礼部');
    });

    it('handles approval_gate node', () => {
      const task = makeTask({
        trace: [{ node: 'approval_gate', summary: 'waiting approval', at: '2026-04-16T00:00:00.000Z' }],
        status: 'waiting_approval'
      });
      const chain = buildSessionThoughtChain(task);
      expect(chain[0].title).toBe('阻塞式中断确认');
    });

    it('handles run_resumed node', () => {
      const task = makeTask({
        trace: [{ node: 'run_resumed', summary: 'resumed', at: '2026-04-16T00:00:00.000Z' }]
      });
      const chain = buildSessionThoughtChain(task);
      expect(chain[0].title).toBe('恢复执行');
    });

    it('handles finish node', () => {
      const task = makeTask({
        trace: [{ node: 'finish', summary: 'done', at: '2026-04-16T00:00:00.000Z' }],
        status: 'completed'
      });
      const chain = buildSessionThoughtChain(task);
      expect(chain[0].title).toBe('汇总答复');
    });

    it('handles execute node with bingbu-ops ministry', () => {
      const task = makeTask({
        trace: [{ node: 'execute', summary: 'running ops', at: '2026-04-16T00:00:00.000Z' }],
        currentMinistry: 'bingbu-ops'
      });
      const chain = buildSessionThoughtChain(task);
      expect(chain[0].description).toContain('兵部');
    });

    it('handles unknown node as default', () => {
      const task = makeTask({
        trace: [{ node: 'custom_node', summary: 'custom', at: '2026-04-16T00:00:00.000Z' }]
      });
      const chain = buildSessionThoughtChain(task);
      expect(chain[0].title).toBe('custom_node');
    });
  });

  describe('buildSessionThinkState', () => {
    it('returns undefined when no traces', () => {
      const task = makeTask({ trace: [] });
      expect(buildSessionThinkState(task)).toBeUndefined();
    });

    it('returns think state with loading for running task', () => {
      const task = makeTask({ status: 'running' });
      const state = buildSessionThinkState(task);
      expect(state).toBeDefined();
      expect(state!.loading).toBe(true);
      expect(state!.blink).toBe(true);
    });

    it('returns think state without loading for completed task', () => {
      const task = makeTask({ status: 'completed' });
      const state = buildSessionThinkState(task);
      expect(state).toBeDefined();
      expect(state!.loading).toBe(false);
    });

    it('includes thinkingDurationMs', () => {
      const task = makeTask();
      const state = buildSessionThinkState(task);
      expect(state!.thinkingDurationMs).toBeDefined();
    });

    it('includes messageId', () => {
      const task = makeTask();
      const state = buildSessionThinkState(task, 'msg-1');
      expect(state!.messageId).toBe('msg-1');
    });

    it('builds think title for waiting approval with user-input', () => {
      const task = makeTask({
        status: 'waiting_approval',
        activeInterrupt: { kind: 'user-input' }
      });
      const state = buildSessionThinkState(task);
      expect(state!.title).toBe('等待方案澄清');
    });

    it('builds think title for waiting approval', () => {
      const task = makeTask({
        status: 'waiting_approval',
        activeInterrupt: { kind: 'tool-approval' }
      });
      const state = buildSessionThinkState(task);
      expect(state!.title).toBe('等待阻塞式中断确认');
    });

    it('builds think title with ministry', () => {
      const task = makeTask({ currentMinistry: 'hubu-search' });
      const state = buildSessionThinkState(task);
      expect(state!.title).toContain('户部');
    });

    it('builds think content for plan mode', () => {
      const task = makeTask({
        executionMode: 'plan'
      });
      const state = buildSessionThinkState(task);
      expect(state!.content).toContain('计划只读');
    });

    it('builds think content for waiting approval with pendingApproval', () => {
      const task = makeTask({
        status: 'waiting_approval',
        pendingApproval: {
          intent: 'write_file',
          riskLevel: 'high',
          reason: 'needs approval'
        }
      });
      const state = buildSessionThinkState(task);
      expect(state!.content).toContain('阻塞式中断确认');
    });
  });

  describe('buildSessionThoughtGraph', () => {
    it('builds nodes and edges from traces', () => {
      const task = makeTask();
      const checkpoint = makeCheckpoint();
      const graph = buildSessionThoughtGraph(task, checkpoint);
      expect(graph.nodes).toHaveLength(3);
      expect(graph.edges).toHaveLength(2);
    });

    it('sets node status correctly', () => {
      const task = makeTask({ status: 'running' });
      const checkpoint = makeCheckpoint();
      const graph = buildSessionThoughtGraph(task, checkpoint);
      expect(graph.nodes[graph.nodes.length - 1].status).toBe('running');
      expect(graph.nodes[0].status).toBe('completed');
    });

    it('sets failed status for failed task', () => {
      const task = makeTask({ status: 'failed' });
      const checkpoint = makeCheckpoint();
      const graph = buildSessionThoughtGraph(task, checkpoint);
      expect(graph.nodes[graph.nodes.length - 1].status).toBe('failed');
    });

    it('sets blocked status for waiting_approval task', () => {
      const task = makeTask({ status: 'waiting_approval' });
      const checkpoint = makeCheckpoint();
      const graph = buildSessionThoughtGraph(task, checkpoint);
      expect(graph.nodes[graph.nodes.length - 1].status).toBe('blocked');
    });

    it('sets completed status for completed task', () => {
      const task = makeTask({ status: 'completed' });
      const checkpoint = makeCheckpoint();
      const graph = buildSessionThoughtGraph(task, checkpoint);
      expect(graph.nodes[graph.nodes.length - 1].status).toBe('completed');
    });

    it('adds planning node when no traces', () => {
      const task = makeTask({ trace: [] });
      const checkpoint = makeCheckpoint();
      const graph = buildSessionThoughtGraph(task, checkpoint);
      expect(graph.nodes).toHaveLength(1);
      expect(graph.nodes[0].kind).toBe('planning');
      expect(graph.nodes[0].label).toBe('test goal');
    });

    it('includes checkpointRef in nodes', () => {
      const task = makeTask();
      const checkpoint = makeCheckpoint();
      const graph = buildSessionThoughtGraph(task, checkpoint);
      expect(graph.nodes[0].checkpointRef).toBeDefined();
      expect(graph.nodes[0].checkpointRef.checkpointId).toBe('cp-1');
    });

    it('includes errorCode from trace data', () => {
      const task = makeTask({
        trace: [{ node: 'execute', summary: 'error', at: '2026-04-16T00:00:00.000Z', data: { errorCode: 'E001' } }]
      });
      const checkpoint = makeCheckpoint();
      const graph = buildSessionThoughtGraph(task, checkpoint);
      expect(graph.nodes[0].errorCode).toBe('E001');
    });
  });
});
