import { describe, expect, it } from 'vitest';

import { AgentRole } from '@agent/shared';

import {
  buildFallbackSupervisorPlan,
  inferDispatchKind
} from '../../../src/flows/supervisor/contracts/supervisor-plan-contract';
import { buildSupervisorPlanUserPrompt } from '../../../src/flows/supervisor/prompts/supervisor-plan-prompts';
import { SupervisorPlanSchema } from '../../../src/flows/supervisor/schemas/supervisor-plan-schema';

describe('supervisor plan contracts', () => {
  it('validates the fallback plan with SupervisorPlanSchema', () => {
    const plan = buildFallbackSupervisorPlan({
      taskId: 'task_1',
      goal: '整理当前仓库的前后端规范'
    });

    const parsed = SupervisorPlanSchema.parse(plan);

    expect(parsed.subTasks).toHaveLength(3);
    expect(parsed.subTasks.map(item => item.assignedTo)).toEqual([
      AgentRole.RESEARCH,
      AgentRole.EXECUTOR,
      AgentRole.REVIEWER
    ]);
  });

  it('embeds the original goal in the user prompt', () => {
    expect(buildSupervisorPlanUserPrompt('重构 chat flow')).toContain('重构 chat flow');
  });

  it('classifies dispatch kinds into strategy, ministry, and fallback', () => {
    expect(
      inferDispatchKind({
        title: '策略约束',
        description: '整理增长策略与风险约束',
        assignedTo: AgentRole.RESEARCH
      })
    ).toBe('strategy');
    expect(
      inferDispatchKind({
        title: '执行任务',
        description: '围绕目标执行最合适的方案',
        assignedTo: AgentRole.EXECUTOR
      })
    ).toBe('ministry');
    expect(
      inferDispatchKind({
        title: '通用兜底',
        description: '直接回答并整理最终答复',
        assignedTo: AgentRole.MANAGER
      })
    ).toBe('fallback');
  });
});
