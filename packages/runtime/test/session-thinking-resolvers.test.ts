import { describe, expect, it } from 'vitest';

import { TaskStatus } from '@agent/core';

import {
  buildMinistryNextActionHint,
  buildMinistryThinkContent,
  buildNextActionHint,
  extractTraceErrorCode,
  getMinistryLabel,
  getThinkTitle,
  getThoughtStatus,
  getThoughtTitle,
  mapTraceNodeToThoughtKind
} from '../src/session/session-thinking-resolvers';

describe('session-thinking-resolvers', () => {
  describe('buildNextActionHint', () => {
    it('returns goal_intake hint', () => {
      const task = { currentStep: 'goal_intake' } as any;
      expect(buildNextActionHint(task)).toContain('流程模板');
    });

    it('returns route hint', () => {
      const task = { currentStep: 'route' } as any;
      expect(buildNextActionHint(task)).toContain('吏部路由');
    });

    it('returns manager_plan hint', () => {
      const task = { currentStep: 'manager_plan' } as any;
      expect(buildNextActionHint(task)).toContain('拆解');
    });

    it('returns dispatch hint', () => {
      const task = { currentStep: 'dispatch' } as any;
      expect(buildNextActionHint(task)).toContain('下发');
    });

    it('returns research hint', () => {
      const task = { currentStep: 'research' } as any;
      expect(buildNextActionHint(task)).toContain('检索');
    });

    it('returns execute hint', () => {
      const task = { currentStep: 'execute' } as any;
      expect(buildNextActionHint(task)).toContain('执行');
    });

    it('returns review hint', () => {
      const task = { currentStep: 'review' } as any;
      expect(buildNextActionHint(task)).toContain('审查');
    });

    it('returns finish hint', () => {
      const task = { currentStep: 'finish' } as any;
      expect(buildNextActionHint(task)).toContain('结束');
    });

    it('returns completed message for completed status', () => {
      const task = { status: TaskStatus.COMPLETED } as any;
      expect(buildNextActionHint(task)).toContain('完成');
    });

    it('returns interrupted message for failed status', () => {
      const task = { status: TaskStatus.FAILED } as any;
      expect(buildNextActionHint(task)).toContain('中断');
    });

    it('returns interrupted message for blocked status', () => {
      const task = { status: TaskStatus.BLOCKED } as any;
      expect(buildNextActionHint(task)).toContain('中断');
    });

    it('returns default hint for unknown step', () => {
      const task = { status: TaskStatus.RUNNING } as any;
      expect(buildNextActionHint(task)).toContain('推进');
    });
  });

  describe('buildMinistryNextActionHint', () => {
    it('returns governance hint for libu-governance', () => {
      expect(buildMinistryNextActionHint({} as any, 'libu-governance')).toContain('平衡');
    });

    it('returns governance hint for libu-router', () => {
      expect(buildMinistryNextActionHint({} as any, 'libu-router')).toContain('平衡');
    });

    it('returns research hint for hubu-search', () => {
      expect(buildMinistryNextActionHint({} as any, 'hubu-search')).toContain('检索');
    });

    it('returns delivery hint for libu-delivery in review step', () => {
      const task = { currentStep: 'review' } as any;
      expect(buildMinistryNextActionHint(task, 'libu-delivery')).toContain('交付');
    });

    it('returns delivery hint for libu-delivery in non-review step', () => {
      const task = { currentStep: 'execute' } as any;
      expect(buildMinistryNextActionHint(task, 'libu-delivery')).toContain('规范');
    });

    it('returns delivery hint for libu-docs', () => {
      const task = { currentStep: 'research' } as any;
      expect(buildMinistryNextActionHint(task, 'libu-docs')).toContain('规范');
    });

    it('returns ops hint for bingbu-ops', () => {
      expect(buildMinistryNextActionHint({} as any, 'bingbu-ops')).toContain('终端');
    });

    it('returns review hint for xingbu-review', () => {
      expect(buildMinistryNextActionHint({} as any, 'xingbu-review')).toContain('审查');
    });

    it('returns code hint for gongbu-code', () => {
      expect(buildMinistryNextActionHint({} as any, 'gongbu-code')).toContain('代码');
    });

    it('falls back to buildNextActionHint for unknown ministry', () => {
      const task = { currentStep: 'research' } as any;
      expect(buildMinistryNextActionHint(task, 'unknown')).toContain('检索');
    });
  });

  describe('getThinkTitle', () => {
    it('returns user-input waiting title when status is waiting_approval and kind is user-input', () => {
      const task = {
        status: TaskStatus.WAITING_APPROVAL,
        activeInterrupt: { kind: 'user-input' }
      } as any;
      expect(getThinkTitle(task)).toBe('等待方案澄清');
    });

    it('returns approval waiting title when status is waiting_approval', () => {
      const task = {
        status: TaskStatus.WAITING_APPROVAL,
        activeInterrupt: { kind: 'approval' }
      } as any;
      expect(getThinkTitle(task)).toBe('等待阻塞式中断确认');
    });

    it('returns ministry title when currentMinistry is set', () => {
      const task = { currentMinistry: 'hubu-search' } as any;
      expect(getThinkTitle(task)).toContain('户部');
    });

    it('returns step title when currentStep is set but no ministry', () => {
      const task = { currentStep: 'research' } as any;
      expect(getThinkTitle(task)).toContain('research');
    });

    it('returns default thinking title', () => {
      const task = {} as any;
      expect(getThinkTitle(task)).toBe('首辅思考中');
    });
  });

  describe('getThoughtTitle', () => {
    it('returns correct titles for each known node', () => {
      expect(getThoughtTitle('decree_received')).toBe('接收圣旨');
      expect(getThoughtTitle('skill_resolved')).toBe('解析流程模板');
      expect(getThoughtTitle('skill_stage_started')).toBe('流程阶段开始');
      expect(getThoughtTitle('skill_stage_completed')).toBe('流程阶段完成');
      expect(getThoughtTitle('supervisor_planned')).toBe('首辅规划');
      expect(getThoughtTitle('manager_plan')).toBe('首辅规划');
      expect(getThoughtTitle('manager_replan')).toBe('首辅规划');
      expect(getThoughtTitle('libu_routed')).toBe('吏部路由');
      expect(getThoughtTitle('dispatch')).toBe('分派尚书');
      expect(getThoughtTitle('research')).toBe('户部检索');
      expect(getThoughtTitle('planning_readonly_guard')).toBe('计划只读保护');
      expect(getThoughtTitle('execute')).toBe('工部/兵部执行');
      expect(getThoughtTitle('review')).toBe('刑部/礼部审查');
      expect(getThoughtTitle('approval_gate')).toBe('阻塞式中断确认');
      expect(getThoughtTitle('run_resumed')).toBe('恢复执行');
      expect(getThoughtTitle('finish')).toBe('汇总答复');
      expect(getThoughtTitle('final_response_completed')).toBe('汇总答复');
    });

    it('returns the node name for unknown nodes', () => {
      expect(getThoughtTitle('custom_node')).toBe('custom_node');
    });
  });

  describe('getThoughtStatus', () => {
    it('returns success for finish node', () => {
      expect(getThoughtStatus('finish', TaskStatus.RUNNING, true)).toBe('success');
    });

    it('returns success for final_response_completed node', () => {
      expect(getThoughtStatus('final_response_completed', TaskStatus.RUNNING, true)).toBe('success');
    });

    it('returns success for completed status', () => {
      expect(getThoughtStatus('other', TaskStatus.COMPLETED, true)).toBe('success');
    });

    it('returns error for last node when failed', () => {
      expect(getThoughtStatus('other', TaskStatus.FAILED, true)).toBe('error');
    });

    it('returns success for non-last node when failed', () => {
      expect(getThoughtStatus('other', TaskStatus.FAILED, false)).toBe('success');
    });

    it('returns abort for last node when cancelled', () => {
      expect(getThoughtStatus('other', TaskStatus.CANCELLED, true)).toBe('abort');
    });

    it('returns abort for approval_gate when waiting', () => {
      expect(getThoughtStatus('approval_gate', TaskStatus.WAITING_APPROVAL, true)).toBe('abort');
    });

    it('returns loading for last running node', () => {
      expect(getThoughtStatus('other', TaskStatus.RUNNING, true)).toBe('loading');
    });

    it('returns success for non-last running node', () => {
      expect(getThoughtStatus('other', TaskStatus.RUNNING, false)).toBe('success');
    });
  });

  describe('getMinistryLabel', () => {
    it('returns Chinese label for known ministries', () => {
      expect(getMinistryLabel('hubu-search')).toBe('户部');
      expect(getMinistryLabel('gongbu-code')).toBe('工部');
    });

    it('returns the input string for unknown ministries', () => {
      expect(getMinistryLabel('unknown')).toBe('unknown');
    });
  });

  describe('mapTraceNodeToThoughtKind', () => {
    it('returns planning for entry nodes', () => {
      expect(mapTraceNodeToThoughtKind('entry_router')).toBe('planning');
      expect(mapTraceNodeToThoughtKind('mode_gate')).toBe('planning');
      expect(mapTraceNodeToThoughtKind('dispatch_planner')).toBe('planning');
      expect(mapTraceNodeToThoughtKind('context_filter')).toBe('planning');
    });

    it('returns finalize for aggregation nodes', () => {
      expect(mapTraceNodeToThoughtKind('result_aggregator')).toBe('finalize');
      expect(mapTraceNodeToThoughtKind('learning_recorder')).toBe('finalize');
    });

    it('returns approval for interrupt/approval nodes', () => {
      expect(mapTraceNodeToThoughtKind('interrupt_controller')).toBe('approval');
      expect(mapTraceNodeToThoughtKind('approval_gate')).toBe('approval');
      expect(mapTraceNodeToThoughtKind('some_approval_node')).toBe('approval');
    });

    it('returns review for review/diagnosis nodes', () => {
      expect(mapTraceNodeToThoughtKind('review')).toBe('review');
      expect(mapTraceNodeToThoughtKind('diagnosis_check')).toBe('review');
    });

    it('returns recovery for recover/resume nodes', () => {
      expect(mapTraceNodeToThoughtKind('recover_state')).toBe('recovery');
      // resume_from_approval contains 'approval' which is matched first
      expect(mapTraceNodeToThoughtKind('resume_from_approval')).toBe('approval');
      expect(mapTraceNodeToThoughtKind('run_resumed')).toBe('recovery');
    });

    it('returns research for research/source nodes', () => {
      expect(mapTraceNodeToThoughtKind('research')).toBe('research');
      expect(mapTraceNodeToThoughtKind('source_check')).toBe('research');
    });

    it('returns finalize for final/deliver nodes', () => {
      expect(mapTraceNodeToThoughtKind('final_response')).toBe('finalize');
      expect(mapTraceNodeToThoughtKind('deliver_result')).toBe('finalize');
    });

    it('returns execution for tool/execute/terminal/browser nodes', () => {
      expect(mapTraceNodeToThoughtKind('tool_call')).toBe('execution');
      expect(mapTraceNodeToThoughtKind('execute')).toBe('execution');
      expect(mapTraceNodeToThoughtKind('terminal_run')).toBe('execution');
      expect(mapTraceNodeToThoughtKind('browser_nav')).toBe('execution');
    });

    it('returns failure for fail/error nodes', () => {
      expect(mapTraceNodeToThoughtKind('fail_state')).toBe('failure');
      expect(mapTraceNodeToThoughtKind('error_handler')).toBe('failure');
    });

    it('returns planning as default for unknown nodes', () => {
      expect(mapTraceNodeToThoughtKind('unknown_node')).toBe('planning');
    });
  });

  describe('extractTraceErrorCode', () => {
    it('extracts errorCode from object detail', () => {
      expect(extractTraceErrorCode({ errorCode: 'TIMEOUT' })).toBe('TIMEOUT');
    });

    it('returns undefined for non-string errorCode', () => {
      expect(extractTraceErrorCode({ errorCode: 123 })).toBeUndefined();
    });

    it('returns undefined for null/undefined detail', () => {
      expect(extractTraceErrorCode(null)).toBeUndefined();
      expect(extractTraceErrorCode(undefined)).toBeUndefined();
    });

    it('returns undefined for non-object detail', () => {
      expect(extractTraceErrorCode('string')).toBeUndefined();
      expect(extractTraceErrorCode(42)).toBeUndefined();
    });

    it('returns undefined when no errorCode field', () => {
      expect(extractTraceErrorCode({ other: 'value' })).toBeUndefined();
    });
  });

  describe('buildMinistryThinkContent', () => {
    it('includes ministry worker line and route info', () => {
      const task = {
        currentMinistry: 'hubu-search',
        currentWorker: 'worker-1',
        modelRoute: [{ ministry: 'hubu-search', selectedModel: 'gpt-4', reason: 'best for research' }],
        currentStep: 'research',
        trace: []
      } as any;
      const content = buildMinistryThinkContent(task, 'latest summary');
      expect(content).toContain('户部');
      expect(content).toContain('worker-1');
      expect(content).toContain('gpt-4');
      expect(content).toContain('latest summary');
    });

    it('handles missing worker with generic line', () => {
      const task = {
        currentMinistry: 'gongbu-code',
        trace: []
      } as any;
      const content = buildMinistryThinkContent(task, '');
      expect(content).toContain('工部');
      expect(content).toContain('负责处理');
    });

    it('includes plan steps info', () => {
      const task = {
        currentMinistry: 'hubu-search',
        plan: { steps: [{ id: '1' }, { id: '2' }] },
        currentStep: 'research',
        trace: []
      } as any;
      const content = buildMinistryThinkContent(task, '');
      expect(content).toContain('2 步');
    });
  });
});
