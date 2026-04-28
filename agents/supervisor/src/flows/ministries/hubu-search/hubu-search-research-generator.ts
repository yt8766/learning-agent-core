import { safeGenerateObject, type StructuredContractMeta } from '@agent/adapters';
import { withReactiveContextRetry } from '@agent/adapters';
import { generateObjectWithRetry } from '../../../utils/llm-retry';
import type { SkillCard, SpecialistFindingRecord } from '@agent/core';
import type { MemoryRecord, RuleRecord } from '@agent/memory';
import type { AgentRuntimeContext } from '../../../runtime/agent-runtime-context';
import {
  buildResearchFallbackSummary,
  buildResearchObservations,
  isChatPersonaGoal,
  isChatSkill,
  type MinistryToolCallDecision
} from './hubu-search-helpers';
import { HUBU_RESEARCH_SYSTEM_PROMPT } from './prompts/research-prompts';
import { type ResearchEvidenceOutput, ResearchEvidenceSchema } from './schemas/research-evidence-schema';

export async function generateHubuResearchEvidence(params: {
  context: AgentRuntimeContext;
  subTask: string;
  memories: MemoryRecord[];
  rules: RuleRecord[];
  skills: SkillCard[];
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
}): Promise<{
  summary: string;
  observations: string[];
  specialistFinding?: SpecialistFindingRecord;
  contractMeta: StructuredContractMeta;
}> {
  const chatGoal = isChatPersonaGoal(params.context.goal);
  const matchedChatSkills = chatGoal ? params.skills.filter(isChatSkill) : [];
  const researchMemories = params.memories.filter(memory => memory.tags.includes('research-job'));

  const structuredResearch = await safeGenerateObject<ResearchEvidenceOutput>({
    contractName: 'research-evidence',
    contractVersion: 'research-evidence.v1',
    isConfigured: params.context.llm.isConfigured(),
    schema: ResearchEvidenceSchema,
    invoke: async () =>
      withReactiveContextRetry({
        context: params.context,
        trigger: 'hubu-research',
        messages: [
          {
            role: 'system',
            content: HUBU_RESEARCH_SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: JSON.stringify({
              goal: params.context.goal,
              subTask: params.subTask,
              memories: params.memories.map(item => ({ id: item.id, summary: item.summary, tags: item.tags })),
              skills: params.skills.map(item => ({
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
        invoke: async retryMessages =>
          generateObjectWithRetry({
            llm: params.context.llm,
            contractName: 'research-evidence',
            contractVersion: 'research-evidence.v1',
            messages: retryMessages,
            schema: ResearchEvidenceSchema,
            options: {
              role: 'research',
              taskId: params.context.taskId,
              modelId: params.context.currentWorker?.defaultModel,
              budgetState: params.context.budgetState,
              thinking: params.context.thinking.research,
              temperature: 0.1,
              onUsage: usage => {
                params.context.onUsage?.({
                  usage,
                  role: 'research'
                });
              }
            }
          })
      })
  });
  const llmResearch = structuredResearch.object;

  const observations =
    llmResearch?.observations ??
    buildResearchObservations({
      memories: params.memories,
      rules: params.rules,
      skills: params.skills,
      knowledgeHitCount: params.knowledgeHits.length,
      toolDecisions: params.toolDecisions,
      chatGoal,
      matchedChatSkillCount: matchedChatSkills.length
    });

  const fallbackSummary = buildResearchFallbackSummary({
    chatGoal,
    matchedChatSkillCount: matchedChatSkills.length,
    memoryCount: params.memories.length,
    researchMemoryCount: researchMemories.length,
    knowledgeHitCount: params.knowledgeHits.length,
    skillCount: params.skills.length
  });

  const specialistFinding = llmResearch?.specialistFinding
    ? ({
        ...llmResearch.specialistFinding,
        contractVersion: 'specialist-finding.v1',
        source: 'research',
        stage: 'research'
      } satisfies SpecialistFindingRecord)
    : undefined;

  return {
    summary: llmResearch?.summary ?? fallbackSummary,
    observations,
    specialistFinding,
    contractMeta: structuredResearch.meta
  };
}
