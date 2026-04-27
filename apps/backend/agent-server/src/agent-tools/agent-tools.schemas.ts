import { z } from 'zod';

export const CreateAgentToolExecutionRequestSchema = z
  .object({
    sessionId: z.string().optional(),
    taskId: z.string().min(1),
    nodeId: z.string().min(1).optional(),
    capabilityId: z.string().min(1).optional(),
    toolName: z.string().min(1).optional(),
    alias: z.enum(['read', 'list', 'search', 'write', 'edit', 'delete', 'command']).optional(),
    approvalMode: z.enum(['suggest', 'auto_edit', 'full_auto']).optional(),
    requestedBy: z.object({
      actor: z.enum(['human', 'supervisor', 'ministry', 'specialist_agent', 'runtime']),
      actorId: z.string().optional()
    }),
    input: z.record(z.string(), z.unknown()),
    inputPreview: z.string().optional(),
    riskClass: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    approvalIntent: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  })
  .refine(request => Boolean(request.toolName || request.alias), {
    message: 'Either toolName or alias is required',
    path: ['toolName']
  });
export type CreateAgentToolExecutionRequest = z.infer<typeof CreateAgentToolExecutionRequestSchema>;

export const AgentToolCancelRequestSchema = z
  .object({
    sessionId: z.string().optional(),
    taskId: z.string().optional(),
    actor: z.string().optional(),
    reason: z.string().optional()
  })
  .default({});
export type AgentToolCancelRequest = z.infer<typeof AgentToolCancelRequestSchema>;

export const AgentToolApprovalResumeInputSchema = z.object({
  interruptId: z.string().optional(),
  action: z.enum(['approve', 'reject', 'feedback', 'input', 'bypass', 'abort']),
  requestId: z.string().min(1),
  approvalId: z.string().optional(),
  feedback: z.string().optional(),
  value: z.string().optional(),
  payload: z
    .record(z.string(), z.unknown())
    .optional()
    .refine(
      payload => {
        if (!payload) {
          return true;
        }
        const scope = payload.approvalScope;
        return scope === undefined || scope === 'once' || scope === 'session' || scope === 'always';
      },
      { message: 'approvalScope must be one of once, session or always' }
    )
});
export type AgentToolApprovalResumeInput = z.infer<typeof AgentToolApprovalResumeInputSchema>;

export const AgentToolApprovalRequestSchema = z.object({
  sessionId: z.string().min(1),
  interrupt: AgentToolApprovalResumeInputSchema,
  actor: z.string().optional(),
  reason: z.string().optional()
});
export type AgentToolApprovalRequest = z.infer<typeof AgentToolApprovalRequestSchema>;

export const AgentToolNodeHealthCheckRequestSchema = z
  .object({
    reason: z.string().optional(),
    actor: z.string().optional()
  })
  .default({});
export type AgentToolNodeHealthCheckRequest = z.infer<typeof AgentToolNodeHealthCheckRequestSchema>;

const AgentToolOptionalQueryStringSchema = z.preprocess(value => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().min(1).optional());

export const AgentToolEventsQuerySchema = z.object({
  requestId: AgentToolOptionalQueryStringSchema,
  taskId: AgentToolOptionalQueryStringSchema,
  sessionId: AgentToolOptionalQueryStringSchema
});
export type AgentToolEventsQuery = z.infer<typeof AgentToolEventsQuerySchema>;
