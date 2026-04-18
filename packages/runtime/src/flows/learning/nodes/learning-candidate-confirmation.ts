import type { RuleRecord, SkillCard } from '@agent/core';
import type { MemoryRepository, RuleRepository } from '@agent/memory';
import type { SkillRegistry } from '@agent/skill-runtime';

import type { RuntimeTaskRecord as TaskRecord } from '../../../runtime/runtime-task.types';

interface LearningCandidateConfirmationDependencies {
  memoryRepository: MemoryRepository;
  ruleRepository: RuleRepository;
  skillRegistry: SkillRegistry;
}

export async function confirmSelectedLearningCandidates(
  task: TaskRecord,
  candidateIds: string[] | undefined,
  dependencies: LearningCandidateConfirmationDependencies
): Promise<string[]> {
  if (!task.learningCandidates?.length) {
    return [];
  }

  const selected = new Set(candidateIds ?? task.learningCandidates.map(candidate => candidate.id));
  for (const candidate of task.learningCandidates) {
    if (!selected.has(candidate.id)) {
      continue;
    }

    if (candidate.type === 'memory') {
      const memory = candidate.payload as any;
      const conflicts = await dependencies.memoryRepository.search(memory.summary, 3);
      const matchedConflicts = conflicts.filter(
        record => record.id !== memory.id && hasMeaningfulMemoryConflict(record, memory)
      );
      const preferredConflict = selectPreferredConflict(memory, matchedConflicts);
      const conflictIds = matchedConflicts.map(record => record.id);
      if (conflictIds.length > 0) {
        const closeConflict =
          preferredConflict && Math.abs((preferredConflict.effectiveness ?? 0) - (memory.effectiveness ?? 0)) < 0.1;
        const highImpactConflict =
          closeConflict &&
          ((memory.effectiveness ?? 0) >= 0.8 || matchedConflicts.some(record => (record.effectiveness ?? 0) >= 0.8));
        task.learningEvaluation = {
          ...(task.learningEvaluation ?? {
            score: 0,
            confidence: 'low',
            notes: [],
            recommendedCandidateIds: [],
            autoConfirmCandidateIds: [],
            sourceSummary: {
              externalSourceCount: 0,
              internalSourceCount: 0,
              reusedMemoryCount: 0,
              reusedRuleCount: 0,
              reusedSkillCount: 0
            }
          }),
          conflictDetected: true,
          conflictTargets: Array.from(new Set([...(task.learningEvaluation?.conflictTargets ?? []), ...conflictIds])),
          skippedReasons: Array.from(
            new Set([
              ...(task.learningEvaluation?.skippedReasons ?? []),
              closeConflict
                ? `memory:${candidate.id} pending lightweight review due to close effectiveness conflicts: ${conflictIds.join(', ')}`
                : `memory:${candidate.id} skipped due to conflicts: ${conflictIds.join(', ')}`
            ])
          ),
          governanceWarnings: Array.from(
            new Set([
              ...(task.learningEvaluation?.governanceWarnings ?? []),
              closeConflict
                ? highImpactConflict
                  ? `长期记忆候选 ${candidate.id} 与已有记录 ${conflictIds.join(', ')} 效果分接近且影响较高，需升级为 plan-question 再决定。`
                  : `长期记忆候选 ${candidate.id} 与已有记录 ${conflictIds.join(', ')} 效果分接近，需交刑部做轻量裁决后再写入。`
                : `长期记忆候选 ${candidate.id} 与已有记录 ${conflictIds.join(', ')} 冲突，已跳过自动写入。`
            ])
          )
        };
        if (
          preferredConflict &&
          !closeConflict &&
          (preferredConflict.effectiveness ?? 0) >= (memory.effectiveness ?? 0)
        ) {
          continue;
        }
        if (closeConflict) {
          continue;
        }
      }
      if (preferredConflict && (preferredConflict.effectiveness ?? 0) > (memory.effectiveness ?? 0)) {
        continue;
      }
      await dependencies.memoryRepository.append(memory as never);
    } else if (candidate.type === 'rule') {
      await dependencies.ruleRepository.append(candidate.payload as RuleRecord as never);
    } else if (candidate.type === 'skill') {
      await dependencies.skillRegistry.publishToLab(candidate.payload as SkillCard as never);
    }
  }

  task.learningCandidates = task.learningCandidates.map(candidate =>
    selected.has(candidate.id)
      ? { ...candidate, status: 'confirmed', confirmedAt: new Date().toISOString() }
      : candidate
  );

  return [...selected];
}

function selectPreferredConflict(candidate: { effectiveness?: number }, conflicts: Array<{ effectiveness?: number }>) {
  if (!conflicts.length) {
    return undefined;
  }
  return conflicts.slice().sort((left, right) => (right.effectiveness ?? 0) - (left.effectiveness ?? 0))[0];
}

function hasMeaningfulMemoryConflict(
  left: { summary: string; tags: string[] },
  right: { summary: string; tags: string[] }
) {
  const leftSummary = left.summary.trim().toLowerCase();
  const rightSummary = right.summary.trim().toLowerCase();
  if (leftSummary === rightSummary) {
    return true;
  }
  const leftTags = new Set(left.tags);
  const overlap = right.tags.filter(tag => leftTags.has(tag));
  return overlap.length >= 2;
}
