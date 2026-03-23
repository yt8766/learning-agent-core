import { MemoryRepository, RuleRepository } from '@agent/memory';
import {
  EvaluationResult,
  LearningCandidateRecord,
  ReviewRecord,
  RuleRecord,
  SkillCard,
  TaskRecord,
  TaskStatus
} from '@agent/shared';
import { SkillRegistry } from '@agent/skills';

interface LearningFlowDependencies {
  memoryRepository: MemoryRepository;
  ruleRepository: RuleRepository;
  skillRegistry: SkillRegistry;
}

export class LearningFlow {
  constructor(private readonly dependencies: LearningFlowDependencies) {}

  ensureCandidates(task: TaskRecord): LearningCandidateRecord[] {
    if (task.learningCandidates?.length) {
      return task.learningCandidates;
    }

    const now = new Date().toISOString();
    task.learningCandidates = [
      {
        id: `learn_mem_${Date.now()}`,
        taskId: task.id,
        type: 'memory',
        summary: '沉淀本轮多 Agent 执行经验',
        status: 'pending_confirmation',
        payload: {
          id: `mem_candidate_${Date.now()}`,
          type: task.status === TaskStatus.COMPLETED ? 'success_case' : 'failure_case',
          taskId: task.id,
          summary: `围绕 ${task.goal} 的多 Agent 经验总结`,
          content: task.result ?? '',
          tags: ['chat-session', 'multi-agent'],
          createdAt: now
        },
        createdAt: now
      },
      {
        id: `learn_rule_${Date.now()}`,
        taskId: task.id,
        type: 'rule',
        summary: '沉淀可复用的执行约束',
        status: 'pending_confirmation',
        payload: {
          id: `rule_candidate_${Date.now()}`,
          name: 'Chat Session Rule Candidate',
          summary: '当类似目标再次出现时复用这条规则',
          conditions: [`taskId=${task.id}`],
          action: task.result ?? 'review task result',
          sourceTaskId: task.id,
          createdAt: now
        },
        createdAt: now
      },
      {
        id: `learn_skill_${Date.now()}`,
        taskId: task.id,
        type: 'skill',
        summary: '将本轮执行抽取为技能候选并进入 lab',
        status: 'pending_confirmation',
        payload: {
          id: `skill_candidate_${Date.now()}`,
          name: 'Chat Session Skill Candidate',
          description: '从主 Agent 与子 Agent 协作过程中提炼出的可复用技能。',
          applicableGoals: [task.goal],
          requiredTools: ['search_memory', 'read_local_file'],
          steps:
            task.plan?.steps.map((step, index) => ({
              title: `Step ${index + 1}`,
              instruction: step,
              toolNames: ['search_memory']
            })) ?? [],
          constraints: ['高风险动作必须人工确认'],
          successSignals: ['任务成功完成', 'review 给出 approved 结论'],
          riskLevel: 'medium',
          source: 'execution',
          status: 'lab',
          createdAt: now,
          updatedAt: now
        },
        createdAt: now
      }
    ];

    return task.learningCandidates;
  }

  async confirmCandidates(task: TaskRecord, candidateIds?: string[]) {
    if (!task.learningCandidates?.length) {
      return [];
    }

    const selected = new Set(candidateIds ?? task.learningCandidates.map(candidate => candidate.id));
    for (const candidate of task.learningCandidates) {
      if (!selected.has(candidate.id)) {
        continue;
      }

      if (candidate.type === 'memory') {
        await this.dependencies.memoryRepository.append(candidate.payload as never);
      } else if (candidate.type === 'rule') {
        await this.dependencies.ruleRepository.append(candidate.payload as never);
      } else if (candidate.type === 'skill') {
        await this.dependencies.skillRegistry.publishToLab(candidate.payload as never);
      }
    }

    task.learningCandidates = task.learningCandidates.map(candidate =>
      selected.has(candidate.id)
        ? { ...candidate, status: 'confirmed', confirmedAt: new Date().toISOString() }
        : candidate
    );

    return [...selected];
  }

  async persistReviewArtifacts(
    task: TaskRecord,
    goal: string,
    evaluation: EvaluationResult,
    review: ReviewRecord,
    executionSummary: string,
    builders: {
      buildMemoryRecord: (
        taskId: string,
        targetGoal: string,
        targetEvaluation: EvaluationResult,
        targetReview: ReviewRecord,
        targetExecutionSummary: string
      ) => any;
      buildRuleRecord: (taskId: string, targetExecutionSummary: string) => RuleRecord;
      buildSkillDraft: (targetGoal: string, source: 'execution' | 'document') => SkillCard;
      addTrace: (node: string, summary: string) => void;
    }
  ): Promise<void> {
    if (evaluation.shouldWriteMemory) {
      const memory = builders.buildMemoryRecord(task.id, goal, evaluation, review, executionSummary);
      await this.dependencies.memoryRepository.append(memory);
      builders.addTrace('memory_write', `Wrote memory record ${memory.id}`);
    }

    if (evaluation.shouldCreateRule) {
      const rule = builders.buildRuleRecord(task.id, executionSummary);
      await this.dependencies.ruleRepository.append(rule);
      builders.addTrace('rule_write', `Wrote rule record ${rule.id}`);
    }

    if (evaluation.shouldExtractSkill) {
      const skill = builders.buildSkillDraft(goal, 'execution');
      await this.dependencies.skillRegistry.publishToLab(skill);
      builders.addTrace('skill_extract', `Published skill ${skill.id} to lab`);
    }
  }
}
