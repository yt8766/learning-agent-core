import { z } from 'zod/v4';

import { IntelDeliverySchema, IntelSignalSchema, IntelSignalSourceSchema } from '../../../types';

export const DigestModeSchema = z.literal('digest');

export const DigestSignalGroupSchema = z.object({
  category: IntelSignalSchema.shape.category,
  signalCount: z.number().int().nonnegative(),
  highlightSignalIds: z.array(z.string().min(1)).default([])
});

export const DigestHighlightSchema = z.object({
  signal: IntelSignalSchema,
  rank: z.number().int().positive(),
  reasons: z.array(z.string().min(1)).default([])
});

export const DigestRenderedContentSchema = z.object({
  title: z.string().min(1),
  markdown: z.string().min(1)
});

export const DigestEvidenceReferenceSchema = IntelSignalSourceSchema.pick({
  sourceName: true,
  sourceType: true,
  url: true
});

export const DigestSignalEvidenceSchema = z.object({
  signalId: z.string().min(1),
  sourceCount: z.number().int().nonnegative(),
  officialSourceCount: z.number().int().nonnegative(),
  communitySourceCount: z.number().int().nonnegative(),
  references: z.array(DigestEvidenceReferenceSchema).default([])
});

export const DigestRouteMatchSchema = z.object({
  signalId: z.string().min(1),
  routeIds: z.array(z.string().min(1)).default([]),
  channelTargets: z.array(z.string().min(1)).default([])
});

export const DigestQueuedDeliverySchema = IntelDeliverySchema.extend({
  digestId: z.string().min(1)
});

export const PersistedDigestSchema = z.object({
  digestId: z.string().min(1),
  digestDate: z.string().min(1),
  linkedSignalIds: z.array(z.string().min(1)).default([])
});

export const DigestStatsSchema = z.object({
  collectedSignals: z.number().int().nonnegative().default(0),
  groupedSignals: z.number().int().nonnegative().default(0),
  highlights: z.number().int().nonnegative().default(0),
  matchedRoutes: z.number().int().nonnegative().default(0),
  queuedDeliveries: z.number().int().nonnegative().default(0)
});

export const DigestGraphStateSchema = z.object({
  mode: DigestModeSchema.default('digest'),
  jobId: z.string().min(1),
  startedAt: z.string().min(1),
  digestDate: z.string().min(1),
  windowStart: z.string().min(1),
  windowEnd: z.string().min(1),
  collectedSignals: z.array(IntelSignalSchema).default([]),
  groupedSignals: z.array(DigestSignalGroupSchema).default([]),
  highlights: z.array(DigestHighlightSchema).default([]),
  signalEvidence: z.record(z.string(), DigestSignalEvidenceSchema).default({}),
  renderedDigest: DigestRenderedContentSchema.optional(),
  persistedDigest: PersistedDigestSchema.optional(),
  matchedRoutes: z.array(DigestRouteMatchSchema).default([]),
  queuedDeliveries: z.array(DigestQueuedDeliverySchema).default([]),
  stats: DigestStatsSchema.default({
    collectedSignals: 0,
    groupedSignals: 0,
    highlights: 0,
    matchedRoutes: 0,
    queuedDeliveries: 0
  }),
  errors: z.array(z.string().min(1)).default([])
});

export type DigestSignalGroup = z.infer<typeof DigestSignalGroupSchema>;
export type DigestHighlight = z.infer<typeof DigestHighlightSchema>;
export type DigestRenderedContent = z.infer<typeof DigestRenderedContentSchema>;
export type DigestEvidenceReference = z.infer<typeof DigestEvidenceReferenceSchema>;
export type DigestSignalEvidence = z.infer<typeof DigestSignalEvidenceSchema>;
export type DigestRouteMatch = z.infer<typeof DigestRouteMatchSchema>;
export type DigestQueuedDelivery = z.infer<typeof DigestQueuedDeliverySchema>;
export type PersistedDigest = z.infer<typeof PersistedDigestSchema>;
export type DigestStats = z.infer<typeof DigestStatsSchema>;
export type DigestGraphState = z.infer<typeof DigestGraphStateSchema>;
