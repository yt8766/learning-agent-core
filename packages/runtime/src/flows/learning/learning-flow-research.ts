import type { LearningEvaluationRecord, MemoryRecord } from '@agent/core';
import type { MemoryRepository } from '@agent/memory';
import type { RuntimeLearningJob as LearningJob } from '../../runtime/runtime-learning.types';

export function evaluateResearchJob(job: LearningJob): LearningEvaluationRecord {
  const sources = job.sources ?? [];
  const externalSourceCount = sources.filter(source => source.trustClass !== 'internal').length;
  const internalSourceCount = sources.filter(source => source.trustClass === 'internal').length;
  const officialCount = sources.filter(source => source.trustClass === 'official').length;
  const curatedCount = sources.filter(source => source.trustClass === 'curated').length;
  const communityCount = sources.filter(source => source.trustClass === 'community').length;

  const score = Math.max(
    0,
    Math.min(100, officialCount * 20 + curatedCount * 12 + communityCount * 5 + internalSourceCount * 4)
  );
  const confidence = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
  const notes = [
    officialCount > 0 ? `本轮研究命中了 ${officialCount} 条官方来源。` : '本轮研究未命中官方来源。',
    curatedCount > 0 ? `补充了 ${curatedCount} 条 curated 来源。` : '没有补充 curated 来源。',
    communityCount > 0 ? `社区来源 ${communityCount} 条，后续需要人工复核。` : '没有使用社区来源。'
  ];

  return {
    score,
    confidence,
    notes,
    recommendedCandidateIds: [],
    autoConfirmCandidateIds: [],
    sourceSummary: {
      externalSourceCount,
      internalSourceCount,
      reusedMemoryCount: 0,
      reusedRuleCount: 0,
      reusedSkillCount: 0
    }
  };
}

export async function autoPersistResearchMemory(
  memoryRepository: MemoryRepository,
  job: LearningJob,
  evaluation: LearningEvaluationRecord,
  policy: 'manual' | 'high-confidence'
): Promise<string[]> {
  const conflicts = await memoryRepository.search(job.goal ?? job.summary ?? job.documentUri, 3);
  const effectiveConflicts = conflicts.filter(
    memory => memory.tags.includes('research-job') || memory.summary === job.summary
  );
  if (effectiveConflicts.length > 0) {
    job.conflictDetected = true;
    job.conflictNotes = effectiveConflicts.map(memory => `已存在相似 research memory：${memory.id}`);
    job.autoPersistEligible = false;
    job.persistedMemoryIds = [];
    job.learningEvaluation = {
      ...evaluation,
      governanceWarnings: [...(evaluation.governanceWarnings ?? []), ...job.conflictNotes]
    };
    return [];
  }

  if (policy !== 'high-confidence' || evaluation.confidence !== 'high') {
    job.autoPersistEligible = false;
    job.persistedMemoryIds = [];
    return [];
  }

  const persistedMemory: MemoryRecord = {
    id: `mem_research_${job.id}`,
    type: 'fact',
    taskId: job.id,
    summary: job.summary ?? `Research summary for ${job.goal ?? job.documentUri}`,
    content: (job.sources ?? [])
      .map(source => `- [${source.trustClass}] ${source.summary}${source.sourceUrl ? ` (${source.sourceUrl})` : ''}`)
      .join('\n'),
    tags: ['research-job', 'auto-persist', job.workflowId ?? 'general'],
    qualityScore: evaluation.score,
    status: 'active',
    createdAt: new Date().toISOString()
  };

  await memoryRepository.append(persistedMemory);
  job.autoPersistEligible = true;
  job.persistedMemoryIds = [persistedMemory.id];
  return job.persistedMemoryIds;
}
