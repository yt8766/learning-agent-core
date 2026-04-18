import type { ChatCheckpointRecord, SkillSearchStateRecord, SpecialistLeadRecord } from '@agent/core';
import type { RuntimeTaskRecord } from '../runtime/runtime-task.types';

import {
  CONNECTOR_TEMPLATE_TO_DISPLAY,
  dedupeAttachments,
  dedupeAugmentations,
  toAttachmentFromSuggestion,
  toCapabilityTrigger
} from './capability-pool.shared';

export function mergeCapabilityStateFromSkillSearch(
  task: Pick<
    RuntimeTaskRecord,
    'capabilityAttachments' | 'capabilityAugmentations' | 'usedInstalledSkills' | 'sessionId' | 'specialistLead'
  >,
  now: string,
  skillSearch?: SkillSearchStateRecord
) {
  const attachments = [...(task.capabilityAttachments ?? [])];
  const augmentations = [...(task.capabilityAugmentations ?? [])];

  for (const used of task.usedInstalledSkills ?? []) {
    attachments.push({
      id: used,
      displayName: used.replace(/^installed-skill:/, ''),
      kind: 'skill',
      owner: {
        ownerType: 'runtime-derived',
        tier: 'temporary-assignment',
        ownerId: task.sessionId ?? 'task',
        capabilityType: 'skill',
        scope: 'session',
        trigger: 'capability_gap_detected',
        consumedBySpecialist: task.specialistLead?.domain
      },
      enabled: true,
      createdAt: now,
      updatedAt: now
    });
  }

  if (!skillSearch) {
    return {
      capabilityAttachments: dedupeAttachments(attachments),
      capabilityAugmentations: dedupeAugmentations(augmentations)
    };
  }

  if (skillSearch.capabilityGapDetected) {
    augmentations.push({
      id: `augmentation:skill-search:${skillSearch.query ?? 'current-task'}`,
      kind: skillSearch.mcpRecommendation ? 'both' : 'skill',
      status:
        skillSearch.status === 'blocked' ? 'blocked' : skillSearch.status === 'auto-installed' ? 'ready' : 'suggested',
      requestedBy: skillSearch.triggerReason === 'user_requested' ? 'user' : 'workflow',
      target: skillSearch.query,
      reason: skillSearch.safetyNotes[0] ?? '当前轮检测到能力缺口。',
      summary: skillSearch.query,
      owner: {
        ownerType: 'runtime-derived',
        tier: 'temporary-assignment',
        ownerId: task.sessionId ?? 'task',
        capabilityType: 'skill',
        scope: 'task',
        trigger: toCapabilityTrigger(skillSearch.triggerReason)
      },
      createdAt: now,
      updatedAt: now
    });
  }

  for (const suggestion of skillSearch.suggestions) {
    attachments.push(toAttachmentFromSuggestion(suggestion, now, task.sessionId, task.specialistLead?.domain));
  }

  if (skillSearch.mcpRecommendation?.connectorTemplateId) {
    attachments.push({
      id: `runtime-connector:${skillSearch.mcpRecommendation.connectorTemplateId}`,
      displayName:
        CONNECTOR_TEMPLATE_TO_DISPLAY[skillSearch.mcpRecommendation.connectorTemplateId] ??
        skillSearch.mcpRecommendation.connectorTemplateId,
      kind: 'connector',
      owner: {
        ownerType: 'runtime-derived',
        tier: 'temporary-assignment',
        ownerId: task.sessionId ?? 'task',
        capabilityType: 'connector',
        scope: 'task',
        trigger: 'capability_gap_detected',
        consumedBySpecialist: task.specialistLead?.domain
      },
      enabled: false,
      createdAt: now,
      updatedAt: now
    });
  }

  return {
    capabilityAttachments: dedupeAttachments(attachments),
    capabilityAugmentations: dedupeAugmentations(augmentations)
  };
}

export function syncCheckpointCapabilityState(
  checkpoint: ChatCheckpointRecord,
  task: Pick<RuntimeTaskRecord, 'capabilityAttachments' | 'capabilityAugmentations'>
) {
  checkpoint.capabilityAttachments = task.capabilityAttachments;
  checkpoint.capabilityAugmentations = task.capabilityAugmentations;
}

export type CapabilityPoolTaskSpecialist = Pick<SpecialistLeadRecord, 'domain'> | undefined;
