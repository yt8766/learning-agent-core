import { AgentRole, MemoryRecord, SkillCard } from '@agent/shared';

import { AgentRuntimeContext } from '../../../runtime/agent-runtime-context';
import {
  buildResearchUserPrompt,
  HUBU_RESEARCH_SYSTEM_PROMPT
} from '../../ministries/hubu-search/prompts/research-prompts';
import { ResearchEvidenceSchema } from '../../ministries/hubu-search/schemas/research-evidence-schema';
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
    const retrieved = this.context.memorySearchService
      ? await this.context.memorySearchService.search(this.context.goal, 5)
      : {
          memories: await this.context.memoryRepository.search(this.context.goal, 5),
          rules: []
        };
    const memories = retrieved.memories;
    const rules = retrieved.rules;
    const skills = await this.context.skillRegistry.list();
    const chatGoal = isChatPersonaGoal(this.context.goal);
    const matchedChatSkills = chatGoal ? skills.filter(isChatSkill) : [];
    const researchMemories = memories.filter(memory => memory.tags.includes('research-job'));
    const autoPersistedResearchMemories = researchMemories.filter(memory => memory.tags.includes('auto-persist'));
    this.state.longTermMemoryRefs = memories.map(item => item.id);
    this.state.plan = ['检索共享长期记忆', '检查可用技能', '输出中文研究结论'];

    const llmResearch = await this.generateObject(
      [
        {
          role: 'system',
          content: HUBU_RESEARCH_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: buildResearchUserPrompt({
            goal: this.context.goal,
            taskContext: this.context.taskContext,
            memories: memories.map(item => ({ id: item.id, summary: item.summary, tags: item.tags })),
            rules: rules.map(item => ({
              id: item.id,
              name: item.name,
              summary: item.summary,
              conditions: item.conditions,
              action: item.action
            })),
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
      ResearchEvidenceSchema,
      {
        role: 'research',
        thinking: this.context.thinking.research
      }
    );

    const observations = llmResearch?.observations ?? [
      `检索到 ${memories.length} 条记忆`,
      ...(rules.length > 0 ? [`同时命中 ${rules.length} 条规则，可作为本轮执行约束`] : []),
      ...(researchMemories.length > 0
        ? [
            `其中 ${researchMemories.length} 条来自此前主动研究沉淀的记忆`,
            autoPersistedResearchMemories.length > 0
              ? `${autoPersistedResearchMemories.length} 条为高置信自动沉淀结果，可优先复用`
              : '当前主动研究记忆还没有高置信自动沉淀结果'
          ]
        : []),
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
      : researchMemories.length > 0
        ? `研究完成：检索到 ${memories.length} 条记忆，其中 ${researchMemories.length} 条来自主动研究沉淀，可优先复用历史资料。`
        : `研究完成：检索到 ${memories.length} 条记忆和 ${skills.length} 个可复用技能。`;

    const summary = llmResearch?.summary ?? fallbackSummary;
    this.state.finalOutput = summary;
    this.setStatus('completed');
    return { summary, memories, skills };
  }
}
