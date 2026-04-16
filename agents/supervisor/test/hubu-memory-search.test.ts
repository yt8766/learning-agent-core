import { describe, expect, it, vi } from 'vitest';

import { searchHubuMemories } from '../src/flows/ministries/hubu-search/hubu-memory-search';

describe('Hubu memory search', () => {
  it('prefers structured memory search and returns reflections alongside memories', async () => {
    const result = await searchHubuMemories({
      goal: '继续当前项目实现',
      taskId: 'task-1',
      memoryRepository: {
        search: vi.fn(async () => [])
      } as never,
      memorySearchService: {
        search: vi.fn(async () => ({
          coreMemories: [
            {
              id: 'memory-1',
              type: 'constraint',
              memoryType: 'constraint',
              scopeType: 'task',
              summary: '当前项目禁止自动提交代码。',
              content: '当前项目禁止自动提交代码。',
              tags: [],
              sourceEvidenceIds: [],
              relatedEntities: [{ entityType: 'project', entityId: 'task-1' }],
              confidence: 0.9,
              importance: 10,
              status: 'active',
              createdAt: '2026-04-16T00:00:00.000Z',
              version: 1
            }
          ],
          archivalMemories: [
            {
              id: 'memory-2',
              type: 'procedure',
              memoryType: 'procedure',
              scopeType: 'workspace',
              summary: '改动前先检查审批门。',
              content: '改动前先检查审批门。',
              tags: [],
              sourceEvidenceIds: [],
              relatedEntities: [{ entityType: 'workspace', entityId: 'workspace-1' }],
              confidence: 0.8,
              importance: 8,
              status: 'active',
              createdAt: '2026-04-16T00:00:00.000Z',
              version: 1
            }
          ],
          rules: [
            {
              id: 'rule-1',
              name: 'approval-first',
              summary: '高风险动作必须审批。',
              conditions: ['destructive'],
              action: 'require_approval',
              priority: 10,
              status: 'active',
              createdAt: '2026-04-16T00:00:00.000Z',
              updatedAt: '2026-04-16T00:00:00.000Z'
            }
          ],
          reflections: [
            {
              id: 'reflection-1',
              kind: 'failurePattern',
              summary: '历史上自动提交会引发用户纠正。',
              whatWorked: [],
              whatFailed: ['自动提交'],
              nextAttemptAdvice: ['保留提交给用户手动执行'],
              promotedMemoryIds: [],
              promotedRuleIds: [],
              relatedEntities: [{ entityType: 'project', entityId: 'task-1' }],
              createdAt: '2026-04-16T00:00:00.000Z'
            }
          ],
          reasons: []
        }))
      } as never
    });

    expect(result.memories.map(item => item.id)).toEqual(['memory-1', 'memory-2']);
    expect(result.rules.map(item => item.id)).toEqual(['rule-1']);
    expect(result.reflections.map(item => item.id)).toEqual(['reflection-1']);
  });

  it('falls back to repository search when structured search is unavailable', async () => {
    const result = await searchHubuMemories({
      goal: '继续当前项目实现',
      taskId: 'task-1',
      memoryRepository: {
        search: vi.fn(async () => [
          {
            id: 'memory-legacy',
            type: 'task_summary',
            summary: '旧搜索结果',
            content: '旧搜索结果',
            tags: [],
            qualityScore: 0.7,
            effectiveness: 0.7,
            createdAt: '2026-04-16T00:00:00.000Z',
            updatedAt: '2026-04-16T00:00:00.000Z'
          }
        ])
      } as never
    });

    expect(result.memories.map(item => item.id)).toEqual(['memory-legacy']);
    expect(result.rules).toEqual([]);
    expect(result.reflections).toEqual([]);
  });
});
