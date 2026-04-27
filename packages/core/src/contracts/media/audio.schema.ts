import { z } from 'zod';

import {
  MediaAssetSchema,
  MediaPreferenceSchema,
  MediaProviderIdSchema,
  MediaRiskLevelSchema
} from './media-common.schema';

export const VoiceProfileSchema = z.object({
  voiceId: z.string().min(1),
  displayName: z.string().min(1).optional(),
  language: z.string().min(1).optional(),
  provider: MediaProviderIdSchema.optional(),
  consentEvidenceRef: z.string().min(1).optional(),
  allowedScopes: z.array(z.string().min(1)).optional()
});

export const VoiceCloneRequestSchema = z.object({
  sourceAudioAssetId: z.string().min(1),
  requestedVoiceId: z.string().min(1),
  voiceOwner: z.string().min(1),
  consentEvidenceRef: z.string().min(1),
  intendedUse: z.string().min(1),
  allowedScopes: z.array(z.string().min(1)),
  riskContext: z.object({
    riskLevel: MediaRiskLevelSchema,
    reason: z.string().min(1)
  })
});

export const VoiceCloneResultSchema = z.object({
  voiceId: z.string().min(1),
  provider: MediaProviderIdSchema,
  consentEvidenceRef: z.string().min(1),
  evidenceRefs: z.array(z.string().min(1)).optional()
});

export const SpeechSynthesisRequestSchema = z.object({
  text: z.string().min(1),
  language: z.string().min(1),
  voiceId: z.string().min(1),
  useCase: z.string().min(1),
  qualityPreference: MediaPreferenceSchema.optional(),
  latencyPreference: MediaPreferenceSchema.optional()
});

export const SpeechSynthesisResultSchema = z.object({
  asset: MediaAssetSchema,
  taskId: z.string().min(1).optional(),
  evidenceRefs: z.array(z.string().min(1)).optional()
});

export type VoiceProfile = z.infer<typeof VoiceProfileSchema>;
export type VoiceCloneRequest = z.infer<typeof VoiceCloneRequestSchema>;
export type VoiceCloneResult = z.infer<typeof VoiceCloneResultSchema>;
export type SpeechSynthesisRequest = z.infer<typeof SpeechSynthesisRequestSchema>;
export type SpeechSynthesisResult = z.infer<typeof SpeechSynthesisResultSchema>;
