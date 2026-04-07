import {
  ActionIntent,
  AgentExecutionState,
  AgentRole,
  EvidenceRecord,
  MemoryRecord,
  SkillCard,
  SpecialistFindingRecord,
  ToolExecutionResult
} from '@agent/shared';
import { z } from 'zod/v4';

import { AgentRuntimeContext } from '../../runtime/agent-runtime-context';
import { ExecutionStepRecord, StreamingExecutionCoordinator } from '../../runtime/streaming-execution';
import { withReactiveContextRetry } from '../../utils/reactive-context-retry';
import { safeGenerateObject, type StructuredContractMeta } from '../../utils/schemas/safe-generate-object';
import { HUBU_RESEARCH_SYSTEM_PROMPT } from './hubu-search/prompts/research-prompts';
import { ResearchEvidenceOutput, ResearchEvidenceSchema } from './hubu-search/schemas/research-evidence-schema';

const RESEARCH_TOOL_IDS = ['memory-search', 'knowledge-search', 'skill-search', 'web-search'] as const;

type ResearchToolId = (typeof RESEARCH_TOOL_IDS)[number];

const ResearchToolPlanSchema = z.object({
  primaryTool: z.enum(RESEARCH_TOOL_IDS),
  followupTools: z.array(z.enum(RESEARCH_TOOL_IDS)).max(3).default([]),
  rationale: z.string().min(1).default('按当前目标优先选择最相关的研究来源。')
});

interface MinistryToolCallDecision {
  toolName: string;
  rationale: string;
  source: 'llm' | 'heuristic';
}

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
  private readonly streamingCoordinator = new StreamingExecutionCoordinator();

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
    const knowledgeEvidence: EvidenceRecord[] = [];
    let memories: MemoryRecord[] = [];
    let rules: any[] = [];
    let skills: SkillCard[] = [];
    const toolDecisions: MinistryToolCallDecision[] = [];
    const knowledgeHits: Array<{
      chunkId: string;
      documentId: string;
      sourceId: string;
      uri: string;
      title: string;
      sourceType: string;
      content: string;
      score: number;
    }> = [];
    const taskMap: Partial<Record<ResearchToolId, ExecutionStepRecord<Record<string, unknown>, unknown>>> = {
      'memory-search': {
        id: 'memory-search',
        toolName: 'search_memory',
        source: 'HubuSearchMinistry',
        ministry: this.context.currentWorker?.ministry,
        inputPreview: { query: this.context.goal },
        streamingEligible: true,
        expectedSideEffect: 'none',
        tool: {
          name: 'search_memory',
          isReadOnly: true,
          isConcurrencySafe: true,
          isDestructive: false,
          supportsStreamingDispatch: true
        },
        run: async () => {
          const retrieved = this.context.memorySearchService
            ? await this.context.memorySearchService.search(this.context.goal, 5)
            : {
                memories: await this.context.memoryRepository.search(this.context.goal, 5),
                rules: []
              };
          memories = retrieved.memories;
          rules = retrieved.rules;
          return retrieved;
        }
      },
      'knowledge-search': {
        id: 'knowledge-search',
        toolName: 'search_doc',
        source: 'HubuSearchMinistry',
        ministry: this.context.currentWorker?.ministry,
        inputPreview: { query: this.context.goal },
        streamingEligible: true,
        expectedSideEffect: 'none',
        tool: {
          name: 'search_doc',
          isReadOnly: true,
          isConcurrencySafe: true,
          isDestructive: false,
          supportsStreamingDispatch: true
        },
        run: async () => {
          const hits = this.context.knowledgeSearchService
            ? await this.context.knowledgeSearchService.search(this.context.goal, 5)
            : [];
          knowledgeHits.push(...hits);
          knowledgeEvidence.push(
            ...hits.map(hit => ({
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
            }))
          );
          return hits;
        }
      },
      'skill-search': {
        id: 'skill-search',
        toolName: 'find-skills',
        source: 'HubuSearchMinistry',
        ministry: this.context.currentWorker?.ministry,
        inputPreview: { query: this.context.goal },
        streamingEligible: true,
        expectedSideEffect: 'none',
        tool: {
          name: 'find-skills',
          isReadOnly: true,
          isConcurrencySafe: true,
          isDestructive: false,
          supportsStreamingDispatch: true
        },
        run: async () => {
          skills = await this.context.skillRegistry.list();
          return skills;
        }
      }
    };

    const webSearchTask = this.buildWebSearchTask(knowledgeEvidence);
    const availableResearchTools: ResearchToolId[] = webSearchTask
      ? ['memory-search', 'knowledge-search', 'skill-search', 'web-search']
      : ['memory-search', 'knowledge-search', 'skill-search'];
    const plannedResearchTools = await this.resolveResearchToolPlan(subTask, availableResearchTools);
    const selectedTasks = plannedResearchTools
      .filter(toolId => toolId !== 'web-search' || Boolean(webSearchTask))
      .map(toolId => {
        const task = toolId === 'web-search' ? webSearchTask : taskMap[toolId];
        if (!task) {
          return undefined;
        }
        toolDecisions.push({
          toolName: task.toolName,
          rationale: `户部优先采用 ${task.toolName} 作为研究来源。`,
          source: this.context.llm.isConfigured() ? 'llm' : 'heuristic'
        });
        return task;
      })
      .filter((task): task is ExecutionStepRecord<Record<string, unknown>, unknown> => Boolean(task));

    const { events } = await this.streamingCoordinator.run<unknown>(selectedTasks, {
      shouldContinue: () => !this.context.isTaskCancelled?.()
    });
    for (const event of events) {
      this.state.toolCalls.push(`${event.type}:${event.toolName}`);
      if (event.type === 'tool_stream_dispatched') {
        this.state.observations.push(`户部已流式派发 ${event.toolName}（${event.scheduling}）`);
      }
    }
    const chatGoal = isChatPersonaGoal(this.context.goal);
    const matchedChatSkills = chatGoal ? skills.filter(isChatSkill) : [];
    const researchMemories = memories.filter(memory => memory.tags.includes('research-job'));
    const autoPersistedResearchMemories = researchMemories.filter(memory => memory.tags.includes('auto-persist'));
    this.state.longTermMemoryRefs = memories.map(item => item.id);
    this.state.plan = [
      `按当前目标优先检索 ${selectedTasks.map(task => task.toolName).join(' / ')}`,
      '汇总受控来源与外部研究结果',
      '输出中文研究结论'
    ];

    const structuredResearch = await safeGenerateObject<ResearchEvidenceOutput>({
      contractName: 'research-evidence',
      contractVersion: 'research-evidence.v1',
      isConfigured: this.context.llm.isConfigured(),
      schema: ResearchEvidenceSchema,
      messages: [
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
      invokeWithMessages: async messages =>
        withReactiveContextRetry({
          context: this.context,
          trigger: 'hubu-research',
          messages,
          invoke: async retryMessages =>
            this.context.llm.generateObject(retryMessages, ResearchEvidenceSchema, {
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
            })
        })
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
      ...(toolDecisions.length > 0
        ? [`本轮户部动态选择的研究能力：${toolDecisions.map(item => item.toolName).join(' / ')}`]
        : []),
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

  private async resolveResearchToolPlan(subTask: string, availableTools: ResearchToolId[]): Promise<ResearchToolId[]> {
    const heuristicPlan = this.buildHeuristicResearchPlan(availableTools);

    if (!this.context.llm.isConfigured()) {
      return heuristicPlan;
    }

    const llmPlan = await safeGenerateObject<z.infer<typeof ResearchToolPlanSchema>>({
      contractName: 'research-tool-plan',
      contractVersion: 'research-tool-plan.v1',
      isConfigured: this.context.llm.isConfigured(),
      schema: ResearchToolPlanSchema,
      messages: [
        {
          role: 'system',
          content: '你是户部研究调度器。只从给定工具名单中选择最合适的研究工具顺序，优先受控来源。'
        },
        {
          role: 'user',
          content: JSON.stringify({
            goal: this.context.goal,
            subTask,
            availableTools
          })
        }
      ],
      invokeWithMessages: async messages =>
        withReactiveContextRetry({
          context: this.context,
          trigger: 'hubu-tool-plan',
          messages,
          invoke: async retryMessages =>
            this.context.llm.generateObject(retryMessages, ResearchToolPlanSchema, {
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
            })
        })
    });

    const llmTools = llmPlan.object
      ? [llmPlan.object.primaryTool, ...llmPlan.object.followupTools].filter(
          (tool, index, list): tool is ResearchToolId => availableTools.includes(tool) && list.indexOf(tool) === index
        )
      : [];

    return llmTools.length > 0 ? llmTools : heuristicPlan;
  }

  private buildHeuristicResearchPlan(availableTools: ResearchToolId[]): ResearchToolId[] {
    const goal = this.context.goal.toLowerCase();
    const ranked: ResearchToolId[] = [];

    if (/(最新|最近|today|latest|recent|本周|今天|近况)/i.test(goal) && availableTools.includes('web-search')) {
      ranked.push('web-search');
    }
    if (/(文档|架构|规范|repo|repository|源码|runtime|knowledge|设计)/i.test(goal)) {
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

  private buildWebSearchTask(knowledgeEvidence: EvidenceRecord[]) {
    const canUseWebSearch =
      this.context.mcpClientManager?.hasCapability('webSearchPrime') ||
      Boolean(this.context.toolRegistry?.get?.('webSearchPrime'));
    if (!canUseWebSearch) {
      return undefined;
    }

    return {
      id: 'web-search',
      toolName: 'webSearchPrime',
      source: 'HubuSearchMinistry',
      ministry: this.context.currentWorker?.ministry,
      inputPreview: { query: this.context.goal },
      streamingEligible: true,
      expectedSideEffect: 'none',
      tool: {
        name: 'webSearchPrime',
        isReadOnly: true,
        isConcurrencySafe: true,
        isDestructive: false,
        supportsStreamingDispatch: true
      },
      run: async () => {
        const request = {
          taskId: this.context.taskId,
          toolName: 'webSearchPrime',
          intent: ActionIntent.READ_FILE,
          input: {
            query: this.context.goal,
            freshnessHint: /(最新|最近|today|latest|recent|本周|今天|近况)/i.test(this.context.goal)
              ? 'latest'
              : 'general'
          },
          requestedBy: 'agent' as const
        };
        const result: ToolExecutionResult = this.context.mcpClientManager
          ? await this.context.mcpClientManager.invokeCapability('webSearchPrime', request)
          : await this.context.sandbox.execute(request);
        const results = Array.isArray((result.rawOutput as { results?: unknown[] } | undefined)?.results)
          ? (result.rawOutput as { results: Array<{ url?: string; title?: string; summary?: string }> }).results
          : [];
        knowledgeEvidence.push(
          ...results
            .filter(item => typeof item.url === 'string')
            .slice(0, 3)
            .map((item, index) => ({
              id: `web:${this.context.taskId}:${index}`,
              taskId: this.context.taskId,
              sourceId: item.url!,
              sourceType: 'web',
              sourceUrl: item.url!,
              trustClass: 'unverified' as const,
              summary: item.title ?? '网页搜索结果',
              detail: {
                query: this.context.goal,
                excerpt: item.summary
              },
              createdAt: new Date().toISOString()
            }))
        );
        return result;
      }
    };
  }
}
