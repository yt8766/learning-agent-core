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
      memorySearchService: {
        search: vi.fn(async () => ({
          memories: [],
          rules: []
        }))
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

  it('persist review 前会补充相似 memory / rule 到 learning reuse', async () => {
    const flow = new LearningFlow({
      memoryRepository: {
        append: vi.fn(),
        list: vi.fn(async () => []),
        search: vi.fn(async () => []),
        getById: vi.fn(),
        invalidate: vi.fn()
      } as never,
      memorySearchService: {
        search: vi.fn(async () => ({
          memories: [
            {
              id: 'mem_reuse_build',
              type: 'success_case',
              summary: '发布前先跑构建',
              content: 'Run build before release.',
              tags: ['release'],
              createdAt: '2026-03-24T00:00:00.000Z',
              status: 'active'
            }
          ],
          rules: [
            {
              id: 'rule_release_gate',
              name: 'release_gate',
              summary: '上线前必须通过构建',
              conditions: ['before release'],
              action: 'run build',
              createdAt: '2026-03-24T00:00:00.000Z',
              status: 'active'
            }
          ]
        }))
      } as never,
      ruleRepository: {
        append: vi.fn(),
        list: vi.fn(async () => []),
        search: vi.fn(async () => []),
        getById: vi.fn(),
        invalidate: vi.fn()
      } as never,
      skillRegistry: {
        publishToLab: vi.fn(),
        recordExecutionResult: vi.fn()
      } as never
    });

    const task: any = {
      id: 'task_1',
      runId: 'run_1',
      goal: '发布前检查',
      status: 'completed',
      updatedAt: '2026-03-24T00:00:00.000Z',
      trace: [],
      externalSources: [],
      agentStates: [],
      usedInstalledSkills: [],
      usedCompanyWorkers: [],
      reusedMemories: [],
      reusedRules: []
    };

    await flow.persistReviewArtifacts(
      task,
      task.goal,
      {
        success: true,
        quality: 'high',
        shouldRetry: false,
        shouldWriteMemory: false,
        shouldCreateRule: false,
        shouldExtractSkill: false,
        notes: []
      },
      {
        taskId: task.id,
        decision: 'approved',
        notes: [],
        createdAt: '2026-03-24T00:00:00.000Z'
      },
      'release check passed',
      {
        buildMemoryRecord: vi.fn(),
        buildRuleRecord: vi.fn(),
        buildSkillDraft: vi.fn(),
        addTrace: vi.fn()
      }
    );

    expect(task.reusedMemories).toEqual(expect.arrayContaining(['mem_reuse_build']));
    expect(task.reusedRules).toEqual(expect.arrayContaining(['rule_release_gate']));
    expect(task.learningEvaluation?.sourceSummary.reusedMemoryCount).toBeGreaterThan(0);
    expect(task.learningEvaluation?.sourceSummary.reusedRuleCount).toBeGreaterThan(0);
  });
});
