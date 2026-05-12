import { describe, expect, it } from 'vitest';

import { TaskStatus } from '@agent/core';

import {
  buildMinistryThinkContent,
  buildNextActionHint,
  buildMinistryNextActionHint,
  getThinkTitle,
  getThoughtTitle,
  getThoughtStatus,
  getMinistryLabel,
  mapTraceNodeToThoughtKind,
  extractTraceErrorCode
} from '../src/session/session-thinking-resolvers';

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    status: TaskStatus.RUNNING,
    currentMinistry: 'gongbu-code',
    currentStep: 'execute',
    ...overrides
  } as any;
}

describe('session-thinking-resolvers (direct)', () => {
  describe('buildMinistryThinkContent', () => {
    it('includes ministry label', () => {
      const content = buildMinistryThinkContent(makeTask(), 'latest summary');
      expect(content).toContain('工部');
    });

    it('includes worker name when present', () => {
      const content = buildMinistryThinkContent(makeTask({ currentWorker: 'coder-1' }), '');
      expect(content).toContain('coder-1');
    });

    it('includes model route when present', () => {
      const task = makeTask({
        modelRoute: [{ ministry: 'gongbu-code', selectedModel: 'gpt-4', reason: 'best for code' }]
      });
      const content = buildMinistryThinkContent(task, '');
      expect(content).toContain('gpt-4');
    });

    it('includes plan steps when present', () => {
      const task = makeTask({
        plan: { steps: ['step 1', 'step 2', 'step 3'] }
      });
      const content = buildMinistryThinkContent(task, '');
      expect(content).toContain('3 步');
    });

    it('includes latest summary', () => {
      const content = buildMinistryThinkContent(makeTask(), 'progress update');
      expect(content).toContain('progress update');
    });
  });

  describe('buildNextActionHint', () => {
    it('returns hint for goal_intake', () => {
      expect(buildNextActionHint(makeTask({ currentStep: 'goal_intake' }))).toContain('流程模板');
    });

    it('returns hint for route', () => {
      expect(buildNextActionHint(makeTask({ currentStep: 'route' }))).toContain('吏部路由');
    });

    it('returns hint for manager_plan', () => {
      expect(buildNextActionHint(makeTask({ currentStep: 'manager_plan' }))).toContain('拆解');
    });

    it('returns hint for dispatch', () => {
      expect(buildNextActionHint(makeTask({ currentStep: 'dispatch' }))).toContain('下发');
    });

    it('returns hint for research', () => {
      expect(buildNextActionHint(makeTask({ currentStep: 'research' }))).toContain('检索');
    });

    it('returns hint for execute', () => {
      expect(buildNextActionHint(makeTask({ currentStep: 'execute' }))).toContain('执行');
    });

    it('returns hint for review', () => {
      expect(buildNextActionHint(makeTask({ currentStep: 'review' }))).toContain('审查');
    });

    it('returns hint for finish', () => {
      expect(buildNextActionHint(makeTask({ currentStep: 'finish' }))).toContain('结束');
    });

    it('returns completed hint for completed task', () => {
      expect(buildNextActionHint(makeTask({ status: TaskStatus.COMPLETED, currentStep: undefined }))).toContain('完成');
    });

    it('returns blocked hint for failed task', () => {
      expect(buildNextActionHint(makeTask({ status: TaskStatus.FAILED, currentStep: undefined }))).toContain('中断');
    });

    it('returns default hint for running task', () => {
      expect(buildNextActionHint(makeTask({ currentStep: undefined }))).toContain('推进');
    });
  });

  describe('buildMinistryNextActionHint', () => {
    it('returns governance hint for libu-governance', () => {
      expect(buildMinistryNextActionHint(makeTask(), 'libu-governance')).toContain('平衡');
    });

    it('returns search hint for hubu-search', () => {
      expect(buildMinistryNextActionHint(makeTask(), 'hubu-search')).toContain('检索');
    });

    it('returns code hint for gongbu-code', () => {
      expect(buildMinistryNextActionHint(makeTask(), 'gongbu-code')).toContain('代码');
    });

    it('returns ops hint for bingbu-ops', () => {
      expect(buildMinistryNextActionHint(makeTask(), 'bingbu-ops')).toContain('终端');
    });

    it('returns review hint for xingbu-review', () => {
      expect(buildMinistryNextActionHint(makeTask(), 'xingbu-review')).toContain('审查');
    });

    it('returns delivery hint for libu-delivery', () => {
      expect(buildMinistryNextActionHint(makeTask(), 'libu-delivery')).toBeDefined();
    });

    it('returns delivery review hint when step is review', () => {
      expect(buildMinistryNextActionHint(makeTask({ currentStep: 'review' }), 'libu-delivery')).toContain('交付');
    });

    it('falls back to buildNextActionHint for unknown ministry', () => {
      expect(buildMinistryNextActionHint(makeTask(), 'unknown-ministry')).toBeDefined();
    });
  });

  describe('getThinkTitle', () => {
    it('returns waiting clarification for user-input interrupt', () => {
      const task = makeTask({
        status: TaskStatus.WAITING_APPROVAL,
        activeInterrupt: { kind: 'user-input' }
      });
      expect(getThinkTitle(task)).toBe('等待方案澄清');
    });

    it('returns waiting approval for other interrupts', () => {
      const task = makeTask({
        status: TaskStatus.WAITING_APPROVAL,
        activeInterrupt: { kind: 'tool-approval' }
      });
      expect(getThinkTitle(task)).toBe('等待阻塞式中断确认');
    });

    it('returns ministry label with reporting', () => {
      expect(getThinkTitle(makeTask())).toContain('工部');
      expect(getThinkTitle(makeTask())).toContain('汇报');
    });

    it('returns step label when no ministry', () => {
      expect(getThinkTitle(makeTask({ currentMinistry: undefined, currentStep: 'review' }))).toContain('review');
    });

    it('returns default thinking title', () => {
      expect(getThinkTitle(makeTask({ currentMinistry: undefined, currentStep: undefined }))).toBe('首辅思考中');
    });
  });

  describe('getThoughtTitle', () => {
    it('returns correct title for known nodes', () => {
      expect(getThoughtTitle('decree_received')).toBe('接收圣旨');
      expect(getThoughtTitle('research')).toBe('户部检索');
      expect(getThoughtTitle('execute')).toBe('工部/兵部执行');
      expect(getThoughtTitle('review')).toBe('刑部/礼部审查');
      expect(getThoughtTitle('approval_gate')).toBe('阻塞式中断确认');
      expect(getThoughtTitle('run_resumed')).toBe('恢复执行');
      expect(getThoughtTitle('finish')).toBe('汇总答复');
    });

    it('returns node name for unknown nodes', () => {
      expect(getThoughtTitle('custom_node')).toBe('custom_node');
    });

    it('returns correct title for planning nodes', () => {
      expect(getThoughtTitle('manager_plan')).toBe('首辅规划');
      expect(getThoughtTitle('libu_routed')).toBe('吏部路由');
      expect(getThoughtTitle('dispatch')).toBe('分派尚书');
    });
  });

  describe('getThoughtStatus', () => {
    it('returns success for finish node', () => {
      expect(getThoughtStatus('finish', TaskStatus.RUNNING, true)).toBe('success');
    });

    it('returns success for completed task', () => {
      expect(getThoughtStatus('execute', TaskStatus.COMPLETED, false)).toBe('success');
    });

    it('returns error for failed task last item', () => {
      expect(getThoughtStatus('execute', TaskStatus.FAILED, true)).toBe('error');
    });

    it('returns success for failed task non-last item', () => {
      expect(getThoughtStatus('research', TaskStatus.FAILED, false)).toBe('success');
    });

    it('returns abort for cancelled task last item', () => {
      expect(getThoughtStatus('execute', TaskStatus.CANCELLED, true)).toBe('abort');
    });

    it('returns abort for approval_gate with waiting_approval', () => {
      expect(getThoughtStatus('approval_gate', TaskStatus.WAITING_APPROVAL, true)).toBe('abort');
    });

    it('returns loading for last running item', () => {
      expect(getThoughtStatus('execute', TaskStatus.RUNNING, true)).toBe('loading');
    });

    it('returns success for non-last running item', () => {
      expect(getThoughtStatus('research', TaskStatus.RUNNING, false)).toBe('success');
    });
  });

  describe('getMinistryLabel', () => {
    it('returns Chinese label for known ministry', () => {
      expect(getMinistryLabel('hubu-search')).toBe('户部');
    });

    it('returns input for unknown ministry', () => {
      expect(getMinistryLabel('unknown')).toBe('unknown');
    });
  });

  describe('mapTraceNodeToThoughtKind', () => {
    it('returns planning for entry nodes', () => {
      expect(mapTraceNodeToThoughtKind('entry_router')).toBe('planning');
      expect(mapTraceNodeToThoughtKind('dispatch_planner')).toBe('planning');
    });

    it('returns finalize for result nodes', () => {
      expect(mapTraceNodeToThoughtKind('result_aggregator')).toBe('finalize');
      expect(mapTraceNodeToThoughtKind('learning_recorder')).toBe('finalize');
    });

    it('returns approval for interrupt nodes', () => {
      expect(mapTraceNodeToThoughtKind('interrupt_controller')).toBe('approval');
      expect(mapTraceNodeToThoughtKind('approval_gate')).toBe('approval');
    });

    it('returns review for review nodes', () => {
      expect(mapTraceNodeToThoughtKind('review')).toBe('review');
    });

    it('returns recovery for recovery nodes', () => {
      expect(mapTraceNodeToThoughtKind('recovery_node')).toBe('recovery');
      expect(mapTraceNodeToThoughtKind('run_resumed')).toBe('recovery');
    });

    it('returns research for research nodes', () => {
      expect(mapTraceNodeToThoughtKind('research')).toBe('research');
      expect(mapTraceNodeToThoughtKind('source_search')).toBe('research');
    });

    it('returns execution for tool/execute nodes', () => {
      expect(mapTraceNodeToThoughtKind('execute')).toBe('execution');
      expect(mapTraceNodeToThoughtKind('tool_call')).toBe('execution');
      expect(mapTraceNodeToThoughtKind('terminal_run')).toBe('execution');
    });

    it('returns failure for error nodes', () => {
      expect(mapTraceNodeToThoughtKind('error_handler')).toBe('failure');
      expect(mapTraceNodeToThoughtKind('fail_detected')).toBe('failure');
    });

    it('returns planning as default', () => {
      expect(mapTraceNodeToThoughtKind('unknown_node')).toBe('planning');
    });
  });

  describe('extractTraceErrorCode', () => {
    it('returns undefined for non-object', () => {
      expect(extractTraceErrorCode(undefined)).toBeUndefined();
      expect(extractTraceErrorCode('string')).toBeUndefined();
      expect(extractTraceErrorCode(42)).toBeUndefined();
    });

    it('returns undefined when no errorCode', () => {
      expect(extractTraceErrorCode({})).toBeUndefined();
    });

    it('returns errorCode when present', () => {
      expect(extractTraceErrorCode({ errorCode: 'E001' })).toBe('E001');
    });

    it('returns undefined when errorCode is not a string', () => {
      expect(extractTraceErrorCode({ errorCode: 123 })).toBeUndefined();
    });
  });
});
