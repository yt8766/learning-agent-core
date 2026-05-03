import type { PermissionProfile, PolicyDecision, ToolRequest } from '@agent/core';

const blastRank: Record<PolicyDecision['normalizedRisk']['blastRadius'], number> = {
  local: 0,
  project: 1,
  team: 2,
  external: 3,
  production: 4
};

const approvalActions = new Set<PolicyDecision['normalizedRisk']['action']>(['delete', 'publish', 'spend']);
const approvalDataClasses = new Set<PolicyDecision['normalizedRisk']['dataClasses'][number]>(['secret', 'pii']);

export interface DecideToolRequestPolicyInput {
  profile: PermissionProfile;
  request: ToolRequest;
}

export function decideToolRequestPolicy(input: DecideToolRequestPolicyInput): PolicyDecision {
  const hint = input.request.agentRiskHint;
  const normalizedRisk: PolicyDecision['normalizedRisk'] = {
    action: hint?.action ?? 'read',
    assetScope: hint?.assetScope ?? [],
    environment: hint?.environment ?? 'workspace',
    dataClasses: hint?.dataClasses ?? ['internal'],
    blastRadius: hint?.blastRadius ?? 'local',
    level: 'low'
  };

  const deniedReason = findDeniedReason(input.profile, normalizedRisk);
  if (deniedReason) {
    return {
      decision: 'deny',
      reason: deniedReason,
      decidedBy: 'permission_service',
      normalizedRisk: { ...normalizedRisk, level: 'critical' }
    };
  }

  if (requiresApproval(normalizedRisk)) {
    return {
      decision: 'needs_approval',
      reason: 'Request crosses a high-risk action, data class, or blast radius.',
      decidedBy: 'permission_service',
      requiredApprovalPolicy: 'human',
      normalizedRisk: { ...normalizedRisk, level: 'high' }
    };
  }

  return {
    decision: 'allow',
    reason: 'Request is allowed by profile and does not require approval.',
    decidedBy: 'permission_service',
    normalizedRisk
  };
}

function requiresApproval(risk: PolicyDecision['normalizedRisk']): boolean {
  return (
    approvalActions.has(risk.action) ||
    risk.dataClasses.some(dataClass => approvalDataClasses.has(dataClass)) ||
    blastRank[risk.blastRadius] >= blastRank.external
  );
}

function findDeniedReason(profile: PermissionProfile, risk: PolicyDecision['normalizedRisk']): string | undefined {
  if (!profile.allowedActions.includes(risk.action)) {
    return `Action ${risk.action} is not allowed by profile.`;
  }

  if (risk.assetScope.some(scope => !profile.allowedAssetScopes.includes(scope))) {
    return 'Request includes an asset scope that is not allowed by profile.';
  }

  if (!profile.allowedEnvironments.includes(risk.environment)) {
    return `Environment ${risk.environment} is not allowed by profile.`;
  }

  if (risk.dataClasses.some(dataClass => !profile.allowedDataClasses.includes(dataClass))) {
    return 'Request includes a data class that is not allowed by profile.';
  }

  if (!requiresApproval(risk) && blastRank[risk.blastRadius] > blastRank[profile.maxBlastRadius]) {
    return `Blast radius ${risk.blastRadius} exceeds profile maximum ${profile.maxBlastRadius}.`;
  }

  return undefined;
}
