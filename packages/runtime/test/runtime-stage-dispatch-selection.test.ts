import { describe, expect, it } from 'vitest';
import type { DispatchInstruction } from '@agent/core';

import {
  resolveExecutionDispatchObjective,
  resolveResearchDispatchObjective
} from '../src/flows/runtime-stage/runtime-stage-helpers';

describe('runtime stage dispatch selection', () => {
  it('prefers strategy dispatch objectives for research even when dispatch metadata is agent-driven', () => {
    const dispatches: DispatchInstruction[] = [
      {
        taskId: 'task-1',
        subTaskId: 'sub-strategy',
        from: 'manager',
        to: 'research',
        kind: 'strategy',
        objective: '并行收集技术架构证据',
        agentId: 'official.coder',
        selectedAgentId: 'official.coder',
        selectionSource: 'strategy-counselor'
      }
    ];

    expect(resolveResearchDispatchObjective(dispatches)).toBe('并行收集技术架构证据');
  });

  it('keeps execution objectives away from review-oriented dispatches', () => {
    const dispatches: DispatchInstruction[] = [
      {
        taskId: 'task-1',
        subTaskId: 'sub-review',
        from: 'manager',
        to: 'reviewer',
        kind: 'ministry',
        objective: '先做风险审查',
        specialistDomain: 'risk-compliance',
        selectedAgentId: 'official.reviewer',
        selectionSource: 'supporting-specialist'
      },
      {
        taskId: 'task-1',
        subTaskId: 'sub-exec',
        from: 'manager',
        to: 'executor',
        kind: 'ministry',
        objective: '收敛正式实现方案',
        selectedAgentId: 'official.coder',
        selectionSource: 'specialist-lead'
      }
    ];

    expect(resolveExecutionDispatchObjective(dispatches)).toBe('收敛正式实现方案');
  });
});
