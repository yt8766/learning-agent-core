import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ArchiveCenterPanel } from '@/features/archive-center/archive-center-panel';

describe('ArchiveCenterPanel render smoke', () => {
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

    expect(html).toContain('Runtime Archive');
    expect(html).toContain('执行模式 计划模式');
    expect(html).toContain('交互类型 plan-question');
    expect(html).toContain('Runtime 导出会沿用当前 runtime 视图中的筛选条件');
    expect(html).toContain('Approvals Archive');
    expect(html).toContain('导出 approvals');
  });
});
