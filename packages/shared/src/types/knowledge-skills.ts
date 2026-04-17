export type { SkillCard, SkillConnectorContract, SkillStep, SkillToolContract } from '@agent/core';

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
