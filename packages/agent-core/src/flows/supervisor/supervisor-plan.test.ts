import { describe, expect, it } from 'vitest';

import { AgentRole } from '@agent/shared';

import { buildFallbackSupervisorPlan } from './contracts/supervisor-plan-contract';
import { buildSupervisorPlanUserPrompt } from './prompts/supervisor-plan-prompts';
import { SupervisorPlanSchema } from './schemas/supervisor-plan-schema';

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
});
