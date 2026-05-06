# Company Live Experts Consult API

路径：`POST /api/company-live/experts/consult`
版本：v1（MVP）
状态：current
文档类型：reference
适用范围：`packages/core`、`agents/company-live`、`apps/backend/agent-server`、`apps/frontend/agent-admin`
最后核对：2026-05-02

---

## 接口目的

接收一个公司直播专家会诊问题和简化直播 brief，由后端补全并解析成 `CompanyLiveContentBrief`，调用 `agents/company-live` 的专家会诊 graph，返回稳定的 `CompanyExpertConsultation`。

该接口只负责业务会诊，不强制触发图片、音频、视频或音乐生成。需要媒体生成时，调用方仍应使用 `POST /api/company-live/generate` 或后续媒体编排入口。

---

## 请求

### Header

| 字段           | 值                 |
| -------------- | ------------------ |
| `Content-Type` | `application/json` |

### 请求体

请求体必须是对象：

```json
{
  "question": "这段直播开场如何提高停留和转化？",
  "brief": {
    "briefId": "brief-001",
    "targetPlatform": "douyin",
    "script": "欢迎来到新品直播间，今天主推...",
    "durationSeconds": 60,
    "speakerVoiceId": "voice-default",
    "targetRegion": "CN",
    "language": "zh",
    "audienceProfile": "新客与复购用户",
    "productRefs": ["sku-001"],
    "sellingPoints": ["限时优惠", "组合装"],
    "riskLevel": "low"
  }
}
```

字段说明：

| 字段                       | 类型                          | 必填 | 说明                                                                                        |
| -------------------------- | ----------------------------- | ---- | ------------------------------------------------------------------------------------------- |
| `question`                 | `string`                      | 是   | 用户提交的会诊问题；后端会 `trim()` 并要求非空。                                            |
| `brief`                    | `CompanyLiveGenerateBrief`    | 是   | Admin 表单使用的简化输入。后端会先按 DTO parse，再补全为 `CompanyLiveContentBrief`。        |
| `brief.briefId`            | `string`                      | 是   | 直播 brief 标识；同时用于响应中的 `briefId` 和 `businessPlanPatch.briefId`。                |
| `brief.targetPlatform`     | `string`                      | 是   | 目标平台，例如 `douyin`、`TikTok`。                                                         |
| `brief.script`             | `string`                      | 否   | 当前脚本内容；专家会诊可围绕该内容给出诊断。                                                |
| `brief.durationSeconds`    | `number`                      | 否   | Admin 简化表单字段；当前后端 DTO 接收但不会写入 `CompanyLiveContentBrief` 的稳定 contract。 |
| `brief.speakerVoiceId`     | `string`                      | 否   | Admin 简化表单字段；当前后端 DTO 接收但不会写入 `CompanyLiveContentBrief` 的稳定 contract。 |
| `brief.backgroundMusicUri` | `string`                      | 否   | Admin 简化表单字段；当前会诊接口只接收，不触发音乐 provider。                               |
| `brief.brandKitRef`        | `string`                      | 否   | Admin 简化表单字段；当前会诊接口只接收，不读取品牌资产。                                    |
| `brief.requestedBy`        | `string`                      | 否   | Admin 简化表单字段；当前会诊响应不回传该字段。                                              |
| `brief.targetRegion`       | `string`                      | 否   | 默认 `global`。                                                                             |
| `brief.language`           | `string`                      | 否   | 默认 `zh`。                                                                                 |
| `brief.audienceProfile`    | `string`                      | 否   | 默认 `general`。                                                                            |
| `brief.productRefs`        | `string[]`                    | 否   | 默认 `[]`。                                                                                 |
| `brief.sellingPoints`      | `string[]`                    | 否   | 默认 `[]`。                                                                                 |
| `brief.riskLevel`          | `"low" \| "medium" \| "high"` | 否   | 默认 `low`。                                                                                |

后端解析位置：`apps/backend/agent-server/src/company-live/company-live.dto.ts`。

简化 brief 解析后会生成 `CompanyLiveContentBrief`：

```text
CompanyLiveContentBrief
├─ briefId
├─ targetPlatform
├─ targetRegion
├─ language
├─ audienceProfile
├─ productRefs
├─ sellingPoints
├─ riskLevel
├─ script?
└─ createdAt
```

`createdAt` 由后端按当前时间生成；当前 DTO 不从请求体接受 `offer`、`visualBrief`、`voiceBrief`、`videoBrief`、`complianceNotes` 或 `evidenceRefs`。

---

## 响应

### 200 成功

响应体是 `CompanyExpertConsultation`，schema 定义在 `packages/core/src/contracts/media/company-live-experts.schema.ts`。

```json
{
  "consultationId": "company-live-experts-brief-001-2026-05-02T00:00:00.000Z",
  "briefId": "brief-001",
  "userQuestion": "这段直播开场如何提高停留和转化？",
  "selectedExperts": ["contentAgent", "growthAgent", "riskAgent"],
  "expertFindings": [
    {
      "expertId": "contentAgent",
      "role": "content",
      "summary": "开场需要更快给出利益点和场景钩子。",
      "diagnosis": ["当前脚本前 5 秒缺少明确用户收益。"],
      "recommendations": ["把核心优惠和使用场景前置。"],
      "questionsToUser": ["是否有平台禁用话术清单？"],
      "risks": ["不得承诺未证实功效。"],
      "confidence": 0.72,
      "source": "llm"
    }
  ],
  "missingInputs": ["请补充价格、库存或风控禁用词。"],
  "conflicts": [],
  "nextActions": [
    {
      "actionId": "next-content-1",
      "ownerExpertId": "contentAgent",
      "label": "重写前 5 秒开场钩子",
      "priority": "high"
    }
  ],
  "businessPlanPatch": {
    "briefId": "brief-001",
    "updates": [
      {
        "path": "script.opening",
        "value": "先讲限时优惠，再展示商品场景。",
        "reason": "提升停留和转化。"
      }
    ]
  },
  "createdAt": "2026-05-02T00:00:00.000Z"
}
```

稳定字段：

| 字段                | 说明                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `consultationId`    | 会诊记录标识，由 `briefId` 和创建时间生成。                                                   |
| `briefId`           | 解析后的 `CompanyLiveContentBrief.briefId`。                                                  |
| `userQuestion`      | 解析后的用户问题。                                                                            |
| `selectedExperts`   | 本次参与会诊的专家 id；必须去重。                                                             |
| `expertFindings`    | 每个已选专家的诊断、建议、追问、风险、置信度和来源；`expertId` 必须存在于 `selectedExperts`。 |
| `missingInputs`     | 当前会诊需要用户继续补充的信息。                                                              |
| `conflicts`         | 专家之间存在冲突时的摘要与解决提示；冲突专家必须来自 `selectedExperts`。                      |
| `nextActions`       | 可执行下一步；责任专家必须来自 `selectedExperts`。                                            |
| `businessPlanPatch` | 对 brief 或业务计划的结构化 patch 建议，`value` 必须是 JSON-safe 值。                         |
| `createdAt`         | ISO datetime。                                                                                |

专家枚举由 `CompanyExpertIdSchema` 定义：`productAgent`、`operationsAgent`、`contentAgent`、`growthAgent`、`marketingAgent`、`intelligenceAgent`、`riskAgent`、`financeAgent`、`supportAgent`、`supplyAgent`。

当前已定义 10 个专家，其中 v1 核心专家为 6 个：`productAgent`、`operationsAgent`、`contentAgent`、`growthAgent`、`riskAgent`、`financeAgent`。普通广义问题默认路由到这 6 个核心专家；关键词问题可路由到对应专家。

### 400 请求体校验失败

当请求体不是对象、`question` 为空、`brief` 缺失，或简化 brief 无法 parse 成 `CompanyLiveContentBrief` 时返回 400，并携带 zod 错误摘要。

### 500 会诊执行失败

当专家会诊 graph 或 service 执行异常时返回 500。前端只能展示错误摘要，不应读取 agent 内部 graph state。

---

## Schema 定义位置

| Schema / 类型                  | 路径                                                               |
| ------------------------------ | ------------------------------------------------------------------ |
| `CompanyLiveContentBrief`      | `packages/core/src/contracts/media/company-live-media.schema.ts`   |
| `CompanyExpertConsultation`    | `packages/core/src/contracts/media/company-live-experts.schema.ts` |
| `ExpertFinding`                | `packages/core/src/contracts/media/company-live-experts.schema.ts` |
| `CompanyExpertConflict`        | `packages/core/src/contracts/media/company-live-experts.schema.ts` |
| `CompanyExpertNextAction`      | `packages/core/src/contracts/media/company-live-experts.schema.ts` |
| `CompanyLiveBusinessPlanPatch` | `packages/core/src/contracts/media/company-live-experts.schema.ts` |

---

## 前后端职责

- 后端 controller 只接收 HTTP、调用 DTO parse、转发到 `CompanyLiveService.consultExperts()`。
- 后端 DTO 层负责把 `CompanyLiveGenerateBrief` 简化输入补全为稳定 `CompanyLiveContentBrief`。
- `agents/company-live` 负责专家路由、LLM 专家诊断、fallback finding、冲突和下一步组装。
- `packages/core` 负责 `CompanyExpertConsultationSchema` 的稳定结构校验。
- `apps/frontend/agent-admin` 通过 `src/api/company-live.api.ts` 调用接口，并只消费 `CompanyExpertConsultation` 稳定 contract。

---

## 兼容与演进约束

- 新增响应字段必须先扩展 `CompanyExpertConsultationSchema` 或其子 schema，再更新本文档和前端展示。
- 不得把 agent graph 内部 state、prompt、LLM 原始响应、provider 原始错误或完整 trace 透传到该 API 响应。
- `selectedExperts`、`expertFindings[].expertId`、`conflicts[].expertIds` 和 `nextActions[].ownerExpertId` 的一致性由 schema 约束，不允许前端自行猜测修正。
- 媒体 provider 仍走 `packages/runtime` provider interface、`packages/platform-runtime` 默认装配和 `packages/adapters` vendor adapter；专家会诊接口不得直接调用 MiniMax 或其他媒体 provider。
