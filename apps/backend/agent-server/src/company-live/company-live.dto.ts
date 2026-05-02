import { BadRequestException } from '@nestjs/common';
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

const CompanyLiveExpertConsultDtoSchema = z.object({
  question: z.string().trim().min(1),
  brief: CompanyLiveGenerateDtoSchema
});

export type CompanyLiveGenerateDto = CompanyLiveContentBrief;

export interface CompanyLiveExpertConsultDto {
  brief: CompanyLiveContentBrief;
  question: string;
}

export function parseCompanyLiveGenerateDto(body: unknown): CompanyLiveGenerateDto {
  const partial = parseCompanyLiveDto(CompanyLiveGenerateDtoSchema, body);
  return parseCompanyLiveBrief(partial);
}

export function parseCompanyLiveExpertConsultDto(body: unknown): CompanyLiveExpertConsultDto {
  const partial = parseCompanyLiveDto(CompanyLiveExpertConsultDtoSchema, body);
  return {
    brief: parseCompanyLiveBrief(partial.brief),
    question: partial.question
  };
}

function parseCompanyLiveDto<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (result.success) {
    return result.data;
  }

  throw new BadRequestException({
    error: 'Bad Request',
    message: 'Invalid company-live request payload',
    details: result.error.issues
  });
}

function parseCompanyLiveBrief(partial: z.infer<typeof CompanyLiveGenerateDtoSchema>): CompanyLiveContentBrief {
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
