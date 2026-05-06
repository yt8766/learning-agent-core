import type { KnowledgeGovernanceProjection as CoreKnowledgeGovernanceProjection } from '@agent/core';

export type KnowledgeGovernanceProjection = CoreKnowledgeGovernanceProjection;

export type KnowledgeGovernanceNodeTone = 'neutral' | 'success' | 'warning' | 'danger';

export interface KnowledgeGovernanceFlowNodeData {
  [key: string]: unknown;
  label: string;
  detail: string;
  meta: string;
  tone: KnowledgeGovernanceNodeTone;
}
