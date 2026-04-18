import type { EvidenceRecord, MemoryRecord, RuleRecord, SkillCard } from '@agent/core';
import type { ExecutionStepRecord } from '@agent/agent-kit';
import type { AgentRuntimeContext } from '../../../runtime/agent-runtime-context';
import { searchHubuMemories } from './hubu-memory-search';
import { buildHubuWebSearchTask } from './hubu-web-search';
import type { MinistryToolCallDecision, ResearchToolId } from './hubu-search-helpers';

export function createHubuSearchTaskMap(params: {
  context: AgentRuntimeContext;
  memories: MemoryRecord[];
  setMemories: (memories: MemoryRecord[]) => void;
  rules: RuleRecord[];
  setRules: (rules: RuleRecord[]) => void;
  skills: SkillCard[];
  setSkills: (skills: SkillCard[]) => void;
  knowledgeEvidence: EvidenceRecord[];
  knowledgeHits: Array<{
    chunkId: string;
    documentId: string;
    sourceId: string;
    uri: string;
    title: string;
    sourceType: string;
    content: string;
    score: number;
  }>;
  toolDecisions: MinistryToolCallDecision[];
}) {
  const taskMap: Partial<Record<ResearchToolId, ExecutionStepRecord<Record<string, unknown>, unknown>>> = {
    'memory-search': {
      id: 'memory-search',
      toolName: 'search_memory',
      source: 'HubuSearchMinistry',
      ministry: params.context.currentWorker?.ministry,
      inputPreview: { query: params.context.goal },
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
        const retrieved = await searchHubuMemories({
          goal: params.context.goal,
          taskId: params.context.taskId,
          memoryRepository: params.context.memoryRepository,
          memorySearchService: params.context.memorySearchService
        });
        params.setMemories(retrieved.memories);
        params.setRules(retrieved.rules);
        params.knowledgeEvidence.push(
          ...retrieved.reflections.map((reflection, index) => ({
            id: `hubu-reflection:${params.context.taskId}:${index}`,
            taskId: params.context.taskId,
            sourceId: reflection.id,
            sourceType: 'memory_reuse',
            trustClass: 'internal' as const,
            summary: `已命中历史反思：${reflection.summary}`,
            detail: {
              reflectionKind: reflection.kind,
              whatFailed: reflection.whatFailed,
              nextAttemptAdvice: reflection.nextAttemptAdvice
            },
            createdAt: new Date().toISOString()
          }))
        );
        return retrieved;
      }
    },
    'knowledge-search': {
      id: 'knowledge-search',
      toolName: 'search_doc',
      source: 'HubuSearchMinistry',
      ministry: params.context.currentWorker?.ministry,
      inputPreview: { query: params.context.goal },
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
        const hits = params.context.knowledgeSearchService
          ? await params.context.knowledgeSearchService.search(params.context.goal, 5)
          : [];
        params.knowledgeHits.push(...hits);
        params.knowledgeEvidence.push(
          ...hits.map(hit => ({
            id: `knowledge:${hit.chunkId}`,
            taskId: params.context.taskId,
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
      ministry: params.context.currentWorker?.ministry,
      inputPreview: { query: params.context.goal },
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
        const skills = await params.context.skillRegistry.list();
        params.setSkills(skills);
        return skills;
      }
    }
  };

  const webSearchTask = buildHubuWebSearchTask(params.context, params.knowledgeEvidence);

  return { taskMap, webSearchTask };
}
