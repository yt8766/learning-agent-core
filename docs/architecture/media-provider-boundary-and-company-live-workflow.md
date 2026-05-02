# Media Provider Boundary 与 CompanyLive 工作流

状态：current
文档类型：architecture
适用范围：`packages/core`、`packages/runtime`、`packages/adapters`、`packages/platform-runtime`、`agents/audio`、`agents/image`、`agents/video`、`agents/company-live`
最后核对：2026-05-12

本文定义媒体生成能力与公司海外直播业务 Agent 的目标边界。当前结论是：MiniMax 是默认媒体模型 provider，不是 Agent；Audio / Image / Video 是平台级媒体 Domain；CompanyLive 只产出业务内容需求与经营判断，不直接调用厂商 API。

## 1. 目标

v1.0 目标是跑通一条可治理、可替换、可观测的媒体生成闭环：

```text
CompanyLive 内容需求
-> ContentBrief
-> Audio / Image / Video Domain
-> Media Provider Interface
-> MiniMax Adapter
-> MediaAsset / MediaGenerationTask
-> Review / Risk
-> Evidence / Trajectory
```

这条链路必须满足：

- Agent 不直接依赖 MiniMax 字段、URL、task id 或错误码。
- MiniMax 实现只出现在 `packages/adapters`。
- 稳定 JSON contract 先落 `packages/core`。
- Agent 可消费接口落 `packages/runtime`。
- 默认 provider 装配落 `packages/platform-runtime`。
- 音色克隆必须走授权、风险审查与审批边界。

## 2. 分层边界

推荐依赖方向：

```text
agents/audio ─┐
agents/image ─┼─> @agent/runtime media provider interfaces
agents/video ─┘
                    ↑
              @agent/core media schemas

packages/platform-runtime
  -> createDefaultMediaProviders()
  -> 注入 MiniMax providers

packages/adapters
  -> MiniMax provider implementations
```

各层职责：

- `packages/core`：媒体资产、媒体任务、语音、图片、视频、音乐、错误与治理请求的 schema-first contract。
- `packages/runtime`：`AudioProvider`、`ImageProvider`、`VideoProvider`、`MusicProvider` 与 `MediaProviderRegistry` 接口。
- `packages/adapters`：MiniMax HTTP / WebSocket client、request/response mapper、provider error 映射、任务状态映射。
- `packages/platform-runtime`：读取配置并装配默认 MiniMax provider。
- `agents/audio`、`agents/image`、`agents/video`：业务编排、prompt、review、asset delivery；只消费 provider interface。
- `agents/company-live`：生成直播业务 brief、媒体需求、风险上下文与业务复盘；不直接生成媒体资产。

禁止路径：

```text
agents/audio -> MiniMax API
agents/video -> packages/adapters/src/media/minimax
packages/runtime -> MiniMax provider
packages/core -> MiniMax 专属字段
```

## 3. 目录规划

媒体 contract：

```text
packages/core/src/contracts/media/
├─ media-asset.schema.ts
├─ media-task.schema.ts
├─ media-error.schema.ts
├─ audio.schema.ts
├─ image.schema.ts
├─ video.schema.ts
├─ music.schema.ts
├─ voice-clone.schema.ts
└─ index.ts
```

Agent 侧 provider interface：

```text
packages/runtime/src/media/
├─ audio-provider.ts
├─ image-provider.ts
├─ video-provider.ts
├─ music-provider.ts
├─ media-provider-registry.ts
└─ index.ts
```

MiniMax adapter：

```text
packages/adapters/src/media/minimax/
├─ client/
│  ├─ minimax-http-client.ts
│  ├─ minimax-websocket-client.ts
│  └─ minimax-config.ts
├─ audio/
│  ├─ minimax-audio-provider.ts
│  ├─ minimax-voice-catalog.ts
│  ├─ minimax-voice-clone.mapper.ts
│  └─ minimax-speech.mapper.ts
├─ image/
│  ├─ minimax-image-provider.ts
│  └─ minimax-image.mapper.ts
├─ video/
│  ├─ minimax-video-provider.ts
│  ├─ minimax-video-task-poller.ts
│  └─ minimax-video.mapper.ts
├─ music/
│  ├─ minimax-music-provider.ts
│  └─ minimax-music.mapper.ts
├─ errors/
│  └─ minimax-error.mapper.ts
└─ index.ts
```

默认装配：

```text
packages/platform-runtime/src/media/
├─ create-default-media-providers.ts
├─ media-provider-registry.ts
└─ index.ts
```

媒体 Agent：

```text
agents/audio/src/
agents/image/src/
agents/video/src/
```

CompanyLive：

```text
agents/company-live/src/
├─ graphs/company-live.graph.ts
├─ flows/
│  ├─ supervisor/
│  ├─ growth/
│  ├─ operations/
│  ├─ risk/
│  ├─ product/
│  ├─ finance/
│  ├─ support/
│  ├─ content/
│  └─ intelligence/
├─ prompts/
├─ schemas/
├─ runtime/
└─ types/
```

## 4. 核心媒体 contract

`MediaAsset` 表示已经可引用的媒体产物：

```text
MediaAsset
├─ assetId
├─ kind: image | audio | video | music | transcript
├─ uri
├─ mimeType
├─ durationMs?
├─ width?
├─ height?
├─ sizeBytes?
├─ provider
├─ model?
├─ provenance
└─ createdAt
```

`MediaGenerationTask` 表示异步或同步生成任务的统一投影：

```text
MediaGenerationTask
├─ taskId
├─ kind: image | audio | video | music
├─ provider
├─ status: queued | running | succeeded | failed | canceled
├─ providerTaskId?
├─ assetRefs
├─ error?
├─ evidenceRefs
├─ createdAt
├─ updatedAt
└─ completedAt?
```

`MediaProviderError` 表示厂商错误归一化结果：

```text
MediaProviderError
├─ provider
├─ code
├─ message
├─ retryable
├─ rawRef?
└─ occurredAt
```

## 5. Provider interface

`packages/runtime` 暴露 Agent 可消费接口：

```ts
export interface AudioProvider {
  listSystemVoices(input: ListSystemVoicesInput): Promise<ListSystemVoicesResult>;
  cloneVoice(input: VoiceCloneInput): Promise<VoiceCloneResult>;
  synthesizeSpeech(input: SpeechSynthesisInput): Promise<SpeechSynthesisResult>;
  createSpeechTask(input: AsyncSpeechInput): Promise<MediaGenerationTask>;
  getSpeechTask(input: MediaTaskQuery): Promise<MediaGenerationTask>;
}

export interface ImageProvider {
  generateImage(input: ImageGenerationInput): Promise<ImageGenerationResult>;
  generateImageFromReference(input: ImageReferenceGenerationInput): Promise<ImageGenerationResult>;
}

export interface VideoProvider {
  createTextToVideoTask(input: TextToVideoInput): Promise<MediaGenerationTask>;
  createImageToVideoTask(input: ImageToVideoInput): Promise<MediaGenerationTask>;
  createFirstLastFrameTask(input: FirstLastFrameVideoInput): Promise<MediaGenerationTask>;
  createSubjectReferenceTask(input: SubjectReferenceVideoInput): Promise<MediaGenerationTask>;
  createTemplateVideoTask(input: TemplateVideoInput): Promise<MediaGenerationTask>;
  getVideoTask(input: MediaTaskQuery): Promise<MediaGenerationTask>;
}

export interface MusicProvider {
  generateLyrics(input: LyricsGenerationInput): Promise<LyricsGenerationResult>;
  createMusicTask(input: MusicGenerationInput): Promise<MediaGenerationTask>;
  getMusicTask(input: MediaTaskQuery): Promise<MediaGenerationTask>;
}
```

## 6. MiniMax 默认能力映射

MiniMax 是 v1.0 默认 provider。参考入口：

- [音色快速复刻](https://platform.minimaxi.com/docs/guides/speech-voice-clone)
- [同步语音合成](https://platform.minimaxi.com/docs/guides/speech-t2a-websocket)
- [异步语音合成](https://platform.minimaxi.com/docs/guides/speech-t2a-async)
- [系统音色列表](https://platform.minimaxi.com/docs/faq/system-voice-id)
- [视频生成](https://platform.minimaxi.com/docs/guides/video-generation)
- [模板视频生成](https://platform.minimaxi.com/docs/guides/video-agent)
- [音乐生成](https://platform.minimaxi.com/docs/guides/music-generation)
- [图片生成](https://platform.minimaxi.com/docs/guides/image-generation)

映射关系：

```text
MiniMax voice clone       -> AudioProvider.cloneVoice()
MiniMax t2a websocket     -> AudioProvider.synthesizeSpeech()
MiniMax t2a async         -> AudioProvider.createSpeechTask() / getSpeechTask()
MiniMax system voices     -> AudioProvider.listSystemVoices()
MiniMax image generation  -> ImageProvider.generateImage()
MiniMax video generation  -> VideoProvider.create*VideoTask()
MiniMax video templates   -> VideoProvider.createTemplateVideoTask()
MiniMax music generation  -> MusicProvider.createMusicTask()
```

MiniMax 模型名只允许在 adapter、配置或模型选择策略中出现，不进入 Agent prompt 或公共业务 contract。

语音模型默认策略：

```text
speech-2.8-hd     -> 高质量营销口播、直播素材、情绪表达
speech-2.8-turbo  -> 快速批量素材、多版本 A/B
speech-2.6-hd     -> 低延时高自然度
speech-2.6-turbo  -> 语音聊天、数字人、低成本快速响应
speech-02-hd      -> 音色复刻相似度和稳定性优先
speech-02-turbo   -> 小语种、多语言、性能优先
```

## 7. AudioDomain

```text
AudioDomainSupervisor
├─ AudioBriefAgent
├─ VoiceCatalogAgent
├─ VoiceCloneAgent
├─ SpeechSynthesisAgent
├─ LongSpeechSynthesisAgent
├─ MusicAgent
├─ SoundEffectAgent
├─ TranscriptAgent
├─ AudioReviewAgent
└─ AssetDeliveryAgent
```

职责：

- 系统音色选择与音色目录投影。
- 授权音色克隆。
- 同步或异步语音合成。
- 音乐或音效生成。
- 音频质量、版权、合规审查。
- 产物交付与 evidence 记录。

## 8. Voice Clone 治理

音色克隆不是普通生成能力，必须走高风险治理边界。

`VoiceCloneRequest` 至少包含：

```text
sourceAudioAssetId
requestedVoiceId
voiceOwner
consentEvidenceRef
intendedUse
allowedScopes
expiresAt?
riskContext
approvalRef?
```

流程：

```text
VoiceCloneAgent
-> 校验 voiceOwner / consentEvidenceRef / intendedUse
-> RiskAgent 或 ComplianceReviewAgent 审查
-> 高风险进入 Approval
-> AudioProvider.cloneVoice()
-> 保存 ClonedVoiceProfile
-> AudioReviewAgent
-> AssetDeliveryAgent
```

缺少授权证明时，必须拒绝，不允许调用 provider。

## 9. ImageDomain

```text
ImageDomainSupervisor
├─ ImageBriefAgent
├─ PromptDesignAgent
├─ ImageGenerationAgent
├─ ImageEditAgent
├─ ReferenceImageAgent
├─ BrandVisualAgent
├─ ImageReviewAgent
└─ AssetDeliveryAgent
```

职责：

- 将业务 brief 转成图片 prompt。
- 生成或编辑图片资产。
- 检查品牌一致性、版权风险、平台合规。
- 输出 `MediaAsset` 与 evidence。

## 10. VideoDomain

```text
VideoDomainSupervisor
├─ CreativeBriefAgent
├─ ScriptAgent
├─ StoryboardAgent
├─ ShotPlanningAgent
├─ AssetOrchestrationAgent
├─ VideoGenerationAgent
├─ TemplateVideoAgent
├─ PostProductionAgent
├─ VideoReviewAgent
└─ PublishingAgent
```

视频生成统一按异步任务处理：

```text
createTask
-> providerTaskId
-> pollStatus
-> fileId / videoUrl
-> persist MediaAsset
-> VideoReviewAgent
-> AssetDeliveryAgent
```

轮询、重试、超时、取消与 SSE 投影属于 runtime / provider registry 边界，不放进 prompt 节点。

## 11. CompanyLiveDomain

```text
CompanyLiveSupervisor
├─ GrowthAgent
├─ OperationsAgent
├─ RiskAgent
├─ ProductAgent
├─ FinanceAgent
├─ SupportAgent
├─ ContentAgent
└─ IntelligenceAgent
```

八个一级 Agent 边界：

- `GrowthAgent`：GMV、营收、转化、地区增长、主播流水、投放增长。
- `OperationsAgent`：主播运营、排班、直播间健康、场控、SOP、执行异常。
- `RiskAgent`：作弊、异常流水、退款、封禁、合规、审计，有阻断权。
- `ProductAgent`：功能体验、用户路径、转化漏斗、实验分析、留存复购。
- `FinanceAgent`：结算、成本、利润、渠道 ROI、预算、回款周期。
- `SupportAgent`：工单、投诉、差评、售后、退款原因、用户反馈。
- `ContentAgent`：直播脚本、商品话术、短视频内容、素材 brief、本地化。
- `IntelligenceAgent`：市场、竞品、平台政策、地区趋势、达人生态。

`ContentAgent` 输出业务 brief，不直接生成媒体：

```text
CompanyLiveContentBrief
├─ briefId
├─ targetPlatform
├─ targetRegion
├─ language
├─ audienceProfile
├─ productRefs
├─ sellingPoints
├─ offer
├─ script
├─ visualBrief
├─ voiceBrief
├─ videoBrief
├─ complianceNotes
├─ riskLevel
├─ evidenceRefs
└─ createdAt
```

`CompanyLiveMediaRequest` 将业务 brief 转成跨域媒体任务：

```text
CompanyLiveMediaRequest
├─ requestId
├─ sourceBriefId
├─ requestedAssets
│  ├─ image
│  ├─ voiceover
│  ├─ music
│  └─ video
├─ reviewPolicy
├─ approvalPolicy
├─ deliveryFormat
└─ deadline?
```

跨域流程：

```text
CompanyLive.ContentAgent
-> ImageDomain 生成封面/商品图
-> AudioDomain 生成口播/音乐
-> VideoDomain 生成短视频
-> RiskAgent / ReviewDomain 审查合规
```

## 12. v1.0 MVP 场景

唯一验收场景：

```text
为美国 TikTok 新品直播生成 30 秒预热视频：
英文口播 + 封面图 + 视频脚本 + 合规审查。
```

执行链：

```text
CompanyLive.ContentAgent
-> IntelligenceAgent 补平台/地区风格
-> RiskAgent 预审话术
-> ImageDomain 生成封面图
-> AudioDomain 生成英文口播
-> VideoDomain 创建视频任务
-> ReviewDomain 审查最终资产
-> 输出 GeneratedMediaBundle
```

输出：

```text
GeneratedMediaBundle
├─ script
├─ coverImage
├─ voiceoverAudio
├─ video
├─ reviewFindings
├─ riskWarnings
├─ evidenceRefs
└─ taskTrajectory
```

## 13. 验收标准

v1.0 至少满足：

- `core` media schema 有 parse 成功与失败样例。
- `runtime` provider interface 不依赖 MiniMax。
- MiniMax adapter mapper 能把厂商响应映射成统一 contract。
- `platform-runtime` 能注册默认 MiniMax provider。
- `AudioDomain` 能通过 interface 生成 TTS 请求。
- `VoiceCloneAgent` 在缺少授权证明时阻断请求。
- `ImageDomain` 能生成图片任务或 mock asset。
- `VideoDomain` 能创建异步任务并查询状态。
- `CompanyLiveContentBrief` 能驱动媒体生成。
- `ReviewDomain` / `RiskAgent` 能输出审查结果。

## 14. 实施顺序

推荐按以下顺序推进：

1. 新增本文档并完成评审。
2. 新增 `packages/core/src/contracts/media` schema。
3. 新增 `packages/runtime/src/media` provider interface。
4. 新增 `packages/adapters/src/media/minimax` skeleton 与 mapper。
5. 新增 `packages/platform-runtime/src/media` provider registry。
6. 新增或完善 `agents/audio`、`agents/image`、`agents/video` skeleton。
7. 新增 `agents/company-live` 的 content-to-media workflow contract。
8. 接入 voice clone governance。
9. 用 v1.0 MVP 场景补齐 Type / Spec / Unit / Demo / Integration 验证。

## 15. 后续扩展

后续接入 OpenAI、Runway、ElevenLabs、Suno、可灵、即梦或其他媒体模型时，只允许新增 provider adapter 与装配策略，不应修改 `agents/*` 的业务 graph 主链。

判断一个新媒体能力的落点：

- 稳定 DTO / schema：`packages/core`
- Agent 侧接口：`packages/runtime`
- 厂商 API 映射：`packages/adapters`
- 默认装配：`packages/platform-runtime`
- 业务编排：`agents/audio`、`agents/image`、`agents/video`
- 公司直播业务 brief：`agents/company-live`

## 16. 当前已落地结构（Phase 1 完成后）

### agents/image

```text
agents/image/src/
├─ flows/
│  └─ image-generation/
│     └─ image-generation-policy.ts   # assertImageGenerationRequestAllowed()
├─ runtime/
│  └─ image-domain-runtime.ts          # ImageDomainRuntime + createImageDomainRuntime()
└─ index.ts                            # 导出 policy、runtime、imageDomainDescriptor
```

Policy 规则：`count > 4` 且无 `evidenceRefs` 时拒绝，末尾调用 `ImageGenerationRequestSchema.parse()`。

### agents/video

```text
agents/video/src/
├─ flows/
│  └─ video-generation/
│     └─ video-generation-policy.ts   # assertVideoGenerationRequestAllowed()
├─ runtime/
│  └─ video-domain-runtime.ts          # VideoDomainRuntime + createVideoDomainRuntime()
└─ index.ts                            # 导出 policy、runtime、videoDomainDescriptor
```

Policy 规则：`durationMs > 300000` 或 `imageAssetRefs.length > 10` 时拒绝，末尾调用 `VideoGenerationRequestSchema.parse()`。

### agents/company-live

`companyLiveDomainDescriptor` 已标注 `type: 'composite'`、`orchestrates: ['audio', 'image', 'video']`，明确此 agent 是编排型 Domain 而非原子能力 Domain。

### agents/intel-engine

`src/services/` 目录已删除，三个执行函数迁入 `src/runtime/execution/`：

| 旧路径                                   | 新路径                                            |
| ---------------------------------------- | ------------------------------------------------- |
| `src/services/digest-intel.service.ts`   | `src/runtime/execution/digest-intel-run.ts`       |
| `src/services/patrol-intel.service.ts`   | `src/runtime/execution/patrol-intel-run.ts`       |
| `src/services/retry-delivery.service.ts` | `src/runtime/execution/retry-intel-deliveries.ts` |

所有外部 import（`src/graphs/intel/intel.graph.ts`、`src/index.ts`、相关测试文件）已同步更新到新路径。

## 16. v1.0 Implementation Status

状态：completed
最后核对：2026-04-27

v1.0 已完成以下边界：

- `packages/core/src/contracts/media` 提供 schema-first media contracts。
- `packages/runtime/src/media` 提供 Agent-facing provider interfaces。
- `packages/adapters/src/media/minimax` 提供 MiniMax adapter skeleton 与 mapper。
- `packages/platform-runtime/src/media` 提供默认 provider registry wiring。
- `agents/audio`、`agents/image`、`agents/video` 提供媒体 Domain skeleton。
- `agents/company-live` 提供 content brief 到 media request 的稳定转换入口。

真实 MiniMax 网络调用、后台轮询 worker、资产持久化、Admin 媒体中心和完整 CompanyLive 业务 graph 留到后续阶段。

## 17. v1.0 MVP E2E 打通状态

状态：completed
最后核对：2026-04-29

以 stub transport（无需真实 API key）完成前端→后端→agent graph→media providers 的完整 MVP 端到端：

### 新增模块

| 模块              | 路径                                                                                | 说明                                                                          |
| ----------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Graph + 节点      | `agents/company-live/src/graphs/company-live.graph.ts`                              | 顺序 pipeline：generateAudio → generateImage → generateVideo → assembleBundle |
| Stub Registry     | `agents/company-live/src/runtime/company-live-domain-runtime.ts`                    | `createCompanyLiveStubRegistry()` 返回 mock asset，不发 HTTP                  |
| 节点 trace schema | `packages/core/src/contracts/media/company-live-generate-result.schema.ts`          | `CompanyLiveNodeTraceSchema` + `CompanyLiveGenerateResultSchema`              |
| 后端 endpoint     | `apps/backend/agent-server/src/company-live/`                                       | POST /company-live/generate → service → graph                                 |
| 前端 API 客户端   | `apps/frontend/agent-admin/src/api/company-live.api.ts`                             | `generateCompanyLive(brief)`                                                  |
| 前端生成表单      | `apps/frontend/agent-admin/src/pages/company-agents/company-live-generate-form.tsx` | 输入 briefId/platform/script/duration/voiceId                                 |
| 前端结果展示      | `apps/frontend/agent-admin/src/pages/company-agents/company-live-bundle-result.tsx` | 展示 GeneratedMediaBundle.assets                                              |
| 前端节点轨迹      | `apps/frontend/agent-admin/src/pages/company-agents/company-live-node-trace.tsx`    | 时间线：nodeId、status、durationMs、input/output snapshot                     |

### 接口文档

`docs/contracts/api/company-live-generate.md` — POST /api/company-live/generate 完整接口定义。

### 验证状态

- Spec：`packages/core/test/media-contracts.test.ts` 7 ✅
- Unit/Graph：`agents/company-live/test/company-live-graph.test.ts` 5 ✅
- Demo/Controller：`apps/backend/agent-server/test/company-live/company-live.controller.spec.ts` 2 ✅
- Frontend API：`apps/frontend/agent-admin/test/api/admin-api-company-live.test.ts` 2 ✅
- Typecheck：core、company-live、backend、agent-admin 四层全通过

### 已知限制

- stub registry 返回固定 mock asset，不发真实 HTTP
- video stub 直接构造 MediaAsset，不经 task polling
- GeneratedMediaBundle.assets 无 `sourceNodeId` 字段（schema 未定义此字段）
