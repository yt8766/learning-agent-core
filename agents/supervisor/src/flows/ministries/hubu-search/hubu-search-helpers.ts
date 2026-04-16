import type { MemoryRecord, RuleRecord, SkillCard } from '@agent/shared';
import { z } from 'zod/v4';

export const RESEARCH_TOOL_IDS = ['memory-search', 'knowledge-search', 'skill-search', 'web-search'] as const;

export type ResearchToolId = (typeof RESEARCH_TOOL_IDS)[number];

export const ResearchToolPlanSchema = z.object({
  primaryTool: z.enum(RESEARCH_TOOL_IDS),
  followupTools: z.array(z.enum(RESEARCH_TOOL_IDS)).max(3).default([]),
  rationale: z.string().min(1).default('按当前目标优先选择最相关的研究来源。')
});

export interface MinistryToolCallDecision {
  toolName: string;
  rationale: string;
  source: 'llm' | 'heuristic';
}

export function isChatPersonaGoal(goal: string) {
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

export function isChatSkill(skill: SkillCard) {
  const text = `${skill.name} ${skill.description} ${skill.applicableGoals.join(' ')}`.toLowerCase();
  return (
    text.includes('聊天') ||
    text.includes('对话') ||
    text.includes('角色') ||
    text.includes('persona') ||
    text.includes('roleplay')
  );
}

export function buildHeuristicResearchPlan(goal: string, availableTools: ResearchToolId[]): ResearchToolId[] {
  const normalizedGoal = goal.toLowerCase();
  const ranked: ResearchToolId[] = [];

  if (/(最新|最近|today|latest|recent|本周|今天|近况)/i.test(normalizedGoal) && availableTools.includes('web-search')) {
    ranked.push('web-search');
  }
  if (/(文档|架构|规范|repo|repository|源码|runtime|knowledge|设计)/i.test(normalizedGoal)) {
    ranked.push('knowledge-search');
  }
  ranked.push('memory-search', 'skill-search');
  if (availableTools.includes('web-search')) {
    ranked.push('web-search');
  }

  return Array.from(new Set(ranked))
    .filter(tool => availableTools.includes(tool))
    .slice(0, 4);
}

export function buildResearchObservations(params: {
  memories: MemoryRecord[];
  rules: RuleRecord[];
  skills: SkillCard[];
  knowledgeHitCount: number;
  toolDecisions: MinistryToolCallDecision[];
  chatGoal: boolean;
  matchedChatSkillCount: number;
}) {
  const researchMemories = params.memories.filter(memory => memory.tags.includes('research-job'));
  const autoPersistedResearchMemories = researchMemories.filter(memory => memory.tags.includes('auto-persist'));

  return [
    `检索到 ${params.memories.length} 条记忆`,
    ...(params.rules.length > 0 ? [`同时命中 ${params.rules.length} 条规则，可作为本轮执行约束`] : []),
    ...(researchMemories.length > 0
      ? [
          `其中 ${researchMemories.length} 条来自此前主动研究沉淀的记忆`,
          autoPersistedResearchMemories.length > 0
            ? `${autoPersistedResearchMemories.length} 条为高置信自动沉淀结果，可优先复用`
            : '当前主动研究记忆还没有高置信自动沉淀结果'
        ]
      : []),
    ...(params.knowledgeHitCount > 0
      ? [`同时命中 ${params.knowledgeHitCount} 条藏经阁文档切片，可作为受控来源文档证据`]
      : ['当前没有命中可检索的藏经阁文档切片']),
    `检索到 ${params.skills.length} 个技能`,
    ...(params.toolDecisions.length > 0
      ? [`本轮户部动态选择的研究能力：${params.toolDecisions.map(item => item.toolName).join(' / ')}`]
      : []),
    ...(params.chatGoal
      ? [
          params.matchedChatSkillCount > 0
            ? `已发现 ${params.matchedChatSkillCount} 个可复用聊天技能`
            : '尚未发现可复用的聊天技能，后续应补充聊天技能候选'
        ]
      : [])
  ];
}

export function buildResearchFallbackSummary(params: {
  chatGoal: boolean;
  matchedChatSkillCount: number;
  memoryCount: number;
  researchMemoryCount: number;
  knowledgeHitCount: number;
  skillCount: number;
}) {
  if (params.chatGoal) {
    return params.matchedChatSkillCount > 0
      ? `户部研究完成：已找到 ${params.matchedChatSkillCount} 个与聊天/角色设定相关的技能，可优先复用这些技能来响应“你是……”这类目标。`
      : '户部研究完成：当前还没有现成的聊天技能可复用，建议本轮先以中文完成对话任务，并在结束后生成聊天技能候选进入学习确认。';
  }

  if (params.researchMemoryCount > 0) {
    return `户部研究完成：检索到 ${params.memoryCount} 条文渊阁记忆，其中 ${params.researchMemoryCount} 条来自主动研究沉淀；另命中 ${params.knowledgeHitCount} 条藏经阁文档切片。`;
  }

  return `户部研究完成：检索到 ${params.memoryCount} 条文渊阁记忆、${params.knowledgeHitCount} 条藏经阁文档切片和 ${params.skillCount} 个可复用技能。`;
}
