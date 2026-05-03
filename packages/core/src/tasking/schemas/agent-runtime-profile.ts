import { z } from 'zod';

export const AgentRuntimeLevelSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

export const AgentRuntimeActionSchema = z.enum(['read', 'write', 'execute', 'delete', 'publish', 'spend']);
export const AgentRuntimeEnvironmentSchema = z.enum(['sandbox', 'workspace', 'staging', 'production']);
export const AgentRuntimeDataClassSchema = z.enum(['public', 'internal', 'confidential', 'secret', 'pii']);
export const AgentRuntimeBlastRadiusSchema = z.enum(['local', 'project', 'team', 'external', 'production']);
export const AgentRuntimeApprovalPolicySchema = z.enum(['none', 'auto', 'human', 'two_person']);

export const AgentDescriptorSchema = z.object({
  agentId: z.string().min(1),
  role: z.string().min(1),
  level: AgentRuntimeLevelSchema,
  description: z.string().min(1),
  capabilities: z.array(z.string().min(1)).default([])
});

export const ContextAccessProfileSchema = z.object({
  readableKinds: z.array(z.string().min(1)).default([]),
  writableKinds: z.array(z.string().min(1)).default([]),
  memoryViewScopes: z.array(z.string().min(1)).default([]),
  maxContextTokens: z.number().int().positive()
});

export const SyscallProfileSchema = z.object({
  resource: z.array(z.string().min(1)).default([]),
  mutation: z.array(z.string().min(1)).default([]),
  execution: z.array(z.string().min(1)).default([]),
  external: z.array(z.string().min(1)).default([]),
  controlPlane: z.array(z.string().min(1)).default([]),
  runtime: z.array(z.string().min(1)).default([])
});

export const PermissionProfileSchema = z.object({
  allowedActions: z.array(AgentRuntimeActionSchema).default([]),
  allowedAssetScopes: z.array(z.string().min(1)).default([]),
  allowedEnvironments: z.array(AgentRuntimeEnvironmentSchema).default([]),
  allowedDataClasses: z.array(AgentRuntimeDataClassSchema).default([]),
  maxBlastRadius: AgentRuntimeBlastRadiusSchema,
  defaultApprovalPolicy: AgentRuntimeApprovalPolicySchema
});

export const ResourceProfileSchema = z.object({
  tokenBudget: z.number().int().positive(),
  costBudgetUsd: z.number().nonnegative(),
  maxWallTimeMs: z.number().int().positive(),
  maxToolCalls: z.number().int().positive(),
  maxConcurrentTasks: z.number().int().positive(),
  modelClassAllowed: z.array(z.string().min(1)).default([])
});

export const ObservabilityProfileSchema = z.object({
  decisionLog: z.boolean(),
  rationaleSummary: z.boolean(),
  toolTrace: z.boolean(),
  evidence: z.boolean(),
  audit: z.boolean(),
  approvalHistory: z.boolean(),
  stateTransitions: z.boolean()
});

export const RecoveryProfileSchema = z.object({
  checkpoint: z.boolean(),
  resume: z.boolean(),
  rollbackLocalState: z.boolean(),
  compensateExternalEffects: z.boolean(),
  sideEffectLedger: z.boolean()
});

export const OutputContractProfileSchema = z.object({
  schemaName: z.string().min(1),
  schemaVersion: z.string().min(1),
  parseStrategy: z.enum(['strict', 'passthrough']),
  compatPolicy: z.enum(['additive', 'versioned', 'breaking'])
});

export const AgentRuntimeProfileSchema = z.object({
  descriptor: AgentDescriptorSchema,
  contextAccess: ContextAccessProfileSchema,
  syscall: SyscallProfileSchema,
  permission: PermissionProfileSchema,
  resource: ResourceProfileSchema,
  observability: ObservabilityProfileSchema,
  recovery: RecoveryProfileSchema,
  outputContract: OutputContractProfileSchema
});
