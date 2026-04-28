import { z } from 'zod/v4';

export const IntelSourceTypeSchema = z.enum(['official', 'community']);

export const IntelSignalSourceSchema = z.object({
  id: z.string().min(1),
  signalId: z.string().min(1),
  contentHash: z.string().min(1),
  sourceName: z.string().min(1),
  sourceType: IntelSourceTypeSchema,
  title: z.string().min(1),
  url: z.string().min(1),
  snippet: z.string().min(1),
  publishedAt: z.string().min(1),
  fetchedAt: z.string().min(1),
  createdAt: z.string().min(1)
});

export type IntelSignalSource = z.infer<typeof IntelSignalSourceSchema>;
