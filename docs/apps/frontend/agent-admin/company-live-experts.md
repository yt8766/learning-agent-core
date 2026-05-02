# Company Live Experts Admin 页面

状态：current
文档类型：guide
适用范围：`apps/frontend/agent-admin/src/pages/company-agents`、`apps/frontend/agent-admin/src/api/company-live.api.ts`
最后核对：2026-05-02

本文说明 `agent-admin` 的公司专员编排页面如何接入 Company Live 专家会诊能力。该页面属于后台治理与运营视图，不是 `agent-chat` 的聊天执行面。

## 页面入口

专家会诊入口位于 `company-agents` 页面：

```text
apps/frontend/agent-admin/src/pages/company-agents/
├─ company-agents-panel.tsx
├─ company-live-expert-consult-form.tsx
└─ company-live-expert-consult-result.tsx
```

`company-agents-panel.tsx` 负责装配表单、调用 API、展示 loading / error / result 状态。页面只通过 `consultCompanyLiveExperts()` 发起请求，不直接 import 或读取 `agents/company-live` 内部 graph、nodes、prompts、schemas 或 runtime 文件。

## API 消费边界

前端唯一稳定调用入口：

```ts
consultCompanyLiveExperts(input: CompanyLiveExpertConsultRequest): Promise<CompanyExpertConsultation>
```

定义位置：`apps/frontend/agent-admin/src/api/company-live.api.ts`。

HTTP 入口由 API facade 封装为：

```text
POST /company-live/experts/consult
```

在部署到 `agent-server` 时对应后端 controller 路径：

```text
POST /api/company-live/experts/consult
```

请求体：

```ts
interface CompanyLiveExpertConsultRequest {
  question: string;
  brief: CompanyLiveGenerateBrief;
}
```

`CompanyLiveGenerateBrief` 是 Admin 简化表单输入；后端会 parse 成 `CompanyLiveContentBrief`，前端不负责补齐 `createdAt`、默认 `targetRegion`、默认 `language`、默认 `audienceProfile` 或默认 `riskLevel`。

## 表单字段

`company-live-expert-consult-form.tsx` 当前提交：

| 字段              | 来源控件 | 说明                                        |
| ----------------- | -------- | ------------------------------------------- |
| `question`        | textarea | 会诊问题；提交前 trim，空值不提交。         |
| `briefId`         | input    | brief 标识；提交前 trim，空值不提交。       |
| `targetPlatform`  | input    | 目标平台；空值 fallback 为 `douyin`。       |
| `script`          | textarea | 直播脚本；提交前 trim，空值不提交。         |
| `durationSeconds` | number   | 10 到 3600 的整数秒数；前端先做范围校验。   |
| `speakerVoiceId`  | input    | 音色 id；空值 fallback 为 `voice-default`。 |

当前表单不直接暴露 `productRefs`、`sellingPoints`、`targetRegion`、`language`、`audienceProfile` 或 `riskLevel`；这些字段由后端 DTO 默认值补齐。

## 结果展示字段

`company-live-expert-consult-result.tsx` 只消费 `CompanyExpertConsultation` 稳定字段：

| UI 区域         | 对应 contract 字段                                                               |
| --------------- | -------------------------------------------------------------------------------- |
| 标题与摘要      | `consultationId`、`userQuestion`                                                 |
| 已选专家        | `selectedExperts`                                                                |
| Expert Findings | `expertFindings[].role`、`summary`、`confidence`、`diagnosis`、`recommendations` |
| Missing Inputs  | `missingInputs`                                                                  |
| Conflicts       | `conflicts[].summary`、`resolutionHint`、`expertIds`                             |
| Next Actions    | `nextActions[].priority`、`label`、`ownerExpertId`                               |

当前 UI 不展示 `businessPlanPatch`，但 API contract 已返回该字段；后续如果增加 patch 预览、应用或审批入口，必须先更新 API 文档和页面文档，再接线 UI。

## 不允许的依赖

- 不从 `apps/frontend/agent-admin` 直连 `agents/company-live/src/*`。
- 不在页面中读取 graph state、node trace、prompt、LLM 原始响应或 fallback reason。
- 不把媒体 provider、MiniMax 字段、provider task id 或 vendor 错误暴露到专家会诊页面。
- 不在前端根据内部路由规则重算专家列表；展示以后端返回的 `selectedExperts` 为准。

## 验证入口

本页面的最小回归入口：

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-admin/test/api/admin-api-company-live.test.ts
pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit --pretty false
```
