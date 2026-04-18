import { z } from 'zod';

import { LearningSourceTypeSchema, RiskLevelSchema, SkillStatusSchema } from '../../primitives';
import { CapabilityOwnershipRecordSchema } from './capability';

export const SkillStepSchema = z.object({
  title: z.string(),
  instruction: z.string(),
  toolNames: z.array(z.string())
});

export const SkillToolContractSchema = z.object({
  required: z.array(z.string()),
  optional: z.array(z.string()).optional(),
  approvalSensitive: z.array(z.string()).optional()
});

export const SkillConnectorContractSchema = z.object({
  preferred: z.array(z.string()),
  required: z.array(z.string()).optional(),
  configureIfMissing: z.boolean().optional()
});

export const SkillCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  applicableGoals: z.array(z.string()),
  requiredTools: z.array(z.string()),
  steps: z.array(SkillStepSchema),
  constraints: z.array(z.string()),
  successSignals: z.array(z.string()),
  riskLevel: RiskLevelSchema,
  source: LearningSourceTypeSchema,
  status: SkillStatusSchema,
  previousStatus: SkillStatusSchema.optional(),
  disabledReason: z.string().optional(),
  retiredAt: z.string().optional(),
  restoredAt: z.string().optional(),
  version: z.string().optional(),
  successRate: z.number().optional(),
  promotionState: z.string().optional(),
  governanceRecommendation: z.enum(['promote', 'keep-lab', 'disable', 'retire']).optional(),
  sourceRuns: z.array(z.string()).optional(),
  sourceId: z.string().optional(),
  installReceiptId: z.string().optional(),
  bootstrap: z.boolean().optional(),
  ownership: CapabilityOwnershipRecordSchema.optional(),
  domains: z.array(z.string()).optional(),
  specialistAffinity: z.array(z.string()).optional(),
  preferredMinistries: z.array(z.string()).optional(),
  preferredConnectors: z.array(z.string()).optional(),
  toolContract: SkillToolContractSchema.optional(),
  connectorContract: SkillConnectorContractSchema.optional(),
  requiredCapabilities: z.array(z.string()).optional(),
  requiredConnectors: z.array(z.string()).optional(),
  allowedTools: z.array(z.string()).optional(),
  compatibility: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});
