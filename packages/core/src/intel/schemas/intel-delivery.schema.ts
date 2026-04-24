import { z } from 'zod/v4';

export const IntelChannelTypeSchema = z.enum(['lark']);
export const IntelDeliveryKindSchema = z.enum(['alert', 'digest']);
export const IntelDeliveryStatusSchema = z.enum(['pending', 'sent', 'failed', 'closed']);

export const IntelDeliverySchema = z.object({
  id: z.string().min(1),
  signalId: z.string().min(1),
  alertId: z.string().min(1).optional(),
  digestId: z.string().min(1).optional(),
  channelType: IntelChannelTypeSchema,
  channelTarget: z.string().min(1),
  deliveryKind: IntelDeliveryKindSchema,
  deliveryStatus: IntelDeliveryStatusSchema,
  retryCount: z.number().int().nonnegative(),
  statusVersion: z.number().int().positive().optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1).optional(),
  nextRetryAt: z.string().min(1).optional(),
  expiresAt: z.string().min(1).optional(),
  lastAttemptAt: z.string().min(1).optional(),
  failureReason: z.string().min(1).optional(),
  closedAt: z.string().min(1).optional()
});

export type IntelDelivery = z.infer<typeof IntelDeliverySchema>;
