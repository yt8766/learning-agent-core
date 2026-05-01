import { describe, expect, it, vi } from 'vitest';

const { RuntimeTechBriefingServiceMock, forceRunMock } = vi.hoisted(() => {
  const forceRunMock = vi.fn();
  const RuntimeTechBriefingServiceMock = vi.fn(function () {
    return {
      forceRun: forceRunMock,
      getStatus: vi.fn(),
      initializeSchedule: vi.fn(),
      runScheduled: vi.fn()
    };
  });

  return { RuntimeTechBriefingServiceMock, forceRunMock };
});

vi.mock('@agent/agents-intel-engine', () => ({
  RuntimeTechBriefingService: RuntimeTechBriefingServiceMock
}));

import { RuntimeIntelBriefingFacade } from '../../../src/runtime/core/runtime-intel-briefing-facade';

describe('RuntimeIntelBriefingFacade', () => {
  it('delegates forceRun through the intel briefing service contract', async () => {
    const now = new Date('2026-04-29T00:00:00.000Z');
    forceRunMock.mockResolvedValueOnce({ categories: ['frontend-tech'] });

    const getContext = vi.fn(() => ({
      settings: {
        workspaceRoot: process.cwd(),
        dailyTechBriefing: {
          enabled: false,
          schedule: 'daily 11:00'
        }
      }
    }));

    const facade = new RuntimeIntelBriefingFacade(getContext as never);
    const run = await facade.forceRun('frontend-tech', now);

    expect(run.categories).toContain('frontend-tech');
    expect(RuntimeTechBriefingServiceMock).toHaveBeenCalledWith(getContext);
    expect(forceRunMock).toHaveBeenCalledWith('frontend-tech', now);
  });
});
