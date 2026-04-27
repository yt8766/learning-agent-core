import type { SkillDraftRecord } from './types';

export interface SkillDraftApprovalDecision {
  allowed: boolean;
  reason?: string;
}

export function decideSkillDraftApproval(draft: SkillDraftRecord): SkillDraftApprovalDecision {
  if ((draft.riskLevel === 'high' || draft.riskLevel === 'critical') && draft.sourceEvidenceIds.length === 0) {
    return {
      allowed: false,
      reason: 'High or critical skill drafts require evidence before approval.'
    };
  }

  return { allowed: true };
}
