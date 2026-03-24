import { describe, expect, it, vi } from 'vitest';

import { LearningFlow } from './learning-flow';

describe('LearningFlow knowledge governance', () => {
  it('遇到相似 research memory 时不会自动沉淀，并记录冲突', async () => {
    const flow = new LearningFlow({
      memoryRepository: {
        append: vi.fn(),
        list: vi.fn(async () => []),
        search: vi.fn(async () => [
          {
            id: 'mem_existing',
            summary: 'React 流式渲染研究结论',
            content: 'existing',
            tags: ['research-job', 'auto-persist'],
            createdAt: '2026-03-24T00:00:00.000Z'
          }
        ]),
        getById: vi.fn(),
        invalidate: vi.fn()
      } as never,
      ruleRepository: {
        append: vi.fn(),
        list: vi.fn(async () => []),
        getById: vi.fn(),
        invalidate: vi.fn()
      } as never,
      skillRegistry: {
        publishToLab: vi.fn()
      } as never
    });

    const job: any = {
      id: 'learn_1',
      sourceType: 'research',
      status: 'completed',
      documentUri: 'React 流式渲染',
      goal: 'React 流式渲染',
      summary: 'React 流式渲染研究结论',
      sources: [
        {
          id: 'src_1',
          taskId: 'learn_1',
          sourceType: 'web',
          trustClass: 'official',
          summary: 'React docs',
          createdAt: '2026-03-24T00:00:00.000Z'
        }
      ],
      createdAt: '2026-03-24T00:00:00.000Z',
      updatedAt: '2026-03-24T00:00:00.000Z'
    };

    const persisted = await flow.autoPersistResearchMemory(job, 'high-confidence');

    expect(persisted).toEqual([]);
    expect(job.conflictDetected).toBe(true);
    expect(job.autoPersistEligible).toBe(false);
    expect(job.conflictNotes).toEqual(expect.arrayContaining([expect.stringContaining('mem_existing')]));
    expect(job.learningEvaluation?.governanceWarnings).toEqual(
      expect.arrayContaining([expect.stringContaining('mem_existing')])
    );
  });
});
