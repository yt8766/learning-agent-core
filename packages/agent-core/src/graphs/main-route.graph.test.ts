import { describe, expect, it } from 'vitest';

import { createMainRouteGraph } from './main-route.graph';

describe('createMainRouteGraph', () => {
  it('routes standard goals to workflow/supervisor', async () => {
    const graph = createMainRouteGraph().compile();

    const result = await graph.invoke({
      goal: '帮我重构这个仓库的技能路由'
    });

    expect(result.selectedGraph).toBe('workflow');
    expect(result.selectedFlow).toBe('supervisor');
    expect(result.routeReason).toBe('default_workflow');
  });

  it('routes identity questions to direct reply', async () => {
    const graph = createMainRouteGraph().compile();

    const result = await graph.invoke({
      goal: 'who are you'
    });

    expect(result.selectedGraph).toBe('workflow');
    expect(result.selectedFlow).toBe('direct-reply');
    expect(result.routeReason).toBe('identity_or_capability_question');
  });
});
