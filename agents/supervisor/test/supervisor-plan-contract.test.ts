import { describe, expect, it } from 'vitest';

import {
  buildFallbackSupervisorPlan,
  derivePlannerStrategyRecord,
  toManagerPlan
} from '../src/flows/supervisor/contracts/supervisor-plan-contract';

describe('@agent/agents-supervisor supervisor plan contract', () => {
  it('turns missing official specialist candidates into capability-gap fallback planning', () => {
    const plan = buildFallbackSupervisorPlan({
      taskId: 'task-gap',
      goal: '重构新的结算风控链路',
      specialistLead: {
        displayName: '风控合规专家',
        domain: 'risk-compliance',
        requiredCapabilities: ['specialist.risk-compliance'],
        candidateAgentIds: []
      },
      supportingSpecialists: []
    });

    expect(plan.summary).toContain('能力暂未命中官方 Agent');
    expect(plan.steps[0]).toContain('确认能力缺口');
    expect(plan.subTasks[0]?.requiredCapabilities).toEqual(['specialist.risk-compliance']);
  });

  it('injects specialist-required capabilities into manager plan subtasks when llm output omits them', () => {
    const plan = toManagerPlan(
      {
        taskId: 'task-rich',
        goal: '重构报表 dashboard',
        specialistLead: {
          displayName: '技术架构专家',
          domain: 'technical-architecture',
          requiredCapabilities: ['specialist.technical-architecture'],
          candidateAgentIds: ['official.coder', 'official.reviewer']
        },
        supportingSpecialists: [
          {
            displayName: '风控合规专家',
            domain: 'risk-compliance',
            requiredCapabilities: ['specialist.risk-compliance'],
            candidateAgentIds: ['official.reviewer']
          }
        ]
      },
      {
        summary: '分三步推进',
        steps: ['研究候选方案', '执行收敛改造', '复核风险'],
        subTasks: [
          {
            title: '研究候选方案',
            description: '对比技术实现路径',
            assignedTo: 'research'
          },
          {
            title: '执行收敛改造',
            description: '落地选定方案',
            assignedTo: 'executor'
          },
          {
            title: '复核风险',
            description: '确认回归风险',
            assignedTo: 'reviewer'
          }
        ]
      }
    );

    expect(plan.subTasks[0]?.requiredCapabilities).toEqual(['specialist.technical-architecture']);
    expect(plan.subTasks[1]?.requiredCapabilities).toEqual(['specialist.technical-architecture']);
    expect(plan.subTasks[2]?.requiredCapabilities).toEqual(['specialist.risk-compliance']);
  });

  it('derives planner strategy state for rich official candidate routes', () => {
    const strategy = derivePlannerStrategyRecord(
      {
        taskId: 'task-rich-route',
        goal: '重构报表 dashboard',
        specialistLead: {
          displayName: '技术架构专家',
          domain: 'technical-architecture',
          requiredCapabilities: ['specialist.technical-architecture'],
          candidateAgentIds: ['official.coder', 'official.reviewer', 'official.data-report']
        },
        supportingSpecialists: []
      },
      '2026-04-19T00:00:00.000Z'
    );

    expect(strategy.mode).toBe('rich-candidates');
    expect(strategy.candidateCount).toBe(3);
    expect(strategy.preferredAgentId).toBe('official.coder');
    expect(strategy.gapDetected).toBe(false);
  });
});
