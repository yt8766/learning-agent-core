import { describe, expect, it } from 'vitest';

import { resolveHubuResearchToolPlan } from '../src/flows/ministries/hubu-search/hubu-search-tool-plan';

type ToolPlanContext = Parameters<typeof resolveHubuResearchToolPlan>[0]['context'];

describe('hubu search tool plan', () => {
  it('在未配置 llm 时回退到 heuristic research plan', async () => {
    const plan = await resolveHubuResearchToolPlan({
      context: {
        goal: '帮我研究 React 最新发布说明',
        taskId: 'task-1',
        llm: {
          isConfigured: () => false
        }
      } as unknown as ToolPlanContext,
      subTask: '研究 React',
      availableTools: ['memory-search', 'knowledge-search', 'skill-search']
    });

    expect(plan).toEqual(['memory-search', 'skill-search']);
  });
});
