import { ActionIntent, ApprovalDecision, ApprovalStatus, ToolDefinition } from '@agent/shared';

const manualApprovalIntents = new Set<ActionIntent>([
  ActionIntent.WRITE_FILE,
  ActionIntent.CALL_EXTERNAL_API,
  ActionIntent.PROMOTE_SKILL,
  ActionIntent.ENABLE_PLUGIN,
  ActionIntent.MODIFY_RULE
]);

export class ApprovalService {
  requiresApproval(intent: ActionIntent, tool?: ToolDefinition): boolean {
    return manualApprovalIntents.has(intent) || Boolean(tool?.requiresApproval);
  }

  getDefaultDecision(intent: ActionIntent, tool?: ToolDefinition): ApprovalStatus {
    return this.requiresApproval(intent, tool) ? 'pending' : ApprovalDecision.APPROVED;
  }
}
