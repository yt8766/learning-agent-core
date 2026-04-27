import { z } from 'zod/v4';

export const SandboxPermissionScopeSchema = z
  .object({
    workspaceRoot: z.string().min(1).optional(),
    allowedPaths: z.array(z.string().min(1)).default([]),
    deniedPaths: z.array(z.string().min(1)).default([]),
    allowedHosts: z.array(z.string().min(1)).default([]),
    deniedHosts: z.array(z.string().min(1)).default([]),
    allowedCommands: z.array(z.string().min(1)).default([]),
    deniedCommands: z.array(z.string().min(1)).default([])
  })
  .strict();

export const SandboxPreflightRequestSchema = z
  .object({
    sessionId: z.string().min(1).optional(),
    taskId: z.string().min(1),
    requestId: z.string().min(1).optional(),
    toolName: z.string().min(1),
    profile: z.string().min(1),
    riskClass: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    commandPreview: z.string().optional(),
    inputPreview: z.string().optional(),
    permissionScope: SandboxPermissionScopeSchema.optional(),
    metadata: z.record(z.string(), z.unknown()).default({})
  })
  .strict();

export const SandboxExecuteCommandRequestSchema = z
  .object({
    sessionId: z.string().min(1).optional(),
    taskId: z.string().min(1),
    requestId: z.string().min(1).optional(),
    command: z.string().min(1),
    profile: z.string().min(1),
    cwd: z.string().min(1),
    timeoutMs: z.number().int().positive().optional(),
    permissionScope: SandboxPermissionScopeSchema.optional(),
    metadata: z.record(z.string(), z.unknown()).default({})
  })
  .strict();

export const SandboxCancelRequestSchema = z
  .object({
    sessionId: z.string().min(1).optional(),
    taskId: z.string().min(1).optional(),
    actor: z.string().min(1).optional(),
    reason: z.string().min(1).optional()
  })
  .strict();

export const SandboxApprovalResumeRequestSchema = z
  .object({
    sessionId: z.string().min(1),
    actor: z.string().min(1).optional(),
    reason: z.string().min(1).optional(),
    interrupt: z
      .object({
        interruptId: z.string().min(1).optional(),
        action: z.enum(['approve', 'reject', 'feedback', 'input', 'bypass', 'abort']),
        runId: z.string().min(1).optional(),
        requestId: z.string().min(1).optional(),
        approvalId: z.string().min(1).optional(),
        feedback: z.string().min(1).optional(),
        value: z.string().min(1).optional(),
        payload: z
          .object({
            permissionScopePatch: SandboxPermissionScopeSchema.partial().optional(),
            maxAttemptsOverride: z.number().int().positive().optional(),
            approvalScope: z.enum(['once', 'session', 'always']).optional(),
            reasonCode: z.string().min(1).optional()
          })
          .catchall(z.unknown())
          .optional()
      })
      .strict()
  })
  .strict();

export type SandboxPreflightRequest = z.infer<typeof SandboxPreflightRequestSchema>;
export type SandboxExecuteCommandRequest = z.infer<typeof SandboxExecuteCommandRequestSchema>;
export type SandboxCancelRequest = z.infer<typeof SandboxCancelRequestSchema>;
export type SandboxApprovalResumeRequest = z.infer<typeof SandboxApprovalResumeRequestSchema>;
