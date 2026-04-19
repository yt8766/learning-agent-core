import type { DispatchInstruction } from '@agent/core';
import { describe, expect, it } from 'vitest';

import { enrichPlanningDispatches } from '../src/flows/supervisor/planning-stage-dispatches';
import type { SupervisorPlanningTaskLike } from '../src/flows/supervisor/pipeline-stage-node.types';

describe('planning stage dispatch enrichment', () => {
  it('annotates strategy and ministry dispatches with official specialist agent hints', () => {
    const task = {
      specialistLead: {
        id: 'technical-architecture',
        displayName: '技术架构专家',
        domain: 'technical-architecture',
        requiredCapabilities: ['specialist.technical-architecture'],
        agentId: 'official.coder',
        candidateAgentIds: ['official.coder', 'official.reviewer', 'official.data-report']
      },
      supportingSpecialists: [
        {
          id: 'risk-compliance',
          displayName: '风控合规专家',
          domain: 'risk-compliance',
          requiredCapabilities: ['specialist.risk-compliance'],
          agentId: 'official.reviewer',
          candidateAgentIds: ['official.reviewer']
        }
      ],
      executionPlan: {
        selectedCounselorId: 'official.coder',
        strategyCounselors: ['official.coder', 'official.reviewer', 'official.data-report']
      }
    } as unknown as SupervisorPlanningTaskLike;

    const dispatches: DispatchInstruction[] = [
      {
        taskId: 'task-1',
        subTaskId: 'sub-strategy',
        from: 'manager',
        to: 'research',
        kind: 'strategy',
        objective: '先收集架构证据'
      },
      {
        taskId: 'task-1',
        subTaskId: 'sub-exec',
        from: 'manager',
        to: 'executor',
        kind: 'ministry',
        objective: '收敛实现方案'
      },
      {
        taskId: 'task-1',
        subTaskId: 'sub-review',
        from: 'manager',
        to: 'reviewer',
        kind: 'ministry',
        objective: '做风险审查'
      }
    ];

    const result = enrichPlanningDispatches(task, dispatches);

    expect(result[0]).toMatchObject({
      specialistDomain: 'technical-architecture',
      requiredCapabilities: ['specialist.technical-architecture'],
      agentId: 'official.coder',
      candidateAgentIds: ['official.coder', 'official.reviewer', 'official.data-report'],
      selectedAgentId: 'official.coder',
      selectionSource: 'strategy-counselor'
    });
    expect(result[1]).toMatchObject({
      specialistDomain: 'technical-architecture',
      requiredCapabilities: ['specialist.technical-architecture'],
      agentId: 'official.coder',
      candidateAgentIds: ['official.coder', 'official.reviewer', 'official.data-report'],
      selectedAgentId: 'official.coder',
      selectionSource: 'specialist-lead'
    });
    expect(result[2]).toMatchObject({
      specialistDomain: 'risk-compliance',
      requiredCapabilities: ['specialist.risk-compliance'],
      agentId: 'official.reviewer',
      candidateAgentIds: ['official.reviewer'],
      selectedAgentId: 'official.reviewer',
      selectionSource: 'supporting-specialist'
    });
  });
});
