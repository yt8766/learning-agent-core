import { describe, expect, it } from 'vitest';

import { knowledgeApiFixtures } from '../../src/knowledge/knowledge-api-fixtures';

describe('knowledge API fixtures', () => {
  it('contains MVP dashboard, chat, trace, and eval data', () => {
    expect(knowledgeApiFixtures.dashboard.knowledgeBaseCount).toBeGreaterThan(0);
    expect(knowledgeApiFixtures.knowledgeBases.items[0]?.name).toBe('前端知识库');
    expect(knowledgeApiFixtures.chatResponse.traceId).toBe(knowledgeApiFixtures.traceDetail.id);
    expect(knowledgeApiFixtures.evalRuns.items[0]?.summary?.totalScore).toBeGreaterThan(0);
  });
});
