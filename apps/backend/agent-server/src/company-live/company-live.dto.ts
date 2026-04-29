import type { CompanyLiveContentBrief } from '@agent/core';
import { CompanyLiveContentBriefSchema } from '@agent/core';
import { z } from 'zod';

/** MVP stub 接受的最简表单字段，后端补全默认值 */
const CompanyLiveGenerateDtoSchema = z.object({
  briefId: z.string().min(1),
  targetPlatform: z.string().min(1),
  targetRegion: z.string().min(1).default('global'),
  language: z.string().min(1).default('zh'),
  audienceProfile: z.string().min(1).default('general'),
  productRefs: z.array(z.string().min(1)).default([]),
  sellingPoints: z.array(z.string().min(1)).default([]),
  riskLevel: z.enum(['low', 'medium', 'high']).default('low'),
  script: z.string().min(1).optional(),
  durationSeconds: z.number().int().positive().optional(),
  speakerVoiceId: z.string().min(1).optional(),
  backgroundMusicUri: z.string().optional(),
  brandKitRef: z.string().optional(),
  requestedBy: z.string().optional()
});

export type CompanyLiveGenerateDto = CompanyLiveContentBrief;

export function parseCompanyLiveGenerateDto(body: unknown): CompanyLiveGenerateDto {
  const partial = CompanyLiveGenerateDtoSchema.parse(body);
  return CompanyLiveContentBriefSchema.parse({
    briefId: partial.briefId,
    targetPlatform: partial.targetPlatform,
    targetRegion: partial.targetRegion,
    language: partial.language,
    audienceProfile: partial.audienceProfile,
    productRefs: partial.productRefs,
    sellingPoints: partial.sellingPoints,
    riskLevel: partial.riskLevel,
    script: partial.script,
    createdAt: new Date().toISOString()
  });
}
