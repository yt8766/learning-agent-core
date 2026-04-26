import { z } from 'zod';

import { MediaAssetSchema, MediaRiskLevelSchema } from './media-common.schema';

export const CompanyLiveContentBriefSchema = z.object({
  briefId: z.string().trim().min(1),
  targetPlatform: z.string().trim().min(1),
  targetRegion: z.string().trim().min(1),
  language: z.string().trim().min(1),
  audienceProfile: z.string().trim().min(1),
  productRefs: z.array(z.string().trim().min(1)).min(1),
  sellingPoints: z.array(z.string().trim().min(1)).min(1),
  offer: z.string().trim().min(1).optional(),
  script: z.string().trim().min(1).optional(),
  visualBrief: z.string().trim().min(1).optional(),
  voiceBrief: z.string().trim().min(1).optional(),
  videoBrief: z.string().trim().min(1).optional(),
  complianceNotes: z.array(z.string().trim().min(1)).default([]),
  riskLevel: MediaRiskLevelSchema,
  evidenceRefs: z.array(z.string().trim().min(1)).default([]),
  createdAt: z.string().datetime()
});

const CompanyLiveRequestedAssetsSchema = z
  .object({
    image: z
      .object({
        count: z.number().int().positive().optional(),
        purpose: z.string().trim().min(1).optional(),
        aspectRatio: z.string().trim().min(1).optional()
      })
      .optional(),
    voiceover: z
      .object({
        durationMs: z.number().int().positive().optional(),
        voiceId: z.string().trim().min(1).optional()
      })
      .optional(),
    video: z
      .object({
        durationMs: z.number().int().positive().optional(),
        aspectRatio: z.string().trim().min(1).optional()
      })
      .optional(),
    music: z
      .object({
        durationMs: z.number().int().positive().optional(),
        mood: z.string().trim().min(1).optional()
      })
      .optional()
  })
  .refine(assets => Boolean(assets.image ?? assets.voiceover ?? assets.video ?? assets.music), {
    message: 'At least one media asset type must be requested.'
  });

export const CompanyLiveMediaRequestSchema = z.object({
  requestId: z.string().trim().min(1),
  sourceBriefId: z.string().trim().min(1),
  requestedAssets: CompanyLiveRequestedAssetsSchema,
  reviewPolicy: z.string().trim().min(1),
  approvalPolicy: z.string().trim().min(1).optional(),
  deliveryFormat: z.string().trim().min(1)
});

export const GeneratedMediaBundleSchema = z.object({
  bundleId: z.string().trim().min(1),
  requestId: z.string().trim().min(1),
  sourceBriefId: z.string().trim().min(1).optional(),
  assets: z.array(MediaAssetSchema),
  taskRefs: z.array(z.string().trim().min(1)).default([]),
  evidenceRefs: z.array(z.string().trim().min(1)).default([]),
  createdAt: z.string().datetime()
});

export type CompanyLiveContentBrief = z.infer<typeof CompanyLiveContentBriefSchema>;
export type CompanyLiveMediaRequest = z.infer<typeof CompanyLiveMediaRequestSchema>;
export type GeneratedMediaBundle = z.infer<typeof GeneratedMediaBundleSchema>;
