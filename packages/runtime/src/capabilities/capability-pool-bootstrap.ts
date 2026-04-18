import type {
  CapabilityAttachmentRecord,
  CapabilityAugmentationRecord,
  RequestedExecutionHints,
  SpecialistLeadRecord,
  WorkerDomain,
  WorkflowPresetDefinition
} from '@agent/core';
import type { RuntimeTaskRecord } from '../runtime/runtime-task.types';
import { listBootstrapSkills, type BootstrapSkillRecord } from '../bridges/supervisor-runtime-bridge';

import {
  CONNECTOR_TEMPLATE_TO_DISPLAY,
  dedupeAttachments,
  dedupeAugmentations,
  normalizeMinistryId,
  normalizeSpecialistDomain,
  resolveMinistryDisplay,
  resolveSpecialistDisplay
} from './capability-pool.shared';

export function buildInitialCapabilityState(params: {
  now: string;
  workflow?: WorkflowPresetDefinition;
  specialistLead?: SpecialistLeadRecord;
  requestedHints?: RequestedExecutionHints;
  seedCapabilityAttachments?: CapabilityAttachmentRecord[];
  seedCapabilityAugmentations?: CapabilityAugmentationRecord[];
}): Pick<RuntimeTaskRecord, 'capabilityAttachments' | 'capabilityAugmentations'> {
  const attachments: CapabilityAttachmentRecord[] = [
    ...listBootstrapSkills().map(
      (skill: BootstrapSkillRecord): CapabilityAttachmentRecord => ({
        id: `bootstrap:${skill.id}`,
        displayName: skill.displayName,
        kind: 'skill',
        owner: {
          ownerType: 'shared',
          tier: 'shared',
          capabilityType: 'skill',
          scope: 'session',
          trigger: 'bootstrap'
        },
        enabled: true,
        permission: 'readonly',
        riskLevel: 'low',
        promotionStatus: 'active',
        capabilityTrust: {
          trustLevel: 'medium',
          trustTrend: 'steady',
          lastReason: 'bootstrap capability attached',
          updatedAt: params.now
        },
        sourceId: skill.id,
        createdAt: params.now,
        updatedAt: params.now
      })
    )
  ];

  if (params.workflow) {
    for (const ministry of params.workflow.requiredMinistries) {
      const normalizedMinistry = normalizeMinistryId(ministry);
      if (!normalizedMinistry) {
        continue;
      }
      const canonicalMinistry = normalizedMinistry as WorkerDomain;
      attachments.push({
        id: `ministry:${ministry}`,
        displayName: resolveMinistryDisplay(canonicalMinistry),
        kind: 'skill',
        owner: {
          ownerType: 'ministry-owned',
          tier: 'ministry-owned',
          ownerId: canonicalMinistry,
          capabilityType: 'skill',
          scope: 'task',
          trigger: 'workflow_required',
          consumedByMinistry: canonicalMinistry
        },
        enabled: true,
        permission:
          ministry === 'bingbu-ops' ? 'external-side-effect' : ministry === 'gongbu-code' ? 'write' : 'readonly',
        riskLevel: ministry === 'bingbu-ops' ? 'high' : ministry === 'gongbu-code' ? 'medium' : 'low',
        promotionStatus: 'active',
        capabilityTrust: {
          trustLevel: 'medium',
          trustTrend: 'steady',
          lastReason: `workflow required by ${canonicalMinistry}`,
          updatedAt: params.now
        },
        createdAt: params.now,
        updatedAt: params.now
      });
    }
  }

  if (params.specialistLead) {
    const canonicalDomain =
      normalizeSpecialistDomain({ domain: params.specialistLead.domain }) ?? params.specialistLead.domain;
    attachments.push({
      id: `specialist:${params.specialistLead.domain}`,
      displayName: resolveSpecialistDisplay(params.specialistLead.domain, params.specialistLead.displayName),
      kind: 'skill',
      owner: {
        ownerType: 'specialist-owned',
        tier: 'specialist-owned',
        ownerId: canonicalDomain,
        capabilityType: 'skill',
        scope: 'task',
        trigger: 'workflow_required',
        consumedBySpecialist: params.specialistLead.domain
      },
      enabled: true,
      permission: 'readonly',
      riskLevel: 'low',
      promotionStatus: 'active',
      capabilityTrust: {
        trustLevel: 'medium',
        trustTrend: 'steady',
        lastReason: `specialist route selected ${canonicalDomain}`,
        updatedAt: params.now
      },
      createdAt: params.now,
      updatedAt: params.now
    });
  }

  if (params.requestedHints?.requestedSkill) {
    attachments.push({
      id: `requested-skill:${params.requestedHints.requestedSkill}`,
      displayName: params.requestedHints.requestedSkill,
      kind: 'skill',
      owner: {
        ownerType: 'user-attached',
        tier: 'temporary-assignment',
        ownerId: 'workspace',
        capabilityType: 'skill',
        scope: 'session',
        trigger: 'user_requested'
      },
      enabled: true,
      permission: 'readonly',
      riskLevel: 'low',
      promotionStatus: 'candidate',
      capabilityTrust: {
        trustLevel: 'medium',
        trustTrend: 'steady',
        lastReason: 'user requested skill attachment',
        updatedAt: params.now
      },
      createdAt: params.now,
      updatedAt: params.now
    });
  }

  if (params.requestedHints?.requestedConnectorTemplate) {
    attachments.push({
      id: `requested-connector:${params.requestedHints.requestedConnectorTemplate}`,
      displayName:
        CONNECTOR_TEMPLATE_TO_DISPLAY[params.requestedHints.requestedConnectorTemplate] ??
        params.requestedHints.requestedConnectorTemplate,
      kind: 'connector',
      owner: {
        ownerType: 'user-attached',
        tier: 'temporary-assignment',
        ownerId: 'workspace',
        capabilityType: 'connector',
        scope: 'session',
        trigger: 'user_requested'
      },
      enabled: true,
      permission: 'external-side-effect',
      riskLevel: 'medium',
      promotionStatus: 'candidate',
      capabilityTrust: {
        trustLevel: 'medium',
        trustTrend: 'steady',
        lastReason: 'user requested connector attachment',
        updatedAt: params.now
      },
      createdAt: params.now,
      updatedAt: params.now
    });
  }

  attachments.push(...(params.seedCapabilityAttachments ?? []));

  const augmentations: CapabilityAugmentationRecord[] = [...(params.seedCapabilityAugmentations ?? [])];
  if (params.requestedHints?.requestedConnectorTemplate) {
    augmentations.push({
      id: `augmentation:${params.requestedHints.requestedConnectorTemplate}`,
      kind: 'connector',
      status: 'suggested',
      requestedBy: 'user',
      target: params.requestedHints.requestedConnectorTemplate,
      reason: `用户明确指定使用 ${CONNECTOR_TEMPLATE_TO_DISPLAY[params.requestedHints.requestedConnectorTemplate]}。`,
      owner: {
        ownerType: 'user-attached',
        tier: 'temporary-assignment',
        ownerId: 'workspace',
        capabilityType: 'connector',
        scope: 'session',
        trigger: 'user_requested'
      },
      createdAt: params.now,
      updatedAt: params.now
    });
  }
  if (params.requestedHints?.requestedSkill) {
    augmentations.push({
      id: `augmentation:skill:${params.requestedHints.requestedSkill}`,
      kind: 'skill',
      status: 'suggested',
      requestedBy: 'user',
      target: params.requestedHints.requestedSkill,
      reason: `用户明确指定优先考虑 skill ${params.requestedHints.requestedSkill}。`,
      owner: {
        ownerType: 'user-attached',
        tier: 'temporary-assignment',
        ownerId: 'workspace',
        capabilityType: 'skill',
        scope: 'session',
        trigger: 'user_requested'
      },
      createdAt: params.now,
      updatedAt: params.now
    });
  }

  for (const attachment of params.seedCapabilityAttachments ?? []) {
    if (attachment.kind !== 'skill') {
      continue;
    }
    const connectorRequirements = [
      ...(attachment.metadata?.requiredConnectors ?? []),
      ...(attachment.metadata?.preferredConnectors ?? [])
    ];
    for (const connectorTemplate of connectorRequirements) {
      if (
        !connectorTemplate ||
        attachments.some(
          item =>
            item.kind === 'connector' &&
            `${item.id} ${item.displayName}`.toLowerCase().includes(connectorTemplate.replace(/-template$/i, ''))
        ) ||
        augmentations.some(item => item.target === connectorTemplate)
      ) {
        continue;
      }
      augmentations.push({
        id: `attachment-contract:${attachment.id}:${connectorTemplate}`,
        kind: 'connector',
        status: 'suggested',
        requestedBy: attachment.owner.ownerType === 'specialist-owned' ? 'specialist' : 'user',
        target: connectorTemplate,
        reason: `${attachment.displayName} 依赖 ${CONNECTOR_TEMPLATE_TO_DISPLAY[connectorTemplate] ?? connectorTemplate}，本轮会优先尝试补齐该 connector。`,
        owner: {
          ...attachment.owner,
          capabilityType: 'connector'
        },
        summary: attachment.displayName,
        createdAt: params.now,
        updatedAt: params.now
      });
    }
  }

  return {
    capabilityAttachments: dedupeAttachments(attachments),
    capabilityAugmentations: dedupeAugmentations(augmentations)
  };
}
