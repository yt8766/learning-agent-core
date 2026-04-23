import type { SpecialistDomain, RiskLevel } from '@agent/core';

export interface RuntimeSpecialistLeadRecord {
  id: SpecialistDomain;
  displayName: string;
  domain: SpecialistDomain;
  reason?: string;
  agentId?: string;
  candidateAgentIds?: string[];
}

export interface RuntimeSpecialistSupportRecord {
  id: SpecialistDomain;
  displayName: string;
  domain: SpecialistDomain;
  reason?: string;
  agentId?: string;
  candidateAgentIds?: string[];
}

export interface RuntimeSpecialistFindingRecord {
  specialistId: SpecialistDomain;
  role: 'lead' | 'support';
  contractVersion: 'specialist-finding.v1';
  source: 'route' | 'research' | 'execution' | 'critique';
  stage: 'planning' | 'research' | 'execution' | 'review';
  summary: string;
  domain: SpecialistDomain;
  riskLevel?: RiskLevel;
  blockingIssues?: string[];
  constraints?: string[];
  suggestions?: string[];
  evidenceRefs?: string[];
  confidence?: number;
}
