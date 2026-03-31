import type {
  CapabilityAttachmentRecord,
  CapabilityAugmentationRecord,
  CapabilityOwnershipRecord,
  ChatCheckpointRecord,
  LocalSkillSuggestionRecord,
  RequestedExecutionHints,
  SkillSearchStateRecord,
  SpecialistLeadRecord,
  TaskRecord,
  WorkflowPresetDefinition,
  WorkerDomain
} from '@agent/shared';
import {
  getMinistryDisplayName,
  getSpecialistDisplayName,
  normalizeMinistryId,
  normalizeSpecialistDomain
} from '@agent/shared';

import { listBootstrapSkills } from '../bootstrap/bootstrap-skill-registry';

const MINISTRY_LABELS: Record<WorkerDomain, string> = {
  'libu-governance': '吏部能力池',
  'libu-router': '吏部能力池',
  'hubu-search': '户部能力池',
  'gongbu-code': '工部能力池',
  'bingbu-ops': '兵部能力池',
  'xingbu-review': '刑部能力池',
  'libu-delivery': '礼部能力池',
  'libu-docs': '礼部能力池'
};

const SPECIALIST_LABELS: Record<string, string> = {
  'general-assistant': '通用助理能力池',
  'product-strategy': '产品策略能力池',
  'growth-marketing': '增长投放能力池',
  'payment-channel': '支付通道能力池',
  'live-ops': '直播互动能力池（兼容别名）',
  'risk-compliance': '风控合规能力池',
  'technical-architecture': '技术架构能力池'
};

const CONNECTOR_TEMPLATE_TO_DISPLAY: Record<string, string> = {
  'github-mcp-template': 'GitHub MCP',
  'browser-mcp-template': 'Browser MCP',
  'lark-mcp-template': 'Lark MCP'
};

export function buildInitialCapabilityState(params: {
  now: string;
  workflow?: WorkflowPresetDefinition;
  specialistLead?: SpecialistLeadRecord;
  requestedHints?: RequestedExecutionHints;
  seedCapabilityAttachments?: CapabilityAttachmentRecord[];
  seedCapabilityAugmentations?: CapabilityAugmentationRecord[];
}): Pick<TaskRecord, 'capabilityAttachments' | 'capabilityAugmentations'> {
  const attachments: CapabilityAttachmentRecord[] = [
    ...listBootstrapSkills().map(
      (skill): CapabilityAttachmentRecord => ({
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
      const canonicalMinistry = normalizeMinistryId(ministry) ?? ministry;
      attachments.push({
        id: `ministry:${ministry}`,
        displayName: getMinistryDisplayName(ministry) ?? MINISTRY_LABELS[ministry] ?? ministry,
        kind: 'skill',
        owner: {
          ownerType: 'ministry-owned',
          tier: 'ministry-owned',
          ownerId: canonicalMinistry,
          capabilityType: 'skill',
          scope: 'task',
          trigger: 'workflow_required',
          consumedByMinistry: ministry
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
      displayName:
        getSpecialistDisplayName({ domain: params.specialistLead.domain }) ??
        SPECIALIST_LABELS[params.specialistLead.domain] ??
        params.specialistLead.displayName,
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

export function mergeCapabilityStateFromSkillSearch(
  task: Pick<
    TaskRecord,
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

export function buildWorkerSelectionPreferences(
  task: Pick<TaskRecord, 'capabilityAttachments' | 'specialistLead' | 'requestedHints' | 'usedInstalledSkills'>
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

function ministryTags(ministryId?: string) {
  const normalized = normalizeMinistryId(ministryId ?? '') ?? ministryId;
  switch (normalized) {
    case 'hubu-search':
      return ['research', 'knowledge', 'memory'];
    case 'gongbu-code':
      return ['code', 'refactor'];
    case 'bingbu-ops':
      return ['sandbox', 'terminal', 'release'];
    case 'xingbu-review':
      return ['review', 'security', 'compliance'];
    case 'libu-delivery':
      return ['documentation', 'delivery'];
    case 'libu-governance':
    case 'libu-router':
      return ['routing', 'budget', 'supervisor'];
    default:
      return [];
  }
}

export function buildMinistryStagePreferences(
  task: Pick<
    TaskRecord,
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
      : ('libu-delivery' as const)
  };
}

export function syncCheckpointCapabilityState(
  checkpoint: ChatCheckpointRecord,
  task: Pick<TaskRecord, 'capabilityAttachments' | 'capabilityAugmentations'>
) {
  checkpoint.capabilityAttachments = task.capabilityAttachments;
  checkpoint.capabilityAugmentations = task.capabilityAugmentations;
}

export function resolveCapabilityRedirect(
  task: Pick<TaskRecord, 'capabilityAttachments' | 'executionMode'>,
  target?: string
): {
  requestedTarget?: string;
  redirectedTarget?: string;
  attachment?: CapabilityAttachmentRecord;
  redirectAttachment?: CapabilityAttachmentRecord;
  requiresReadonlyFallback: boolean;
} {
  if (!target) {
    return {
      requestedTarget: target,
      redirectedTarget: target,
      requiresReadonlyFallback: task.executionMode === 'plan'
    };
  }
  const attachments = task.capabilityAttachments ?? [];
  const normalizedTarget = target.toLowerCase();
  const attachment = attachments.find(item =>
    [item.id, item.displayName, item.sourceId].filter(Boolean).some(value => value!.toLowerCase() === normalizedTarget)
  );
  const redirectedTarget = attachment?.deprecated_in_favor_of ?? target;
  const redirectAttachment = attachments.find(item =>
    [item.id, item.displayName, item.sourceId]
      .filter(Boolean)
      .some(value => value!.toLowerCase() === redirectedTarget.toLowerCase())
  );
  return {
    requestedTarget: target,
    redirectedTarget,
    attachment,
    redirectAttachment,
    requiresReadonlyFallback: task.executionMode === 'plan'
  };
}

function toAttachmentFromSuggestion(
  suggestion: LocalSkillSuggestionRecord,
  now: string,
  ownerId?: string,
  specialistDomain?: string
): CapabilityAttachmentRecord {
  const owner = suggestion.ownership ?? inferOwnershipFromSuggestion(suggestion, ownerId, specialistDomain);
  return {
    id: `suggestion:${suggestion.kind}:${suggestion.id}`,
    displayName: suggestion.displayName,
    kind: suggestion.kind === 'connector-template' ? 'connector' : 'skill',
    owner,
    enabled: suggestion.availability === 'ready',
    sourceId: suggestion.sourceId,
    createdAt: now,
    updatedAt: now
  };
}

function inferOwnershipFromSuggestion(
  suggestion: LocalSkillSuggestionRecord,
  ownerId?: string,
  specialistDomain?: string
): CapabilityOwnershipRecord {
  if (suggestion.kind === 'connector-template') {
    return {
      ownerType: 'runtime-derived',
      tier: 'temporary-assignment',
      ownerId: ownerId ?? 'task',
      capabilityType: 'connector',
      scope: 'task',
      trigger: 'capability_gap_detected',
      consumedBySpecialist: specialistDomain
    };
  }
  if (suggestion.kind === 'installed') {
    return {
      ownerType: 'shared',
      tier: 'shared',
      ownerId: suggestion.id,
      capabilityType: 'skill',
      scope: 'workspace',
      trigger: 'workflow_required',
      consumedBySpecialist: specialistDomain
    };
  }
  return {
    ownerType: 'runtime-derived',
    tier: 'temporary-assignment',
    ownerId: ownerId ?? 'task',
    capabilityType: 'skill',
    scope: 'task',
    trigger: toCapabilityTrigger(suggestion.triggerReason),
    consumedBySpecialist: specialistDomain
  };
}

function toCapabilityTrigger(
  triggerReason?: 'user_requested' | 'capability_gap_detected' | 'domain_specialization_needed'
): CapabilityOwnershipRecord['trigger'] {
  if (triggerReason === 'user_requested') {
    return 'user_requested';
  }
  if (triggerReason === 'domain_specialization_needed') {
    return 'specialist_requested';
  }
  return 'capability_gap_detected';
}

function normalizeConnectorTag(value?: string) {
  const normalized = value?.toLowerCase() ?? '';
  if (normalized.includes('github')) {
    return 'repo';
  }
  if (normalized.includes('browser')) {
    return 'browser';
  }
  if (normalized.includes('lark') || normalized.includes('feishu')) {
    return 'feishu';
  }
  return normalized;
}

function specialistTags(domain?: string) {
  switch (domain) {
    case 'technical-architecture':
      return ['architecture', 'repo', 'code', 'refactor'];
    case 'risk-compliance':
      return ['review', 'security', 'compliance'];
    case 'payment-channel':
      return ['payment', 'knowledge'];
    case 'product-strategy':
      return ['documentation', 'delivery', 'product'];
    default:
      return [];
  }
}

function hasCapabilityAffinity(
  connectorIds: Set<string>,
  enabledConnectorIds: Set<string>,
  augmentationTargets: Set<string>,
  tokens: string[]
) {
  return tokens.some(token => {
    const normalized = token.toLowerCase();
    return (
      Array.from(enabledConnectorIds).some(item => item.includes(normalized)) ||
      Array.from(connectorIds).some(item => item.includes(normalized)) ||
      Array.from(augmentationTargets).some(item => item.includes(normalized))
    );
  });
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

function getAttachmentTrust(
  attachments: CapabilityAttachmentRecord[] | undefined,
  predicate: (attachment: CapabilityAttachmentRecord) => boolean
) {
  const attachment = (attachments ?? []).find(predicate);
  return {
    level: attachment?.capabilityTrust?.trustLevel,
    trend: attachment?.capabilityTrust?.trustTrend
  };
}

function isDegradedTrust(level?: 'high' | 'medium' | 'low', trend?: 'up' | 'steady' | 'down') {
  return level === 'low' || trend === 'down';
}

function dedupeAttachments(attachments: CapabilityAttachmentRecord[]) {
  return Array.from(new Map(attachments.map(item => [item.id, item])).values());
}

function dedupeAugmentations(augmentations: CapabilityAugmentationRecord[]) {
  return Array.from(new Map(augmentations.map(item => [item.id, item])).values());
}
