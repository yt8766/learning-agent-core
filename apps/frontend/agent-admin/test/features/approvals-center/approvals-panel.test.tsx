import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ApprovalsPanel, filterApprovals } from '@/features/approvals-center/approvals-panel';

describe('ApprovalsPanel render smoke', () => {
  it('renders reason code labels, tool metadata and preview values', () => {
    const html = renderToStaticMarkup(
      <ApprovalsPanel
        approvals={[
          {
            taskId: 'task-approval-1',
            goal: '更新本地配置文件',
            status: 'pending',
            executionMode: 'plan',
            sessionId: 'session-1',
            currentMinistry: 'gongbu',
            currentWorker: 'gongbu-code',
            intent: 'write_file',
            reason: '敏感文件写入需要审批。',
            reasonCode: 'requires_approval_destructive',
            toolName: 'write_local_file',
            riskLevel: 'high',
            requestedBy: 'gongbu-code',
            interruptSource: 'graph',
            interruptMode: 'blocking',
            resumeStrategy: 'command',
            preview: [{ label: 'Path', value: '.env.local' }]
          }
        ]}
        loading={false}
        onExport={vi.fn()}
        onCopyShareLink={vi.fn()}
        executionModeFilter="all"
        onExecutionModeFilterChange={vi.fn()}
        interactionKindFilter="all"
        onInteractionKindFilterChange={vi.fn()}
        onDecision={vi.fn()}
      />
    );

    expect(html).toContain('Approvals Center');
    expect(html).toContain('导出 approvals');
    expect(html).toContain('计划模式');
    expect(html).toContain('操作确认');
    expect(html).toContain('write_file');
    expect(html).toContain('write_local_file');
    expect(html).toContain('risk high');
    expect(html).toContain('gongbu-code');
    expect(html).toContain('破坏性操作');
    expect(html).toContain('图内发起');
    expect(html).toContain('阻塞式');
    expect(html).toContain('图中断恢复');
    expect(html).toContain('.env.local');
    expect(html).toContain('批准');
    expect(html).toContain('拒绝');
  });

  it('filters approvals by execution mode and interaction kind', () => {
    const filtered = filterApprovals(
      [
        {
          taskId: 'task-plan',
          goal: '先收敛方案',
          status: 'waiting_interrupt',
          executionMode: 'plan',
          intent: '计划问题',
          interactionKind: 'plan-question'
        },
        {
          taskId: 'task-approval',
          goal: '写入文件',
          status: 'waiting_approval',
          executionMode: 'execute',
          intent: 'write_file',
          interactionKind: 'approval'
        }
      ],
      { executionMode: 'plan', interactionKind: 'plan-question' }
    );

    expect(filtered).toEqual([
      expect.objectContaining({
        taskId: 'task-plan',
        interactionKind: 'plan-question',
        executionMode: 'plan'
      })
    ]);
  });
});
