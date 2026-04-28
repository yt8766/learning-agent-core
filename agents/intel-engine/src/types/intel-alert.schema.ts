import { z } from 'zod/v4';

import { IntelPrioritySchema } from './intel-signal.schema';

export const IntelAlertKindSchema = z.enum(['formal', 'pending', 'digest_only']);
export const IntelAlertStatusSchema = z.enum(['ready', 'sent', 'upgraded', 'closed']);

export const IntelAlertSchema = z.object({
  id: z.string().min(1),
  signalId: z.string().min(1),
  alertLevel: IntelPrioritySchema,
  alertKind: IntelAlertKindSchema,
  status: IntelAlertStatusSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export type IntelAlert = z.infer<typeof IntelAlertSchema>;
