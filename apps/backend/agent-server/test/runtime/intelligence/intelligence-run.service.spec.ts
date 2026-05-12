import { describe, expect, it, vi } from 'vitest';

import { createIntelligenceMemoryRepository } from '../../../src/runtime/intelligence/intelligence-memory.repository';
import { RuntimeIntelligenceRunService } from '../../../src/runtime/intelligence/intelligence-run.service';

describe('RuntimeIntelligenceRunService', () => {
  it('runs a new intelligence channel through web search and persists signals plus candidates', async () => {
    const repository = createIntelligenceMemoryRepository();
    const mcpClientManager = {
      hasCapability: vi.fn((capabilityId: string) => capabilityId === 'webSearchPrime'),
      invokeTool: vi.fn(async () => ({
        ok: true,
        rawOutput: {
          results: [
            {
              title: 'OpenAI releases GPT-5.5',
              url: 'https://openai.com/index/gpt-5-5',
              summary: 'Official API release changes model routing, pricing, and migration behavior.',
              sourceName: 'OpenAI',
              sourceUrl: 'https://openai.com',
              sourceGroup: 'official',
              publishedAt: '2026-05-11T00:00:00.000Z'
            }
          ]
        }
      }))
    };
    const service = new RuntimeIntelligenceRunService(() => ({
      workspaceRoot: process.cwd(),
      repository,
      mcpClientManager
    }));

    const result = await service.forceRun('llm-releases', new Date('2026-05-11T01:00:00.000Z'));
    const signals = await repository.listRecentSignals({ limit: 10 });
    const candidates = await repository.listPendingCandidates({ limit: 10 });

    expect(result).toEqual({
      ok: true,
      channel: 'llm-releases',
      status: 'completed',
      acceptedAt: '2026-05-11T01:00:00.000Z',
      summary: {
        queries: 3,
        rawEvents: 3,
        signals: 1,
        candidates: 1,
        failedQueries: 0,
        skippedQueries: 0
      }
    });
    expect(mcpClientManager.invokeTool).toHaveBeenCalledWith(
      'webSearchPrime',
      expect.objectContaining({
        toolName: 'webSearchPrime',
        requestedBy: 'agent'
      })
    );
    expect(signals).toEqual([
      expect.objectContaining({
        channel: 'llm-releases',
        title: 'OpenAI releases GPT-5.5',
        sourceCount: 1,
        knowledgeDecision: 'candidate'
      })
    ]);
    expect(candidates).toEqual([
      expect.objectContaining({
        signalId: signals[0]!.id,
        candidateType: 'knowledge',
        decision: 'candidate',
        reviewStatus: 'pending'
      })
    ]);
  });
});
