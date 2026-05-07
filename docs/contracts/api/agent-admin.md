# Agent Admin API

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-admin`
最后核对：2026-05-07

本文是 `agent-admin` 控制台聚合入口契约。Runtime、Approvals 和 Run Observatory 的专题接口分别见 [runtime.md](/docs/contracts/api/runtime.md)、[approvals.md](/docs/contracts/api/approvals.md)、[run-observatory.md](/docs/contracts/api/run-observatory.md)。

## 总约定

- `agent-admin` 的控制台聚合接口主要通过 `/api/platform/*` 读取；少量专题仍使用 `/api/runtime/*`、`/api/learning/*`、`/api/evidence/*`、`/api/gateway/*`、`/api/skills/*`、`/api/rules/*`。
- dashboard 首页优先请求轻量 shell；详情页按需请求对应 center。
- `diagnostics` 仅用于观测和排障，不得作为业务状态判断来源。
- Runtime / Evidence 中的 knowledge retrieval diagnostics 只允许暴露项目自有摘要字段；后端会裁剪 provider error、SDK response、命中正文和 vendor-specific 对象。
- 前端默认 base URL 为 `VITE_API_BASE_URL ?? http://127.0.0.1:3000/api`；本文表格使用公开完整路径，便于从浏览器或 curl 直接核对。默认使用 IPv4 loopback 是为了避免本地 `localhost` 解析到另一个开发服务导致 `/api/platform/*` 返回无 CORS 头的 404。
- 管理端请求失败时，前端 API client 会把带 HTTP 响应的错误归一为 `Request failed: <status>`；主动取消归一为 `__ADMIN_REQUEST_ABORTED__`。

## 返回结构速查

| 类型                                 | 关键字段                                                                                                                | 说明                                                              |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `PlatformConsoleRecord`              | `runtime`、`approvals`、`learning`、`evidence`、`connectors`、`skillSources`、`companyAgents`、`evals?`、`diagnostics?` | Admin dashboard 的聚合投影。shell 模式只保证 summary 与占位可用。 |
| `PlatformConsoleRecord["runtime"]`   | `summary`、`tasks`、`queue`、`models`、`approvalScopePolicies?`、`tools?`、`knowledgeSearchStatus?`                     | Runtime Center 投影。                                             |
| `PlatformConsoleRecord["approvals"]` | `summary`、`items`、`policies?`                                                                                         | Approvals Center 投影。                                           |
| `RuntimeArchitectureRecord`          | `nodes`、`edges`、`subgraphs`、`updatedAt`                                                                              | Runtime 架构图投影。                                              |
| `ChannelDeliveryRecord`              | `id`、`channel`、`channelChatId`、`segment`、`status`、`queuedAt`、`lastAttemptAt?`、`deliveredAt?`                     | 外部消息通道投递记录。                                            |

## Platform Console

| 方法   | 地址                                            | 参数                                                                                                                                                              | 返回值                                  | 说明                                               |
| ------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------- |
| `GET`  | `/api/platform/console-shell`                   | query: `days?`、`status?`、`model?`、`pricingSource?`、`runtimeExecutionMode?`、`runtimeInteractionKind?`、`approvalsExecutionMode?`、`approvalsInteractionKind?` | `PlatformConsoleRecord`                 | dashboard 首页轻量数据；重量中心只保留占位或摘要。 |
| `GET`  | `/api/platform/console`                         | 同上，另支持 `view?: "shell" \| "full"`                                                                                                                           | `PlatformConsoleRecord`                 | 兼容入口；不传 `view=full` 时等价 shell。          |
| `POST` | `/api/platform/console/refresh-metrics?days=30` | query: `days?: number`                                                                                                                                            | `{ days: number; refreshedAt: string }` | 刷新 runtime / evals persisted metrics snapshot。  |
| `GET`  | `/api/platform/console/log-analysis?days=7`     | query: `days?: number`                                                                                                                                            | `PlatformConsoleLogAnalysisRecord`      | 平台控制台日志趋势、预算判断和摘要状态。           |

`days` 由后端 `ParseOptionalIntPipe` 解析；无法解析为整数时应视为参数错误。

## Admin 专题接口

| 方法  | 地址                                       | 参数                                                                  | 返回值                                                    | 说明                      |
| ----- | ------------------------------------------ | --------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------- |
| `GET` | `/api/runtime/architecture`                | 无                                                                    | `RuntimeArchitectureRecord`                               | Runtime 架构图。          |
| `GET` | `/api/gateway/deliveries`                  | 无                                                                    | `ChannelDeliveryRecord[]`                                 | 外部消息通道投递记录。    |
| `GET` | `/api/learning/center`                     | 无                                                                    | `PlatformConsoleRecord["learning"]`                       | Learning Center 详情。    |
| `GET` | `/api/evidence/center`                     | 无                                                                    | `PlatformConsoleRecord["evidence"]`                       | Evidence Center 详情。    |
| `GET` | `/api/platform/browser-replays/:sessionId` | path: `sessionId`                                                     | `Record<string, unknown>`                                 | 浏览器回放数据。          |
| `GET` | `/api/platform/connectors-center`          | 无                                                                    | `PlatformConsoleRecord["connectors"]`                     | Connector Center。        |
| `GET` | `/api/platform/tools-center`               | 无                                                                    | `PlatformConsoleRecord["runtime"]["tools"]`               | Tool Center。             |
| `GET` | `/api/platform/skill-sources-center`       | 无                                                                    | `PlatformConsoleRecord["skillSources"]`                   | Skill source center。     |
| `GET` | `/api/platform/company-agents-center`      | 无                                                                    | `PlatformConsoleRecord["companyAgents"]`                  | Company agents center。   |
| `GET` | `/api/platform/evals-center`               | query: `days?`、`scenarioId?`、`outcome?`                             | `PlatformConsoleRecord["evals"]`                          | Evals Center。            |
| `GET` | `/api/platform/evals-center/export`        | query: `days?`、`scenarioId?`、`outcome?`、`format?: "csv" \| "json"` | `{ filename: string; mimeType: string; content: string }` | Evals 导出。              |
| `GET` | `/api/platform/workflow-presets`           | 无                                                                    | `WorkflowPresetDefinition[]`                              | Workflow preset catalog。 |
| `GET` | `/api/platform/briefings/runs`             | query: `days?`、`category?: BriefingCategory`                         | `Array<Record<string, unknown>>`                          | 获取 briefing run 历史。  |

## Workflow Lab

Workflow Lab 是 `agent-admin` 内用于横向测试专项 agent / workflow 的轻量实验入口。前端只消费统一的 run API，不直接调用专项 agent 包；后端链路是 `WorkflowDispatcher -> RuntimeWorkflowExecutionFacade -> createPlatformWorkflowRegistry()`。`WorkflowDispatcher` 只做 workflow-runs API 适配，`runtime/core` facade 负责注册现有 executor，真实领域实现仍位于对应 `agents/*` 宿主。

| 方法   | 地址                            | 参数                                                           | 返回值                                                     | 说明                          |
| ------ | ------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------- |
| `POST` | `/api/workflow-runs`            | body: `{ workflowId: string; input: Record<string, unknown> }` | `{ runId: string }`                                        | 创建并异步执行一次 workflow。 |
| `GET`  | `/api/workflow-runs`            | query: `workflowId?: string`                                   | `WorkflowRunRecord[]`                                      | 查询 workflow run 历史。      |
| `GET`  | `/api/workflow-runs/:id`        | path: `id`                                                     | `WorkflowRunDetail`                                        | 查询 run 输入和 trace 快照。  |
| `SSE`  | `/api/workflow-runs/:id/stream` | path: `id`                                                     | `node-complete`、`run-complete`、`run-error` server events | 订阅运行中的节点事件。        |

当前已注册 workflow：

| `workflowId`       | 前端用途                            | 后端宿主                                                                                           | 输入要点                                                                                                                                        |
| ------------------ | ----------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `company-live`     | 直播内容生成 bundle 测试            | backend `runtime/core` workflow facade 注册 executor，真实 graph 位于 `@agent/agents-company-live` | 复用 `company-live` 生成 DTO。                                                                                                                  |
| `data-report-json` | 报表 JSON / `report-bundle.v1` 测试 | backend `runtime/core` workflow facade 注册 executor，真实生成能力位于 `@agent/agents-data-report` | `message` 必填；`structuredSeed` 可选但 admin 默认提供最小单报表 seed；`projectId`、`currentProjectPath` 只作为生成上下文传入，不参与路由鉴权。 |

内部 workflow registry 使用 `WorkflowStageEvent`，对外 SSE 仍投影为 `WorkflowNodeTrace` 形态的 `node-complete` 事件；前端不应直接依赖 platform registry 的内部 stage contract。

`data-report-json` 的 admin 默认 payload：

```json
{
  "workflowId": "data-report-json",
  "input": {
    "message": "生成奖金中心总览报表",
    "projectId": "agent-admin-workflow-lab",
    "currentProjectPath": "/admin/workflow-lab",
    "structuredSeed": {
      "meta": {
        "reportId": "bonus-center-overview",
        "title": "奖金中心总览",
        "description": "Workflow Lab generated report JSON test seed.",
        "route": "/bonus-center-overview",
        "templateRef": "workflow-lab",
        "scope": "single",
        "layout": "dashboard"
      },
      "filters": [],
      "dataSources": [
        {
          "key": "main",
          "serviceKey": "bonusCenterService",
          "requestAdapter": { "orgId": "orgId" },
          "responseAdapter": { "listPath": "data.list", "totalPath": "data.total" }
        }
      ],
      "sections": []
    }
  }
}
```

Workflow Lab SSE 节点事件统一使用 `WorkflowNodeTrace` 形态：`nodeId`、`status: "succeeded" | "failed" | "skipped"`、`durationMs`、`inputSnapshot`、`outputSnapshot`、`errorMessage?`。专项 agent 的 vendor / LLM 原始响应不得穿透到这里；只能输出节点摘要、状态和可展示快照。

### Evidence Center 知识检索诊断

`GET /api/evidence/center` 中 `sourceStore: "cangjing"`、`id: "cangjing:overview"` 的 evidence 会在 `detail.knowledgeRetrievalDiagnostics` 中可选携带最近一次知识检索诊断快照。该字段只用于调试展示，不代表按 task/run 归档的证据事实。

字段裁剪规则：

- 保留 `query`、`limit`、`hitCount`、`total`、`searchedAt`。
- 只透出 `diagnostics.postRetrieval`，包含 filtering / ranking / diversification 摘要。
- 不透出命中正文、被 drop/mask 的原文、第三方 provider error、SDK response 或 vendor-specific 对象。
- 字段缺失时前端必须静默跳过，不得把 diagnostics 当作 Evidence Center 的必需字段。

Briefing 分类枚举 `BriefingCategory`：

- `frontend-security`
- `general-security`
- `devtool-security`
- `ai-tech`
- `frontend-tech`
- `backend-tech`
- `cloud-infra-tech`

## 治理动作接口

所有 connector center 与 skill sources center 的 `POST` 写接口都要求已解析 principal 具备 `governance:write` 权限。缺少 principal 返回 `401`，principal 存在但权限不足返回 `403`。读取接口仍不声明该写权限。

| 方法   | 地址                                                                                     | 参数                                                                                                                                                                                                                                                 | 返回值                                                      | 说明                                                                                |
| ------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `POST` | `/api/platform/connectors-center/:connectorId/enable`                                    | path: `connectorId`                                                                                                                                                                                                                                  | `PlatformConsoleRecord["connectors"][number]`               | 启用 connector。                                                                    |
| `POST` | `/api/platform/connectors-center/:connectorId/disable`                                   | path: `connectorId`                                                                                                                                                                                                                                  | `PlatformConsoleRecord["connectors"][number]`               | 禁用 connector。                                                                    |
| `POST` | `/api/platform/connectors-center/:connectorId/refresh`                                   | path: `connectorId`                                                                                                                                                                                                                                  | `PlatformConsoleRecord["connectors"][number]`               | 显式刷新 discovery。                                                                |
| `POST` | `/api/platform/connectors-center/:connectorId/close-session`                             | path: `connectorId`                                                                                                                                                                                                                                  | `{ connectorId: string; closed: boolean }`                  | 关闭 connector session。                                                            |
| `POST` | `/api/platform/connectors-center/:connectorId/policy/:effect`                            | path: `connectorId`、`effect`                                                                                                                                                                                                                        | `PlatformConsoleRecord["connectors"][number]`               | 设置 connector policy；`effect` 为 `allow`、`deny`、`require-approval`、`observe`。 |
| `POST` | `/api/platform/connectors-center/:connectorId/policy/reset`                              | path: `connectorId`                                                                                                                                                                                                                                  | `PlatformConsoleRecord["connectors"][number]`               | 清除 connector policy。                                                             |
| `POST` | `/api/platform/connectors-center/:connectorId/capabilities/:capabilityId/policy/:effect` | path: `connectorId`、`capabilityId`、`effect`                                                                                                                                                                                                        | `PlatformConsoleRecord["connectors"][number]`               | 设置 capability policy。                                                            |
| `POST` | `/api/platform/connectors-center/:connectorId/capabilities/:capabilityId/policy/reset`   | path: `connectorId`、`capabilityId`                                                                                                                                                                                                                  | `PlatformConsoleRecord["connectors"][number]`               | 清除 capability policy。                                                            |
| `POST` | `/api/platform/connectors-center/configure`                                              | body: `{ templateId: "github-mcp-template" \| "browser-mcp-template" \| "lark-mcp-template"; transport: "stdio" \| "http"; displayName?: string; endpoint?: string; command?: string; args?: string[]; apiKey?: string }`                            | `PlatformConsoleRecord["connectors"][number]`               | 配置并启用 connector；后端补写 actor 与 enabled。                                   |
| `POST` | `/api/platform/company-agents-center/:workerId/enable`                                   | path: `workerId`                                                                                                                                                                                                                                     | `PlatformConsoleRecord["companyAgents"][number]`            | 启用公司 agent。                                                                    |
| `POST` | `/api/platform/company-agents-center/:workerId/disable`                                  | path: `workerId`                                                                                                                                                                                                                                     | `PlatformConsoleRecord["companyAgents"][number]`            | 禁用公司 agent。                                                                    |
| `POST` | `/api/platform/skill-sources-center/install`                                             | body: `{ manifestId: string; sourceId?: string; actor?: string }`                                                                                                                                                                                    | `PlatformConsoleRecord["skillSources"]["receipts"][number]` | 安装 skill manifest。                                                               |
| `POST` | `/api/platform/skill-sources-center/install-remote`                                      | body: `{ repo: string; skillName?: string; detailsUrl?: string; installCommand?: string; triggerReason?: string; summary?: string; actor?: string }`                                                                                                 | `SkillInstallReceipt`                                       | 远程安装 skill。                                                                    |
| `POST` | `/api/platform/skill-sources-center/receipts/:receiptId/approve`                         | path: `receiptId`; body: `{ actor?: string }`                                                                                                                                                                                                        | receipt record                                              | 批准安装回执。                                                                      |
| `POST` | `/api/platform/skill-sources-center/receipts/:receiptId/reject`                          | path: `receiptId`; body: `{ actor?: string; reason?: string }`                                                                                                                                                                                       | receipt record                                              | 拒绝安装回执。                                                                      |
| `POST` | `/api/platform/skill-sources-center/:sourceId/enable`                                    | path: `sourceId`                                                                                                                                                                                                                                     | skill source record                                         | 启用 skill source。                                                                 |
| `POST` | `/api/platform/skill-sources-center/:sourceId/disable`                                   | path: `sourceId`                                                                                                                                                                                                                                     | skill source record                                         | 禁用 skill source。                                                                 |
| `POST` | `/api/platform/skill-sources-center/:sourceId/sync`                                      | path: `sourceId`                                                                                                                                                                                                                                     | skill source record                                         | 同步 skill source。                                                                 |
| `POST` | `/api/platform/learning-center/counselor-selectors`                                      | body: `{ selectorId: string; domain: string; strategy: "manual" \| "user-id" \| "session-ratio" \| "task-type" \| "feature-flag"; candidateIds: string[]; weights?: number[]; featureFlag?: string; defaultCounselorId: string; enabled?: boolean }` | counselor selector record                                   | 创建或更新 counselor selector。                                                     |
| `POST` | `/api/platform/learning-center/counselor-selectors/:selectorId/enable`                   | path: `selectorId`                                                                                                                                                                                                                                   | counselor selector record                                   | 启用 selector。                                                                     |
| `POST` | `/api/platform/learning-center/counselor-selectors/:selectorId/disable`                  | path: `selectorId`                                                                                                                                                                                                                                   | counselor selector record                                   | 禁用 selector。                                                                     |
| `POST` | `/api/platform/learning-center/conflicts/:conflictId/:status`                            | path: `conflictId`、`status`; body: `{ preferredMemoryId?: string }`                                                                                                                                                                                 | conflict pair record                                        | 设置学习冲突状态；`status` 为 `open`、`merged`、`dismissed`、`escalated`。          |
| `POST` | `/api/platform/briefings/:category/force-run`                                            | path: `category: BriefingCategory`                                                                                                                                                                                                                   | briefing run record                                         | 立即触发指定分类 briefing。                                                         |
| `POST` | `/api/platform/briefings/feedback`                                                       | body: `{ messageKey: string; category: BriefingCategory; feedbackType: "helpful" \| "notHelpful"; reasonTag?: "too-noisy" \| "irrelevant" \| "too-late" \| "useful-actionable" }`                                                                    | briefing feedback record                                    | 记录 briefing 消息反馈。                                                            |
| `GET`  | `/api/skills?status=...`                                                                 | query: `status?`                                                                                                                                                                                                                                     | `PlatformConsoleRecord["skills"]`                           | 读取 skill 列表。                                                                   |
| `POST` | `/api/skills/:skillId/promote`                                                           | path: `skillId`                                                                                                                                                                                                                                      | `SkillRecord`                                               | 提升 skill。                                                                        |
| `POST` | `/api/skills/:skillId/disable`                                                           | path: `skillId`                                                                                                                                                                                                                                      | `SkillRecord`                                               | 禁用 skill。                                                                        |
| `POST` | `/api/skills/:skillId/restore`                                                           | path: `skillId`                                                                                                                                                                                                                                      | `SkillRecord`                                               | 恢复 skill。                                                                        |
| `POST` | `/api/skills/:skillId/retire`                                                            | path: `skillId`                                                                                                                                                                                                                                      | `SkillRecord`                                               | 退役 skill。                                                                        |
| `GET`  | `/api/rules`                                                                             | 无                                                                                                                                                                                                                                                   | `PlatformConsoleRecord["rules"]`                            | 读取 rules。                                                                        |
| `POST` | `/api/rules/:ruleId/invalidate`                                                          | path: `ruleId`; body: `{ reason: string }`                                                                                                                                                                                                           | rule record                                                 | 失效 rule。                                                                         |
| `POST` | `/api/rules/:ruleId/supersede`                                                           | path: `ruleId`; body: `{ replacementId: string; reason: string }`                                                                                                                                                                                    | rule record                                                 | 替换 rule。                                                                         |
| `POST` | `/api/rules/:ruleId/restore`                                                             | path: `ruleId`                                                                                                                                                                                                                                       | rule record                                                 | 恢复 rule。                                                                         |
| `POST` | `/api/rules/:ruleId/retire`                                                              | path: `ruleId`; body: `{ reason: string }`                                                                                                                                                                                                           | rule record                                                 | 退役 rule。                                                                         |

## Refresh 语义

- `console-shell` 适合 `refreshAll`、首页摘要和 shell 级诊断。
- `console?view=full` 只用于兼容、诊断或比对，不作为首页默认依赖。
- Runtime 详情必须请求 `GET /api/platform/runtime-center`。
- Approvals 详情必须请求 `GET /api/platform/approvals-center`。
- Run detail 必须请求 `GET /api/platform/run-observatory/:taskId`。
- `connectors` 读接口不得隐式触发 full discovery refresh；显式刷新应走 connector 专用刷新入口。
- dashboard 不应靠读取 console 接口顺手生产 metrics snapshot；需要刷新时调用 `POST /api/platform/console/refresh-metrics`。

## 前后端边界

- 后端负责聚合、裁剪、缓存、诊断字段和兼容别名转换。
- 前端负责按页面粒度选择 shell 或 center 接口，不从 shell 占位数据反推详情。
- 前端可以展示 `diagnostics.cacheStatus / generatedAt / timingsMs`，但不得用它替代具体 center 数据。
