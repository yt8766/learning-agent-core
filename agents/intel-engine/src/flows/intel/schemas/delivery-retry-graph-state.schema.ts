import { z } from 'zod/v4';

const IntelRetryDeliveryStatusSchema = z.enum(['pending', 'failed', 'sent', 'closed']);

export const IntelRetryDeliveryRecordSchema = z.object({
  id: z.string().min(1),
  signalId: z.string().min(1),
  channelType: z.literal('lark'),
  channelTarget: z.string().min(1),
  deliveryKind: z.enum(['alert', 'digest']),
  deliveryStatus: IntelRetryDeliveryStatusSchema,
  retryCount: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
  nextRetryAt: z.string().min(1).optional(),
  expiresAt: z.string().min(1).optional(),
  lastAttemptAt: z.string().min(1).optional(),
  failureReason: z.string().min(1).optional()
});

export const DeliveryRetryGraphStateSchema = z.object({
  jobId: z.string().min(1),
  startedAt: z.string().min(1),
  now: z.string().min(1).optional(),
  pendingDeliveries: z.array(IntelRetryDeliveryRecordSchema).default([]),
  retryableDeliveries: z.array(IntelRetryDeliveryRecordSchema).default([]),
  sentDeliveries: z.array(IntelRetryDeliveryRecordSchema).default([]),
  failedDeliveries: z.array(IntelRetryDeliveryRecordSchema).default([]),
  closedDeliveries: z.array(IntelRetryDeliveryRecordSchema).default([]),
  stats: z
    .object({
      loaded: z.number().int().nonnegative().default(0),
      retryable: z.number().int().nonnegative().default(0),
      sent: z.number().int().nonnegative().default(0),
      failed: z.number().int().nonnegative().default(0),
      closed: z.number().int().nonnegative().default(0)
    })
    .default({
      loaded: 0,
      retryable: 0,
      sent: 0,
      failed: 0,
      closed: 0
    })
});

export type IntelRetryDeliveryRecord = z.infer<typeof IntelRetryDeliveryRecordSchema>;
export type DeliveryRetryGraphState = z.infer<typeof DeliveryRetryGraphStateSchema>;
