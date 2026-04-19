import { describe, expect, it, vi } from 'vitest';

import { PlatformDiagnosticsController } from '../../src/platform/platform-diagnostics.controller';

describe('PlatformDiagnosticsController', () => {
  it('delegates platform console log analysis through runtime centers service', () => {
    const runtimeCentersService = {
      getPlatformConsoleLogAnalysis: vi.fn((days?: number) => ({
        days,
        sampleCount: 3
      }))
    };

    const controller = new PlatformDiagnosticsController(runtimeCentersService as never);

    expect(controller.getPlatformConsoleLogAnalysis('14')).toEqual({
      days: 14,
      sampleCount: 3
    });
    expect(runtimeCentersService.getPlatformConsoleLogAnalysis).toHaveBeenCalledWith(14);
  });
});
