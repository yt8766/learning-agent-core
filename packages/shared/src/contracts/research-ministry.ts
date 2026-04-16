import type { AgentExecutionState, EvidenceRecord, MemoryRecord, SkillCard, SpecialistFindingRecord } from '../types';

export type MinistryContractParseStatus = 'success' | 'schema_parse_failed' | 'provider_failed' | 'not_configured';

export interface MinistryContractMeta {
  contractName: string;
  contractVersion: string;
  parseStatus: MinistryContractParseStatus;
  fallbackUsed: boolean;
  fallbackReason?: string;
}

export interface ResearchMinistryResult {
  summary: string;
  memories: MemoryRecord[];
  knowledgeEvidence: EvidenceRecord[];
  skills: SkillCard[];
  specialistFinding?: SpecialistFindingRecord;
  contractMeta: MinistryContractMeta;
}

export interface ResearchMinistryLike {
  research(subTask: string): Promise<ResearchMinistryResult>;
  getState(): AgentExecutionState;
}
