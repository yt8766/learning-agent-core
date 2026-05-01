import { describe, expect, it } from 'vitest';

import { createCompanyLiveStubRegistry, executeCompanyLiveGraph } from '../src';

const stubBrief = {
  briefId: 'brief-business-agent-mvp',
  targetPlatform: 'TikTok',
  targetRegion: 'US',
  language: 'en-US',
  audienceProfile: 'US shoppers',
  productRefs: ['sku-1'],
  sellingPoints: ['Fast glow'],
  riskLevel: 'medium' as const,
  createdAt: '2026-04-29T00:00:00.000Z'
};

const businessAgentNodeIds = [
  'growthAgent',
  'operationsAgent',
  'riskAgent',
  'productAgent',
  'financeAgent',
  'supportAgent',
  'contentAgent',
  'intelligenceAgent'
];

describe('executeCompanyLiveGraph business agent MVP', () => {
  it('runs the 8 company-live business agents before media generation', async () => {
    const result = await executeCompanyLiveGraph(stubBrief, createCompanyLiveStubRegistry());

    expect(result.trace.map(trace => trace.nodeId).slice(0, 8)).toEqual(businessAgentNodeIds);
    expect(result.trace.map(trace => trace.nodeId).slice(8)).toEqual([
      'generateAudio',
      'generateImage',
      'generateVideo',
      'assembleBundle'
    ]);
  });

  it('emits progress callbacks for every business agent so the MVP can be debugged', async () => {
    const completed: string[] = [];

    await executeCompanyLiveGraph(stubBrief, createCompanyLiveStubRegistry(), {
      onNodeComplete: trace => completed.push(trace.nodeId)
    });

    expect(completed.slice(0, 8)).toEqual(businessAgentNodeIds);
    expect(completed).toHaveLength(12);
  });

  it('includes each business agent domain and summary in trace snapshots', async () => {
    const result = await executeCompanyLiveGraph(stubBrief, createCompanyLiveStubRegistry());
    const businessTraces = result.trace.slice(0, 8);

    for (const trace of businessTraces) {
      expect(trace.status).toBe('succeeded');
      expect(trace.outputSnapshot).toEqual(
        expect.objectContaining({
          agentId: trace.nodeId,
          summary: expect.any(String)
        })
      );
    }
  });
});
