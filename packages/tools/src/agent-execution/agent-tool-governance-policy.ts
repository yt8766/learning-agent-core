import type { ExecutionRiskClass } from '@agent/core';

const AGENT_TOOL_APPROVAL_RISK_CLASSES = new Set<ExecutionRiskClass>(['medium', 'high', 'critical']);

export function shouldRequireAgentToolApproval(
  riskClass: ExecutionRiskClass,
  capabilityRequiresApproval: boolean
): boolean {
  return capabilityRequiresApproval || AGENT_TOOL_APPROVAL_RISK_CLASSES.has(riskClass);
}

export function resolveAgentToolSandboxProfile(riskClass: ExecutionRiskClass, toolName: string): string {
  if (riskClass === 'high' || riskClass === 'critical') {
    return 'release-ops';
  }
  if (toolName === 'read_local_file') {
    return 'workspace-readonly';
  }
  return 'workspace-write';
}
