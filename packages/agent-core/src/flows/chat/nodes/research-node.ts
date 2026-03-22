import { z } from 'zod/v4';

import { AgentRole, MemoryRecord, SkillCard } from '@agent/shared';

import { AgentRuntimeContext } from '../../../runtime/agent-runtime-context';
import { BaseAgent } from '../base-agent';

function isChatPersonaGoal(goal: string) {
  const normalized = goal.toLowerCase();
  return (
    normalized.includes('你是') ||
    normalized.includes('扮演') ||
    normalized.includes('角色') ||
    normalized.includes('persona') ||
    normalized.includes('roleplay') ||
    normalized.includes('聊天')
  );
}

function isChatSkill(skill: SkillCard) {
  const text = `${skill.name} ${skill.description} ${skill.applicableGoals.join(' ')}`.toLowerCase();
  return (
    text.includes('聊天') ||
    text.includes('对话') ||
    text.includes('角色') ||
    text.includes('persona') ||
    text.includes('roleplay')
  );
}

export class ResearchAgent extends BaseAgent {
  constructor(context: AgentRuntimeContext) {
    super(AgentRole.RESEARCH, context);
  }

  async run(subTask: string): Promise<{ summary: string; memories: MemoryRecord[]; skills: SkillCard[] }> {
    this.setStatus('running');
    this.setSubTask(subTask);
    const memories = await this.context.memoryRepository.search(this.context.goal, 5);
    const skills = await this.context.skillRegistry.list();
    const chatGoal = isChatPersonaGoal(this.context.goal);
    const matchedChatSkills = chatGoal ? skills.filter(isChatSkill) : [];
    this.state.longTermMemoryRefs = memories.map(item => item.id);
    this.state.plan = ['检索共享长期记忆', '检查可用技能', '输出中文研究结论'];

    const researchSchema = z.object({
      summary: z.string(),
      observations: z.array(z.string()).max(5).default([])
    });

    const llmResearch = await this.generateObject(
      [
        {
          role: 'system',
          content:
            '你是研究 Agent。请始终使用中文，把记忆、规则和技能上下文整理成对执行 Agent 有帮助的行动建议。如果用户在定义“你是……”这类聊天角色，也要明确说明是否已经存在可复用的聊天技能。'
        },
        {
          role: 'user',
          content: JSON.stringify({
            goal: this.context.goal,
            memories: memories.map(item => ({ id: item.id, summary: item.summary, tags: item.tags })),
            skills: skills.map(item => ({
              id: item.id,
              name: item.name,
              status: item.status,
              description: item.description
            })),
            chatGoal,
            matchedChatSkillCount: matchedChatSkills.length
          })
        }
      ],
      researchSchema,
      {
        role: 'research',
        thinking: this.context.thinking.research
      }
    );

    const observations = llmResearch?.observations ?? [
      `检索到 ${memories.length} 条记忆`,
      `检索到 ${skills.length} 个技能`,
      ...(chatGoal
        ? [
            matchedChatSkills.length > 0
              ? `已发现 ${matchedChatSkills.length} 个可复用聊天技能`
              : '尚未发现可复用的聊天技能，后续应补充聊天技能候选'
          ]
        : [])
    ];

    for (const observation of observations) {
      this.remember(observation);
    }

    const fallbackSummary = chatGoal
      ? matchedChatSkills.length > 0
        ? `研究完成：已找到 ${matchedChatSkills.length} 个与聊天/角色设定相关的技能，可优先复用这些技能来响应“你是……”这类目标。`
        : '研究完成：当前还没有现成的聊天技能可复用，建议本轮先以中文完成对话任务，并在结束后生成聊天技能候选进入学习确认。'
      : `研究完成：检索到 ${memories.length} 条记忆和 ${skills.length} 个可复用技能。`;

    const summary = llmResearch?.summary ?? fallbackSummary;
    this.state.finalOutput = summary;
    this.setStatus('completed');
    return { summary, memories, skills };
  }
}
