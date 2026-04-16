import type { CapabilityOwnershipRecord } from './skills';
import type { LearningSourceType, RiskLevel, SkillStatus, WorkerDomain } from './primitives';

export interface SkillStep {
  title: string;
  instruction: string;
  toolNames: string[];
}

export interface SkillToolContract {
  required: string[];
  optional?: string[];
  approvalSensitive?: string[];
}

export interface SkillConnectorContract {
  preferred: string[];
  required?: string[];
  configureIfMissing?: boolean;
}

export interface SkillCard {
  id: string;
  name: string;
  description: string;
  applicableGoals: string[];
  requiredTools: string[];
  steps: SkillStep[];
  constraints: string[];
  successSignals: string[];
  riskLevel: RiskLevel;
  source: LearningSourceType;
  status: SkillStatus;
  previousStatus?: SkillStatus;
  disabledReason?: string;
  retiredAt?: string;
  restoredAt?: string;
  version?: string;
  successRate?: number;
  promotionState?: string;
  governanceRecommendation?: 'promote' | 'keep-lab' | 'disable' | 'retire';
  sourceRuns?: string[];
  sourceId?: string;
  installReceiptId?: string;
  bootstrap?: boolean;
  ownership?: CapabilityOwnershipRecord;
  domains?: string[];
  specialistAffinity?: string[];
  preferredMinistries?: WorkerDomain[];
  preferredConnectors?: string[];
  toolContract?: SkillToolContract;
  connectorContract?: SkillConnectorContract;
  requiredCapabilities?: string[];
  requiredConnectors?: string[];
  allowedTools?: string[];
  compatibility?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PluginDraft {
  id: string;
  name: string;
  description: string;
  manifest: Record<string, unknown>;
  code?: string;
  status: 'draft' | 'lab' | 'disabled';
  createdAt: string;
  updatedAt: string;
}

export interface SkillExecutionTrace {
  skillId: string;
  taskId: string;
  success: boolean;
  durationMs: number;
  failureReason?: string;
  reviewedByHuman?: boolean;
  createdAt: string;
}

export interface SkillEvalResult {
  skillId: string;
  pass: boolean;
  consecutiveSuccesses: number;
  severeIncidents: number;
  notes: string[];
}
