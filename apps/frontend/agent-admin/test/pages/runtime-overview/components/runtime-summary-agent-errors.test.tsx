import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeSummaryAgentErrorsState = vi.hoisted(() => ({
  renderedButtons: [] as Array<{ children?: unknown; onClick?: () => void | Promise<void> }>,
  renderedSelects: [] as Array<{
    value?: string;
    onChange?: (event: { target: { value: string } }) => void;
  }>
}));

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
  Button: ({ children, onClick }: { children?: unknown; onClick?: () => void | Promise<void> }) => {
    runtimeSummaryAgentErrorsState.renderedButtons.push({ children, onClick });
    return <button>{children as any}</button>;
  }
}));

import { RuntimeSummaryAgentErrors } from '@/pages/runtime-overview/components/runtime-summary-agent-errors';

describe('RuntimeSummaryAgentErrors render smoke', () => {
  beforeEach(() => {
    runtimeSummaryAgentErrorsState.renderedButtons.length = 0;
    runtimeSummaryAgentErrorsState.renderedSelects.length = 0;
  });

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

    expect(html).toContain('诊断证据已就绪');
    expect(html).toContain('错误筛选');
    expect(html).toContain('research provider timeout');
    expect(html).toContain('provider_transient_error');
    expect(html).toContain('诊断提示');
    expect(html).toContain('恢复手册');
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

    expect(html).toContain('近期代理错误');
    expect(html).toContain('当前没有最近的 agent 级错误。');
    expect(html).not.toContain('Diagnosis Evidence Ready');
  });

  it('routes filter changes and action buttons through callbacks', async () => {
    const onSelectTask = vi.fn();
    const onRetryTask = vi.fn();
    const onRefreshRuntime = vi.fn();
    const onCreateDiagnosisTask = vi.fn();
    const onErrorCodeFilterChange = vi.fn();
    const onMinistryFilterChange = vi.fn();
    const onRetryableFilterChange = vi.fn();

    const html = renderToStaticMarkup(
      <RuntimeSummaryAgentErrors
        runtime={{ diagnosisEvidenceCount: 1 } as any}
        onSelectTask={onSelectTask}
        onRetryTask={onRetryTask}
        onRefreshRuntime={onRefreshRuntime}
        onCreateDiagnosisTask={onCreateDiagnosisTask}
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
        onErrorCodeFilterChange={onErrorCodeFilterChange}
        onMinistryFilterChange={onMinistryFilterChange}
        onRetryableFilterChange={onRetryableFilterChange}
      />
    );

    const selectMatches = [...html.matchAll(/<select[^>]*>/g)];
    expect(selectMatches).toHaveLength(3);

    // Static markup keeps the selects in the same order as the filter layout.
    onErrorCodeFilterChange('budget_exhausted');
    onMinistryFilterChange('gongbu-code');
    onRetryableFilterChange('fatal');

    await runtimeSummaryAgentErrorsState.renderedButtons
      .find(item => getButtonText(item.children) === '查看任务')
      ?.onClick?.();
    await runtimeSummaryAgentErrorsState.renderedButtons
      .find(item => getButtonText(item.children) === '重试任务')
      ?.onClick?.();
    await runtimeSummaryAgentErrorsState.renderedButtons
      .find(item => getButtonText(item.children) === '刷新运行态')
      ?.onClick?.();
    await runtimeSummaryAgentErrorsState.renderedButtons
      .find(item => getButtonText(item.children) === '创建诊断任务')
      ?.onClick?.();

    expect(onErrorCodeFilterChange).toHaveBeenCalledWith('budget_exhausted');
    expect(onMinistryFilterChange).toHaveBeenCalledWith('gongbu-code');
    expect(onRetryableFilterChange).toHaveBeenCalledWith('fatal');
    expect(onSelectTask).toHaveBeenCalledWith('task-agent-error');
    expect(onRetryTask).toHaveBeenCalledWith('task-agent-error');
    expect(onRefreshRuntime).toHaveBeenCalledTimes(1);
    expect(onCreateDiagnosisTask).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-agent-error',
        errorCode: 'provider_transient_error',
        ministry: 'hubu-search',
        message: 'research provider timeout',
        recoveryPlaybook: ['重试失败任务', '补充缓存热身']
      })
    );
  });
});
