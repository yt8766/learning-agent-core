import type { CapabilityAttachmentRecord, WorkflowPresetDefinition, WorkerDomain } from '@agent/core';
import { normalizeMinistryId } from '../runtime/runtime-architecture-helpers';
import type { RuntimeTaskRecord } from '../runtime/runtime-task.types';

import {
  getAttachmentTrust,
  hasCapabilityAffinity,
  isDegradedTrust,
  ministryTags,
  normalizeConnectorTag,
  specialistTags
} from './capability-pool.shared';

export function buildWorkerSelectionPreferences(
  task: Pick<RuntimeTaskRecord, 'capabilityAttachments' | 'specialistLead' | 'requestedHints' | 'usedInstalledSkills'>
) {
  const preferredConnectorTags = new Set<string>();
  const preferredTags = new Set<string>();
  const preferredWorkerIds = new Set<string>();
  const avoidedTags = new Set<string>();
  const avoidedWorkerIds = new Set<string>();

  for (const attachment of task.capabilityAttachments ?? []) {
    const trustLevel = attachment.capabilityTrust?.trustLevel ?? 'medium';
    if (attachment.kind === 'connector') {
      preferredConnectorTags.add(normalizeConnectorTag(attachment.displayName));
      preferredConnectorTags.add(normalizeConnectorTag(attachment.id));
    }
    if (attachment.owner.ownerType === 'specialist-owned') {
      for (const tag of specialistTags(attachment.owner.ownerId ?? task.specialistLead?.domain)) {
        if (trustLevel === 'low') {
          avoidedTags.add(tag);
        } else {
          preferredTags.add(tag);
        }
      }
    }
    if (attachment.owner.ownerType === 'user-attached') {
      preferredTags.add('user-requested');
    }
    if (attachment.id.startsWith('installed-skill:')) {
      if (trustLevel === 'low') {
        avoidedWorkerIds.add(attachment.id);
      } else {
        preferredWorkerIds.add(attachment.id);
      }
    }
    if (attachment.owner.ownerType === 'ministry-owned') {
      for (const tag of ministryTags(attachment.owner.ownerId)) {
        if (trustLevel === 'low') {
          avoidedTags.add(tag);
        } else if (trustLevel === 'high') {
          preferredTags.add(tag);
        }
      }
    }
  }

  for (const used of task.usedInstalledSkills ?? []) {
    preferredWorkerIds.add(used);
  }

  return {
    preferredConnectorTags: Array.from(preferredConnectorTags).filter(Boolean),
    preferredTags: Array.from(preferredTags).filter(Boolean),
    preferredWorkerIds: Array.from(preferredWorkerIds),
    avoidedTags: Array.from(avoidedTags).filter(Boolean),
    avoidedWorkerIds: Array.from(avoidedWorkerIds)
  };
}

export function buildMinistryStagePreferences(
  task: Pick<
    RuntimeTaskRecord,
    | 'capabilityAttachments'
    | 'capabilityAugmentations'
    | 'requestedHints'
    | 'specialistLead'
    | 'skillSearch'
    | 'pendingApproval'
    | 'resolvedWorkflow'
  >
) {
  const connectorIds = new Set<string>();
  const enabledConnectorIds = new Set<string>();
  const augmentationTargets = new Set<string>();

  for (const attachment of task.capabilityAttachments ?? []) {
    if (attachment.kind !== 'connector') {
      for (const connector of [
        ...(attachment.metadata?.requiredConnectors ?? []),
        ...(attachment.metadata?.preferredConnectors ?? [])
      ]) {
        augmentationTargets.add(connector.toLowerCase());
      }
      continue;
    }
    const normalizedId = `${attachment.id} ${attachment.displayName}`.toLowerCase();
    connectorIds.add(normalizedId);
    if (attachment.enabled) {
      enabledConnectorIds.add(normalizedId);
    }
  }

  for (const augmentation of task.capabilityAugmentations ?? []) {
    if (augmentation.target) {
      augmentationTargets.add(augmentation.target.toLowerCase());
    }
  }

  const requestedConnector = task.requestedHints?.requestedConnectorTemplate?.toLowerCase();
  if (requestedConnector) {
    augmentationTargets.add(requestedConnector);
  }
  const specialistDomain = task.specialistLead?.domain ?? '';
  const hasBrowserAffinity = hasCapabilityAffinity(connectorIds, enabledConnectorIds, augmentationTargets, ['browser']);
  const hasGithubAffinity = hasCapabilityAffinity(connectorIds, enabledConnectorIds, augmentationTargets, [
    'github',
    'repo'
  ]);
  const hasLarkAffinity = hasCapabilityAffinity(connectorIds, enabledConnectorIds, augmentationTargets, [
    'lark',
    'feishu'
  ]);
  const hasConnectorAffinity = hasBrowserAffinity || hasGithubAffinity || hasLarkAffinity;
  const hasRequestedSkill = Boolean(task.requestedHints?.requestedSkill);
  const hasCapabilityGap = Boolean(task.skillSearch?.capabilityGapDetected);
  const hasHighRiskApproval =
    task.pendingApproval?.riskLevel === 'high' ||
    (task.skillSearch?.safetyNotes ?? []).some(note => /审批|approval|高风险|blocked/i.test(note));
  const isArchitectureHeavy =
    specialistDomain === 'technical-architecture' ||
    Boolean(task.requestedHints?.requestedSkill) ||
    (task.skillSearch?.suggestions ?? []).some(item => (item.domains ?? []).includes('technical-architecture'));
  const isRiskHeavy = specialistDomain === 'risk-compliance' || hasHighRiskApproval;
  const specialistTrust = getAttachmentTrust(
    task.capabilityAttachments,
    attachment => attachment.owner.ownerType === 'specialist-owned' && attachment.owner.ownerId === specialistDomain
  );
  const gongbuTrust = getAttachmentTrust(
    task.capabilityAttachments,
    attachment => attachment.owner.ownerType === 'ministry-owned' && attachment.owner.ownerId === 'gongbu-code'
  );
  const bingbuTrust = getAttachmentTrust(
    task.capabilityAttachments,
    attachment => attachment.owner.ownerType === 'ministry-owned' && attachment.owner.ownerId === 'bingbu-ops'
  );
  const specialistNeedsGovernanceBackstop = isDegradedTrust(specialistTrust.level, specialistTrust.trend);

  return {
    research:
      workflowSupports(task.resolvedWorkflow, 'hubu-search') &&
      (hasConnectorAffinity ||
        hasCapabilityGap ||
        specialistDomain !== 'general-assistant' ||
        specialistNeedsGovernanceBackstop)
        ? ('hubu-search' as const)
        : ('libu-delivery' as const),
    execution: resolveExecutionStageMinistry(task.resolvedWorkflow, {
      hasBrowserAffinity,
      hasGithubAffinity,
      hasLarkAffinity,
      hasRequestedSkill,
      isArchitectureHeavy,
      gongbuDegraded: isDegradedTrust(gongbuTrust.level, gongbuTrust.trend),
      bingbuDegraded: isDegradedTrust(bingbuTrust.level, bingbuTrust.trend)
    }),
    review: workflowSupports(task.resolvedWorkflow, 'xingbu-review')
      ? ('xingbu-review' as const)
      : ('libu-delivery' as const),
    isRiskHeavy
  };
}

function resolveExecutionStageMinistry(
  workflow: WorkflowPresetDefinition | undefined,
  context: {
    hasBrowserAffinity: boolean;
    hasGithubAffinity: boolean;
    hasLarkAffinity: boolean;
    hasRequestedSkill: boolean;
    isArchitectureHeavy: boolean;
    gongbuDegraded: boolean;
    bingbuDegraded: boolean;
  }
): 'gongbu-code' | 'bingbu-ops' | 'libu-delivery' {
  const connectorHeavy = context.hasBrowserAffinity || context.hasLarkAffinity || context.hasGithubAffinity;
  if (workflowSupports(workflow, 'gongbu-code') && workflowSupports(workflow, 'bingbu-ops')) {
    if (context.gongbuDegraded && connectorHeavy && !context.bingbuDegraded) {
      return 'bingbu-ops';
    }
    if (context.bingbuDegraded && !context.gongbuDegraded) {
      return 'gongbu-code';
    }
  }
  if (workflowSupports(workflow, 'bingbu-ops') && connectorHeavy) {
    return 'bingbu-ops';
  }
  if (workflowSupports(workflow, 'gongbu-code') && (context.isArchitectureHeavy || context.hasRequestedSkill)) {
    return 'gongbu-code';
  }
  if (workflowSupports(workflow, 'gongbu-code')) {
    return 'gongbu-code';
  }
  if (workflowSupports(workflow, 'bingbu-ops')) {
    return 'bingbu-ops';
  }
  return 'libu-delivery';
}

function workflowSupports(workflow: WorkflowPresetDefinition | undefined, ministry: WorkerDomain) {
  return workflow?.requiredMinistries.includes(ministry) ?? false;
}

export function isCapabilityPoolMinistryOwnedAttachment(
  attachments: CapabilityAttachmentRecord[] | undefined,
  ministryId: string
) {
  const normalized = normalizeMinistryId(ministryId) ?? ministryId;
  return (attachments ?? []).some(
    attachment => attachment.owner.ownerType === 'ministry-owned' && attachment.owner.ownerId === normalized
  );
}
