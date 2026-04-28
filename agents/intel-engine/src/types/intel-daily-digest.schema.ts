import { z } from 'zod/v4';

export const IntelDailyDigestSchema = z.object({
  id: z.string().min(1),
  digestDate: z.string().min(1),
  groupKey: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  contentMarkdown: z.string().min(1),
  windowStart: z.string().min(1),
  windowEnd: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const IntelDailyDigestSignalSchema = z.object({
  digestId: z.string().min(1),
  signalId: z.string().min(1),
  position: z.number().int().nonnegative(),
  createdAt: z.string().min(1)
});

export type IntelDailyDigest = z.infer<typeof IntelDailyDigestSchema>;
export type IntelDailyDigestSignal = z.infer<typeof IntelDailyDigestSignalSchema>;
