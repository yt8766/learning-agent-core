import { z } from 'zod/v4';

export const CreateAutoReviewRequestSchema = z
  .object({
    sessionId: z.string().min(1).optional(),
    taskId: z.string().min(1),
    requestId: z.string().min(1).optional(),
    kind: z.enum(['code_change', 'tool_execution', 'sandbox_result', 'policy', 'release', 'report_bundle']),
    target: z
      .object({
        type: z.string().min(1),
        id: z.string().min(1).optional(),
        summary: z.string().optional(),
        diffPreview: z.string().optional(),
        outputPreview: z.string().optional()
      })
      .strict(),
    evidenceIds: z.array(z.string().min(1)).default([]),
    artifactIds: z.array(z.string().min(1)).default([]),
    sandboxRunId: z.string().min(1).optional(),
    policyDecisionId: z.string().min(1).optional(),
    requestedBy: z
      .object({
        actor: z.enum(['human', 'supervisor', 'ministry', 'specialist_agent', 'runtime']),
        actorId: z.string().min(1).optional()
      })
      .strict()
      .optional(),
    metadata: z.record(z.string(), z.unknown()).default({})
  })
  .strict();

export const RerunAutoReviewRequestSchema = z
  .object({
    actor: z.string().min(1).optional(),
    reason: z.string().min(1).optional(),
    includeEvidenceIds: z.array(z.string().min(1)).optional()
  })
  .strict();

export const AutoReviewApprovalResumeRequestSchema = z
  .object({
    sessionId: z.string().min(1),
    actor: z.string().min(1).optional(),
    reason: z.string().min(1).optional(),
    interrupt: z
      .object({
        interruptId: z.string().min(1).optional(),
        action: z.enum(['approve', 'reject', 'feedback', 'input', 'bypass', 'abort']),
        reviewId: z.string().min(1),
        requestId: z.string().min(1).optional(),
        approvalId: z.string().min(1).optional(),
        feedback: z.string().min(1).optional(),
        value: z.string().min(1).optional(),
        payload: z
          .object({
            acceptedFindingIds: z.array(z.string().min(1)).optional(),
            dismissedFindingIds: z.array(z.string().min(1)).optional(),
            requiredFixSummary: z.string().min(1).optional(),
            rerunAfterFix: z.boolean().optional(),
            approvalScope: z.enum(['once', 'session', 'always']).optional(),
            reasonCode: z.string().min(1).optional()
          })
          .catchall(z.unknown())
          .optional()
      })
      .strict()
  })
  .strict();

export type CreateAutoReviewRequest = z.infer<typeof CreateAutoReviewRequestSchema>;
export type RerunAutoReviewRequest = z.infer<typeof RerunAutoReviewRequestSchema>;
export type AutoReviewApprovalResumeRequest = z.infer<typeof AutoReviewApprovalResumeRequestSchema>;
