import { z } from 'zod';

export const ExecutionNodeKindSchema = z.enum([
  'local_terminal',
  'browser',
  'docker_sandbox',
  'ssh_remote',
  'ci_runner',
  'file_workspace'
]);
export type ExecutionNodeKind = z.infer<typeof ExecutionNodeKindSchema>;

export const ExecutionNodeStatusSchema = z.enum(['available', 'busy', 'degraded', 'offline', 'disabled']);
export type ExecutionNodeStatus = z.infer<typeof ExecutionNodeStatusSchema>;

export const ExecutionSandboxModeSchema = z.enum(['host', 'sandboxed', 'remote']);
export type ExecutionSandboxMode = z.infer<typeof ExecutionSandboxModeSchema>;

export const ExecutionRiskClassSchema = z.enum(['low', 'medium', 'high', 'critical']);
export type ExecutionRiskClass = z.infer<typeof ExecutionRiskClassSchema>;

export const ExecutionRequestStatusSchema = z.enum([
  'pending_policy',
  'pending_approval',
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'denied'
]);
export type ExecutionRequestStatus = z.infer<typeof ExecutionRequestStatusSchema>;

export const ExecutionPolicyDecisionSchema = z.enum(['allow', 'require_approval', 'deny']);
export type ExecutionPolicyDecision = z.infer<typeof ExecutionPolicyDecisionSchema>;

export const ExecutionCapabilityCategorySchema = z.enum([
  'terminal',
  'browser',
  'filesystem',
  'network',
  'code_execution',
  'deployment',
  'test',
  'inspection'
]);
export type ExecutionCapabilityCategory = z.infer<typeof ExecutionCapabilityCategorySchema>;

export const ExecutionRequestedByActorSchema = z.enum([
  'human',
  'supervisor',
  'ministry',
  'specialist_agent',
  'runtime'
]);
export type ExecutionRequestedByActor = z.infer<typeof ExecutionRequestedByActorSchema>;

export const ExecutionResultStatusSchema = z.enum(['succeeded', 'failed', 'cancelled']);
export type ExecutionResultStatus = z.infer<typeof ExecutionResultStatusSchema>;
