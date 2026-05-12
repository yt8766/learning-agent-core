import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/logger/platform-console-log-analysis', () => ({
  collectPlatformConsoleLogAnalysis: vi.fn().mockResolvedValue({
    sampleCount: 0,
    summary: { status: 'healthy', reasons: [], budgetsMs: { freshAggregateP95: 600, slowP95: 1200 } },
    byEvent: {},
    latestSamples: []
  })
}));

import { getPlatformConsoleLogAnalysis } from '../../src/runtime/domain/observability/runtime-platform-console-log-analysis';
import { collectPlatformConsoleLogAnalysis } from '../../src/logger/platform-console-log-analysis';

const mockCollect = vi.mocked(collectPlatformConsoleLogAnalysis);

describe('getPlatformConsoleLogAnalysis', () => {
  it('delegates to collectPlatformConsoleLogAnalysis with defaults when no options', async () => {
    const ctx = { settings: { workspaceRoot: '/workspace' } } as any;

    const result = await getPlatformConsoleLogAnalysis(ctx);

    expect(mockCollect).toHaveBeenCalledWith({
      logsDir: '/workspace/apps/backend/agent-server/logs',
      days: 7,
      latestSampleLimit: 5
    });
    expect(result.sampleCount).toBe(0);
  });

  it('uses custom days and latestSampleLimit from options', async () => {
    const ctx = { settings: { workspaceRoot: '/ws' } } as any;

    await getPlatformConsoleLogAnalysis(ctx, { days: 14, latestSampleLimit: 10 });

    expect(mockCollect).toHaveBeenCalledWith({
      logsDir: '/ws/apps/backend/agent-server/logs',
      days: 14,
      latestSampleLimit: 10
    });
  });

  it('passes undefined logsDir when workspaceRoot is missing', async () => {
    const ctx = { settings: {} } as any;

    await getPlatformConsoleLogAnalysis(ctx);

    expect(mockCollect).toHaveBeenCalledWith({
      logsDir: undefined,
      days: 7,
      latestSampleLimit: 5
    });
  });

  it('passes undefined logsDir when settings is undefined', async () => {
    const ctx = {} as any;

    await getPlatformConsoleLogAnalysis(ctx);

    expect(mockCollect).toHaveBeenCalledWith({
      logsDir: undefined,
      days: 7,
      latestSampleLimit: 5
    });
  });
});
