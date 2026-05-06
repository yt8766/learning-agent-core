import { z } from 'zod';

export const ExecutionAutoReviewSubjectSchema = z.enum([
  'tool_call',
  'shell_command',
  'file_edit',
  'network_request',
  'git_operation'
]);

export const ExecutionAutoReviewVerdictSchema = z.enum(['allow', 'needs_confirmation', 'block']);

export const ExecutionAutoReviewRiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

export const ExecutionAutoReviewRecordSchema = z
  .object({
    id: z.string(),
    sessionId: z.string(),
    runId: z.string(),
    requestId: z.string(),
    subject: ExecutionAutoReviewSubjectSchema,
    verdict: ExecutionAutoReviewVerdictSchema,
    riskLevel: ExecutionAutoReviewRiskLevelSchema,
    autoExecutable: z.boolean(),
    reasons: z.array(z.string()),
    reasonCodes: z.array(z.string()),
    requiredConfirmationPhrase: z.string().optional(),
    userFacingSummary: z.string(),
    createdAt: z.string()
  })
  .superRefine((record, ctx) => {
    if (record.verdict === 'allow' && !record.autoExecutable) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['autoExecutable'],
        message: 'allow auto review verdict must be autoExecutable.'
      });
    }
    if (record.verdict !== 'allow' && record.autoExecutable) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['autoExecutable'],
        message: 'Only allow auto review verdict can be autoExecutable.'
      });
    }
  });
