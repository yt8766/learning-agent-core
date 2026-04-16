import { describe, expect, it } from 'vitest';

import { SupervisorPlanSchema } from '../src/flows/supervisor/schemas/supervisor-plan-schema';

describe('@agent/agents-supervisor supervisor plan schema', () => {
  it('accepts a valid three-role supervisor plan', () => {
    const parsed = SupervisorPlanSchema.parse({
      summary: '先补齐验证底座，再补 schema 回归。',
      steps: ['盘点缺口', '补齐验证入口', '补测试回归'],
      subTasks: [
        {
          title: '研究验证缺口',
          description: '梳理包级验证缺口与阻塞项',
          assignedTo: 'research'
        },
        {
          title: '补脚本和测试',
          description: '补 typecheck、unit、integration 承接',
          assignedTo: 'executor'
        },
        {
          title: '复核回归风险',
          description: '确认不会破坏原有链路',
          assignedTo: 'reviewer'
        }
      ]
    });

    expect(parsed.steps).toHaveLength(3);
    expect(parsed.subTasks.map(item => item.assignedTo)).toEqual(['research', 'executor', 'reviewer']);
  });

  it('rejects plans with too few steps', () => {
    expect(() =>
      SupervisorPlanSchema.parse({
        summary: '步骤不够',
        steps: ['只做一步'],
        subTasks: [
          { title: '研究', description: '研究', assignedTo: 'research' },
          { title: '执行', description: '执行', assignedTo: 'executor' },
          { title: '评审', description: '评审', assignedTo: 'reviewer' }
        ]
      })
    ).toThrow(/>=3 items|Too small/i);
  });
});
