import { describe, expect, it } from 'vitest';

import { sanitizeListedSkills } from '../src/catalog/skill-card-listing';

describe('skill card listing', () => {
  it('filters accidental prompt-like cards and prefers stable duplicates', () => {
    const result = sanitizeListedSkills([
      {
        id: 'older-stable',
        name: 'GitHub Review',
        description: 'Review pull requests safely.',
        status: 'stable',
        source: 'execution',
        createdAt: '2026-01-01T00:00:00.000Z',
        ownership: { ownerType: 'shared' }
      },
      {
        id: 'newer-lab',
        name: 'GitHub Review',
        description: 'Review pull requests safely.',
        status: 'lab',
        source: 'execution',
        createdAt: '2026-04-01T00:00:00.000Z',
        ownership: { ownerType: 'shared' }
      },
      {
        id: 'accidental',
        name: '多 Agent 执行模式',
        description: '参考上面的生成我当前完成任务的周报',
        status: 'lab',
        source: 'user',
        ownership: { ownerType: 'user' }
      }
    ] as any);

    expect(result).toEqual([expect.objectContaining({ id: 'older-stable', status: 'stable' })]);
  });
});
