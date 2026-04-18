import { describe, expect, it } from 'vitest';

import {
  estimateModelCostUsd,
  resolveCompiledSkillAttachment,
  resolveExecutionMode,
  roundUsageCost
} from '../src/graphs/main/tasking/context/main-graph-task-context-helpers';

describe('main graph task context helpers', () => {
  it('prefers execution plan mode before legacy execution mode fallbacks', () => {
    expect(
      resolveExecutionMode({
        executionPlan: { mode: 'imperial_direct' },
        executionMode: 'plan'
      } as any)
    ).toBe('imperial_direct');

    expect(
      resolveExecutionMode({
        executionMode: 'plan'
      } as any)
    ).toBe('plan');

    expect(
      resolveExecutionMode({
        planMode: 'drafting'
      } as any)
    ).toBe('plan');
  });

  it('resolves a requested compiled skill before the generic user-attached fallback', () => {
    const task: any = {
      requestedHints: {
        requestedSkill: 'sql'
      },
      capabilityAttachments: [
        {
          id: 'skill-1',
          kind: 'skill',
          enabled: true,
          displayName: 'Markdown Export',
          sourceId: 'markdown-export',
          owner: {
            ownerType: 'user-attached'
          },
          metadata: {
            steps: [{ title: 'export', instruction: 'export markdown' }]
          }
        },
        {
          id: 'skill-2',
          kind: 'skill',
          enabled: true,
          displayName: 'SQL Analyst',
          sourceId: 'sql-analyst',
          owner: {
            ownerType: 'user-attached'
          },
          metadata: {
            steps: [{ title: 'query', instruction: 'run sql' }]
          }
        }
      ]
    };

    expect(resolveCompiledSkillAttachment(task)?.id).toBe('skill-2');
  });

  it('uses model-specific rate cards and cost rounding for budget tracking', () => {
    expect(estimateModelCostUsd('glm-5-air', 1500)).toBe(0.003);
    expect(estimateModelCostUsd('glm-4.7-flash', 2000)).toBe(0.001);
    expect(roundUsageCost(0.123456)).toBe(0.1235);
  });
});
