import { z } from 'zod';

import { TrustClassSchema } from './primitives';

export const DeliveryCitationRecordSchema = z.object({
  label: z.string(),
  sourceUrl: z.string().optional(),
  sourceType: z.string().optional(),
  trustClass: z.union([TrustClassSchema, z.string()]).optional(),
  summary: z.string().optional()
});

export const DeliverySourceSummaryRecordSchema = z.object({
  freshnessSourceSummary: z.string().optional(),
  citationSourceSummary: z.string().optional(),
  citations: z.array(DeliveryCitationRecordSchema).optional()
});
