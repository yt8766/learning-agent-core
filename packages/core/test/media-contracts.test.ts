import { describe, expect, it } from 'vitest';
import {
  CompanyLiveContentBriefSchema,
  CompanyLiveGenerateResultSchema,
  CompanyLiveMediaRequestSchema,
  CompanyLiveNodeTraceSchema,
  MediaAssetSchema,
  MediaGenerationTaskSchema,
  SpeechSynthesisRequestSchema,
  VoiceCloneRequestSchema
} from '../src';
import {
  CompanyExpertConsultationSchema,
  CompanyExpertDefinitionSchema,
  CompanyLiveBusinessPlanPatchSchema,
  ExpertFindingSchema
} from '../src/contracts/media/company-live-experts.schema';

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

  it('parses a CompanyLiveNodeTrace', () => {
    const trace = CompanyLiveNodeTraceSchema.parse({
      nodeId: 'generateAudio',
      status: 'succeeded',
      durationMs: 12,
      inputSnapshot: { audioAssetRef: null },
      outputSnapshot: { audioAssetRef: 'asset-audio-stub-1' }
    });

    expect(trace.nodeId).toBe('generateAudio');
    expect(trace.status).toBe('succeeded');
    expect(trace.durationMs).toBe(12);
    expect(trace.outputSnapshot['audioAssetRef']).toBe('asset-audio-stub-1');
  });

  it('parses a CompanyLiveGenerateResult with bundle and trace', () => {
    const result = CompanyLiveGenerateResultSchema.parse({
      bundle: {
        bundleId: 'bundle-stub-1',
        requestId: 'req-stub-1',
        assets: [],
        createdAt: '2026-04-29T00:00:00.000Z'
      },
      trace: [
        {
          nodeId: 'generateAudio',
          status: 'succeeded',
          durationMs: 12,
          inputSnapshot: { audioAssetRef: null },
          outputSnapshot: { audioAssetRef: 'asset-audio-stub-1' }
        },
        {
          nodeId: 'assembleBundle',
          status: 'succeeded',
          durationMs: 3,
          inputSnapshot: { assetCount: 3 },
          outputSnapshot: { bundleId: 'bundle-stub-1' }
        }
      ]
    });

    expect(result.bundle.bundleId).toBe('bundle-stub-1');
    expect(result.trace).toHaveLength(2);
    expect(result.trace[0]?.nodeId).toBe('generateAudio');
  });

  it('rejects CompanyLiveNodeTrace with invalid status', () => {
    expect(() =>
      CompanyLiveNodeTraceSchema.parse({
        nodeId: 'generateAudio',
        status: 'unknown',
        durationMs: 12,
        inputSnapshot: {},
        outputSnapshot: {}
      })
    ).toThrow();
  });
});

describe('company-live expert consultation contracts', () => {
  const buildConsultation = (overrides: Record<string, unknown> = {}) => ({
    consultationId: 'consult-brief-1-001',
    briefId: 'brief-1',
    userQuestion: '这个项目缺什么？',
    selectedExperts: ['productAgent', 'operationsAgent', 'contentAgent', 'growthAgent', 'financeAgent'],
    expertFindings: [
      {
        expertId: 'productAgent',
        role: 'product',
        summary: '产品定位需要更清楚。',
        diagnosis: ['目标用户和购买理由仍偏泛。'],
        recommendations: ['补充核心用户画像。'],
        questionsToUser: ['主推 SKU 是哪一个？'],
        risks: ['卖点分散会降低转化。'],
        confidence: 0.66,
        source: 'fallback'
      },
      {
        expertId: 'operationsAgent',
        role: 'operations',
        summary: '直播执行排期需要拆到可操作节点。',
        diagnosis: ['主播协作和场控流程还缺少明确负责人。'],
        recommendations: ['补充直播排期和场控 checklist。'],
        questionsToUser: ['首场直播计划在哪一天？'],
        risks: ['执行节奏不清会影响开播质量。'],
        confidence: 0.62,
        source: 'fallback'
      },
      {
        expertId: 'contentAgent',
        role: 'content',
        summary: '内容话术需要贴近目标区域。',
        diagnosis: ['脚本缺少本地化表达和素材节奏。'],
        recommendations: ['补充平台首屏话术和素材分镜。'],
        questionsToUser: ['目标平台主推哪种内容形式？'],
        risks: ['内容表达泛化会降低停留时长。'],
        confidence: 0.64,
        source: 'fallback'
      },
      {
        expertId: 'growthAgent',
        role: 'growth',
        summary: '增长目标需要量化。',
        diagnosis: ['GMV、转化率和复购目标尚未拆分。'],
        recommendations: ['先定义首场直播转化目标。'],
        questionsToUser: ['首场直播目标 GMV 是多少？'],
        risks: ['缺少目标会影响投放和复盘。'],
        confidence: 0.61,
        source: 'fallback'
      },
      {
        expertId: 'financeAgent',
        role: 'finance',
        summary: '财务护栏需要补齐。',
        diagnosis: ['缺少成本、库存和折扣边界。'],
        recommendations: ['补充商品成本和目标毛利。'],
        questionsToUser: ['每个 SKU 的成本是多少？'],
        risks: ['折扣策略可能压缩毛利。'],
        confidence: 0.6,
        source: 'fallback'
      }
    ],
    missingInputs: ['商品成本', '库存'],
    conflicts: [
      {
        conflictId: 'conflict-discount-margin',
        summary: '增长折扣与毛利护栏存在冲突。',
        expertIds: ['growthAgent', 'financeAgent'],
        resolutionHint: '先补成本和目标毛利，再确认折扣。'
      }
    ],
    nextActions: [
      {
        actionId: 'action-fill-cost',
        ownerExpertId: 'financeAgent',
        label: '补充商品成本和折扣边界',
        priority: 'high'
      }
    ],
    businessPlanPatch: {
      briefId: 'brief-1',
      updates: [
        {
          path: 'finance.missingInputs',
          value: ['商品成本', '物流成本'],
          reason: '财务专家无法在缺少成本时判断 ROI。'
        }
      ]
    },
    createdAt: '2026-05-02T00:00:00.000Z',
    ...overrides
  });

  it('parses a company expert definition', () => {
    const definition = CompanyExpertDefinitionSchema.parse({
      expertId: 'productAgent',
      displayName: '产品专家',
      role: 'product',
      phase: 'core',
      responsibilities: ['商品定位', '用户体验'],
      boundaries: ['不审批预算'],
      keywords: ['商品', '卖点']
    });

    expect(definition.expertId).toBe('productAgent');
  });

  it('parses an expert finding', () => {
    const finding = ExpertFindingSchema.parse({
      expertId: 'riskAgent',
      role: 'risk',
      summary: '存在平台合规风险。',
      diagnosis: ['话术中包含未经证据支持的功效表达。'],
      recommendations: ['删除绝对化功效承诺。'],
      questionsToUser: ['是否有第三方检测报告？'],
      risks: ['可能触发平台审核。'],
      confidence: 0.72,
      source: 'fallback'
    });

    expect(finding.source).toBe('fallback');
  });

  it('parses a company expert consultation result', () => {
    const consultation = CompanyExpertConsultationSchema.parse(buildConsultation());

    expect(consultation.selectedExperts).toContain('productAgent');
  });

  it('rejects mismatched company expert role identities', () => {
    expect(() =>
      ExpertFindingSchema.parse({
        expertId: 'riskAgent',
        role: 'finance',
        summary: '存在平台合规风险。',
        diagnosis: ['话术中包含未经证据支持的功效表达。'],
        recommendations: ['删除绝对化功效承诺。'],
        questionsToUser: ['是否有第三方检测报告？'],
        risks: ['可能触发平台审核。'],
        confidence: 0.72,
        source: 'fallback'
      })
    ).toThrow();
  });

  it('rejects duplicate selected company experts', () => {
    expect(() =>
      CompanyExpertConsultationSchema.parse(
        buildConsultation({
          selectedExperts: ['productAgent', 'productAgent'],
          conflicts: [],
          nextActions: []
        })
      )
    ).toThrow();
  });

  it('rejects expert findings outside selected company experts', () => {
    expect(() =>
      CompanyExpertConsultationSchema.parse(
        buildConsultation({
          selectedExperts: ['productAgent', 'growthAgent', 'financeAgent'],
          expertFindings: [
            {
              expertId: 'riskAgent',
              role: 'risk',
              summary: '存在平台合规风险。',
              diagnosis: ['话术中包含未经证据支持的功效表达。'],
              recommendations: ['删除绝对化功效承诺。'],
              questionsToUser: ['是否有第三方检测报告？'],
              risks: ['可能触发平台审核。'],
              confidence: 0.72,
              source: 'fallback'
            }
          ]
        })
      )
    ).toThrow();
  });

  it('rejects selected company experts without matching findings', () => {
    expect(() =>
      CompanyExpertConsultationSchema.parse(
        buildConsultation({
          selectedExperts: ['productAgent', 'riskAgent'],
          expertFindings: [
            {
              expertId: 'productAgent',
              role: 'product',
              summary: '产品定位需要更清楚。',
              diagnosis: ['目标用户和购买理由仍偏泛。'],
              recommendations: ['补充核心用户画像。'],
              questionsToUser: ['主推 SKU 是哪一个？'],
              risks: ['卖点分散会降低转化。'],
              confidence: 0.66,
              source: 'fallback'
            }
          ],
          conflicts: [],
          nextActions: []
        })
      )
    ).toThrow();
  });

  it('rejects duplicate expert findings and conflict participants', () => {
    expect(() =>
      CompanyExpertConsultationSchema.parse(
        buildConsultation({
          expertFindings: [
            {
              expertId: 'productAgent',
              role: 'product',
              summary: '产品定位需要更清楚。',
              diagnosis: ['目标用户和购买理由仍偏泛。'],
              recommendations: ['补充核心用户画像。'],
              questionsToUser: ['主推 SKU 是哪一个？'],
              risks: ['卖点分散会降低转化。'],
              confidence: 0.66,
              source: 'fallback'
            },
            {
              expertId: 'productAgent',
              role: 'product',
              summary: '重复产品专家结论。',
              diagnosis: ['重复诊断。'],
              recommendations: ['合并结论。'],
              questionsToUser: [],
              risks: [],
              confidence: 0.6,
              source: 'fallback'
            }
          ]
        })
      )
    ).toThrow();

    expect(() =>
      CompanyExpertConsultationSchema.parse(
        buildConsultation({
          conflicts: [
            {
              conflictId: 'conflict-duplicate-expert',
              summary: '同一专家不应在冲突参与方中重复出现。',
              expertIds: ['growthAgent', 'growthAgent'],
              resolutionHint: '去重后再表达冲突。'
            }
          ]
        })
      )
    ).toThrow();
  });

  it('rejects conflict and next-action experts outside selected company experts', () => {
    expect(() =>
      CompanyExpertConsultationSchema.parse(
        buildConsultation({
          selectedExperts: ['productAgent', 'growthAgent'],
          conflicts: [
            {
              conflictId: 'conflict-unselected-expert',
              summary: '冲突参与方包含未选专家。',
              expertIds: ['growthAgent', 'financeAgent'],
              resolutionHint: '只能引用已选专家。'
            }
          ],
          nextActions: []
        })
      )
    ).toThrow();

    expect(() =>
      CompanyExpertConsultationSchema.parse(
        buildConsultation({
          selectedExperts: ['productAgent', 'growthAgent', 'financeAgent'],
          nextActions: [
            {
              actionId: 'action-risk-review',
              ownerExpertId: 'riskAgent',
              label: '复核合规风险',
              priority: 'high'
            }
          ]
        })
      )
    ).toThrow();
  });

  it('parses json company live business plan patch values', () => {
    const validJsonValues = [
      null,
      'launch plan',
      12.5,
      true,
      ['商品成本', '物流成本'],
      { key: 'value' },
      {
        finance: {
          missingInputs: ['商品成本', '物流成本'],
          ready: false
        }
      }
    ];

    validJsonValues.forEach((value, index) => {
      const patch = CompanyLiveBusinessPlanPatchSchema.parse({
        briefId: 'brief-1',
        updates: [
          {
            path: `runtime.value.${index}`,
            value,
            reason: '合法 JSON 值可以进入业务计划 patch。'
          }
        ]
      });

      expect(patch.updates[0]?.value).toEqual(value);
    });
  });

  it('rejects non-json company live business plan patch values', () => {
    class RuntimePatchValue {
      value = 'not-json';
    }

    const nonJsonValues = [
      () => 'not-json',
      Symbol('not-json'),
      new Date('2026-05-02T00:00:00.000Z'),
      new Map([['key', 'value']]),
      new RuntimePatchValue()
    ];

    nonJsonValues.forEach(value => {
      expect(() =>
        CompanyLiveBusinessPlanPatchSchema.parse({
          briefId: 'brief-1',
          updates: [
            {
              path: 'runtime.value',
              value,
              reason: '非 JSON 值不能进入 JSON patch。'
            }
          ]
        })
      ).toThrow();
    });
  });

  it('rejects invalid confidence source and action priority values', () => {
    expect(() =>
      ExpertFindingSchema.parse({
        expertId: 'riskAgent',
        role: 'risk',
        summary: '存在平台合规风险。',
        diagnosis: ['话术中包含未经证据支持的功效表达。'],
        recommendations: ['删除绝对化功效承诺。'],
        questionsToUser: ['是否有第三方检测报告？'],
        risks: ['可能触发平台审核。'],
        confidence: 1.2,
        source: 'fallback'
      })
    ).toThrow();

    expect(() =>
      ExpertFindingSchema.parse({
        expertId: 'riskAgent',
        role: 'risk',
        summary: '存在平台合规风险。',
        diagnosis: ['话术中包含未经证据支持的功效表达。'],
        recommendations: ['删除绝对化功效承诺。'],
        questionsToUser: ['是否有第三方检测报告？'],
        risks: ['可能触发平台审核。'],
        confidence: 0.72,
        source: 'manual'
      })
    ).toThrow();

    expect(() =>
      CompanyExpertConsultationSchema.parse(
        buildConsultation({
          nextActions: [
            {
              actionId: 'action-fill-cost',
              ownerExpertId: 'financeAgent',
              label: '补充商品成本和折扣边界',
              priority: 'urgent'
            }
          ]
        })
      )
    ).toThrow();
  });
});
