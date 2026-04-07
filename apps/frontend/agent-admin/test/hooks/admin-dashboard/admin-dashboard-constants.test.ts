import { describe, expect, it } from 'vitest';

import {
  buildDashboardHash,
  buildDashboardShareUrl,
  readDashboardStateFromHash,
  shouldPollTask,
  toApprovalItems
} from '@/hooks/admin-dashboard/admin-dashboard-constants';

// Legacy hash aliases are normalized into canonical executionPlan.mode values in these tests.
// activeInterrupt samples below are persisted 司礼监 / InterruptController projections.
describe('admin-dashboard-constants', () => {
  it('reads dashboard filters from hash', () => {
    expect(
      readDashboardStateFromHash({
        hash: '#/approvals?runtimeExecutionMode=planning-readonly&runtimeInteractionKind=plan-question&approvalsExecutionMode=standard&approvalsInteractionKind=approval'
      } as Location)
    ).toEqual({
      page: 'approvals',
      runtimeExecutionModeFilter: 'plan',
      runtimeInteractionKindFilter: 'plan-question',
      approvalsExecutionModeFilter: 'execute',
      approvalsInteractionKindFilter: 'approval'
    });
  });

  it('builds compact dashboard hashes and share urls', () => {
    expect(
      buildDashboardHash({
        page: 'runtime',
        runtimeExecutionModeFilter: 'plan',
        runtimeInteractionKindFilter: 'plan-question',
        approvalsExecutionModeFilter: 'all',
        approvalsInteractionKindFilter: 'all'
      })
    ).toBe('#/runtime?runtimeExecutionMode=plan&runtimeInteractionKind=plan-question');

    expect(
      buildDashboardShareUrl(
        {
          page: 'approvals',
          runtimeExecutionModeFilter: 'all',
          runtimeInteractionKindFilter: 'all',
          approvalsExecutionModeFilter: 'plan',
          approvalsInteractionKindFilter: 'plan-question'
        },
        {
          origin: 'http://localhost:5174',
          pathname: '/dashboard.html'
        }
      )
    ).toBe(
      'http://localhost:5174/dashboard.html#/approvals?approvalsExecutionMode=plan&approvalsInteractionKind=plan-question'
    );
  });

  it('toApprovalItems 会透传 pendingApproval 的原因码、工具和预览信息', () => {
    const items = toApprovalItems({
      approvals: [
        {
          taskId: 'task-1',
          goal: '更新配置文件',
          status: 'waiting_approval',
          sessionId: 'session-1',
          currentMinistry: 'gongbu-code',
          currentWorker: 'worker-1',
          pendingApproval: {
            toolName: 'write_local_file',
            intent: 'write_file',
            riskLevel: 'high',
            reason: '路径属于敏感位置，需要审批。',
            reasonCode: 'requires_approval_destructive',
            preview: [{ label: 'Path', value: '.env.local' }]
          },
          approvals: [
            {
              taskId: 'task-1',
              intent: 'write_file',
              decision: 'pending',
              decidedAt: '2026-03-28T00:00:00.000Z',
              reason: 'fallback reason'
            }
          ]
        }
      ]
    } as any);

    expect(items).toEqual([
      expect.objectContaining({
        taskId: 'task-1',
        intent: 'write_file',
        executionMode: undefined,
        reason: '路径属于敏感位置，需要审批。',
        reasonCode: 'requires_approval_destructive',
        toolName: 'write_local_file',
        riskLevel: 'high',
        preview: [{ label: 'Path', value: '.env.local' }]
      })
    ]);
  });

  it('toApprovalItems 会在缺少 pendingApproval 时回退到 activeInterrupt', () => {
    const items = toApprovalItems({
      approvals: [
        {
          taskId: 'task-2',
          goal: '安装远程 skill',
          status: 'waiting_approval',
          sessionId: 'session-2',
          executionMode: 'planning-readonly',
          currentMinistry: 'hubu-search',
          currentWorker: 'research-worker',
          activeInterrupt: {
            id: 'interrupt-1',
            status: 'pending',
            mode: 'blocking',
            source: 'graph',
            kind: 'skill-install',
            intent: 'install_skill',
            toolName: 'npx skills add',
            reason: '需要安装 skill 后继续当前轮研究。',
            riskLevel: 'medium',
            resumeStrategy: 'command',
            preview: [{ label: 'Skill', value: 'find-skills' }]
          },
          approvals: [
            {
              taskId: 'task-2',
              intent: 'install_skill',
              decision: 'pending',
              decidedAt: '2026-03-28T00:00:00.000Z'
            }
          ]
        }
      ]
    } as any);

    expect(items).toEqual([
      expect.objectContaining({
        taskId: 'task-2',
        intent: 'install_skill',
        executionMode: 'plan',
        reason: '需要安装 skill 后继续当前轮研究。',
        toolName: 'npx skills add',
        riskLevel: 'medium',
        preview: [{ label: 'Skill', value: 'find-skills' }]
      })
    ]);
  });

  it('toApprovalItems 会保留 runtime-governance watchdog 原因码', () => {
    const items = toApprovalItems({
      approvals: [
        {
          taskId: 'task-3',
          goal: '等待终端补充输入',
          status: 'waiting_approval',
          sessionId: 'session-3',
          executionMode: 'execute',
          currentMinistry: 'bingbu-ops',
          currentWorker: 'worker-bingbu',
          activeInterrupt: {
            id: 'interrupt-3',
            status: 'pending',
            mode: 'blocking',
            source: 'tool',
            kind: 'runtime-governance',
            intent: 'run_terminal',
            toolName: 'run_terminal',
            reason: '终端命令长时间无输出。',
            riskLevel: 'high',
            resumeStrategy: 'approval-recovery',
            payload: {
              interactionKind: 'supplemental-input',
              runtimeGovernanceReasonCode: 'watchdog_timeout',
              commandPreview: 'pnpm test',
              approvalScope: 'once'
            }
          },
          approvals: [
            {
              taskId: 'task-3',
              intent: 'run_terminal',
              decision: 'pending',
              decidedAt: '2026-03-28T00:00:00.000Z'
            }
          ]
        }
      ]
    } as any);

    expect(items).toEqual([
      expect.objectContaining({
        taskId: 'task-3',
        interactionKind: 'supplemental-input',
        reasonCode: 'watchdog_timeout',
        commandPreview: 'pnpm test',
        approvalScope: 'once'
      })
    ]);
  });

  it('shouldPollTask 只对真正可推进的运行中任务保持轮询', () => {
    expect(shouldPollTask({ status: 'queued' } as any)).toBe(true);
    expect(shouldPollTask({ status: 'running' } as any)).toBe(true);
    expect(shouldPollTask({ status: 'waiting_approval' } as any)).toBe(true);
    expect(shouldPollTask({ status: 'blocked' } as any)).toBe(false);
    expect(shouldPollTask({ status: 'completed' } as any)).toBe(false);
    expect(shouldPollTask(undefined)).toBe(false);
  });
});
