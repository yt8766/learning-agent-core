import { describe, expect, it, vi } from 'vitest';

import { loadSettings } from '@agent/config';
import type { SkillSearchStateRecord } from '@agent/shared';

import { LearningFlow } from '../../../src/flows/learning/learning-flow';

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

  it('诊断任务会在 learning notes 中标记故障诊断沉淀', () => {
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
          memories: [],
          rules: []
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
      id: 'task_diag_1',
      runId: 'run_diag_1',
      goal: '请诊断任务 task-agent-error 的 agent 错误并给出恢复方案。',
      context: 'diagnosis_for:task-agent-error',
      status: 'failed',
      updatedAt: '2026-03-24T00:00:00.000Z',
      trace: [],
      externalSources: [],
      agentStates: [],
      usedInstalledSkills: [],
      usedCompanyWorkers: [],
      reusedMemories: [],
      reusedRules: []
    };

    const evaluation = flow.prepareTaskLearning(
      task,
      {
        success: false,
        quality: 'medium',
        shouldRetry: false,
        shouldWriteMemory: true,
        shouldCreateRule: true,
        shouldExtractSkill: false,
        notes: ['需要检查 connector 状态']
      },
      {
        taskId: task.id,
        decision: 'blocked',
        notes: ['先修复 connector 后再恢复'],
        createdAt: '2026-03-24T00:00:00.000Z'
      }
    );

    expect(evaluation?.notes).toEqual(expect.arrayContaining([expect.stringContaining('agent 故障诊断沉淀')]));
  });

  it('does not publish weekly report drafting tasks to skill lab even if evaluation suggests skill extraction', async () => {
    const skillRegistry = {
      publishToLab: vi.fn(),
      recordExecutionResult: vi.fn()
    };
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
          memories: [],
          rules: []
        }))
      } as never,
      ruleRepository: {
        append: vi.fn(),
        list: vi.fn(async () => []),
        search: vi.fn(async () => []),
        getById: vi.fn(),
        invalidate: vi.fn()
      } as never,
      skillRegistry: skillRegistry as never
    });

    const task: any = {
      id: 'task_weekly_1',
      runId: 'run_weekly_1',
      goal: '参考上面的生成我当前完成任务的周报',
      context: '把项目进展整理成周报输出。',
      result: '周报草稿已完成。',
      status: 'completed',
      updatedAt: '2026-04-07T00:00:00.000Z',
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
        shouldExtractSkill: true,
        notes: []
      },
      {
        taskId: task.id,
        decision: 'approved',
        notes: [],
        createdAt: '2026-04-07T00:00:00.000Z'
      },
      '周报草稿已完成。',
      {
        buildMemoryRecord: vi.fn(),
        buildRuleRecord: vi.fn(),
        buildSkillDraft: vi.fn(),
        addTrace: vi.fn()
      }
    );

    expect(skillRegistry.publishToLab).not.toHaveBeenCalled();
    expect(task.learningEvaluation?.suggestedCandidateTypes).not.toContain('skill');
  });

  it('会从任务语义中提取稳定偏好并生成可自动确认的偏好记忆候选', () => {
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
          memories: [],
          rules: []
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
      } as never,
      settings: loadSettings({
        profile: 'personal',
        env: {} as NodeJS.ProcessEnv
      })
    });

    const task: any = {
      id: 'task_pref_1',
      runId: 'run_pref_1',
      goal: '主聊天区只看最终答复，审批放聊天记录里，并且给我更专业建议。',
      context: '长期偏好，不是本轮临时要求。',
      result: '后续默认按领域专家视角输出建议。',
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

    flow.prepareTaskLearning(task, {
      success: true,
      quality: 'high',
      shouldRetry: false,
      shouldWriteMemory: true,
      shouldCreateRule: false,
      shouldExtractSkill: false,
      notes: []
    });
    const candidates = flow.ensureCandidates(task);

    const preferenceCandidates = candidates.filter((candidate: any) => candidate.summary.includes('用户偏好'));
    expect(preferenceCandidates.length).toBeGreaterThan(0);
    expect(preferenceCandidates.every((candidate: any) => candidate.autoConfirmEligible)).toBe(true);
    expect(task.learningEvaluation?.candidateReasons).toEqual(
      expect.arrayContaining([expect.stringContaining('稳定偏好')])
    );
    expect(task.learningEvaluation?.expertiseSignals).toEqual(expect.arrayContaining(['user-preference']));
  });

  it('learning 阶段在 skill gap 且候选不足时会重新触发 find-skills 并写入 notes', async () => {
    const resolver = vi.fn(
      async (): Promise<SkillSearchStateRecord> => ({
        capabilityGapDetected: true,
        status: 'suggested',
        safetyNotes: ['测试候选可安装。'],
        suggestions: [
          {
            id: 'skill_test_strategy',
            kind: 'manifest',
            displayName: 'Test Strategy',
            summary: '补足测试策略能力',
            score: 0.91,
            availability: 'installable',
            reason: '检测到测试能力缺口。',
            requiredCapabilities: ['test'],
            sourceId: 'workspace-skills'
          }
        ]
      })
    );

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
          memories: [],
          rules: []
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
      } as never,
      settings: loadSettings({
        profile: 'personal',
        env: {} as NodeJS.ProcessEnv
      }),
      localSkillSuggestionResolver: resolver
    });

    const task: any = {
      id: 'task_gap_1',
      runId: 'run_gap_1',
      goal: '帮我补齐测试策略和回归方案',
      status: 'completed',
      updatedAt: '2026-03-24T00:00:00.000Z',
      trace: [],
      externalSources: [],
      agentStates: [],
      usedInstalledSkills: [],
      usedCompanyWorkers: [],
      reusedMemories: [],
      reusedRules: [],
      skillSearch: {
        capabilityGapDetected: true,
        status: 'blocked',
        safetyNotes: [],
        suggestions: []
      }
    };

    task.learningEvaluation = flow.prepareTaskLearning(task, {
      success: true,
      quality: 'medium',
      shouldRetry: false,
      shouldWriteMemory: true,
      shouldCreateRule: false,
      shouldExtractSkill: false,
      notes: []
    });

    await flow.refineTaskLearning(task, {
      success: true,
      quality: 'medium',
      shouldRetry: false,
      shouldWriteMemory: true,
      shouldCreateRule: false,
      shouldExtractSkill: false,
      notes: []
    });

    expect(resolver).toHaveBeenCalledTimes(1);
    expect(task.skillSearch?.suggestions).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'skill_test_strategy' })])
    );
    expect(task.learningEvaluation?.notes).toEqual(
      expect.arrayContaining([expect.stringContaining('重新触发 find-skills')])
    );
    expect(task.externalSources).toEqual(
      expect.arrayContaining([expect.objectContaining({ sourceType: 'skill_search' })])
    );
  });
});
