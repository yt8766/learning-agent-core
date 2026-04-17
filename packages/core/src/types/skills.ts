import { z } from 'zod';

import {
  CapabilityAttachmentRecordSchema,
  CapabilityGovernanceProfileRecordSchema,
  CapabilityOwnerTypeSchema,
  CapabilityOwnershipRecordSchema,
  CapabilityScopeSchema,
  CapabilityTierSchema,
  CapabilityTriggerSchema,
  CapabilityTypeSchema,
  GovernanceProfileRecordSchema,
  RequestedExecutionHintsSchema,
  SkillCardSchema,
  SkillConnectorContractSchema,
  SkillStepSchema,
  SkillToolContractSchema
} from '../spec/skills';

export type CapabilityOwnerType = z.infer<typeof CapabilityOwnerTypeSchema>;
export type CapabilityTier = z.infer<typeof CapabilityTierSchema>;
export type CapabilityType = z.infer<typeof CapabilityTypeSchema>;
export type CapabilityScope = z.infer<typeof CapabilityScopeSchema>;
export type CapabilityTrigger = z.infer<typeof CapabilityTriggerSchema>;
export type CapabilityOwnershipRecord = z.infer<typeof CapabilityOwnershipRecordSchema>;
export type RequestedExecutionHints = z.infer<typeof RequestedExecutionHintsSchema>;
export type CapabilityAttachmentRecord = z.infer<typeof CapabilityAttachmentRecordSchema>;
export type CapabilityGovernanceProfileRecord = z.infer<typeof CapabilityGovernanceProfileRecordSchema>;
export type GovernanceProfileRecord = z.infer<typeof GovernanceProfileRecordSchema>;
export type SkillStep = z.infer<typeof SkillStepSchema>;
export type SkillToolContract = z.infer<typeof SkillToolContractSchema>;
export type SkillConnectorContract = z.infer<typeof SkillConnectorContractSchema>;
export type SkillCard = z.infer<typeof SkillCardSchema>;
