import type { SkillDraftRecord, SkillDraftReuseStats, SkillDraftRiskLevel } from './types';

export interface SkillDraftInstallCandidate {
  title: string;
  description?: string;
  bodyMarkdown: string;
  requiredTools: string[];
  requiredConnectors: string[];
  sourceTaskId: string;
  sourceEvidenceIds: string[];
  riskLevel: SkillDraftRiskLevel;
  confidence: number;
  reuseStats: SkillDraftReuseStats;
}

export function buildSkillDraftInstallCandidate(draft: SkillDraftRecord): SkillDraftInstallCandidate {
  if (draft.status !== 'active' && draft.status !== 'trusted') {
    throw new Error(`Skill draft ${draft.id} must be active or trusted before install candidate projection.`);
  }

  return {
    title: draft.title,
    description: draft.description,
    bodyMarkdown: draft.bodyMarkdown,
    requiredTools: [...draft.requiredTools],
    requiredConnectors: [...draft.requiredConnectors],
    sourceTaskId: draft.sourceTaskId,
    sourceEvidenceIds: [...draft.sourceEvidenceIds],
    riskLevel: draft.riskLevel,
    confidence: draft.confidence,
    reuseStats: { ...draft.reuseStats }
  };
}
