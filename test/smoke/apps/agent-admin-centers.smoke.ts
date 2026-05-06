import { describe, expect, it } from 'vitest';

import {
  ApprovalsPanel,
  filterApprovals
} from '../../../apps/frontend/agent-admin/src/pages/approvals-center/approvals-panel';
import { ConnectorsCenterPanel } from '../../../apps/frontend/agent-admin/src/pages/connectors-center/connectors-center-panel';
import { EvidenceCenterPanel } from '../../../apps/frontend/agent-admin/src/pages/evidence-center/evidence-center-panel';
import { prioritizeEvidenceRecords } from '../../../apps/frontend/agent-admin/src/pages/evidence-center/evidence-center-panel.helpers';
import { LearningCenterPanel } from '../../../apps/frontend/agent-admin/src/pages/learning-center/learning-center-panel';
import { RuntimeOverviewPanel } from '../../../apps/frontend/agent-admin/src/pages/runtime-overview/runtime-overview-panel';
import { SkillLabPanel } from '../../../apps/frontend/agent-admin/src/pages/skill-lab/skill-lab-panel';
import { PAGE_TITLES } from '../../../apps/frontend/agent-admin/src/hooks/use-admin-dashboard';
import type { ApprovalCenterItem } from '../../../apps/frontend/agent-admin/src/types/admin';

describe('agent-admin governance centers smoke', () => {
  it('keeps the six center panel modules importable from the dashboard surface', () => {
    expect(RuntimeOverviewPanel).toEqual(expect.any(Function));
    expect(ApprovalsPanel).toEqual(expect.any(Function));
    expect(LearningCenterPanel).toEqual(expect.any(Function));
    expect(SkillLabPanel).toEqual(expect.any(Function));
    expect(EvidenceCenterPanel).toEqual(expect.any(Function));
    expect(ConnectorsCenterPanel).toEqual(expect.any(Function));
  });

  it('keeps center titles aligned with the six-governance-console contract', () => {
    expect(PAGE_TITLES.runtime).toBe('运行中枢');
    expect(PAGE_TITLES.approvals).toBe('审批中枢');
    expect(PAGE_TITLES.learning).toBe('学习中枢');
    expect(PAGE_TITLES.skills).toBe('技能工坊');
    expect(PAGE_TITLES.evidence).toBe('证据中心');
    expect(PAGE_TITLES.connectors).toBe('连接器与策略');
  });

  it('keeps lightweight projection helpers alive for approvals and evidence centers', () => {
    const approvals: ApprovalCenterItem[] = [
      {
        taskId: 'task-approval-smoke',
        intent: 'write_file',
        actor: 'human',
        decision: 'pending',
        decidedAt: '2026-04-23T00:00:00.000Z',
        executionMode: 'execute',
        interactionKind: 'approval'
      }
    ];
    const evidence = [
      {
        id: 'evidence-highlighted',
        taskId: 'task-evidence-smoke',
        sourceType: 'diagnosis_result' as const,
        summary: '诊断证据',
        createdAt: '2026-04-23T00:00:00.000Z'
      },
      {
        id: 'evidence-normal',
        taskId: 'task-evidence-smoke',
        sourceType: 'runtime_event' as const,
        summary: '普通证据',
        createdAt: '2026-04-23T00:00:01.000Z'
      }
    ];

    expect(
      filterApprovals(approvals, {
        executionMode: 'execute',
        interactionKind: 'approval'
      })
    ).toHaveLength(1);
    expect(prioritizeEvidenceRecords(evidence as never, ['evidence-highlighted'])[0].id).toBe('evidence-highlighted');
  });
});
