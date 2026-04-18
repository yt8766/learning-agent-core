import type {
  CapabilityAttachmentRecord,
  CreateTaskDto,
  CapabilityGovernanceProfileRecord,
  GovernanceProfileRecord,
  RequestedExecutionHints,
  RuleRecord,
  WorkerDefinition
} from '@agent/core';
import type { MemoryRepository, RuntimeStateRepository, MemorySearchService } from '@agent/memory';

import { archivalMemorySearchByParams } from '../../../memory/active-memory-tools';
import { flattenStructuredMemories } from '../../../memory/runtime-memory-search';
import { resolveSpecialistRoute, type resolveWorkflowPreset } from '../../../bridges/supervisor-runtime-bridge';

type WorkflowResolution = ReturnType<typeof resolveWorkflowPreset>;

export async function resolveLifecycleKnowledgeReuse(params: {
  taskId: string;
  runId: string;
  goal: string;
  createdAt: string;
  memoryRepository: MemoryRepository;
  memorySearchService?: MemorySearchService;
}) {
  const structured = await archivalMemorySearchByParams(params.memorySearchService, {
    query: params.goal,
    limit: 5,
    actorRole: 'system/background',
    scopeType: 'task',
    allowedScopeTypes: ['task', 'workspace', 'team', 'org', 'global', 'user'],
    taskId: params.taskId,
    memoryTypes: ['constraint', 'procedure', 'skill-experience', 'failure-pattern'],
    includeRules: true,
    includeReflections: true
  });
  const fallbackMemories = structured ? [] : await params.memoryRepository.search(params.goal, 5);
  const memories = structured ? flattenStructuredMemories(structured) : fallbackMemories;
  const rules = structured?.rules ?? ([] as RuleRecord[]);
  const reasonById = new Map((structured?.reasons ?? []).map(item => [item.id, item] as const));
  const reusedMemoryIds = memories.map(memory => memory.id);
  const reusedRuleIds = rules.map(rule => rule.id);
  const evidence = [
    ...memories.map((memory, index) => {
      const reason = reasonById.get(memory.id);
      return {
        id: `memory_reuse_${params.taskId}_${index + 1}`,
        taskId: params.taskId,
        sourceType: 'memory_reuse' as const,
        trustClass: 'internal' as const,
        summary: `已命中历史记忆：${memory.summary}`,
        detail: {
          memoryId: memory.id,
          memoryType: memory.type,
          tags: memory.tags,
          qualityScore: memory.qualityScore,
          scopeType: memory.scopeType,
          relatedEntities: memory.relatedEntities,
          reason: reason?.reason,
          score: reason?.score
        },
        linkedRunId: params.runId,
        createdAt: params.createdAt
      };
    }),
    ...rules.map((rule, index) => {
      const reason = reasonById.get(rule.id);
      return {
        id: `rule_reuse_${params.taskId}_${index + 1}`,
        taskId: params.taskId,
        sourceType: 'rule_reuse' as const,
        trustClass: 'internal' as const,
        summary: `已命中历史规则：${rule.summary}`,
        detail: {
          ruleId: rule.id,
          ruleName: rule.name,
          conditions: rule.conditions,
          reason: reason?.reason,
          score: reason?.score
        },
        linkedRunId: params.runId,
        createdAt: params.createdAt
      };
    }),
    ...(structured?.reflections ?? []).slice(0, 4).map((reflection, index) => ({
      id: `reflection_reuse_${params.taskId}_${index + 1}`,
      taskId: params.taskId,
      sourceType: 'memory_reuse' as const,
      trustClass: 'internal' as const,
      summary: `已命中历史反思：${reflection.summary}`,
      detail: {
        reflectionId: reflection.id,
        reflectionKind: reflection.kind,
        whatFailed: reflection.whatFailed,
        nextAttemptAdvice: reflection.nextAttemptAdvice
      },
      linkedRunId: params.runId,
      createdAt: params.createdAt
    }))
  ];
  return { memories, rules, reusedMemoryIds, reusedRuleIds, evidence };
}

export async function applyLifecycleCounselorSelectorGovernance(params: {
  dto: CreateTaskDto;
  workflowResolution: WorkflowResolution;
  runtimeStateRepository: RuntimeStateRepository;
}) {
  const snapshot = await params.runtimeStateRepository.load();
  const specialistRoute = resolveSpecialistRoute({
    goal: params.workflowResolution.normalizedGoal,
    context: params.dto.context,
    requestedHints: params.dto.requestedHints as RequestedExecutionHints | undefined,
    externalSources: [],
    conversationSummary: params.dto.conversationSummary,
    recentTurns: params.dto.recentTurns,
    relatedHistory: params.dto.relatedHistory
  });
  const selectorConfigs = (snapshot.governance?.counselorSelectorConfigs ?? []).filter(item => item.enabled);
  const matchedConfig = params.dto.counselorSelector?.candidateIds?.length
    ? undefined
    : selectorConfigs.find(
        item =>
          item.domain === specialistRoute.specialistLead.domain ||
          item.domain === params.workflowResolution.preset.id ||
          item.domain === params.workflowResolution.normalizedGoal
      );
  const governanceAttachments = buildGovernanceSeedAttachments({
    dto: params.dto,
    workflowResolution: params.workflowResolution,
    specialistRoute,
    snapshot
  });

  return {
    ...params.dto,
    counselorSelector: matchedConfig
      ? {
          strategy: matchedConfig.strategy,
          key: matchedConfig.domain,
          candidateIds: matchedConfig.candidateIds,
          weights: matchedConfig.weights,
          featureFlag: matchedConfig.featureFlag,
          fallbackCounselorId: matchedConfig.defaultCounselorId
        }
      : params.dto.counselorSelector,
    capabilityAttachments: mergeCapabilityAttachments(governanceAttachments, params.dto.capabilityAttachments)
  };
}

function buildGovernanceSeedAttachments(params: {
  dto: CreateTaskDto;
  workflowResolution: WorkflowResolution;
  specialistRoute: ReturnType<typeof resolveSpecialistRoute>;
  snapshot: Awaited<ReturnType<RuntimeStateRepository['load']>>;
}): CapabilityAttachmentRecord[] {
  const governance = params.snapshot.governance;
  const specialistProfile = (governance?.specialistGovernanceProfiles ?? []).find(
    item => item.entityId === params.specialistRoute.specialistLead.domain
  );
  const ministryProfiles = params.workflowResolution.preset.requiredMinistries
    .map(ministry => (governance?.ministryGovernanceProfiles ?? []).find(item => item.entityId === ministry))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const requestedCapabilityProfiles = (governance?.capabilityGovernanceProfiles ?? []).filter(profile =>
    matchesRequestedCapability(profile, params.dto)
  );

  return [
    ...ministryProfiles.map(profile => toNamedGovernanceAttachment(profile, 'ministry-owned')),
    ...(specialistProfile ? [toNamedGovernanceAttachment(specialistProfile, 'specialist-owned')] : []),
    ...requestedCapabilityProfiles.map(profile => toCapabilityGovernanceAttachment(profile, params.dto))
  ];
}

function toNamedGovernanceAttachment(
  profile: GovernanceProfileRecord,
  ownerType: 'ministry-owned' | 'specialist-owned'
): CapabilityAttachmentRecord {
  return {
    id: `${ownerType === 'ministry-owned' ? 'ministry' : 'specialist'}:${profile.entityId}`,
    displayName: profile.displayName,
    kind: 'skill',
    owner: {
      ownerType,
      tier: ownerType,
      ownerId: profile.entityId,
      capabilityType: 'skill',
      scope: 'task',
      trigger: 'workflow_required',
      ...(ownerType === 'ministry-owned'
        ? { consumedByMinistry: profile.entityId as WorkerDefinition['ministry'] }
        : { consumedBySpecialist: profile.entityId })
    },
    enabled: true,
    capabilityTrust: {
      trustLevel: profile.trustLevel,
      trustTrend: profile.trustTrend,
      lastGovernanceSummary: profile.lastGovernanceSummary,
      lastReason: profile.lastReason,
      updatedAt: profile.updatedAt
    },
    governanceProfile: {
      reportCount: profile.reportCount,
      promoteCount: profile.promoteCount,
      holdCount: profile.holdCount,
      downgradeCount: profile.downgradeCount,
      passCount: profile.passCount,
      reviseRequiredCount: profile.reviseRequiredCount,
      blockCount: profile.blockCount,
      lastTaskId: profile.lastTaskId,
      lastReviewDecision: profile.lastReviewDecision,
      lastTrustAdjustment: profile.lastTrustAdjustment,
      recentOutcomes: profile.recentOutcomes,
      updatedAt: profile.updatedAt
    },
    createdAt: profile.updatedAt,
    updatedAt: profile.updatedAt
  };
}

function toCapabilityGovernanceAttachment(
  profile: CapabilityGovernanceProfileRecord,
  dto: CreateTaskDto
): CapabilityAttachmentRecord {
  return {
    id: profile.capabilityId,
    displayName: profile.displayName,
    kind: profile.kind,
    owner: {
      ownerType: profile.ownerType,
      tier:
        profile.ownerType === 'shared' ||
        profile.ownerType === 'ministry-owned' ||
        profile.ownerType === 'specialist-owned' ||
        profile.ownerType === 'imperial-attached' ||
        profile.ownerType === 'temporary-assignment'
          ? profile.ownerType
          : 'temporary-assignment',
      ownerId: dto.sessionId ?? 'task',
      capabilityType: profile.kind,
      scope: 'task',
      trigger:
        dto.requestedHints?.requestedSkill || dto.requestedHints?.requestedCapability
          ? 'user_requested'
          : 'workflow_required'
    },
    enabled: true,
    capabilityTrust: {
      trustLevel: profile.trustLevel,
      trustTrend: profile.trustTrend,
      lastGovernanceSummary: profile.lastGovernanceSummary,
      lastReason: profile.lastReason,
      updatedAt: profile.updatedAt
    },
    governanceProfile: {
      reportCount: profile.reportCount,
      promoteCount: profile.promoteCount,
      holdCount: profile.holdCount,
      downgradeCount: profile.downgradeCount,
      passCount: profile.passCount,
      reviseRequiredCount: profile.reviseRequiredCount,
      blockCount: profile.blockCount,
      lastTaskId: profile.lastTaskId,
      lastReviewDecision: profile.lastReviewDecision,
      lastTrustAdjustment: profile.lastTrustAdjustment,
      recentOutcomes: profile.recentOutcomes,
      updatedAt: profile.updatedAt
    },
    createdAt: profile.updatedAt,
    updatedAt: profile.updatedAt
  };
}

function matchesRequestedCapability(profile: CapabilityGovernanceProfileRecord, dto: CreateTaskDto) {
  const candidates = [
    dto.requestedHints?.requestedSkill,
    dto.requestedHints?.requestedCapability,
    dto.requestedHints?.requestedConnectorTemplate
  ]
    .map(item => item?.trim().toLowerCase())
    .filter(Boolean);
  if (!candidates.length) {
    return false;
  }

  const haystack = [profile.capabilityId, profile.displayName].map(item => item.toLowerCase());
  return candidates.some(candidate => haystack.some(item => item === candidate || item.includes(candidate!)));
}

function mergeCapabilityAttachments(
  governanceAttachments: CapabilityAttachmentRecord[],
  existingAttachments?: CapabilityAttachmentRecord[]
) {
  return Array.from(
    new Map([...(existingAttachments ?? []), ...governanceAttachments].map(item => [item.id, item])).values()
  );
}
