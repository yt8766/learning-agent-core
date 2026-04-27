# Media Provider Company Live V1 Implementation Plan

状态：completed
文档类型：plan
适用范围：`packages/core`、`packages/agent-kit`、`packages/adapters`、`packages/platform-runtime`、`agents/audio`、`agents/image`、`agents/video`、`agents/company-live`
最后核对：2026-04-27

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v1.0 media provider boundary so CompanyLive content briefs can drive Audio / Image / Video media generation through provider interfaces, with MiniMax as the default adapter and voice clone governance enforced before provider calls.

**Architecture:** Stable media DTOs live in `packages/core`, Agent-facing provider interfaces live in `packages/agent-kit`, MiniMax-specific mapping and clients live in `packages/adapters`, and default provider registration lives in `packages/platform-runtime`. `agents/audio`, `agents/image`, `agents/video`, and future `agents/company-live` consume only stable contracts and provider interfaces; they must not import MiniMax-specific modules directly.

**Tech Stack:** TypeScript, zod v4, Vitest, pnpm workspace packages, existing `@agent/*` package boundaries.

---

## File Structure

Create or modify these files in order:

- Create `packages/core/src/contracts/media/media-common.schema.ts`: shared enums, ids, timestamps, provider error, media asset, media task schemas.
- Create `packages/core/src/contracts/media/audio.schema.ts`: voice profiles, voice clone request/result, speech synthesis request/result.
- Create `packages/core/src/contracts/media/image.schema.ts`: image generation requests and results.
- Create `packages/core/src/contracts/media/video.schema.ts`: video generation requests, template requests, and task status input.
- Create `packages/core/src/contracts/media/music.schema.ts`: lyrics and music generation requests/results.
- Create `packages/core/src/contracts/media/company-live-media.schema.ts`: `CompanyLiveContentBrief`, `CompanyLiveMediaRequest`, and `GeneratedMediaBundle`.
- Create `packages/core/src/contracts/media/index.ts`: media contract barrel.
- Modify `packages/core/src/index.ts`: export media contracts.
- Create `packages/core/test/media-contracts.test.ts`: schema parse and rejection tests.
- Create `packages/agent-kit/src/media/audio-provider.ts`: `AudioProvider` interface.
- Create `packages/agent-kit/src/media/image-provider.ts`: `ImageProvider` interface.
- Create `packages/agent-kit/src/media/video-provider.ts`: `VideoProvider` interface.
- Create `packages/agent-kit/src/media/music-provider.ts`: `MusicProvider` interface.
- Create `packages/agent-kit/src/media/media-provider-registry.ts`: registry interface and in-memory implementation.
- Create `packages/agent-kit/src/media/index.ts`: media provider barrel.
- Modify `packages/agent-kit/src/index.ts`: export media interfaces.
- Create `packages/agent-kit/test/media-provider-registry.test.ts`: registry tests.
- Create `packages/adapters/src/media/minimax/minimax-config.ts`: MiniMax media adapter config.
- Create `packages/adapters/src/media/minimax/minimax-error.mapper.ts`: provider error mapping.
- Create `packages/adapters/src/media/minimax/minimax-media-task.mapper.ts`: task status and asset mapping.
- Create `packages/adapters/src/media/minimax/minimax-audio-provider.ts`: skeleton audio provider with injectable transport.
- Create `packages/adapters/src/media/minimax/minimax-image-provider.ts`: skeleton image provider with injectable transport.
- Create `packages/adapters/src/media/minimax/minimax-video-provider.ts`: skeleton video provider with injectable transport.
- Create `packages/adapters/src/media/minimax/minimax-music-provider.ts`: skeleton music provider with injectable transport.
- Create `packages/adapters/src/media/minimax/index.ts`: MiniMax media adapter barrel.
- Modify `packages/adapters/src/index.ts`: export MiniMax media adapters.
- Create `packages/adapters/test/media/minimax-media-mappers.test.ts`: mapping tests.
- Create `packages/platform-runtime/src/media/media-provider-registry.ts`: platform registry factory.
- Create `packages/platform-runtime/src/media/create-default-media-providers.ts`: default MiniMax provider wiring.
- Create `packages/platform-runtime/src/media/index.ts`: platform media barrel.
- Modify `packages/platform-runtime/src/index.ts`: export platform media wiring.
- Create `packages/platform-runtime/test/media-provider-registry.test.ts`: platform runtime wiring tests.
- Create `agents/audio/package.json`: package manifest for `@agent/agents-audio`.
- Create `agents/audio/src/index.ts`: public entry.
- Create `agents/audio/src/runtime/audio-domain-runtime.ts`: `createAudioDomainRuntime()`.
- Create `agents/audio/src/flows/voice-clone/voice-clone-policy.ts`: voice clone authorization guard.
- Create `agents/audio/test/voice-clone-policy.test.ts`: voice clone rejection tests.
- Create `agents/image/package.json`: package manifest for `@agent/agents-image`.
- Create `agents/image/src/index.ts`: public entry with image domain descriptor.
- Create `agents/video/package.json`: package manifest for `@agent/agents-video`.
- Create `agents/video/src/index.ts`: public entry with video domain descriptor.
- Modify root `pnpm-lock.yaml`: regenerated immediately after adding workspace packages.
- Create `agents/company-live/package.json`: package manifest for `@agent/agents-company-live`.
- Create `agents/company-live/src/index.ts`: public entry.
- Create `agents/company-live/src/flows/content/company-live-content-brief.ts`: deterministic v1 content brief builder.
- Create `agents/company-live/test/company-live-content-brief.test.ts`: content brief to media request tests.
- Modify `docs/architecture/media-provider-boundary-and-company-live-workflow.md`: update implementation status after v1 lands.

## Task 1: Core Media Contracts

**Files:**

- Create: `packages/core/src/contracts/media/media-common.schema.ts`
- Create: `packages/core/src/contracts/media/audio.schema.ts`
- Create: `packages/core/src/contracts/media/image.schema.ts`
- Create: `packages/core/src/contracts/media/video.schema.ts`
- Create: `packages/core/src/contracts/media/music.schema.ts`
- Create: `packages/core/src/contracts/media/company-live-media.schema.ts`
- Create: `packages/core/src/contracts/media/index.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/media-contracts.test.ts`

- [ ] **Step 1: Write failing schema tests**

Create `packages/core/test/media-contracts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  CompanyLiveContentBriefSchema,
  CompanyLiveMediaRequestSchema,
  MediaAssetSchema,
  MediaGenerationTaskSchema,
  SpeechSynthesisRequestSchema,
  VoiceCloneRequestSchema
} from '../src';

describe('@agent/core media contracts', () => {
  it('parses a generated audio asset and completed media task', () => {
    const asset = MediaAssetSchema.parse({
      assetId: 'asset-audio-1',
      kind: 'audio',
      uri: 'memory://assets/audio-1.mp3',
      mimeType: 'audio/mpeg',
      durationMs: 30000,
      provider: 'minimax',
      model: 'speech-2.8-hd',
      provenance: {
        source: 'generated',
        promptRef: 'prompt-1',
        evidenceRefs: ['ev-1']
      },
      createdAt: '2026-04-27T00:00:00.000Z'
    });

    expect(asset.kind).toBe('audio');

    const task = MediaGenerationTaskSchema.parse({
      taskId: 'media-task-1',
      kind: 'audio',
      provider: 'minimax',
      status: 'succeeded',
      providerTaskId: 'provider-task-1',
      assetRefs: ['asset-audio-1'],
      evidenceRefs: ['ev-1'],
      createdAt: '2026-04-27T00:00:00.000Z',
      updatedAt: '2026-04-27T00:00:01.000Z',
      completedAt: '2026-04-27T00:00:01.000Z'
    });

    expect(task.status).toBe('succeeded');
  });

  it('requires voice clone consent evidence before provider execution', () => {
    expect(() =>
      VoiceCloneRequestSchema.parse({
        sourceAudioAssetId: 'asset-source-1',
        requestedVoiceId: 'host-us-voice',
        voiceOwner: 'Host A',
        intendedUse: 'Generate authorized livestream preview voiceover.',
        allowedScopes: ['company-live-preview'],
        riskContext: { riskLevel: 'high', reason: 'voice_clone' }
      })
    ).toThrow();

    const request = VoiceCloneRequestSchema.parse({
      sourceAudioAssetId: 'asset-source-1',
      requestedVoiceId: 'host-us-voice',
      voiceOwner: 'Host A',
      consentEvidenceRef: 'ev-consent-1',
      intendedUse: 'Generate authorized livestream preview voiceover.',
      allowedScopes: ['company-live-preview'],
      riskContext: { riskLevel: 'high', reason: 'voice_clone' }
    });

    expect(request.consentEvidenceRef).toBe('ev-consent-1');
  });

  it('parses speech synthesis requests without MiniMax-only fields', () => {
    const request = SpeechSynthesisRequestSchema.parse({
      text: 'Launch week starts now.',
      language: 'en-US',
      voiceId: 'Chinese (Mandarin)_Gentleman',
      useCase: 'company-live-preview',
      qualityPreference: 'quality',
      latencyPreference: 'balanced'
    });

    expect(request.text).toContain('Launch');
  });

  it('parses CompanyLive content brief and requested media bundle', () => {
    const brief = CompanyLiveContentBriefSchema.parse({
      briefId: 'brief-1',
      targetPlatform: 'TikTok',
      targetRegion: 'US',
      language: 'en-US',
      audienceProfile: 'US shoppers interested in skincare bundles.',
      productRefs: ['sku-1'],
      sellingPoints: ['Fast visible glow', 'Bundle discount'],
      offer: '20% launch discount',
      script: 'Open with the result, then show the bundle.',
      visualBrief: 'Vertical cover with product bundle and bright studio light.',
      voiceBrief: 'Energetic English voiceover.',
      videoBrief: '30 second vertical preview video.',
      complianceNotes: ['Avoid medical claims.'],
      riskLevel: 'medium',
      evidenceRefs: ['ev-product-1'],
      createdAt: '2026-04-27T00:00:00.000Z'
    });

    expect(brief.targetRegion).toBe('US');

    const request = CompanyLiveMediaRequestSchema.parse({
      requestId: 'media-request-1',
      sourceBriefId: 'brief-1',
      requestedAssets: {
        image: { count: 1, purpose: 'cover' },
        voiceover: { durationMs: 30000 },
        video: { durationMs: 30000, aspectRatio: '9:16' }
      },
      reviewPolicy: 'risk-and-quality',
      approvalPolicy: 'voice-clone-requires-consent',
      deliveryFormat: 'preview-bundle'
    });

    expect(request.requestedAssets.video?.aspectRatio).toBe('9:16');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @agent/core test -- media-contracts.test.ts
```

Expected: fail because `MediaAssetSchema`, `VoiceCloneRequestSchema`, and related schemas are not exported.

- [ ] **Step 3: Implement media common schemas**

Create `packages/core/src/contracts/media/media-common.schema.ts`:

```ts
import { z } from 'zod';

export const MediaKindSchema = z.enum(['image', 'audio', 'video', 'music', 'transcript']);
export const MediaProviderIdSchema = z.string().trim().min(1);
export const MediaTaskStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed', 'canceled']);
export const MediaRiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
export const MediaPreferenceSchema = z.enum(['speed', 'balanced', 'quality', 'cost']);

export const MediaProvenanceSchema = z.object({
  source: z.enum(['generated', 'uploaded', 'derived', 'external']),
  promptRef: z.string().trim().min(1).optional(),
  sourceAssetRefs: z.array(z.string().trim().min(1)).default([]),
  evidenceRefs: z.array(z.string().trim().min(1)).default([])
});

export const MediaAssetSchema = z.object({
  assetId: z.string().trim().min(1),
  kind: MediaKindSchema,
  uri: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  durationMs: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  sizeBytes: z.number().int().positive().optional(),
  provider: MediaProviderIdSchema,
  model: z.string().trim().min(1).optional(),
  provenance: MediaProvenanceSchema,
  createdAt: z.string().datetime()
});

export const MediaProviderErrorSchema = z.object({
  provider: MediaProviderIdSchema,
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
  retryable: z.boolean(),
  rawRef: z.string().trim().min(1).optional(),
  occurredAt: z.string().datetime()
});

export const MediaGenerationTaskSchema = z.object({
  taskId: z.string().trim().min(1),
  kind: z.enum(['image', 'audio', 'video', 'music']),
  provider: MediaProviderIdSchema,
  status: MediaTaskStatusSchema,
  providerTaskId: z.string().trim().min(1).optional(),
  assetRefs: z.array(z.string().trim().min(1)).default([]),
  error: MediaProviderErrorSchema.optional(),
  evidenceRefs: z.array(z.string().trim().min(1)).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional()
});

export type MediaKind = z.infer<typeof MediaKindSchema>;
export type MediaAsset = z.infer<typeof MediaAssetSchema>;
export type MediaProviderError = z.infer<typeof MediaProviderErrorSchema>;
export type MediaGenerationTask = z.infer<typeof MediaGenerationTaskSchema>;
```

- [ ] **Step 4: Implement audio schemas**

Create `packages/core/src/contracts/media/audio.schema.ts`:

```ts
import { z } from 'zod';
import { MediaPreferenceSchema, MediaRiskLevelSchema } from './media-common.schema';

export const VoiceProfileSchema = z.object({
  voiceId: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  language: z.string().trim().min(1),
  provider: z.string().trim().min(1),
  kind: z.enum(['system', 'cloned']),
  owner: z.string().trim().min(1).optional(),
  consentEvidenceRef: z.string().trim().min(1).optional()
});

export const VoiceCloneRequestSchema = z.object({
  sourceAudioAssetId: z.string().trim().min(1),
  requestedVoiceId: z.string().trim().min(1),
  voiceOwner: z.string().trim().min(1),
  consentEvidenceRef: z.string().trim().min(1),
  intendedUse: z.string().trim().min(1),
  allowedScopes: z.array(z.string().trim().min(1)).min(1),
  expiresAt: z.string().datetime().optional(),
  riskContext: z.object({
    riskLevel: MediaRiskLevelSchema,
    reason: z.string().trim().min(1)
  }),
  approvalRef: z.string().trim().min(1).optional()
});

export const VoiceCloneResultSchema = z.object({
  voice: VoiceProfileSchema,
  evidenceRefs: z.array(z.string().trim().min(1)).default([])
});

export const SpeechSynthesisRequestSchema = z.object({
  text: z.string().trim().min(1).max(100000),
  language: z.string().trim().min(1),
  voiceId: z.string().trim().min(1),
  useCase: z.string().trim().min(1),
  qualityPreference: MediaPreferenceSchema.default('balanced'),
  latencyPreference: MediaPreferenceSchema.default('balanced'),
  format: z.enum(['mp3', 'wav', 'pcm']).default('mp3')
});

export const SpeechSynthesisResultSchema = z.object({
  assetId: z.string().trim().min(1),
  durationMs: z.number().int().positive().optional(),
  evidenceRefs: z.array(z.string().trim().min(1)).default([])
});

export type VoiceProfile = z.infer<typeof VoiceProfileSchema>;
export type VoiceCloneRequest = z.infer<typeof VoiceCloneRequestSchema>;
export type VoiceCloneResult = z.infer<typeof VoiceCloneResultSchema>;
export type SpeechSynthesisRequest = z.infer<typeof SpeechSynthesisRequestSchema>;
export type SpeechSynthesisResult = z.infer<typeof SpeechSynthesisResultSchema>;
```

- [ ] **Step 5: Implement image, video, music, and CompanyLive schemas**

Create `packages/core/src/contracts/media/image.schema.ts`:

```ts
import { z } from 'zod';
import { MediaPreferenceSchema } from './media-common.schema';

export const ImageGenerationRequestSchema = z.object({
  prompt: z.string().trim().min(1),
  aspectRatio: z.string().trim().min(1).default('1:1'),
  count: z.number().int().min(1).max(8).default(1),
  useCase: z.string().trim().min(1),
  qualityPreference: MediaPreferenceSchema.default('balanced'),
  referenceAssetRefs: z.array(z.string().trim().min(1)).default([])
});

export const ImageGenerationResultSchema = z.object({
  assetRefs: z.array(z.string().trim().min(1)).min(1),
  evidenceRefs: z.array(z.string().trim().min(1)).default([])
});

export type ImageGenerationRequest = z.infer<typeof ImageGenerationRequestSchema>;
export type ImageGenerationResult = z.infer<typeof ImageGenerationResultSchema>;
```

Create `packages/core/src/contracts/media/video.schema.ts`:

```ts
import { z } from 'zod';
import { MediaPreferenceSchema } from './media-common.schema';

export const VideoGenerationRequestSchema = z.object({
  prompt: z.string().trim().min(1),
  durationMs: z.number().int().positive(),
  aspectRatio: z.string().trim().min(1).default('9:16'),
  useCase: z.string().trim().min(1),
  qualityPreference: MediaPreferenceSchema.default('balanced'),
  imageAssetRefs: z.array(z.string().trim().min(1)).default([]),
  audioAssetRefs: z.array(z.string().trim().min(1)).default([])
});

export const TemplateVideoRequestSchema = z.object({
  templateId: z.string().trim().min(1),
  mediaAssetRefs: z.array(z.string().trim().min(1)).default([]),
  textSlots: z.record(z.string(), z.string()).default({}),
  useCase: z.string().trim().min(1)
});

export type VideoGenerationRequest = z.infer<typeof VideoGenerationRequestSchema>;
export type TemplateVideoRequest = z.infer<typeof TemplateVideoRequestSchema>;
```

Create `packages/core/src/contracts/media/music.schema.ts`:

```ts
import { z } from 'zod';

export const MusicGenerationRequestSchema = z.object({
  prompt: z.string().trim().min(1),
  lyrics: z.string().trim().min(1).optional(),
  durationMs: z.number().int().positive().optional(),
  useCase: z.string().trim().min(1)
});

export const MusicGenerationResultSchema = z.object({
  taskId: z.string().trim().min(1).optional(),
  assetRefs: z.array(z.string().trim().min(1)).default([]),
  evidenceRefs: z.array(z.string().trim().min(1)).default([])
});

export type MusicGenerationRequest = z.infer<typeof MusicGenerationRequestSchema>;
export type MusicGenerationResult = z.infer<typeof MusicGenerationResultSchema>;
```

Create `packages/core/src/contracts/media/company-live-media.schema.ts`:

```ts
import { z } from 'zod';
import { MediaRiskLevelSchema } from './media-common.schema';

export const CompanyLiveContentBriefSchema = z.object({
  briefId: z.string().trim().min(1),
  targetPlatform: z.string().trim().min(1),
  targetRegion: z.string().trim().min(1),
  language: z.string().trim().min(1),
  audienceProfile: z.string().trim().min(1),
  productRefs: z.array(z.string().trim().min(1)).min(1),
  sellingPoints: z.array(z.string().trim().min(1)).min(1),
  offer: z.string().trim().min(1).optional(),
  script: z.string().trim().min(1),
  visualBrief: z.string().trim().min(1),
  voiceBrief: z.string().trim().min(1),
  videoBrief: z.string().trim().min(1),
  complianceNotes: z.array(z.string().trim().min(1)).default([]),
  riskLevel: MediaRiskLevelSchema,
  evidenceRefs: z.array(z.string().trim().min(1)).default([]),
  createdAt: z.string().datetime()
});

export const CompanyLiveMediaRequestSchema = z.object({
  requestId: z.string().trim().min(1),
  sourceBriefId: z.string().trim().min(1),
  requestedAssets: z.object({
    image: z.object({ count: z.number().int().min(1), purpose: z.string().trim().min(1) }).optional(),
    voiceover: z.object({ durationMs: z.number().int().positive() }).optional(),
    music: z.object({ durationMs: z.number().int().positive() }).optional(),
    video: z.object({ durationMs: z.number().int().positive(), aspectRatio: z.string().trim().min(1) }).optional()
  }),
  reviewPolicy: z.string().trim().min(1),
  approvalPolicy: z.string().trim().min(1),
  deliveryFormat: z.string().trim().min(1),
  deadline: z.string().datetime().optional()
});

export const GeneratedMediaBundleSchema = z.object({
  bundleId: z.string().trim().min(1),
  script: z.string().trim().min(1),
  assetRefs: z.array(z.string().trim().min(1)).default([]),
  reviewFindings: z.array(z.string().trim().min(1)).default([]),
  riskWarnings: z.array(z.string().trim().min(1)).default([]),
  evidenceRefs: z.array(z.string().trim().min(1)).default([]),
  taskTrajectoryRef: z.string().trim().min(1).optional()
});

export type CompanyLiveContentBrief = z.infer<typeof CompanyLiveContentBriefSchema>;
export type CompanyLiveMediaRequest = z.infer<typeof CompanyLiveMediaRequestSchema>;
export type GeneratedMediaBundle = z.infer<typeof GeneratedMediaBundleSchema>;
```

- [ ] **Step 6: Export core media contracts**

Create `packages/core/src/contracts/media/index.ts`:

```ts
export * from './media-common.schema';
export * from './audio.schema';
export * from './image.schema';
export * from './video.schema';
export * from './music.schema';
export * from './company-live-media.schema';
```

Add to `packages/core/src/index.ts`:

```ts
export * from './contracts/media';
```

- [ ] **Step 7: Run tests and typecheck**

Run:

```bash
pnpm --filter @agent/core test -- media-contracts.test.ts
pnpm --filter @agent/core typecheck
```

Expected: both pass.

- [ ] **Step 8: Commit**

Run:

```bash
git add packages/core/src/contracts/media packages/core/src/index.ts packages/core/test/media-contracts.test.ts
git commit -m "feat: add media core contracts"
```

## Task 2: Agent Kit Media Provider Interfaces

**Files:**

- Create: `packages/agent-kit/src/media/audio-provider.ts`
- Create: `packages/agent-kit/src/media/image-provider.ts`
- Create: `packages/agent-kit/src/media/video-provider.ts`
- Create: `packages/agent-kit/src/media/music-provider.ts`
- Create: `packages/agent-kit/src/media/media-provider-registry.ts`
- Create: `packages/agent-kit/src/media/index.ts`
- Modify: `packages/agent-kit/src/index.ts`
- Test: `packages/agent-kit/test/media-provider-registry.test.ts`

- [ ] **Step 1: Write failing registry test**

Create `packages/agent-kit/test/media-provider-registry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createMediaProviderRegistry } from '../src';

describe('@agent/agent-kit media provider registry', () => {
  it('registers and resolves named media providers', async () => {
    const registry = createMediaProviderRegistry();
    const audioProvider = {
      providerId: 'mock-audio',
      async listSystemVoices() {
        return { voices: [] };
      },
      async cloneVoice() {
        throw new Error('not used');
      },
      async synthesizeSpeech() {
        return { assetId: 'asset-1', evidenceRefs: [] };
      },
      async createSpeechTask() {
        throw new Error('not used');
      },
      async getSpeechTask() {
        throw new Error('not used');
      }
    };

    registry.registerAudioProvider(audioProvider);

    expect(registry.getAudioProvider('mock-audio')).toBe(audioProvider);
    await expect(registry.getAudioProvider('missing')).rejects.toThrow('Media provider not found: missing');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @agent/agent-kit test -- media-provider-registry.test.ts
```

Expected: fail because `createMediaProviderRegistry` does not exist.

- [ ] **Step 3: Implement provider interfaces**

Create `packages/agent-kit/src/media/audio-provider.ts`:

```ts
import type {
  MediaGenerationTask,
  SpeechSynthesisRequest,
  SpeechSynthesisResult,
  VoiceCloneRequest,
  VoiceCloneResult,
  VoiceProfile
} from '@agent/core';

export interface ListSystemVoicesInput {
  language?: string;
}

export interface ListSystemVoicesResult {
  voices: VoiceProfile[];
}

export interface MediaTaskQuery {
  taskId: string;
  providerTaskId?: string;
}

export interface AudioProvider {
  providerId: string;
  listSystemVoices(input: ListSystemVoicesInput): Promise<ListSystemVoicesResult>;
  cloneVoice(input: VoiceCloneRequest): Promise<VoiceCloneResult>;
  synthesizeSpeech(input: SpeechSynthesisRequest): Promise<SpeechSynthesisResult>;
  createSpeechTask(input: SpeechSynthesisRequest): Promise<MediaGenerationTask>;
  getSpeechTask(input: MediaTaskQuery): Promise<MediaGenerationTask>;
}
```

Create `packages/agent-kit/src/media/image-provider.ts`:

```ts
import type { ImageGenerationRequest, ImageGenerationResult } from '@agent/core';

export interface ImageProvider {
  providerId: string;
  generateImage(input: ImageGenerationRequest): Promise<ImageGenerationResult>;
  generateImageFromReference(input: ImageGenerationRequest): Promise<ImageGenerationResult>;
}
```

Create `packages/agent-kit/src/media/video-provider.ts`:

```ts
import type { MediaGenerationTask, TemplateVideoRequest, VideoGenerationRequest } from '@agent/core';
import type { MediaTaskQuery } from './audio-provider';

export interface VideoProvider {
  providerId: string;
  createTextToVideoTask(input: VideoGenerationRequest): Promise<MediaGenerationTask>;
  createImageToVideoTask(input: VideoGenerationRequest): Promise<MediaGenerationTask>;
  createFirstLastFrameTask(input: VideoGenerationRequest): Promise<MediaGenerationTask>;
  createSubjectReferenceTask(input: VideoGenerationRequest): Promise<MediaGenerationTask>;
  createTemplateVideoTask(input: TemplateVideoRequest): Promise<MediaGenerationTask>;
  getVideoTask(input: MediaTaskQuery): Promise<MediaGenerationTask>;
}
```

Create `packages/agent-kit/src/media/music-provider.ts`:

```ts
import type { MediaGenerationTask, MusicGenerationRequest, MusicGenerationResult } from '@agent/core';
import type { MediaTaskQuery } from './audio-provider';

export interface LyricsGenerationInput {
  prompt: string;
  language?: string;
}

export interface LyricsGenerationResult {
  lyrics: string;
}

export interface MusicProvider {
  providerId: string;
  generateLyrics(input: LyricsGenerationInput): Promise<LyricsGenerationResult>;
  createMusicTask(input: MusicGenerationRequest): Promise<MediaGenerationTask>;
  getMusicTask(input: MediaTaskQuery): Promise<MediaGenerationTask>;
}
```

- [ ] **Step 4: Implement registry**

Create `packages/agent-kit/src/media/media-provider-registry.ts`:

```ts
import type { AudioProvider } from './audio-provider';
import type { ImageProvider } from './image-provider';
import type { MusicProvider } from './music-provider';
import type { VideoProvider } from './video-provider';

export interface MediaProviderRegistry {
  registerAudioProvider(provider: AudioProvider): void;
  registerImageProvider(provider: ImageProvider): void;
  registerVideoProvider(provider: VideoProvider): void;
  registerMusicProvider(provider: MusicProvider): void;
  getAudioProvider(providerId: string): Promise<AudioProvider>;
  getImageProvider(providerId: string): Promise<ImageProvider>;
  getVideoProvider(providerId: string): Promise<VideoProvider>;
  getMusicProvider(providerId: string): Promise<MusicProvider>;
}

function resolveProvider<T>(map: Map<string, T>, providerId: string): Promise<T> {
  const provider = map.get(providerId);
  if (!provider) {
    return Promise.reject(new Error(`Media provider not found: ${providerId}`));
  }
  return Promise.resolve(provider);
}

export function createMediaProviderRegistry(): MediaProviderRegistry {
  const audio = new Map<string, AudioProvider>();
  const image = new Map<string, ImageProvider>();
  const video = new Map<string, VideoProvider>();
  const music = new Map<string, MusicProvider>();

  return {
    registerAudioProvider(provider) {
      audio.set(provider.providerId, provider);
    },
    registerImageProvider(provider) {
      image.set(provider.providerId, provider);
    },
    registerVideoProvider(provider) {
      video.set(provider.providerId, provider);
    },
    registerMusicProvider(provider) {
      music.set(provider.providerId, provider);
    },
    getAudioProvider(providerId) {
      return resolveProvider(audio, providerId);
    },
    getImageProvider(providerId) {
      return resolveProvider(image, providerId);
    },
    getVideoProvider(providerId) {
      return resolveProvider(video, providerId);
    },
    getMusicProvider(providerId) {
      return resolveProvider(music, providerId);
    }
  };
}
```

- [ ] **Step 5: Export media interfaces**

Create `packages/agent-kit/src/media/index.ts`:

```ts
export * from './audio-provider';
export * from './image-provider';
export * from './video-provider';
export * from './music-provider';
export * from './media-provider-registry';
```

Add to `packages/agent-kit/src/index.ts`:

```ts
export * from './media';
```

- [ ] **Step 6: Run tests and typecheck**

Run:

```bash
pnpm --filter @agent/agent-kit test -- media-provider-registry.test.ts
pnpm --filter @agent/agent-kit typecheck
```

Expected: both pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add packages/agent-kit/src/media packages/agent-kit/src/index.ts packages/agent-kit/test/media-provider-registry.test.ts
git commit -m "feat: add media provider interfaces"
```

## Task 3: MiniMax Media Adapter Skeleton

**Files:**

- Create: `packages/adapters/src/media/minimax/minimax-config.ts`
- Create: `packages/adapters/src/media/minimax/minimax-error.mapper.ts`
- Create: `packages/adapters/src/media/minimax/minimax-media-task.mapper.ts`
- Create: `packages/adapters/src/media/minimax/minimax-audio-provider.ts`
- Create: `packages/adapters/src/media/minimax/minimax-image-provider.ts`
- Create: `packages/adapters/src/media/minimax/minimax-video-provider.ts`
- Create: `packages/adapters/src/media/minimax/minimax-music-provider.ts`
- Create: `packages/adapters/src/media/minimax/index.ts`
- Modify: `packages/adapters/src/index.ts`
- Test: `packages/adapters/test/media/minimax-media-mappers.test.ts`

- [ ] **Step 1: Write failing mapper tests**

Create `packages/adapters/test/media/minimax-media-mappers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mapMiniMaxError, mapMiniMaxTask } from '../../src';

describe('@agent/adapters MiniMax media mappers', () => {
  it('maps MiniMax task status to stable media task contract', () => {
    const task = mapMiniMaxTask({
      taskId: 'task-1',
      kind: 'video',
      providerTaskId: 'mx-task-1',
      status: 'Success',
      assetRefs: ['asset-video-1'],
      now: '2026-04-27T00:00:00.000Z'
    });

    expect(task.status).toBe('succeeded');
    expect(task.provider).toBe('minimax');
  });

  it('maps MiniMax errors to retryable provider errors', () => {
    const error = mapMiniMaxError({
      code: 'rate_limit',
      message: 'Too many requests',
      now: '2026-04-27T00:00:00.000Z'
    });

    expect(error.provider).toBe('minimax');
    expect(error.retryable).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @agent/adapters test -- minimax-media-mappers.test.ts
```

Expected: fail because mapper exports do not exist.

- [ ] **Step 3: Implement MiniMax mapper and config**

Create `packages/adapters/src/media/minimax/minimax-config.ts`:

```ts
export interface MiniMaxMediaConfig {
  apiKey: string;
  baseUrl: string;
  defaultSpeechModel: string;
  defaultImageModel: string;
  defaultVideoModel: string;
}

export const DEFAULT_MINIMAX_MEDIA_BASE_URL = 'https://api.minimaxi.com';
export const DEFAULT_MINIMAX_SPEECH_MODEL = 'speech-2.8-turbo';
export const DEFAULT_MINIMAX_IMAGE_MODEL = 'image-01';
export const DEFAULT_MINIMAX_VIDEO_MODEL = 'MiniMax-Hailuo-2.3';
```

Create `packages/adapters/src/media/minimax/minimax-error.mapper.ts`:

```ts
import type { MediaProviderError } from '@agent/core';

export interface MiniMaxErrorMapperInput {
  code: string;
  message: string;
  now: string;
  rawRef?: string;
}

export function mapMiniMaxError(input: MiniMaxErrorMapperInput): MediaProviderError {
  const retryable = ['rate_limit', 'timeout', 'temporarily_unavailable'].includes(input.code);
  return {
    provider: 'minimax',
    code: input.code,
    message: input.message,
    retryable,
    rawRef: input.rawRef,
    occurredAt: input.now
  };
}
```

Create `packages/adapters/src/media/minimax/minimax-media-task.mapper.ts`:

```ts
import type { MediaGenerationTask } from '@agent/core';

type MiniMaxTaskStatus = 'Preparing' | 'Queueing' | 'Processing' | 'Success' | 'Fail' | 'Unknown';

const statusMap: Record<MiniMaxTaskStatus, MediaGenerationTask['status']> = {
  Preparing: 'queued',
  Queueing: 'queued',
  Processing: 'running',
  Success: 'succeeded',
  Fail: 'failed',
  Unknown: 'running'
};

export interface MiniMaxTaskMapperInput {
  taskId: string;
  kind: MediaGenerationTask['kind'];
  providerTaskId: string;
  status: MiniMaxTaskStatus;
  assetRefs?: string[];
  evidenceRefs?: string[];
  now: string;
}

export function mapMiniMaxTask(input: MiniMaxTaskMapperInput): MediaGenerationTask {
  const status = statusMap[input.status];
  return {
    taskId: input.taskId,
    kind: input.kind,
    provider: 'minimax',
    status,
    providerTaskId: input.providerTaskId,
    assetRefs: input.assetRefs ?? [],
    evidenceRefs: input.evidenceRefs ?? [],
    createdAt: input.now,
    updatedAt: input.now,
    completedAt: status === 'succeeded' || status === 'failed' || status === 'canceled' ? input.now : undefined
  };
}
```

- [ ] **Step 4: Implement skeleton providers**

Create `packages/adapters/src/media/minimax/minimax-audio-provider.ts`:

```ts
import type { AudioProvider, ListSystemVoicesInput, ListSystemVoicesResult, MediaTaskQuery } from '@agent/agent-kit';
import type {
  MediaGenerationTask,
  SpeechSynthesisRequest,
  SpeechSynthesisResult,
  VoiceCloneRequest,
  VoiceCloneResult
} from '@agent/core';
import type { MiniMaxMediaConfig } from './minimax-config';

export interface MiniMaxMediaTransport {
  request<T>(operation: string, payload: unknown): Promise<T>;
}

export class MiniMaxAudioProvider implements AudioProvider {
  readonly providerId = 'minimax';

  constructor(
    private readonly config: MiniMaxMediaConfig,
    private readonly transport: MiniMaxMediaTransport
  ) {}

  async listSystemVoices(_input: ListSystemVoicesInput): Promise<ListSystemVoicesResult> {
    return { voices: [] };
  }

  async cloneVoice(input: VoiceCloneRequest): Promise<VoiceCloneResult> {
    return this.transport.request<VoiceCloneResult>('voice.clone', {
      provider: this.providerId,
      model: this.config.defaultSpeechModel,
      input
    });
  }

  async synthesizeSpeech(input: SpeechSynthesisRequest): Promise<SpeechSynthesisResult> {
    return this.transport.request<SpeechSynthesisResult>('speech.synthesize', {
      provider: this.providerId,
      model: this.config.defaultSpeechModel,
      input
    });
  }

  async createSpeechTask(input: SpeechSynthesisRequest): Promise<MediaGenerationTask> {
    return this.transport.request<MediaGenerationTask>('speech.async.create', {
      provider: this.providerId,
      model: this.config.defaultSpeechModel,
      input
    });
  }

  async getSpeechTask(input: MediaTaskQuery): Promise<MediaGenerationTask> {
    return this.transport.request<MediaGenerationTask>('speech.async.get', input);
  }
}
```

Create `packages/adapters/src/media/minimax/minimax-image-provider.ts`:

```ts
import type { ImageProvider } from '@agent/agent-kit';
import type { ImageGenerationRequest, ImageGenerationResult } from '@agent/core';
import type { MiniMaxMediaConfig } from './minimax-config';
import type { MiniMaxMediaTransport } from './minimax-audio-provider';

export class MiniMaxImageProvider implements ImageProvider {
  readonly providerId = 'minimax';

  constructor(
    private readonly config: MiniMaxMediaConfig,
    private readonly transport: MiniMaxMediaTransport
  ) {}

  async generateImage(input: ImageGenerationRequest): Promise<ImageGenerationResult> {
    return this.transport.request<ImageGenerationResult>('image.generate', {
      provider: this.providerId,
      model: this.config.defaultImageModel,
      input
    });
  }

  async generateImageFromReference(input: ImageGenerationRequest): Promise<ImageGenerationResult> {
    return this.transport.request<ImageGenerationResult>('image.reference.generate', {
      provider: this.providerId,
      model: this.config.defaultImageModel,
      input
    });
  }
}
```

Create `packages/adapters/src/media/minimax/minimax-video-provider.ts`:

```ts
import type { MediaTaskQuery, VideoProvider } from '@agent/agent-kit';
import type { MediaGenerationTask, TemplateVideoRequest, VideoGenerationRequest } from '@agent/core';
import type { MiniMaxMediaConfig } from './minimax-config';
import type { MiniMaxMediaTransport } from './minimax-audio-provider';

export class MiniMaxVideoProvider implements VideoProvider {
  readonly providerId = 'minimax';

  constructor(
    private readonly config: MiniMaxMediaConfig,
    private readonly transport: MiniMaxMediaTransport
  ) {}

  createTextToVideoTask(input: VideoGenerationRequest): Promise<MediaGenerationTask> {
    return this.createVideoTask('video.text.create', input);
  }

  createImageToVideoTask(input: VideoGenerationRequest): Promise<MediaGenerationTask> {
    return this.createVideoTask('video.image.create', input);
  }

  createFirstLastFrameTask(input: VideoGenerationRequest): Promise<MediaGenerationTask> {
    return this.createVideoTask('video.first-last-frame.create', input);
  }

  createSubjectReferenceTask(input: VideoGenerationRequest): Promise<MediaGenerationTask> {
    return this.createVideoTask('video.subject-reference.create', input);
  }

  createTemplateVideoTask(input: TemplateVideoRequest): Promise<MediaGenerationTask> {
    return this.transport.request<MediaGenerationTask>('video.template.create', {
      provider: this.providerId,
      model: this.config.defaultVideoModel,
      input
    });
  }

  getVideoTask(input: MediaTaskQuery): Promise<MediaGenerationTask> {
    return this.transport.request<MediaGenerationTask>('video.get', input);
  }

  private createVideoTask(operation: string, input: VideoGenerationRequest): Promise<MediaGenerationTask> {
    return this.transport.request<MediaGenerationTask>(operation, {
      provider: this.providerId,
      model: this.config.defaultVideoModel,
      input
    });
  }
}
```

Create `packages/adapters/src/media/minimax/minimax-music-provider.ts`:

```ts
import type { LyricsGenerationInput, LyricsGenerationResult, MediaTaskQuery, MusicProvider } from '@agent/agent-kit';
import type { MediaGenerationTask, MusicGenerationRequest } from '@agent/core';
import type { MiniMaxMediaTransport } from './minimax-audio-provider';

export class MiniMaxMusicProvider implements MusicProvider {
  readonly providerId = 'minimax';

  constructor(private readonly transport: MiniMaxMediaTransport) {}

  generateLyrics(input: LyricsGenerationInput): Promise<LyricsGenerationResult> {
    return this.transport.request<LyricsGenerationResult>('music.lyrics.generate', input);
  }

  createMusicTask(input: MusicGenerationRequest): Promise<MediaGenerationTask> {
    return this.transport.request<MediaGenerationTask>('music.create', input);
  }

  getMusicTask(input: MediaTaskQuery): Promise<MediaGenerationTask> {
    return this.transport.request<MediaGenerationTask>('music.get', input);
  }
}
```

- [ ] **Step 5: Export MiniMax adapter**

Create `packages/adapters/src/media/minimax/index.ts`:

```ts
export * from './minimax-config';
export * from './minimax-error.mapper';
export * from './minimax-media-task.mapper';
export * from './minimax-audio-provider';
export * from './minimax-image-provider';
export * from './minimax-video-provider';
export * from './minimax-music-provider';
```

Add to `packages/adapters/src/index.ts`:

```ts
export * from './media/minimax';
```

- [ ] **Step 6: Run tests and typecheck**

Run:

```bash
pnpm --filter @agent/adapters test -- minimax-media-mappers.test.ts
pnpm --filter @agent/adapters typecheck
```

Expected: both pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add packages/adapters/src/media/minimax packages/adapters/src/index.ts packages/adapters/test/media/minimax-media-mappers.test.ts
git commit -m "feat: add minimax media adapter boundary"
```

## Task 4: Platform Runtime Media Provider Registry

**Files:**

- Create: `packages/platform-runtime/src/media/media-provider-registry.ts`
- Create: `packages/platform-runtime/src/media/create-default-media-providers.ts`
- Create: `packages/platform-runtime/src/media/index.ts`
- Modify: `packages/platform-runtime/src/index.ts`
- Test: `packages/platform-runtime/test/media-provider-registry.test.ts`

- [ ] **Step 1: Write failing platform registry test**

Create `packages/platform-runtime/test/media-provider-registry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createDefaultMediaProviders } from '../src';

describe('@agent/platform-runtime media providers', () => {
  it('registers MiniMax as the default media provider set', async () => {
    const providers = createDefaultMediaProviders({
      apiKey: 'test-key',
      baseUrl: 'https://example.invalid',
      defaultSpeechModel: 'speech-2.8-turbo',
      defaultImageModel: 'image-01',
      defaultVideoModel: 'MiniMax-Hailuo-2.3'
    });

    expect((await providers.registry.getAudioProvider('minimax')).providerId).toBe('minimax');
    expect((await providers.registry.getImageProvider('minimax')).providerId).toBe('minimax');
    expect((await providers.registry.getVideoProvider('minimax')).providerId).toBe('minimax');
    expect((await providers.registry.getMusicProvider('minimax')).providerId).toBe('minimax');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @agent/platform-runtime test -- media-provider-registry.test.ts
```

Expected: fail because `createDefaultMediaProviders` does not exist.

- [ ] **Step 3: Implement platform media registry**

Create `packages/platform-runtime/src/media/media-provider-registry.ts`:

```ts
export { createMediaProviderRegistry } from '@agent/agent-kit';
export type { MediaProviderRegistry } from '@agent/agent-kit';
```

Create `packages/platform-runtime/src/media/create-default-media-providers.ts`:

```ts
import { createMediaProviderRegistry } from '@agent/agent-kit';
import {
  DEFAULT_MINIMAX_IMAGE_MODEL,
  DEFAULT_MINIMAX_MEDIA_BASE_URL,
  DEFAULT_MINIMAX_SPEECH_MODEL,
  DEFAULT_MINIMAX_VIDEO_MODEL,
  MiniMaxAudioProvider,
  MiniMaxImageProvider,
  MiniMaxMusicProvider,
  MiniMaxVideoProvider,
  type MiniMaxMediaConfig,
  type MiniMaxMediaTransport
} from '@agent/adapters';

export interface DefaultMediaProvidersInput extends Partial<MiniMaxMediaConfig> {
  apiKey: string;
  transport?: MiniMaxMediaTransport;
}

function createNoopTransport(): MiniMaxMediaTransport {
  return {
    async request() {
      throw new Error('MiniMax media transport is not configured for real provider calls.');
    }
  };
}

export function createDefaultMediaProviders(input: DefaultMediaProvidersInput) {
  const registry = createMediaProviderRegistry();
  const config: MiniMaxMediaConfig = {
    apiKey: input.apiKey,
    baseUrl: input.baseUrl ?? DEFAULT_MINIMAX_MEDIA_BASE_URL,
    defaultSpeechModel: input.defaultSpeechModel ?? DEFAULT_MINIMAX_SPEECH_MODEL,
    defaultImageModel: input.defaultImageModel ?? DEFAULT_MINIMAX_IMAGE_MODEL,
    defaultVideoModel: input.defaultVideoModel ?? DEFAULT_MINIMAX_VIDEO_MODEL
  };
  const transport = input.transport ?? createNoopTransport();

  registry.registerAudioProvider(new MiniMaxAudioProvider(config, transport));
  registry.registerImageProvider(new MiniMaxImageProvider(config, transport));
  registry.registerVideoProvider(new MiniMaxVideoProvider(config, transport));
  registry.registerMusicProvider(new MiniMaxMusicProvider(transport));

  return { registry, config };
}
```

Create `packages/platform-runtime/src/media/index.ts`:

```ts
export * from './media-provider-registry';
export * from './create-default-media-providers';
```

Add to `packages/platform-runtime/src/index.ts`:

```ts
export * from './media';
```

- [ ] **Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @agent/platform-runtime test -- media-provider-registry.test.ts
pnpm --filter @agent/platform-runtime typecheck
```

Expected: both pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add packages/platform-runtime/src/media packages/platform-runtime/src/index.ts packages/platform-runtime/test/media-provider-registry.test.ts
git commit -m "feat: wire default media providers"
```

## Task 5: Audio, Image, and Video Agent Skeleton Packages

**Files:**

- Create: `agents/audio/package.json`
- Create: `agents/audio/src/index.ts`
- Create: `agents/audio/src/runtime/audio-domain-runtime.ts`
- Create: `agents/audio/src/flows/voice-clone/voice-clone-policy.ts`
- Test: `agents/audio/test/voice-clone-policy.test.ts`
- Create: `agents/image/package.json`
- Create: `agents/image/src/index.ts`
- Create: `agents/video/package.json`
- Create: `agents/video/src/index.ts`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Write failing voice clone policy test**

Create `agents/audio/test/voice-clone-policy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { assertVoiceCloneRequestAllowed } from '../src';

describe('@agent/agents-audio voice clone policy', () => {
  it('blocks voice clone requests without consent evidence', () => {
    expect(() =>
      assertVoiceCloneRequestAllowed({
        sourceAudioAssetId: 'asset-1',
        requestedVoiceId: 'host-voice',
        voiceOwner: 'Host A',
        consentEvidenceRef: '',
        intendedUse: 'Authorized preview voiceover.',
        allowedScopes: ['company-live-preview'],
        riskContext: { riskLevel: 'high', reason: 'voice_clone' }
      })
    ).toThrow('Voice clone consent evidence is required.');
  });
});
```

- [ ] **Step 2: Create package manifests**

Create `agents/audio/package.json`:

```json
{
  "name": "@agent/agents-audio",
  "version": "0.1.0",
  "main": "build/cjs/index.js",
  "module": "build/esm/index.mjs",
  "types": "build/types/agents/audio/src/index.d.ts",
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "import": {
        "types": "./build/types/agents/audio/src/index.d.ts",
        "default": "./build/esm/index.mjs"
      },
      "require": {
        "types": "./build/types/agents/audio/src/index.d.ts",
        "default": "./build/cjs/index.js"
      }
    }
  },
  "scripts": {
    "build:transpile": "tsup",
    "build:types": "tsc -p tsconfig.types.json",
    "build:lib": "pnpm build:transpile && pnpm build:types",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "pnpm --dir ../.. exec vitest run --config vitest.config.js agents/audio/test --exclude '**/*.int-spec.ts' --exclude '**/*.int-spec.tsx'",
    "turbo:typecheck": "pnpm typecheck",
    "turbo:test:unit": "pnpm test",
    "verify": "pnpm typecheck && pnpm test && pnpm build:lib"
  },
  "dependencies": {
    "@agent/agent-kit": "workspace:*",
    "@agent/core": "workspace:*",
    "zod": "^4.3.6"
  }
}
```

Create `agents/image/package.json` and `agents/video/package.json` with the same structure, changing `name`, `types`, and test paths to `@agent/agents-image` / `agents/image` and `@agent/agents-video` / `agents/video`.

- [ ] **Step 3: Add package tsconfig files by copying existing agent pattern**

Copy the shape of `agents/data-report/tsconfig.json`, `agents/data-report/tsconfig.types.json`, and `agents/data-report/tsup.config.ts` into each new package, replacing path references from `agents/data-report` to `agents/audio`, `agents/image`, and `agents/video`.

Run:

```bash
pnpm install
```

Expected: `pnpm-lock.yaml` gains importers for `agents/audio`, `agents/image`, and `agents/video`.

- [ ] **Step 4: Implement Audio skeleton and policy**

Create `agents/audio/src/flows/voice-clone/voice-clone-policy.ts`:

```ts
import { VoiceCloneRequestSchema, type VoiceCloneRequest } from '@agent/core';

export function assertVoiceCloneRequestAllowed(input: VoiceCloneRequest): VoiceCloneRequest {
  const request = VoiceCloneRequestSchema.parse(input);
  if (!request.consentEvidenceRef.trim()) {
    throw new Error('Voice clone consent evidence is required.');
  }
  if (!request.allowedScopes.length) {
    throw new Error('Voice clone allowed scopes are required.');
  }
  return request;
}
```

Create `agents/audio/src/runtime/audio-domain-runtime.ts`:

```ts
import type { AudioProvider, MusicProvider } from '@agent/agent-kit';

export interface AudioDomainRuntime {
  audioProvider: AudioProvider;
  musicProvider?: MusicProvider;
}

export function createAudioDomainRuntime(runtime: AudioDomainRuntime): AudioDomainRuntime {
  return runtime;
}
```

Create `agents/audio/src/index.ts`:

```ts
export { assertVoiceCloneRequestAllowed } from './flows/voice-clone/voice-clone-policy';
export { createAudioDomainRuntime };
export type { AudioDomainRuntime } from './runtime/audio-domain-runtime';
```

- [ ] **Step 5: Implement Image and Video skeletons**

Create `agents/image/src/index.ts`:

```ts
export const imageDomainDescriptor = {
  agentId: 'official.image',
  displayName: 'Image Domain',
  capabilities: ['media.image.generate', 'media.image.edit', 'media.image.review']
} as const;
```

Create `agents/video/src/index.ts`:

```ts
export const videoDomainDescriptor = {
  agentId: 'official.video',
  displayName: 'Video Domain',
  capabilities: ['media.video.generate', 'media.video.template', 'media.video.review']
} as const;
```

- [ ] **Step 6: Run tests and package checks**

Run:

```bash
pnpm --filter @agent/agents-audio test
pnpm --filter @agent/agents-audio typecheck
pnpm --filter @agent/agents-image typecheck
pnpm --filter @agent/agents-video typecheck
```

Expected: all pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add agents/audio agents/image agents/video pnpm-lock.yaml
git commit -m "feat: add media domain agent skeletons"
```

## Task 6: CompanyLive Content-to-Media Contract

**Files:**

- Create: `agents/company-live/package.json`
- Create: `agents/company-live/src/index.ts`
- Create: `agents/company-live/src/flows/content/company-live-content-brief.ts`
- Test: `agents/company-live/test/company-live-content-brief.test.ts`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Write failing CompanyLive content brief test**

Create `agents/company-live/test/company-live-content-brief.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildCompanyLiveMediaRequest } from '../src';

describe('@agent/agents-company-live content-to-media workflow', () => {
  it('turns a CompanyLive content brief into a media request', () => {
    const request = buildCompanyLiveMediaRequest({
      briefId: 'brief-1',
      targetPlatform: 'TikTok',
      targetRegion: 'US',
      language: 'en-US',
      audienceProfile: 'US skincare shoppers.',
      productRefs: ['sku-1'],
      sellingPoints: ['Fast glow', 'Launch discount'],
      offer: '20% off',
      script: 'Show the result, then the bundle.',
      visualBrief: 'Vertical cover image with product bundle.',
      voiceBrief: 'Energetic English voiceover.',
      videoBrief: '30 second vertical preview.',
      complianceNotes: ['Avoid medical claims.'],
      riskLevel: 'medium',
      evidenceRefs: ['ev-1'],
      createdAt: '2026-04-27T00:00:00.000Z'
    });

    expect(request.sourceBriefId).toBe('brief-1');
    expect(request.requestedAssets.video?.aspectRatio).toBe('9:16');
    expect(request.reviewPolicy).toBe('risk-and-quality');
  });
});
```

- [ ] **Step 2: Create package manifest**

Create `agents/company-live/package.json` using the same package structure as `agents/audio/package.json`, with:

```json
{
  "name": "@agent/agents-company-live",
  "types": "build/types/agents/company-live/src/index.d.ts"
}
```

Also add `tsconfig.json`, `tsconfig.types.json`, and `tsup.config.ts` by following the new media package pattern.

Run:

```bash
pnpm install
```

Expected: `pnpm-lock.yaml` gains an importer for `agents/company-live`.

- [ ] **Step 3: Implement deterministic content-to-media builder**

Create `agents/company-live/src/flows/content/company-live-content-brief.ts`:

```ts
import {
  CompanyLiveContentBriefSchema,
  CompanyLiveMediaRequestSchema,
  type CompanyLiveContentBrief,
  type CompanyLiveMediaRequest
} from '@agent/core';

export function buildCompanyLiveMediaRequest(input: CompanyLiveContentBrief): CompanyLiveMediaRequest {
  const brief = CompanyLiveContentBriefSchema.parse(input);
  return CompanyLiveMediaRequestSchema.parse({
    requestId: `${brief.briefId}-media-request`,
    sourceBriefId: brief.briefId,
    requestedAssets: {
      image: { count: 1, purpose: 'cover' },
      voiceover: { durationMs: 30000 },
      video: { durationMs: 30000, aspectRatio: '9:16' }
    },
    reviewPolicy: 'risk-and-quality',
    approvalPolicy: 'voice-clone-requires-consent',
    deliveryFormat: 'preview-bundle'
  });
}
```

Create `agents/company-live/src/index.ts`:

```ts
export { buildCompanyLiveMediaRequest } from './flows/content/company-live-content-brief';
```

- [ ] **Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @agent/agents-company-live test
pnpm --filter @agent/agents-company-live typecheck
```

Expected: both pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add agents/company-live pnpm-lock.yaml
git commit -m "feat: add company live media workflow contract"
```

## Task 7: Documentation Update and Verification

**Files:**

- Modify: `docs/architecture/media-provider-boundary-and-company-live-workflow.md`
- Test: repository verification commands

- [ ] **Step 1: Update implementation status in architecture doc**

Append this section to `docs/architecture/media-provider-boundary-and-company-live-workflow.md` after "实施顺序":

```md
## 16. v1.0 Implementation Status

状态：completed
最后核对：2026-04-27

v1.0 已完成以下边界：

- `packages/core/src/contracts/media` 提供 schema-first media contracts。
- `packages/agent-kit/src/media` 提供 Agent-facing provider interfaces。
- `packages/adapters/src/media/minimax` 提供 MiniMax adapter skeleton 与 mapper。
- `packages/platform-runtime/src/media` 提供默认 provider registry wiring。
- `agents/audio`、`agents/image`、`agents/video` 提供媒体 Domain skeleton。
- `agents/company-live` 提供 content brief 到 media request 的稳定转换入口。

真实 MiniMax 网络调用、后台轮询 worker、资产持久化、Admin 媒体中心和完整 CompanyLive 业务 graph 留到后续阶段。
```

- [ ] **Step 2: Run package-level verification**

Run:

```bash
pnpm --filter @agent/core test -- media-contracts.test.ts
pnpm --filter @agent/agent-kit test -- media-provider-registry.test.ts
pnpm --filter @agent/adapters test -- minimax-media-mappers.test.ts
pnpm --filter @agent/platform-runtime test -- media-provider-registry.test.ts
pnpm --filter @agent/agents-audio test
pnpm --filter @agent/agents-company-live test
pnpm check:docs
```

Expected: all pass.

- [ ] **Step 3: Run affected typechecks**

Run:

```bash
pnpm --filter @agent/core typecheck
pnpm --filter @agent/agent-kit typecheck
pnpm --filter @agent/adapters typecheck
pnpm --filter @agent/platform-runtime typecheck
pnpm --filter @agent/agents-audio typecheck
pnpm --filter @agent/agents-image typecheck
pnpm --filter @agent/agents-video typecheck
pnpm --filter @agent/agents-company-live typecheck
```

Expected: all pass.

- [ ] **Step 4: Run library build smoke**

Run:

```bash
pnpm build:lib
```

Expected: build succeeds for changed packages.

- [ ] **Step 5: Commit**

Run:

```bash
git add docs/architecture/media-provider-boundary-and-company-live-workflow.md
git commit -m "docs: record media provider implementation status"
```

## Self-Review

Spec coverage:

- MiniMax as provider, not Agent: covered by Tasks 2, 3, and 4.
- Core schema-first contracts: covered by Task 1.
- Provider interfaces in agent-kit: covered by Task 2.
- MiniMax implementation in adapters: covered by Task 3.
- Platform default wiring: covered by Task 4.
- Audio/Image/Video domain skeletons: covered by Task 5.
- Voice clone governance: covered by Tasks 1 and 5.
- CompanyLive content-to-media workflow: covered by Task 6.
- Verification and docs: covered by Task 7.

Known deliberate exclusions from v1.0:

- Real MiniMax network transport beyond injectable adapter skeleton.
- Runtime worker polling and persisted asset storage.
- Admin UI media center.
- Full CompanyLive graph and all eight business agents.
