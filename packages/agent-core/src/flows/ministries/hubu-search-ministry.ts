import {
  AgentExecutionState,
  AgentRole,
  EvidenceRecord,
  MemoryRecord,
  SkillCard,
  SpecialistFindingRecord
} from '@agent/shared';

import { AgentRuntimeContext } from '../../runtime/agent-runtime-context';
import { safeGenerateObject, type StructuredContractMeta } from '../../shared/schemas/safe-generate-object';
import { HUBU_RESEARCH_SYSTEM_PROMPT } from './hubu-search/prompts/research-prompts';
import { ResearchEvidenceOutput, ResearchEvidenceSchema } from './hubu-search/schemas/research-evidence-schema';

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

export class HubuSearchMinistry {
  private readonly state: AgentExecutionState;

  constructor(private readonly context: AgentRuntimeContext) {
    this.state = {
      agentId: `hubu_search_${context.taskId}`,
      role: AgentRole.RESEARCH,
      goal: context.goal,
      plan: [],
      toolCalls: [],
      observations: [],
      shortTermMemory: [],
      longTermMemoryRefs: [],
      status: 'idle'
    };
  }

  async research(subTask: string): Promise<{
    summary: string;
    memories: MemoryRecord[];
    knowledgeEvidence: EvidenceRecord[];
    skills: SkillCard[];
    specialistFinding?: SpecialistFindingRecord;
    contractMeta: StructuredContractMeta;
  }> {
    this.state.status = 'running';
    this.state.subTask = subTask;
    const retrieved = this.context.memorySearchService
      ? await this.context.memorySearchService.search(this.context.goal, 5)
      : {
          memories: await this.context.memoryRepository.search(this.context.goal, 5),
          rules: []
        };
    const memories = retrieved.memories;
    const rules = retrieved.rules;
    const knowledgeHits = this.context.knowledgeSearchService
      ? await this.context.knowledgeSearchService.search(this.context.goal, 5)
      : [];
    const knowledgeEvidence = knowledgeHits.map(hit => ({
      id: `knowledge:${hit.chunkId}`,
      taskId: this.context.taskId,
      sourceId: hit.sourceId,
      sourceType: 'document',
      sourceUrl: hit.uri,
      trustClass: 'internal' as const,
      summary: `藏经阁命中 ${hit.title}`,
      detail: {
        knowledgeStore: 'cangjing',
        chunkId: hit.chunkId,
        documentId: hit.documentId,
        score: hit.score,
        excerpt: hit.content.slice(0, 320)
      },
      createdAt: new Date().toISOString()
    }));
    const skills = await this.context.skillRegistry.list();
    const chatGoal = isChatPersonaGoal(this.context.goal);
    const matchedChatSkills = chatGoal ? skills.filter(isChatSkill) : [];
    const researchMemories = memories.filter(memory => memory.tags.includes('research-job'));
    const autoPersistedResearchMemories = researchMemories.filter(memory => memory.tags.includes('auto-persist'));
    this.state.longTermMemoryRefs = memories.map(item => item.id);
    this.state.plan = ['检索文渊阁长期记忆', '检索藏经阁本地文档切片', '检查可用技能', '输出中文研究结论'];

    const structuredResearch = await safeGenerateObject<ResearchEvidenceOutput>({
      contractName: 'research-evidence',
      contractVersion: 'research-evidence.v1',
      isConfigured: this.context.llm.isConfigured(),
      schema: ResearchEvidenceSchema,
      invoke: async () =>
        this.context.llm.generateObject(
          [
            {
              role: 'system',
              content: HUBU_RESEARCH_SYSTEM_PROMPT
            },
            {
              role: 'user',
              content: JSON.stringify({
                goal: this.context.goal,
                subTask,
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
          ResearchEvidenceSchema,
          {
            role: 'research',
            taskId: this.context.taskId,
            modelId: this.context.currentWorker?.defaultModel,
            budgetState: this.context.budgetState,
            thinking: this.context.thinking.research,
            temperature: 0.1,
            onUsage: usage => {
              this.context.onUsage?.({
                usage,
                role: 'research'
              });
            }
          }
        )
    });
    const llmResearch = structuredResearch.object;

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
      ...(knowledgeHits.length > 0
        ? [`同时命中 ${knowledgeHits.length} 条藏经阁文档切片，可作为受控来源文档证据`]
        : ['当前没有命中可检索的藏经阁文档切片']),
      `检索到 ${skills.length} 个技能`,
      ...(chatGoal
        ? [
            matchedChatSkills.length > 0
              ? `已发现 ${matchedChatSkills.length} 个可复用聊天技能`
              : '尚未发现可复用的聊天技能，后续应补充聊天技能候选'
          ]
        : [])
    ];

    this.state.observations = [...observations];
    this.state.shortTermMemory = [...observations];

    const fallbackSummary = chatGoal
      ? matchedChatSkills.length > 0
        ? `户部研究完成：已找到 ${matchedChatSkills.length} 个与聊天/角色设定相关的技能，可优先复用这些技能来响应“你是……”这类目标。`
        : '户部研究完成：当前还没有现成的聊天技能可复用，建议本轮先以中文完成对话任务，并在结束后生成聊天技能候选进入学习确认。'
      : researchMemories.length > 0
        ? `户部研究完成：检索到 ${memories.length} 条文渊阁记忆，其中 ${researchMemories.length} 条来自主动研究沉淀；另命中 ${knowledgeHits.length} 条藏经阁文档切片。`
        : `户部研究完成：检索到 ${memories.length} 条文渊阁记忆、${knowledgeHits.length} 条藏经阁文档切片和 ${skills.length} 个可复用技能。`;

    const summary = llmResearch?.summary ?? fallbackSummary;
    this.state.finalOutput = summary;
    this.state.status = 'completed';
    const specialistFinding = llmResearch?.specialistFinding
      ? ({
          ...llmResearch.specialistFinding,
          contractVersion: 'specialist-finding.v1',
          source: 'research',
          stage: 'research'
        } satisfies SpecialistFindingRecord)
      : undefined;

    return { summary, memories, knowledgeEvidence, skills, specialistFinding, contractMeta: structuredResearch.meta };
  }

  getState(): AgentExecutionState {
    return this.state;
  }
}
