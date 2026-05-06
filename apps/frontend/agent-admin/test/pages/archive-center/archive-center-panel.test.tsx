import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const renderedButtons: Array<{ children?: unknown; onClick?: () => void }> = [];

function getButtonText(children: unknown): string {
  if (Array.isArray(children)) {
    return children.map(getButtonText).join('');
  }
  if (children === null || children === undefined || typeof children === 'boolean') {
    return '';
  }
  return String(children);
}

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children?: unknown; onClick?: () => void }) => {
    renderedButtons.push({ children, onClick });
    return <button>{children as any}</button>;
  }
}));

import { ArchiveCenterPanel } from '@/pages/archive-center/archive-center-panel';

describe('ArchiveCenterPanel render smoke', () => {
  beforeEach(() => {
    renderedButtons.length = 0;
  });

  it('renders runtime export filter summary', () => {
    const html = renderToStaticMarkup(
      <ArchiveCenterPanel
        runtime={
          {
            usageAnalytics: {
              historyDays: 30,
              persistedDailyHistory: [],
              recentUsageAudit: []
            }
          } as any
        }
        evals={
          {
            historyDays: 30,
            persistedDailyHistory: [],
            recentRuns: []
          } as any
        }
        runtimeHistoryDays={30}
        evalsHistoryDays={30}
        runtimeExportFilters={{
          executionMode: 'plan',
          interactionKind: 'plan-question'
        }}
        approvalsExportFilters={{
          executionMode: 'plan',
          interactionKind: 'plan-question'
        }}
        onRuntimeHistoryDaysChange={vi.fn()}
        onEvalsHistoryDaysChange={vi.fn()}
        onExportRuntime={vi.fn()}
        onExportApprovals={vi.fn()}
        onExportEvals={vi.fn()}
      />
    );

    expect(html).toContain('运行归档');
    expect(html).toContain('执行模式 计划模式');
    expect(html).toContain('交互类型 plan-question');
    expect(html).toContain('运行归档会沿用当前运行视图中的筛选条件');
    expect(html).toContain('审批归档');
    expect(html).toContain('导出审批');
  });

  it('routes archive export and history window actions through callbacks', () => {
    const onRuntimeHistoryDaysChange = vi.fn();
    const onEvalsHistoryDaysChange = vi.fn();
    const onExportRuntime = vi.fn();
    const onExportApprovals = vi.fn();
    const onExportEvals = vi.fn();

    renderToStaticMarkup(
      <ArchiveCenterPanel
        runtime={
          {
            usageAnalytics: {
              historyDays: 30,
              persistedDailyHistory: [],
              recentUsageAudit: []
            }
          } as any
        }
        evals={
          {
            historyDays: 30,
            persistedDailyHistory: [],
            recentRuns: []
          } as any
        }
        runtimeHistoryDays={30}
        evalsHistoryDays={30}
        runtimeExportFilters={{
          executionMode: 'execute',
          interactionKind: 'approval'
        }}
        approvalsExportFilters={{
          executionMode: 'plan',
          interactionKind: 'plan-question'
        }}
        onRuntimeHistoryDaysChange={onRuntimeHistoryDaysChange}
        onEvalsHistoryDaysChange={onEvalsHistoryDaysChange}
        onExportRuntime={onExportRuntime}
        onExportApprovals={onExportApprovals}
        onExportEvals={onExportEvals}
      />
    );

    renderedButtons.find(item => getButtonText(item.children) === '导出运行数据')?.onClick?.();
    renderedButtons.find(item => getButtonText(item.children) === '导出审批')?.onClick?.();
    renderedButtons.find(item => getButtonText(item.children) === '导出评测')?.onClick?.();
    renderedButtons.filter(item => getButtonText(item.children) === '7d')[0]?.onClick?.();
    renderedButtons.filter(item => getButtonText(item.children) === '90d')[0]?.onClick?.();
    renderedButtons.filter(item => getButtonText(item.children) === '7天')[0]?.onClick?.();
    renderedButtons.filter(item => getButtonText(item.children) === '90天')[0]?.onClick?.();

    expect(onExportRuntime).toHaveBeenCalledTimes(1);
    expect(onExportApprovals).toHaveBeenCalledTimes(1);
    expect(onExportEvals).toHaveBeenCalledTimes(1);
    expect(onRuntimeHistoryDaysChange).toHaveBeenNthCalledWith(1, 7);
    expect(onRuntimeHistoryDaysChange).toHaveBeenNthCalledWith(2, 90);
    expect(onEvalsHistoryDaysChange).toHaveBeenNthCalledWith(1, 7);
    expect(onEvalsHistoryDaysChange).toHaveBeenNthCalledWith(2, 90);
  });
});
