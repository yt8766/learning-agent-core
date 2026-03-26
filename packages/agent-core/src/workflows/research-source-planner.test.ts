import { describe, expect, it } from 'vitest';

import { buildResearchSourcePlan } from './research-source-planner';

describe('buildResearchSourcePlan', () => {
  it('adds freshness-oriented research sources for latest/recent goals', () => {
    const plan = buildResearchSourcePlan({
      taskId: 'task-1',
      goal: '最近 AI 有什么新的技术进展',
      createdAt: '2026-03-26T08:00:00.000Z',
      workflow: {
        id: 'general',
        displayName: '通用协作流程',
        intentPatterns: [],
        requiredMinistries: ['libu-router', 'hubu-search'],
        allowedCapabilities: ['search_memory'],
        approvalPolicy: 'high-risk-only',
        webLearningPolicy: {
          enabled: true,
          preferredSourceTypes: ['official-docs', 'market', 'repo'],
          acceptedTrustClasses: ['official', 'curated', 'internal']
        },
        sourcePolicy: {
          mode: 'controlled-first'
        },
        outputContract: {
          type: 'general_delivery',
          requiredSections: ['summary']
        }
      }
    });

    expect(plan).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: 'web_research_plan',
          sourceUrl: undefined,
          summary: expect.stringContaining('当前绝对日期：2026-03-26')
        }),
        expect.objectContaining({
          sourceUrl: 'https://openai.com/news/'
        }),
        expect.objectContaining({
          sourceUrl: 'https://deepmind.google/discover/blog/'
        })
      ])
    );
  });
});
