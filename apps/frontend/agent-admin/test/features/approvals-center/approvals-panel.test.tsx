import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const renderedButtons: Array<{ children?: unknown; onClick?: () => void }> = [];

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children?: unknown; onClick?: () => void }) => {
    renderedButtons.push({ children, onClick });
    return <button>{children as any}</button>;
  }
}));

import { ApprovalsPanel, filterApprovals } from '@/features/approvals-center/approvals-panel';

describe('ApprovalsPanel render smoke', () => {
  beforeEach(() => {
    renderedButtons.length = 0;
  });

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
            riskReason: '命中高危命令策略，需要人工确认。',
            commandPreview: 'rm -rf /tmp/runtime-cache',
            approvalScope: 'once',
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

    expect(html).toContain('审批中枢');
    expect(html).toContain('导出审批');
    expect(html).toContain('计划模式');
    expect(html).toContain('操作确认');
    expect(html).toContain('write_file');
    expect(html).toContain('write_local_file');
    expect(html).toContain('risk high');
    expect(html).toContain('gongbu-code');
    expect(html).toContain('破坏性操作');
    expect(html).toContain('命中高危命令策略');
    expect(html).toContain('rm -rf /tmp/runtime-cache');
    expect(html).toContain('审批范围');
    expect(html).toContain('仅本次');
    expect(html).toContain('图内发起');
    expect(html).toContain('阻塞式');
    expect(html).toContain('图中断恢复');
    expect(html).toContain('.env.local');
    expect(html).toContain('批准');
    expect(html).toContain('拒绝');
  });

  it('renders watchdog runtime-governance approvals with dedicated labels', () => {
    const html = renderToStaticMarkup(
      <ApprovalsPanel
        approvals={[
          {
            taskId: 'task-watchdog-1',
            goal: '等待兵部处理运行时阻塞',
            status: 'waiting_approval',
            executionMode: 'execute',
            sessionId: 'session-1',
            currentMinistry: 'bingbu-ops',
            currentWorker: 'bingbu-terminal',
            intent: 'run_terminal',
            interactionKind: 'supplemental-input',
            reason: '命令长时间无输出，等待人工干预。',
            reasonCode: 'watchdog_timeout',
            toolName: 'run_terminal',
            riskLevel: 'high',
            interruptSource: 'tool',
            interruptMode: 'blocking',
            resumeStrategy: 'approval-recovery'
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

    expect(html).toContain('运行时治理');
    expect(html).toContain('runtime-governance');
    expect(html).toContain('watchdog');
    expect(html).toContain('运行时超时阻塞');
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

  it('routes export, share, filter and decision actions through callbacks', () => {
    const onExport = vi.fn();
    const onCopyShareLink = vi.fn();
    const onExecutionModeFilterChange = vi.fn();
    const onInteractionKindFilterChange = vi.fn();
    const onDecision = vi.fn();

    renderToStaticMarkup(
      <ApprovalsPanel
        approvals={[
          {
            taskId: 'task-plan',
            goal: '先确认计划边界',
            status: 'waiting_interrupt',
            executionMode: 'plan',
            intent: 'plan_review',
            interactionKind: 'plan-question',
            questionSetTitle: '需要补充计划边界'
          },
          {
            taskId: 'task-approval',
            goal: '发布运行时变更',
            status: 'waiting_approval',
            executionMode: 'execute',
            intent: 'deploy_runtime',
            interactionKind: 'approval'
          }
        ]}
        loading={false}
        onExport={onExport}
        onCopyShareLink={onCopyShareLink}
        executionModeFilter="all"
        onExecutionModeFilterChange={onExecutionModeFilterChange}
        interactionKindFilter="all"
        onInteractionKindFilterChange={onInteractionKindFilterChange}
        onDecision={onDecision}
      />
    );

    renderedButtons.find(item => item.children === '复制视角链接')?.onClick?.();
    renderedButtons.find(item => item.children === '导出审批')?.onClick?.();
    renderedButtons.find(item => item.children === '计划模式')?.onClick?.();
    renderedButtons.find(item => item.children === '补充输入')?.onClick?.();
    renderedButtons.find(item => item.children === '按推荐继续')?.onClick?.();
    renderedButtons.find(item => item.children === '批准')?.onClick?.();
    renderedButtons.filter(item => item.children === '拒绝')[0]?.onClick?.();

    expect(onCopyShareLink).toHaveBeenCalledTimes(1);
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onExecutionModeFilterChange).toHaveBeenCalledWith('plan');
    expect(onInteractionKindFilterChange).toHaveBeenCalledWith('supplemental-input');
    expect(onDecision).toHaveBeenNthCalledWith(1, 'approve', 'task-plan', 'plan_review');
    expect(onDecision).toHaveBeenNthCalledWith(2, 'approve', 'task-approval', 'deploy_runtime');
    expect(onDecision).toHaveBeenNthCalledWith(3, 'reject', 'task-plan', 'plan_review');
  });
});
