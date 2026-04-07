import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import {
  filterRuntimeInterruptItems,
  RuntimeSummaryTools
} from '@/features/runtime-overview/components/runtime-summary-tools';

describe('RuntimeSummaryTools helpers', () => {
  it('filters interrupt items by execution mode and interaction kind', () => {
    const filtered = filterRuntimeInterruptItems(
      [
        {
          taskId: 'task-plan',
          goal: '先给方案',
          status: 'waiting_interrupt',
          executionMode: 'plan',
          interactionKind: 'plan-question',
          interruptLabel: '计划问题',
          updatedAt: '2026-03-29T10:00:00.000Z'
        },
        {
          taskId: 'task-approval',
          goal: '发布配置',
          status: 'waiting_approval',
          executionMode: 'execute',
          interactionKind: 'approval',
          interruptLabel: 'enable_connector',
          updatedAt: '2026-03-29T09:00:00.000Z'
        }
      ],
      { executionMode: 'plan', interactionKind: 'plan-question' }
    );

    expect(filtered).toEqual([
      expect.objectContaining({
        taskId: 'task-plan',
        executionMode: 'plan',
        interactionKind: 'plan-question'
      })
    ]);
  });

  it('renders interrupt, recent usage and blocked reason sections', () => {
    const html = renderToStaticMarkup(
      <RuntimeSummaryTools
        runtime={
          {
            taskCount: 12,
            activeTaskCount: 3,
            pendingApprovalCount: 2,
            recentRuns: [
              {
                id: 'task-plan',
                goal: '先整理方案',
                status: 'waiting_interrupt',
                executionMode: 'plan',
                currentMinistry: 'gongbu-code',
                currentWorker: 'worker-gongbu',
                updatedAt: '2026-03-29T10:00:00.000Z',
                activeInterrupt: {
                  kind: 'user-input',
                  payload: { interactionKind: 'plan-question' }
                },
                planDraft: {
                  questionSet: {
                    title: '需要补充计划边界'
                  }
                }
              },
              {
                id: 'task-watchdog',
                goal: '终端执行卡住',
                status: 'waiting_approval',
                executionMode: 'execute',
                currentNode: 'runtime_governance_gate',
                currentMinistry: 'bingbu-ops',
                currentWorker: 'worker-bingbu',
                updatedAt: '2026-03-29T11:00:00.000Z',
                activeInterrupt: {
                  kind: 'runtime-governance',
                  payload: {
                    interactionKind: 'supplemental-input',
                    watchdog: true,
                    runtimeGovernanceReasonCode: 'watchdog_timeout'
                  }
                }
              }
            ],
            tools: {
              totalTools: 18,
              familyCount: 5,
              blockedToolCount: 2,
              approvalRequiredCount: 4,
              mcpBackedCount: 6,
              governanceToolCount: 3,
              families: [{ id: 'mcp', displayName: 'MCP', toolCount: 6 }],
              recentUsage: [
                {
                  toolName: 'github.search_code',
                  family: 'mcp',
                  status: 'blocked',
                  route: 'approval',
                  requestedBy: 'runtime',
                  usedAt: '2026-03-29T09:00:00.000Z',
                  blockedReason: '需要审批'
                }
              ],
              blockedReasons: [
                {
                  toolName: 'browser.open',
                  usedAt: '2026-03-29T09:00:00.000Z',
                  blockedReason: '缺少连接器授权',
                  riskLevel: 'high'
                }
              ]
            }
          } as any
        }
        executionModeFilter="all"
        onExecutionModeFilterChange={vi.fn()}
        interactionKindFilter="all"
        onInteractionKindFilterChange={vi.fn()}
        onCopyShareLink={vi.fn()}
      />
    );

    expect(html).toContain('Tool Governance');
    expect(html).toContain('司礼监中断与模式筛选');
    expect(html).toContain('需要补充计划边界');
    expect(html).toContain('运行时超时阻塞');
    expect(html).toContain('runtime-governance');
    expect(html).toContain('watchdog');
    expect(html).toContain('最近工具选路');
    expect(html).toContain('github.search_code');
    expect(html).toContain('当前阻塞原因');
    expect(html).toContain('缺少连接器授权');
  });
});
