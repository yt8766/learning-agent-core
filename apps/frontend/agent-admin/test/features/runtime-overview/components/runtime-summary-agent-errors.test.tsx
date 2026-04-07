import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { RuntimeSummaryAgentErrors } from '@/features/runtime-overview/components/runtime-summary-agent-errors';

describe('RuntimeSummaryAgentErrors render smoke', () => {
  it('renders diagnosis banner, filters and actionable error cards', () => {
    const html = renderToStaticMarkup(
      <RuntimeSummaryAgentErrors
        runtime={
          {
            diagnosisEvidenceCount: 3
          } as any
        }
        onSelectTask={vi.fn()}
        onRetryTask={vi.fn()}
        onRefreshRuntime={vi.fn()}
        onCreateDiagnosisTask={vi.fn()}
        errorCodeFilter="provider_transient_error"
        ministryFilter="hubu-search"
        retryableFilter="retryable"
        errorCodeOptions={['provider_transient_error', 'budget_exhausted']}
        ministryOptions={['hubu-search', 'gongbu-code']}
        filteredAgentErrors={
          [
            {
              id: 'err-1',
              taskId: 'task-agent-error',
              goal: '检查最近 AI 技术进展',
              message: 'research provider timeout',
              errorCode: 'provider_transient_error',
              errorCategory: 'provider',
              retryable: true,
              ministry: 'hubu-search',
              node: 'hubu_research',
              toolName: 'web.search_query',
              at: '2026-03-27T09:01:00.000Z',
              diagnosisHint: '检查 provider SLA 和速率限制。',
              recommendedAction: '切换备用模型并降低并发。',
              recoveryPlaybook: ['重试失败任务', '补充缓存热身'],
              stack: 'TimeoutError: research provider timeout'
            }
          ] as any
        }
        onErrorCodeFilterChange={vi.fn()}
        onMinistryFilterChange={vi.fn()}
        onRetryableFilterChange={vi.fn()}
      />
    );

    expect(html).toContain('Diagnosis Evidence Ready');
    expect(html).toContain('Error Filters');
    expect(html).toContain('research provider timeout');
    expect(html).toContain('provider_transient_error');
    expect(html).toContain('Diagnosis Hint');
    expect(html).toContain('Recovery Playbook');
    expect(html).toContain('创建诊断任务');
    expect(html).toContain('TimeoutError: research provider timeout');
  });

  it('renders empty state when no agent errors match filters', () => {
    const html = renderToStaticMarkup(
      <RuntimeSummaryAgentErrors
        runtime={{ diagnosisEvidenceCount: 0 } as any}
        onSelectTask={vi.fn()}
        onRetryTask={vi.fn()}
        onRefreshRuntime={vi.fn()}
        onCreateDiagnosisTask={vi.fn()}
        errorCodeFilter=""
        ministryFilter=""
        retryableFilter=""
        errorCodeOptions={[]}
        ministryOptions={[]}
        filteredAgentErrors={[] as any}
        onErrorCodeFilterChange={vi.fn()}
        onMinistryFilterChange={vi.fn()}
        onRetryableFilterChange={vi.fn()}
      />
    );

    expect(html).toContain('Recent Agent Errors');
    expect(html).toContain('当前没有最近的 agent 级错误。');
    expect(html).not.toContain('Diagnosis Evidence Ready');
  });
});
