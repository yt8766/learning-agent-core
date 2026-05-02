import { z } from 'zod';

export const ChatResponseStepPhaseSchema = z.enum([
  'intake',
  'context',
  'explore',
  'approve',
  'execute',
  'edit',
  'verify',
  'summarize'
]);

export const ChatResponseStepStatusSchema = z.enum([
  'queued',
  'running',
  'completed',
  'blocked',
  'failed',
  'cancelled'
]);

const ChatResponseStepBaseTargetSchema = z
  .object({
    label: z.string().min(1)
  })
  .strict();

export const ChatResponseStepTargetSchema = z.discriminatedUnion('kind', [
  ChatResponseStepBaseTargetSchema.extend({
    kind: z.literal('file'),
    path: z.string().min(1)
  }).strict(),
  ChatResponseStepBaseTargetSchema.extend({
    kind: z.literal('url'),
    href: z.string().url()
  }).strict(),
  ChatResponseStepBaseTargetSchema.extend({
    kind: z.literal('command')
  }).strict(),
  ChatResponseStepBaseTargetSchema.extend({
    kind: z.literal('approval')
  }).strict(),
  ChatResponseStepBaseTargetSchema.extend({
    kind: z.literal('test')
  }).strict(),
  ChatResponseStepBaseTargetSchema.extend({
    kind: z.literal('artifact')
  }).strict(),
  ChatResponseStepBaseTargetSchema.extend({
    kind: z.literal('message')
  }).strict(),
  ChatResponseStepBaseTargetSchema.extend({
    kind: z.literal('other')
  }).strict()
]);

export const ChatResponseStepRecordSchema = z
  .object({
    id: z.string().min(1),
    sessionId: z.string().min(1),
    messageId: z.string().min(1),
    sequence: z.number().int().nonnegative(),
    phase: ChatResponseStepPhaseSchema,
    status: ChatResponseStepStatusSchema,
    title: z.string().min(1),
    detail: z.string().min(1).optional(),
    target: ChatResponseStepTargetSchema.optional(),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime().optional(),
    sourceEventId: z.string().min(1),
    sourceEventType: z.string().min(1),
    metadata: z.record(z.string(), z.unknown()).optional()
  })
  .strict();

export const ChatResponseStepSummarySchema = z
  .object({
    title: z.string().min(1),
    completedCount: z.number().int().nonnegative(),
    runningCount: z.number().int().nonnegative(),
    blockedCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative()
  })
  .strict();

export const ChatResponseStepSnapshotSchema = z
  .object({
    projection: z.literal('chat_response_steps'),
    sessionId: z.string().min(1),
    messageId: z.string().min(1),
    status: z.enum(['running', 'completed', 'blocked', 'failed', 'cancelled']),
    steps: z.array(ChatResponseStepRecordSchema),
    summary: ChatResponseStepSummarySchema,
    updatedAt: z.string().datetime()
  })
  .strict()
  .superRefine((snapshot, ctx) => {
    const expectedSummary = {
      completedCount: snapshot.steps.filter(step => step.status === 'completed').length,
      runningCount: snapshot.steps.filter(step => step.status === 'running' || step.status === 'queued').length,
      blockedCount: snapshot.steps.filter(step => step.status === 'blocked').length,
      failedCount: snapshot.steps.filter(step => step.status === 'failed').length
    };

    snapshot.steps.forEach((step, index) => {
      if (step.sessionId !== snapshot.sessionId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['steps', index, 'sessionId'],
          message: 'Step sessionId must match snapshot sessionId.'
        });
      }

      if (step.messageId !== snapshot.messageId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['steps', index, 'messageId'],
          message: 'Step messageId must match snapshot messageId.'
        });
      }
    });

    for (const [field, expectedValue] of Object.entries(expectedSummary)) {
      const actualValue = snapshot.summary[field as keyof typeof expectedSummary];
      if (actualValue !== expectedValue) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['summary', field],
          message: `Summary ${field} must equal ${expectedValue}.`
        });
      }
    }
  });

export const ChatResponseStepEventSchema = z
  .object({
    projection: z.literal('chat_response_step'),
    action: z.enum(['started', 'updated', 'completed', 'failed', 'blocked', 'cancelled']),
    step: ChatResponseStepRecordSchema
  })
  .strict()
  .superRefine((event, ctx) => {
    const expectedStatusByAction: Partial<Record<typeof event.action, typeof event.step.status>> = {
      started: 'running',
      completed: 'completed',
      failed: 'failed',
      blocked: 'blocked',
      cancelled: 'cancelled'
    };
    const expectedStatus = expectedStatusByAction[event.action];
    if (expectedStatus && event.step.status !== expectedStatus) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['step', 'status'],
        message: `Step status must be "${expectedStatus}" when action is "${event.action}".`
      });
    }

    if (event.action === 'updated' && event.step.status !== 'queued' && event.step.status !== 'running') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['step', 'status'],
        message: 'Step status must be "queued" or "running" when action is "updated".'
      });
    }
  });
