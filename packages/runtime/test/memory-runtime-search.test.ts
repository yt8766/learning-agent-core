import { describe, expect, it, vi } from 'vitest';

import type { MemorySearchService } from '@agent/memory';

import { resolveLifecycleKnowledgeReuse } from '../src/graphs/main/lifecycle/main-graph-lifecycle-governance';
import { buildSessionConversationContext } from '../src/session/session-coordinator-thinking-context';

describe('runtime memory integration', () => {
  it('injects structured memories and reflections into session conversation context', async () => {
    const memorySearchService: MemorySearchService = {
      search: vi.fn(async () => ({
        coreMemories: [
          {
            id: 'memory-1',
            type: 'preference',
            memoryType: 'preference',
            scopeType: 'user',
            summary: '用户偏好先给结论再解释。',
            content: '用户偏好先给结论再解释。',
            tags: ['user-style'],
            sourceEvidenceIds: [],
            relatedEntities: [{ entityType: 'user', entityId: 'user-1' }],
            confidence: 0.9,
            importance: 8,
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
            scopeType: 'task',
            summary: '同类任务先检查审批约束再动手。',
            content: '同类任务先检查审批约束再动手。',
            tags: ['workflow'],
            sourceEvidenceIds: ['ev-1'],
            relatedEntities: [{ entityType: 'project', entityId: 'task-1' }],
            confidence: 0.8,
            importance: 9,
            status: 'active',
            createdAt: '2026-04-16T00:00:00.000Z',
            version: 1
          }
        ],
        rules: [
          {
            id: 'rule-1',
            name: 'manual-approval',
            summary: '高风险动作必须先审批。',
            conditions: ['destructive command'],
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
            summary: '过去在没有确认约束时直接执行会触发用户纠正。',
            whatWorked: [],
            whatFailed: ['直接执行高风险动作'],
            nextAttemptAdvice: ['先确认约束', '把审批门前置'],
            promotedMemoryIds: [],
            promotedRuleIds: [],
            relatedEntities: [{ entityType: 'project', entityId: 'task-1' }],
            createdAt: '2026-04-16T00:00:00.000Z'
          }
        ],
        reasons: [
          {
            id: 'memory-1',
            kind: 'memory',
            summary: '当前项目禁止自动提交代码。',
            score: 0.88,
            reason: 'entity matched; same scope; strong relevance'
          }
        ]
      })) as never
    };

    const result = await buildSessionConversationContext(
      {
        id: 'session-1',
        title: 'Memory session',
        status: 'active',
        channelIdentity: { channel: 'web', channelUserId: 'user-1' },
        createdAt: '2026-04-16T00:00:00.000Z',
        updatedAt: '2026-04-16T00:00:00.000Z'
      } as never,
      {
        checkpointId: 'checkpoint-1',
        sessionId: 'session-1',
        taskId: 'task-1',
        channelIdentity: { channel: 'web', channelUserId: 'user-1' },
        updatedAt: '2026-04-16T00:00:00.000Z',
        recoverability: 'full'
      } as never,
      [
        {
          id: 'msg-1',
          sessionId: 'session-1',
          role: 'user',
          content: '帮我继续实现这个方案',
          createdAt: '2026-04-16T00:00:00.000Z'
        }
      ],
      '继续实现并注意审批约束',
      {
        recentTurns: 4,
        ragTopK: 3
      } as never,
      memorySearchService
    );

    expect(result).toContain('用户偏好先给结论再解释');
    expect(result).toContain('高风险动作必须先审批');
    expect(result).toContain('过去在没有确认约束时直接执行会触发用户纠正');
    expect(result).toContain('下次建议：先确认约束；把审批门前置');
  });

  it('turns structured reflections into lifecycle evidence during knowledge reuse', async () => {
    const memorySearchService: MemorySearchService = {
      search: vi.fn(async () => ({
        coreMemories: [
          {
            id: 'memory-1',
            type: 'constraint',
            memoryType: 'constraint',
            scopeType: 'task',
            summary: '当前项目禁止自动提交代码。',
            content: '当前项目禁止自动提交代码。',
            tags: ['project-rule'],
            sourceEvidenceIds: ['ev-1'],
            relatedEntities: [{ entityType: 'project', entityId: 'task-1' }],
            confidence: 0.95,
            importance: 10,
            status: 'active',
            createdAt: '2026-04-16T00:00:00.000Z',
            version: 1
          }
        ],
        archivalMemories: [],
        rules: [],
        reflections: [
          {
            id: 'reflection-1',
            kind: 'failurePattern',
            summary: '历史上自动提交会引起用户纠正。',
            whatWorked: [],
            whatFailed: ['自动提交'],
            nextAttemptAdvice: ['保留提交给用户手动执行'],
            promotedMemoryIds: [],
            promotedRuleIds: [],
            relatedEntities: [{ entityType: 'project', entityId: 'task-1' }],
            createdAt: '2026-04-16T00:00:00.000Z'
          }
        ],
        reasons: [
          {
            id: 'memory-1',
            kind: 'memory',
            summary: '当前项目禁止自动提交代码。',
            score: 0.88,
            reason: 'entity matched; same scope; strong relevance'
          }
        ]
      })) as never
    };

    const result = await resolveLifecycleKnowledgeReuse({
      taskId: 'task-1',
      runId: 'run-1',
      goal: '继续当前项目实现',
      createdAt: '2026-04-16T00:00:00.000Z',
      memoryRepository: {
        search: vi.fn(async () => [])
      } as never,
      memorySearchService
    });

    expect(result.reusedMemoryIds).toEqual(['memory-1']);
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: 'memory_reuse',
          summary: '已命中历史记忆：当前项目禁止自动提交代码。',
          detail: expect.objectContaining({
            memoryId: 'memory-1',
            reason: 'entity matched; same scope; strong relevance',
            score: 0.88
          })
        }),
        expect.objectContaining({
          sourceType: 'memory_reuse',
          summary: '已命中历史反思：历史上自动提交会引起用户纠正。'
        })
      ])
    );
  });
});
