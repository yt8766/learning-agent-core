import type { AgentToolAlias, AgentToolApprovalMode, ToolRiskLevel } from '@agent/core';

export interface AgentToolApprovalModeInput {
  alias: AgentToolAlias;
  approvalMode: AgentToolApprovalMode;
  riskClass: ToolRiskLevel;
  toolRequiresApproval: boolean;
  riskReasonCode?: string;
}

export interface AgentToolApprovalModeDecision {
  requiresApproval: boolean;
  approvalReasonCode: string;
}

export function decideAgentToolApprovalMode(input: AgentToolApprovalModeInput): AgentToolApprovalModeDecision {
  if (input.riskReasonCode === 'command_destructive') {
    return { requiresApproval: true, approvalReasonCode: 'destructive_command_denied' };
  }

  if (input.riskClass === 'critical') {
    return { requiresApproval: true, approvalReasonCode: 'critical_actions_require_approval' };
  }

  if (input.alias === 'delete') {
    return { requiresApproval: true, approvalReasonCode: 'delete_requires_approval' };
  }

  if (input.approvalMode === 'suggest') {
    return {
      requiresApproval: input.alias !== 'read' && input.alias !== 'list' && input.alias !== 'search',
      approvalReasonCode:
        input.alias === 'read' || input.alias === 'list' || input.alias === 'search'
          ? 'suggest_allows_readonly'
          : 'suggest_requires_approval_for_actions'
    };
  }

  if (input.approvalMode === 'auto_edit') {
    if (input.alias === 'write') {
      return { requiresApproval: false, approvalReasonCode: 'auto_edit_allows_workspace_write' };
    }
    if (input.alias === 'edit') {
      return { requiresApproval: false, approvalReasonCode: 'auto_edit_allows_workspace_patch' };
    }
    if (input.alias === 'command') {
      return { requiresApproval: true, approvalReasonCode: 'auto_edit_requires_command_approval' };
    }
    return { requiresApproval: false, approvalReasonCode: 'auto_edit_allows_readonly' };
  }

  if (input.approvalMode === 'full_auto') {
    if (input.alias === 'command' && input.riskClass === 'low') {
      return {
        requiresApproval: false,
        approvalReasonCode: 'full_auto_allows_sandbox_verification_command'
      };
    }
    if (input.alias === 'command') {
      return { requiresApproval: true, approvalReasonCode: 'full_auto_requires_mutating_command_approval' };
    }
    return {
      requiresApproval: false,
      approvalReasonCode: 'full_auto_allows_sandbox_action'
    };
  }

  return { requiresApproval: true, approvalReasonCode: 'unknown_approval_mode_requires_approval' };
}
