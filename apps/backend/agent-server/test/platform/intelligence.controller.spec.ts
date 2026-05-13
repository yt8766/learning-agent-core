import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';

import { PlatformIntelligenceController } from '../../src/platform/platform-intelligence.controller';
import { RuntimeCentersObservabilityQueryService } from '../../src/runtime/centers/runtime-centers-observability.query-service';
import type { RuntimeHost } from '../../src/runtime/core/runtime.host';

describe('platform intelligence controller', () => {
  it('delegates intelligence overview to runtime centers service', async () => {
    const { controller, runtimeCentersService } = createController();

    await expect(controller.getIntelligenceOverview()).resolves.toEqual({
      generatedAt: '2026-05-10T00:00:00.000Z',
      channels: [],
      recentSignals: [],
      pendingCandidates: []
    });
    expect(runtimeCentersService.getIntelligenceOverview).toHaveBeenCalledTimes(1);
  });

  it('forces an accepted intelligence run for llm releases', async () => {
    const { controller, runtimeCentersService } = createController();

    await expect(controller.forceIntelligenceRun('llm-releases')).resolves.toEqual({
      ok: true,
      channel: 'llm-releases',
      acceptedAt: '2026-05-10T00:00:00.000Z'
    });
    expect(runtimeCentersService.forceIntelligenceRun).toHaveBeenCalledWith('llm-releases');
  });

  it('rejects excluded intelligence channels before force run dispatch', () => {
    const { controller, runtimeCentersService } = createController();

    expect(() => controller.forceIntelligenceRun('agent-rag-runtime-engineering')).toThrow(BadRequestException);
    expect(runtimeCentersService.forceIntelligenceRun).not.toHaveBeenCalled();
  });

  it('returns an empty intelligence projection when repository is unavailable', async () => {
    const queryService = new RuntimeCentersObservabilityQueryService(() => ({}) as never);

    await expect(queryService.getIntelligenceOverview()).resolves.toEqual({
      generatedAt: expect.any(String),
      channels: [],
      recentSignals: [],
      pendingCandidates: []
    });
  });

  it('loads recent signals and pending candidates from intelligence repository', async () => {
    const repository = {
      listRecentSignals: vi.fn(async () => [
        {
          id: 'signal-1',
          channel: 'llm-releases',
          title: 'GPT update',
          summary: 'Release note changed.',
          priority: 'P1',
          confidence: 'high',
          status: 'pending',
          firstSeenAt: '2026-05-10T00:00:00.000Z',
          lastSeenAt: '2026-05-10T00:00:00.000Z',
          sourceCount: 1
        }
      ]),
      listPendingCandidates: vi.fn(async () => [
        {
          id: 'candidate-1',
          signalId: 'signal-1',
          candidateType: 'knowledge',
          decision: 'candidate',
          decisionReason: 'New release behavior.',
          reviewStatus: 'pending',
          createdAt: '2026-05-10T00:00:00.000Z'
        }
      ])
    };
    const queryService = new RuntimeCentersObservabilityQueryService(
      () =>
        ({
          intelligenceRepository: repository
        }) as never
    );

    await expect(queryService.getIntelligenceOverview()).resolves.toEqual({
      generatedAt: expect.any(String),
      channels: [],
      recentSignals: [expect.objectContaining({ id: 'signal-1' })],
      pendingCandidates: [expect.objectContaining({ id: 'candidate-1' })]
    });
    expect(repository.listRecentSignals).toHaveBeenCalledWith({ limit: 20 });
    expect(repository.listPendingCandidates).toHaveBeenCalledWith({ limit: 20 });
  });

  it('forces intelligence runs through the new intelligence runner instead of the legacy briefing service', async () => {
    const intelligenceRunService = {
      forceRun: vi.fn(async (channel: string) => ({
        ok: true,
        channel,
        status: 'completed',
        acceptedAt: '2026-05-11T00:00:00.000Z',
        summary: {
          queries: 3,
          rawEvents: 2,
          signals: 1,
          candidates: 1
        }
      }))
    };
    const queryService = new RuntimeCentersObservabilityQueryService(
      () =>
        ({
          intelligenceRunService
        }) as never
    );

    await expect(queryService.forceIntelligenceRun('llm-releases')).resolves.toEqual({
      ok: true,
      channel: 'llm-releases',
      status: 'completed',
      acceptedAt: '2026-05-11T00:00:00.000Z',
      summary: {
        queries: 3,
        rawEvents: 2,
        signals: 1,
        candidates: 1
      }
    });
    expect(intelligenceRunService.forceRun).toHaveBeenCalledWith('llm-releases');
  });
});

function createController() {
  const runtimeCentersService = {
    getIntelligenceOverview: vi.fn(async () => ({
      generatedAt: '2026-05-10T00:00:00.000Z',
      channels: [],
      recentSignals: [],
      pendingCandidates: []
    })),
    forceIntelligenceRun: vi.fn(async (channel: string) => ({
      ok: true,
      channel,
      acceptedAt: '2026-05-10T00:00:00.000Z'
    }))
  };
  const runtimeHost = {
    listWorkflowPresets: vi.fn(() => [])
  } as Pick<RuntimeHost, 'listWorkflowPresets'> as RuntimeHost;

  return {
    controller: new PlatformIntelligenceController(runtimeCentersService as never, runtimeHost),
    runtimeCentersService
  };
}
