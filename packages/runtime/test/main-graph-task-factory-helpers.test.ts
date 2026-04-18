import { describe, expect, it } from 'vitest';

import type { CreateTaskDto } from '@agent/core';

import {
  buildExecutionPlan,
  deriveOrchestrationGovernance
} from '../src/graphs/main/tasking/factory/task-execution-plan';
import {
  resolveCounselorSelection,
  resolveRequestedMode
} from '../src/graphs/main/tasking/factory/task-entry-decision';
import { resolveTaskWorkflowResolution } from '../src/graphs/main/tasking/factory/task-workflow-resolution';

describe('main graph task factory helpers', () => {
  it('resolves requested mode with explicit, imperial-direct, and /plan priorities', () => {
    expect(
      resolveRequestedMode({
        goal: 'implement runtime cleanup',
        requestedMode: 'plan'
      } as CreateTaskDto)
    ).toBe('plan');

    expect(
      resolveRequestedMode({
        goal: 'ship directly',
        imperialDirectIntent: {
          enabled: true
        }
      } as CreateTaskDto)
    ).toBe('imperial_direct');

    expect(
      resolveRequestedMode({
        goal: '/plan refactor runtime task factory'
      } as CreateTaskDto)
    ).toBe('plan');

    expect(
      resolveRequestedMode({
        goal: 'normal execution request'
      } as CreateTaskDto)
    ).toBe('execute');
  });

  it('derives a manual counselor selection deterministically', () => {
    const selection = resolveCounselorSelection(
      {
        goal: 'build a report',
        context: 'dashboard',
        counselorSelector: {
          strategy: 'manual',
          candidateIds: ['counselor-a', 'counselor-b'],
          fallbackCounselorId: 'fallback-counselor'
        }
      } as CreateTaskDto,
      {
        specialistDomain: 'data-report',
        normalizedGoal: 'build a report',
        sessionId: 'session-1'
      }
    );

    expect(selection.selectedCounselorId).toBe('counselor-a');
    expect(selection.selectionReason).toBe('manual_selector');
    expect(selection.defaultCounselorId).toBe('fallback-counselor');
  });

  it('builds an escalated execution plan without temporary assignment capabilities', () => {
    const governance = deriveOrchestrationGovernance({
      capabilityAttachments: [
        {
          id: 'attach-1',
          capabilityId: 'capability-1',
          status: 'active',
          addedAt: '2026-04-16T00:00:00.000Z',
          owner: {
            ownerType: 'ministry-owned',
            ownerId: 'gongbu-code'
          },
          capabilityTrust: {
            trustLevel: 'low',
            trustTrend: 'down',
            score: 0.2,
            updatedAt: '2026-04-16T00:00:00.000Z'
          }
        }
      ],
      specialistLead: {
        domain: 'frontend',
        displayName: 'Frontend Specialist'
      },
      routeConfidence: 0.8
    });

    const plan = buildExecutionPlan(
      'execute',
      {
        maxCostPerTaskUsd: 3
      },
      {
        selectedCounselorId: 'frontend-v2',
        selectedVersion: 'v2'
      },
      governance
    );

    expect(governance.requiresGovernanceEscalation).toBe(true);
    expect(plan.filteredCapabilities).not.toContain('temporary-assignment');
    expect(plan.modeCapabilities).toContain('governance-escalated-review');
    expect(plan.selectedCounselorId).toBe('frontend-v2');
  });

  it('resolves workflow state and enriches data-report context before routing', () => {
    const result = resolveTaskWorkflowResolution({
      dto: {
        goal: '做一个销售数据报表',
        context: '按月统计 GMV，并且需要多个 tab'
      } as CreateTaskDto,
      evidence: [],
      requestedMode: 'execute'
    });

    expect(result.workflowResolution.preset.id).toBe('data-report');
    expect(result.dataReportContract).toBeDefined();
    expect(result.enrichedTaskContext).toContain('数据报表任务契约');
    expect(result.initialChatRoute.flow).toBe('supervisor');
    expect(result.initialChatRoute.graph).toBe('workflow');
    expect(result.specialistRoute.specialistLead.domain).toBeTruthy();
  });

  it('keeps scaffold workflow explicit and avoids implicit data-report enrichment', () => {
    const result = resolveTaskWorkflowResolution({
      dto: {
        goal: '/scaffold preview --host-kind package --name demo-toolkit --template-id package-lib',
        context: '只走显式 scaffold 命令'
      } as CreateTaskDto,
      evidence: [],
      requestedMode: 'execute'
    });

    expect(result.workflowResolution.preset.id).toBe('scaffold');
    expect(result.workflowResolution.source).toBe('explicit');
    expect(result.dataReportContract).toBeUndefined();
    expect(result.initialChatRoute.flow).toBe('supervisor');
    expect(result.initialChatRoute.intent).toBe('workflow-execute');
  });
});
