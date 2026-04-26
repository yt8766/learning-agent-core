import { z } from 'zod';

import { MediaAssetSchema, MediaRiskLevelSchema } from './media-common.schema';

export const CompanyLiveContentBriefSchema = z.object({
  briefId: z.string().min(1),
  targetPlatform: z.string().min(1),
  targetRegion: z.string().min(1),
  language: z.string().min(1),
  audienceProfile: z.string().min(1),
  productRefs: z.array(z.string().min(1)),
  sellingPoints: z.array(z.string().min(1)),
  offer: z.string().min(1).optional(),
  script: z.string().min(1).optional(),
  visualBrief: z.string().min(1).optional(),
  voiceBrief: z.string().min(1).optional(),
  videoBrief: z.string().min(1).optional(),
  complianceNotes: z.array(z.string().min(1)).optional(),
  riskLevel: MediaRiskLevelSchema,
  evidenceRefs: z.array(z.string().min(1)).optional(),
  createdAt: z.string().datetime()
});

export const CompanyLiveMediaRequestSchema = z.object({
  requestId: z.string().min(1),
  sourceBriefId: z.string().min(1),
  requestedAssets: z.object({
    image: z
      .object({
        count: z.number().int().positive().optional(),
        purpose: z.string().min(1).optional(),
        aspectRatio: z.string().min(1).optional()
      })
      .optional(),
    voiceover: z
      .object({
        durationMs: z.number().int().positive().optional(),
        voiceId: z.string().min(1).optional()
      })
      .optional(),
    video: z
      .object({
        durationMs: z.number().int().positive().optional(),
        aspectRatio: z.string().min(1).optional()
      })
      .optional(),
    music: z
      .object({
        durationMs: z.number().int().positive().optional(),
        mood: z.string().min(1).optional()
      })
      .optional()
  }),
  reviewPolicy: z.string().min(1),
  approvalPolicy: z.string().min(1).optional(),
  deliveryFormat: z.string().min(1)
});

export const GeneratedMediaBundleSchema = z.object({
  bundleId: z.string().min(1),
  requestId: z.string().min(1),
  sourceBriefId: z.string().min(1).optional(),
  assets: z.array(MediaAssetSchema),
  taskRefs: z.array(z.string().min(1)).optional(),
  evidenceRefs: z.array(z.string().min(1)).optional(),
  createdAt: z.string().datetime()
});

export type CompanyLiveContentBrief = z.infer<typeof CompanyLiveContentBriefSchema>;
export type CompanyLiveMediaRequest = z.infer<typeof CompanyLiveMediaRequestSchema>;
export type GeneratedMediaBundle = z.infer<typeof GeneratedMediaBundleSchema>;
