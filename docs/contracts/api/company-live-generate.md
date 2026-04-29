# Company Live Generate API

路径：`POST /api/company-live/generate`
版本：v1（MVP stub）
状态：current
文档类型：reference
适用范围：`agents/company-live`、`apps/backend/agent-server`、`apps/frontend/agent-admin`
最后核对：2026-04-29
最后更新：2026-04-29

---

## 接口目的

接收 `CompanyLiveContentBrief`，驱动 `company-live.graph` 顺序调用 audio/image/video stub provider，返回 `GeneratedMediaBundle` 和节点执行轨迹。

本 MVP 使用 stub transport，不发出真实 HTTP 请求，assetRef 为 mock 字符串。

---

## 请求

### Header

| 字段           | 值                 |
| -------------- | ------------------ |
| `Content-Type` | `application/json` |

### 请求体（`CompanyLiveContentBrief`）

```json
{
  "briefId": "brief-demo-1",
  "targetPlatform": "TikTok",
  "targetRegion": "US",
  "language": "en-US",
  "audienceProfile": "US skincare shoppers",
  "productRefs": ["sku-1"],
  "sellingPoints": ["Fast glow", "Launch discount"],
  "offer": "20% off",
  "script": "Show the result, then the bundle.",
  "visualBrief": "Vertical cover image with product bundle.",
  "voiceBrief": "Energetic English voiceover.",
  "videoBrief": "30 second vertical preview.",
  "complianceNotes": ["Avoid medical claims."],
  "riskLevel": "medium",
  "evidenceRefs": [],
  "createdAt": "2026-04-29T00:00:00.000Z"
}
```

字段约束见 `packages/core/src/contracts/media/company-live-media.schema.ts` → `CompanyLiveContentBriefSchema`。

---

## 响应

### 200 成功

响应体：`CompanyLiveGenerateResult`（见 `packages/core/src/contracts/media/company-live-generate-result.schema.ts`）

```json
{
  "bundle": {
    "bundleId": "bundle-brief-demo-1",
    "requestId": "req-brief-demo-1",
    "sourceBriefId": "brief-demo-1",
    "assets": [
      {
        "assetId": "asset-audio-stub-1",
        "kind": "audio",
        "uri": "memory://stub/audio-brief-demo-1.mp3",
        "mimeType": "audio/mpeg",
        "provider": "minimax",
        "createdAt": "2026-04-29T00:00:00.000Z"
      },
      {
        "assetId": "asset-image-stub-1",
        "kind": "image",
        "uri": "memory://stub/image-brief-demo-1.webp",
        "mimeType": "image/webp",
        "provider": "minimax",
        "createdAt": "2026-04-29T00:00:00.000Z"
      },
      {
        "assetId": "asset-video-stub-1",
        "kind": "video",
        "uri": "memory://stub/video-brief-demo-1.mp4",
        "mimeType": "video/mp4",
        "provider": "minimax",
        "createdAt": "2026-04-29T00:00:00.000Z"
      }
    ],
    "createdAt": "2026-04-29T00:00:00.000Z"
  },
  "trace": [
    {
      "nodeId": "generateAudio",
      "status": "succeeded",
      "durationMs": 12,
      "inputSnapshot": { "briefId": "brief-demo-1", "audioAsset": null },
      "outputSnapshot": { "audioAsset": { "assetId": "asset-audio-stub-1" } }
    },
    {
      "nodeId": "generateImage",
      "status": "succeeded",
      "durationMs": 8,
      "inputSnapshot": { "imageAsset": null },
      "outputSnapshot": { "imageAsset": { "assetId": "asset-image-stub-1" } }
    },
    {
      "nodeId": "generateVideo",
      "status": "succeeded",
      "durationMs": 15,
      "inputSnapshot": { "videoAsset": null },
      "outputSnapshot": { "videoAsset": { "assetId": "asset-video-stub-1" } }
    },
    {
      "nodeId": "assembleBundle",
      "status": "succeeded",
      "durationMs": 3,
      "inputSnapshot": { "assetCount": 3 },
      "outputSnapshot": { "bundleId": "bundle-brief-demo-1", "assetCount": 3 }
    }
  ]
}
```

### 400 请求体校验失败

brief 不符合 `CompanyLiveContentBriefSchema` 约束时返回，携带 zod 错误摘要。

### 500 图执行失败

`company-live.graph` 执行异常时返回。

---

## Schema 定义位置

| Schema                      | 路径                                                                       |
| --------------------------- | -------------------------------------------------------------------------- |
| `CompanyLiveContentBrief`   | `packages/core/src/contracts/media/company-live-media.schema.ts`           |
| `GeneratedMediaBundle`      | `packages/core/src/contracts/media/company-live-media.schema.ts`           |
| `CompanyLiveNodeTrace`      | `packages/core/src/contracts/media/company-live-generate-result.schema.ts` |
| `CompanyLiveGenerateResult` | `packages/core/src/contracts/media/company-live-generate-result.schema.ts` |

---

## 字段演进约束

- `bundle.*` 字段增减必须同步更新 `GeneratedMediaBundleSchema`
- `trace[].inputSnapshot` / `outputSnapshot` 为 `Record<string, unknown>`，字段内容随节点实现变化，不做版本约束
- 新增 trace 字段（如 LLM prompt/response）需先扩展 `CompanyLiveNodeTraceSchema`

---

## MVP 已知限制

- stub transport：不发真实 HTTP，assetRef 为 mock 字符串
- 不支持 SSE 流式返回
- 不持久化 bundle 或 trace 记录
- 通用 Graph Studio 留到后续阶段
