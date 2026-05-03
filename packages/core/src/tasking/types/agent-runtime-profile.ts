import type { z } from 'zod';
import type {
  AgentDescriptorSchema,
  AgentRuntimeActionSchema,
  AgentRuntimeApprovalPolicySchema,
  AgentRuntimeBlastRadiusSchema,
  AgentRuntimeDataClassSchema,
  AgentRuntimeEnvironmentSchema,
  AgentRuntimeLevelSchema,
  AgentRuntimeProfileSchema,
  ContextAccessProfileSchema,
  ObservabilityProfileSchema,
  OutputContractProfileSchema,
  PermissionProfileSchema,
  RecoveryProfileSchema,
  ResourceProfileSchema,
  SyscallProfileSchema
} from '../schemas/agent-runtime-profile';

export type AgentRuntimeLevel = z.infer<typeof AgentRuntimeLevelSchema>;
export type AgentRuntimeAction = z.infer<typeof AgentRuntimeActionSchema>;
export type AgentRuntimeEnvironment = z.infer<typeof AgentRuntimeEnvironmentSchema>;
export type AgentRuntimeDataClass = z.infer<typeof AgentRuntimeDataClassSchema>;
export type AgentRuntimeBlastRadius = z.infer<typeof AgentRuntimeBlastRadiusSchema>;
export type AgentRuntimeApprovalPolicy = z.infer<typeof AgentRuntimeApprovalPolicySchema>;
export type AgentDescriptor = z.infer<typeof AgentDescriptorSchema>;
export type ContextAccessProfile = z.infer<typeof ContextAccessProfileSchema>;
export type SyscallProfile = z.infer<typeof SyscallProfileSchema>;
export type PermissionProfile = z.infer<typeof PermissionProfileSchema>;
export type ResourceProfile = z.infer<typeof ResourceProfileSchema>;
export type ObservabilityProfile = z.infer<typeof ObservabilityProfileSchema>;
export type RecoveryProfile = z.infer<typeof RecoveryProfileSchema>;
export type OutputContractProfile = z.infer<typeof OutputContractProfileSchema>;
export type AgentRuntimeProfile = z.infer<typeof AgentRuntimeProfileSchema>;
