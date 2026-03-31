import { EvaluationResult, MemoryRecord, ReviewRecord, RuleRecord, SkillCard, TaskRecord } from '@agent/shared';

import { isDiagnosisTask } from './main-graph-knowledge';

export class MainGraphTaskDrafts {
  constructor(private readonly tasks: Map<string, TaskRecord>) {}

  buildMemoryRecord(
    taskId: string,
    goal: string,
    evaluation: EvaluationResult,
    review: ReviewRecord,
    executionSummary: string
  ): MemoryRecord {
    const diagnosisTask = isDiagnosisTask({
      goal,
      context: this.tasks.get(taskId)?.context
    });
    return {
      id: `mem_${Date.now()}`,
      type: evaluation.success ? 'success_case' : 'failure_case',
      taskId,
      summary: diagnosisTask
        ? `Agent diagnosis pattern for goal: ${goal}`
        : evaluation.success
          ? `Successful multi-agent pattern for goal: ${goal}`
          : `Failure pattern for goal: ${goal}`,
      content: JSON.stringify({ review, executionSummary }),
      tags: [
        'multi-agent',
        'manager',
        'review',
        evaluation.success ? 'success' : 'failure',
        ...(diagnosisTask ? ['diagnosis', 'recovery'] : [])
      ],
      qualityScore: evaluation.success ? 0.85 : 0.7,
      createdAt: new Date().toISOString()
    };
  }

  buildRuleRecord(taskId: string, executionSummary: string): RuleRecord {
    return {
      id: `rule_${Date.now()}`,
      name: '升级失败模式规则',
      summary: '当评审给出阻断或重试时，沉淀一条更安全的重规划规则。',
      conditions: [`taskId=${taskId}`],
      action: executionSummary,
      sourceTaskId: taskId,
      createdAt: new Date().toISOString()
    };
  }

  buildSkillDraft(goal: string, source: 'execution' | 'document'): SkillCard {
    const now = new Date().toISOString();
    const normalizedGoal = goal.toLowerCase();
    const isChatGoal =
      normalizedGoal.includes('你是') ||
      normalizedGoal.includes('扮演') ||
      normalizedGoal.includes('角色') ||
      normalizedGoal.includes('persona') ||
      normalizedGoal.includes('roleplay') ||
      normalizedGoal.includes('聊天');

    if (isChatGoal) {
      return {
        id: `skill_${Date.now()}`,
        name: '中文聊天角色技能',
        description: '用于处理“你是……”类设定、角色扮演和中文对话风格控制的实验技能。',
        applicableGoals: [goal],
        requiredTools: ['search_memory'],
        steps: [
          {
            title: '识别人设与语气',
            instruction: '先识别用户正在定义的角色、人设、语气和聊天边界。',
            toolNames: ['search_memory']
          },
          {
            title: '检索现有聊天技能',
            instruction: '优先检索已有聊天技能、历史记忆和相关规则，若缺失则标记为技能缺口。',
            toolNames: ['search_memory']
          },
          {
            title: '用中文稳定回复',
            instruction: '按照设定的人设和中文语境生成自然回复，并在任务结束后沉淀成技能候选。',
            toolNames: ['search_memory']
          }
        ],
        constraints: ['默认使用中文回复', '缺少现成技能时生成技能候选而不是静默忽略'],
        successSignals: ['用户获得符合设定的人设回复', '生成聊天技能候选', '后续相似对话可复用'],
        riskLevel: 'medium',
        source,
        status: 'lab',
        createdAt: now,
        updatedAt: now
      };
    }

    return {
      id: `skill_${Date.now()}`,
      name: source === 'execution' ? '多 Agent 执行模式' : '文档学习技能模式',
      description: '从主 Agent 与子 Agent 协作过程中抽取出的可复用实验技能。',
      applicableGoals: [goal],
      requiredTools: ['search_memory', 'read_local_file'],
      steps: [
        {
          title: '研究共享上下文',
          instruction: '先由研究 Agent 检索记忆、规则和可复用技能。',
          toolNames: ['search_memory', 'read_local_file']
        },
        {
          title: '带审批意识地执行',
          instruction: '由执行 Agent 选择安全工具，遇到高风险动作先暂停等待审批。',
          toolNames: ['read_local_file']
        },
        {
          title: '评审并学习',
          instruction: '由评审 Agent 判断质量，并决定是否写回记忆、规则或技能。',
          toolNames: ['search_memory']
        }
      ],
      constraints: ['写入类动作需要审批', '外部请求需要审批'],
      successSignals: ['评审通过结果', '成功写入记忆', '实验技能可再次复用'],
      riskLevel: 'medium',
      source,
      status: 'lab',
      createdAt: now,
      updatedAt: now
    };
  }
}
