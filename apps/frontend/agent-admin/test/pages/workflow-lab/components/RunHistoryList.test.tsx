import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react', () => ({
  CheckCircle2: () => 'CheckCircle2',
  Clock3: () => 'Clock3',
  LoaderCircle: () => 'LoaderCircle',
  XCircle: () => 'XCircle'
}));

vi.mock('@/utils/utils', () => ({
  cn: (...args: (string | boolean | undefined)[]) => args.filter(Boolean).join(' ')
}));

import { RunHistoryList } from '@/pages/workflow-lab/components/RunHistoryList';
import type { WorkflowRunRecord } from '@/pages/workflow-lab/api/workflow-runs.api';

const baseRun: WorkflowRunRecord = {
  id: 'run-abc12345-def6-7890',
  workflowId: 'test-workflow',
  status: 'completed',
  startedAt: new Date('2026-05-01T10:00:00.000Z').getTime(),
  completedAt: new Date('2026-05-01T10:00:05.000Z').getTime()
};

describe('RunHistoryList', () => {
  it('renders empty state when no runs', () => {
    const html = renderToStaticMarkup(<RunHistoryList runs={[]} selectedRunId={null} onSelect={vi.fn()} />);

    expect(html).toContain('暂无历史记录');
    expect(html).toContain('0');
  });

  it('renders run count header', () => {
    const html = renderToStaticMarkup(<RunHistoryList runs={[baseRun]} selectedRunId={null} onSelect={vi.fn()} />);

    expect(html).toContain('1');
    expect(html).toContain('历史运行');
  });

  it('renders run id truncated to 8 chars', () => {
    const html = renderToStaticMarkup(<RunHistoryList runs={[baseRun]} selectedRunId={null} onSelect={vi.fn()} />);

    expect(html).toContain('run-abc1');
  });

  it('renders completed status', () => {
    const html = renderToStaticMarkup(<RunHistoryList runs={[baseRun]} selectedRunId={null} onSelect={vi.fn()} />);

    expect(html).toContain('completed');
  });

  it('renders failed status', () => {
    const run: WorkflowRunRecord = { ...baseRun, status: 'failed' };
    const html = renderToStaticMarkup(<RunHistoryList runs={[run]} selectedRunId={null} onSelect={vi.fn()} />);

    expect(html).toContain('failed');
  });

  it('renders running status with "运行中" duration', () => {
    const run: WorkflowRunRecord = { ...baseRun, status: 'running', completedAt: null };
    const html = renderToStaticMarkup(<RunHistoryList runs={[run]} selectedRunId={null} onSelect={vi.fn()} />);

    expect(html).toContain('running');
    expect(html).toContain('运行中');
  });

  it('renders pending status', () => {
    const run: WorkflowRunRecord = { ...baseRun, status: 'pending' };
    const html = renderToStaticMarkup(<RunHistoryList runs={[run]} selectedRunId={null} onSelect={vi.fn()} />);

    expect(html).toContain('pending');
  });

  it('formats duration in seconds for runs over 1000ms', () => {
    const html = renderToStaticMarkup(<RunHistoryList runs={[baseRun]} selectedRunId={null} onSelect={vi.fn()} />);

    // 5000ms = 5.0s
    expect(html).toContain('5.0s');
  });

  it('formats duration in ms for runs under 1000ms', () => {
    const run: WorkflowRunRecord = {
      ...baseRun,
      completedAt: baseRun.startedAt + 500
    };
    const html = renderToStaticMarkup(<RunHistoryList runs={[run]} selectedRunId={null} onSelect={vi.fn()} />);

    expect(html).toContain('500ms');
  });

  it('applies selected styling to the selected run', () => {
    const html = renderToStaticMarkup(
      <RunHistoryList runs={[baseRun]} selectedRunId={baseRun.id} onSelect={vi.fn()} />
    );

    expect(html).toContain('border-emerald-500');
  });

  it('renders multiple runs', () => {
    const runs: WorkflowRunRecord[] = [
      { ...baseRun, id: 'run-11111111-aaaa-bbbb' },
      { ...baseRun, id: 'run-22222222-cccc-dddd', status: 'failed' },
      { ...baseRun, id: 'run-33333333-eeee-ffff', status: 'running', completedAt: null }
    ];
    const html = renderToStaticMarkup(<RunHistoryList runs={runs} selectedRunId={null} onSelect={vi.fn()} />);

    expect(html).toContain('run-1111');
    expect(html).toContain('run-2222');
    expect(html).toContain('run-3333');
    expect(html).toContain('3');
  });
});
