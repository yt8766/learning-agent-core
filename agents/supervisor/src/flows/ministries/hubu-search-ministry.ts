import { AgentExecutionState, SkillCard, SpecialistFindingRecord } from '@agent/core';
import { type ExecutionStepRecord, StreamingExecutionCoordinator } from '@agent/runtime';

import { AgentRuntimeContext } from '../../runtime/agent-runtime-context';
import { type StructuredContractMeta } from '@agent/adapters';
import { AgentRole } from '../supervisor/supervisor-architecture-helpers';
import { isChatPersonaGoal, MinistryToolCallDecision, ResearchToolId } from './hubu-search/hubu-search-helpers';
import { createHubuSearchTaskMap } from './hubu-search/hubu-search-task-map';
import { generateHubuResearchEvidence } from './hubu-search/hubu-search-research-generator';
import { resolveHubuResearchToolPlan } from './hubu-search/hubu-search-tool-plan';
import type { EvidenceRecord, MemoryRecord, RuleRecord } from '@agent/memory';

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
    let rules: RuleRecord[] = [];
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
    const { taskMap, webSearchTask } = createHubuSearchTaskMap({
      context: this.context,
      memories,
      setMemories: next => {
        memories = next;
      },
      rules,
      setRules: next => {
        rules = next;
      },
      skills,
      setSkills: next => {
        skills = next;
      },
      knowledgeEvidence,
      knowledgeHits,
      toolDecisions
    });
    const availableResearchTools: ResearchToolId[] = webSearchTask
      ? ['memory-search', 'knowledge-search', 'skill-search', 'web-search']
      : ['memory-search', 'knowledge-search', 'skill-search'];
    const plannedResearchTools = await resolveHubuResearchToolPlan({
      context: this.context,
      subTask,
      availableTools: availableResearchTools
    });
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
    isChatPersonaGoal(this.context.goal);
    this.state.longTermMemoryRefs = memories.map(item => item.id);
    this.state.plan = [
      `按当前目标优先检索 ${selectedTasks.map(task => task.toolName).join(' / ')}`,
      '汇总受控来源与外部研究结果',
      '输出中文研究结论'
    ];

    const generatedResearch = await generateHubuResearchEvidence({
      context: this.context,
      subTask,
      memories,
      rules,
      skills,
      knowledgeHits,
      toolDecisions
    });
    const observations = generatedResearch.observations;
    this.state.observations = [...observations];
    this.state.shortTermMemory = [...observations];
    const summary = generatedResearch.summary;
    this.state.finalOutput = summary;
    this.state.status = 'completed';
    return {
      summary,
      memories,
      knowledgeEvidence,
      skills,
      specialistFinding: generatedResearch.specialistFinding,
      contractMeta: generatedResearch.contractMeta
    };
  }

  getState(): AgentExecutionState {
    return this.state;
  }
}
