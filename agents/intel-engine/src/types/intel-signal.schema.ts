import { z } from 'zod/v4';

export const IntelPrioritySchema = z.enum(['P0', 'P1', 'P2']);
export const IntelConfidenceSchema = z.enum(['low', 'medium', 'high']);
export const IntelSignalStatusSchema = z.enum(['pending', 'confirmed', 'closed']);

export const IntelSignalSchema = z.object({
  id: z.string().min(1),
  dedupeKey: z.string().min(1),
  category: z.enum([
    'frontend_tech',
    'frontend_security',
    'ai_release',
    'ai_security',
    'platform_infra',
    'policy_external'
  ]),
  eventType: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  priority: IntelPrioritySchema,
  confidence: IntelConfidenceSchema,
  status: IntelSignalStatusSchema,
  firstSeenAt: z.string().min(1),
  lastSeenAt: z.string().min(1)
});

export type IntelSignal = z.infer<typeof IntelSignalSchema>;
