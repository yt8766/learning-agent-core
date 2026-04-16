import { describe, expect, it } from 'vitest';

import { toMcpSearchItems } from '../../../src/runtime/briefings/runtime-tech-briefing-category-collector';

describe('runtime tech briefing category collector helpers', () => {
  it('keeps allowlisted MCP search results and drops unsupported domains', () => {
    const items = toMcpSearchItems('ai-tech', new Date('2026-04-16T00:00:00.000Z'), {
      results: [
        {
          url: 'https://openai.com/news/new-realtime-api-update',
          title: 'OpenAI realtime update',
          summary: 'Official release note',
          fetchedAt: '2026-04-16T00:00:00.000Z'
        },
        {
          url: 'https://example.com/marketing-post',
          title: 'Marketing post',
          summary: 'Not allowlisted'
        },
        {
          url: 'https://openai.com/news/new-realtime-api-update',
          title: 'OpenAI realtime update',
          summary: 'Duplicate result',
          fetchedAt: '2026-04-16T00:00:00.000Z'
        }
      ]
    });

    expect(items).toHaveLength(2);
    expect(items.every(item => item.url.startsWith('https://openai.com'))).toBe(true);
  });
});
