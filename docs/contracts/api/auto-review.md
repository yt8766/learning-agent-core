# Auto Review API

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-chat`、`apps/frontend/agent-admin`、`packages/runtime`、`packages/core/src/tools`、`packages/tools/src/auto-review`、`agents/*`
最后核对：2026-04-26

本文记录 Auto Review 的审查请求、结果投影、审批恢复、SSE 事件与前后端职责。工具执行见 [Agent Tool Execution API](/docs/contracts/api/tool-execution.md)，sandbox 证据见 [Sandbox API](/docs/contracts/api/sandbox.md)。

开发入口速查：

- 后端主入口：`apps/backend/agent-server/src/auto-review/*`
- Agent Tool 接线入口：`apps/backend/agent-server/src/agent-tools/*` 在 sandbox allow 后创建 `kind = "tool_execution"` review，并在审批恢复时同步恢复关联 review
- 前端消费：`apps/frontend/agent-admin` auto review API facade；`apps/frontend/agent-chat` 通过 `review_completed`、`execution_step_blocked` 与 `interrupt_*` 事件展示审查结论
- Contract 回归：auto-review service/controller/repository 测试与 `test/integration/frontend-backend/sse-payload-contract.int-spec.ts`

## 目的

Auto Review 是执行链路中的自动审查门，用于在工具执行、代码修改、报告生成、发布或高风险操作前后生成结构化审查结论。

本阶段目标：

- 在聊天和后台中统一展示 review verdict、finding、evidence 与阻断原因。
- 把自动审查结论转成可恢复的 interrupt，而不是散落在各 agent 的自然语言里。
- 让后端、runtime、reviewer agent、frontend 使用同一套审查状态和错误语义。
- 为后续 code review、policy review、security review、release review 等子类型扩展保留空间。

Canonical 词汇以本文 `AutoReviewRecord` 为准：

- `status`: `pending`、`running`、`passed`、`warnings`、`blocked`、`failed`、`cancelled`
- `verdict`: `allow`、`warn`、`block`、`unknown`
- finding `severity`: `info`、`warning`、`error`、`blocker`

`packages/core/src/tools` 的 schema、`packages/tools/src/auto-review` 的 skeleton gate、后端投影和前端展示都必须解析或返回这套词汇；不得重新引入 `completed`、`changes_requested`、`pass`、`needs_review`、`low`、`medium`、`high`、`critical` 作为新的稳定 contract。

## 当前实现状态

已落地的最小闭环：

- 后端入口：`apps/backend/agent-server/src/auto-review/*`，Nest controller 使用 `@Controller('auto-review')`，经全局 `api` prefix 后暴露为 `/api/auto-review/*`。
- 后端当前使用 in-memory repository 保存 `AutoReviewRecord`，输出会通过 `@agent/core` 的 `AutoReviewResultSchema` parse，避免后端 facade 偏离稳定 contract；repository 已提供 `exportSnapshot()` / `restoreSnapshot()` 边界，snapshot 只暴露 `{ reviews: AutoReviewRecord[] }`，restore 会先 parse 完整 snapshot 再替换内部状态。
- `POST /api/auto-review/reviews` 已提供最小规则审查：后端通过内部 rule-gate adapter 复用 `@agent/tools` 的 `RuleBasedReviewer` / `AutoReviewGate` 规则命中与 severity threshold 语义，再映射为 `@agent/core` `AutoReviewResultSchema` 需要的 record 字段。目标摘要、diff preview 或 output preview 包含 `BLOCKER` / `SECRET` / `DANGEROUS` 时返回 `block` / `blocked` 并创建 approval；包含 `WARNING` / `TODO` 时返回 `warn` / `warnings`；否则返回 `allow` / `passed`。同一目标命中多个规则时必须保留多个 finding，并按最严重 finding 决定 verdict。
- `GET /api/auto-review/reviews` 已支持 `sessionId`、`taskId`、`requestId`、`kind`、`verdict` 过滤；`GET /:reviewId`、`rerun` 与 `approval` 已覆盖查询、重跑计数、approve / bypass / reject / abort / feedback / input 的最小状态流。
- `/api/agent-tools/requests` 已在 sandbox allow 且低风险可执行路径创建 `kind = "tool_execution"` 的 auto review；`block` verdict 会复用 agent-tools 审批入口等待恢复，`approve` / `bypass` 恢复时会同步调用关联 review 的 approval resume。
- `agent-admin` 已提供 Auto Review API facade：`createAutoReview`、`listAutoReviews`、`getAutoReview`、`rerunAutoReview`、`resumeAutoReviewApproval`；前端 helper 会编码过滤参数、校验返回投影并保留上游请求错误。

仍未落地的部分：

- Auto Review 真实 runner / reviewer agent 接线、review record 真实落盘、checkpoint / SSE 广播、Admin/Chat 展示补拉和 finding evidence 权限过滤仍需后续推进。
- 当前 facade 是结构化审查协议入口和 contract 回归入口；`agent-tools` HTTP facade 已最小接入低风险工具执行审查，但代码修改、发布动作和 chat/runtime 内部旧工具链仍需后续迁移到同一稳定边界。

与 tool-execution / sandbox 的职责边界：

- auto-review 是结构化审查门，通常由 agent-tools 在 sandbox allow 后创建；它不负责创建 execution request，也不直接管理 sandbox profile。
- `verdict = "block"` 时，阻断必须回到 agent-tools 的统一审批恢复链路；`warn` 只能作为可继续执行的展示和审计信号。
- review 可以引用 `sandboxRunId`、`policyDecisionId`、`requestId`、`evidenceIds`、`artifactIds` 等治理关联字段，但不得保存 vendor/provider 原始对象、未脱敏 diff、raw output 或第三方错误对象。
- 写入 SSE 的 auto-review 信息只允许包含 `reviewId`、`kind`、`verdict`、`summary`、`findingCount`、`reasonCode`、`approvalId`、`interruptId` 等白名单摘要。

## Review Kinds

| kind             | 说明                                                   |
| ---------------- | ------------------------------------------------------ |
| `code_change`    | 代码修改审查，关注回归、边界条件、类型和测试缺口。     |
| `tool_execution` | 工具执行前后审查，关注权限、输入、输出和副作用。       |
| `sandbox_result` | sandbox 结果审查，关注 verdict、失败原因和证据充分性。 |
| `policy`         | 治理策略审查，关注审批门、scope 和权限一致性。         |
| `release`        | 发布或 CI 操作审查，关注不可逆影响和回滚路径。         |
| `report_bundle`  | 报表生成或编辑审查，关注 schema、证据和渲染兼容。      |

## REST Endpoints

| 方法   | 地址                                          | 参数                                                                                                                       | 返回值               | 说明                                        |
| ------ | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------- |
| `POST` | `/api/auto-review/reviews`                    | body: `CreateAutoReviewRequest`                                                                                            | `AutoReviewRecord`   | 创建一次自动审查。                          |
| `GET`  | `/api/auto-review/reviews/:reviewId`          | path: `reviewId`                                                                                                           | `AutoReviewRecord`   | 获取审查详情。                              |
| `GET`  | `/api/auto-review/reviews`                    | query: `sessionId?: string`、`taskId?: string`、`requestId?: string`、`kind?: string`、`verdict?: string`                  | `AutoReviewRecord[]` | 查询审查列表。                              |
| `POST` | `/api/auto-review/reviews/:reviewId/rerun`    | path: `reviewId`; body: `{ actor?: string; reason?: string; includeEvidenceIds?: string[] }`                               | `AutoReviewRecord`   | 重新审查，必须保留原 review id 的关联关系。 |
| `POST` | `/api/auto-review/reviews/:reviewId/approval` | path: `reviewId`; body: `{ sessionId: string; interrupt: AutoReviewApprovalResumeInput; actor?: string; reason?: string }` | `AutoReviewRecord`   | 审批恢复审查阻断。                          |

## Request Schema

`CreateAutoReviewRequest`：

```ts
{
  sessionId?: string;
  taskId: string;
  requestId?: string;
  kind: "code_change" | "tool_execution" | "sandbox_result" | "policy" | "release" | "report_bundle";
  target: {
    type: string;
    id?: string;
    summary?: string;
    diffPreview?: string;
    outputPreview?: string;
  };
  evidenceIds?: string[];
  artifactIds?: string[];
  sandboxRunId?: string;
  policyDecisionId?: string;
  requestedBy?: {
    actor: "human" | "supervisor" | "ministry" | "specialist_agent" | "runtime";
    actorId?: string;
  };
  metadata?: Record<string, unknown>;
}
```

## Response Schema

`AutoReviewRecord`：

```ts
{
  reviewId: string;
  sessionId?: string;
  taskId: string;
  requestId?: string;
  kind: string;
  status: "pending" | "running" | "passed" | "warnings" | "blocked" | "failed" | "cancelled";
  verdict: "allow" | "warn" | "block" | "unknown";
  summary: string;
  findings: AutoReviewFinding[];
  evidenceIds: string[];
  artifactIds: string[];
  sandboxRunId?: string;
  policyDecisionId?: string;
  approval?: {
    approvalId: string;
    interruptId: string;
    resumeEndpoint: "/api/auto-review/reviews/:reviewId/approval";
  };
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}
```

`AutoReviewFinding`：

```ts
{
  findingId: string;
  severity: "info" | "warning" | "error" | "blocker";
  category: string;
  title: string;
  message: string;
  file?: string;
  startLine?: number;
  endLine?: number;
  evidenceIds?: string[];
  recommendation?: string;
}
```

状态约束：

- `verdict = "allow"` 时，`status` 应为 `passed`。
- `verdict = "warn"` 时，`status` 应为 `warnings`，调用方可继续但必须展示 warning。
- `verdict = "block"` 时，`status` 应为 `blocked`，后续必须审批、修复或取消。
- `status = "failed"` 表示审查流程失败，不等同于目标内容有缺陷。

## Rule Gate 与 Reviewer 边界

后端 auto-review 服务不再直接在 service 内解析本地 finding。规则审查边界是 `apps/backend/agent-server/src/auto-review/auto-review.rules.ts` 内部 adapter：

- adapter 以 `@agent/tools` 的 `RuleBasedReviewer` 规则形状声明最小规则，并按 `AutoReviewGate` 的 severity threshold 语义产出 `allow` / `warn` / `block` 与 `passed` / `warnings` / `blocked`。
- service 只负责请求 schema parse、调用 adapter、把 adapter 结果映射进 `@agent/core` `AutoReviewResultSchema`、保存 record 与创建审批恢复入口。
- finding 写入稳定 record 前必须转换成 `@agent/core` finding 字段：`findingId`、`severity`、`category`、`title`、`message`、`evidenceIds`、`recommendation`；不得把 reviewer 或 provider 原始对象直接塞进 record。
- 后续可以把 adapter 背后的 reviewer 替换成 reviewer agent、模型 reviewer、policy reviewer 或 sandbox reviewer，但替换实现必须保持同一输出边界：只返回 canonical `status`、`verdict`、finding 和治理关联字段。
- metadata 只保留审查治理关联与调用方显式传入的安全字段；`vendorObject`、`vendorResponse`、`rawVendorResponse`、`providerResponse`、`rawProviderResponse` 等 vendor/raw provider metadata 必须在后端写入 record 前过滤。

## SSE Events

Auto Review 通过 chat SSE 暴露给 `agent-chat`，并写入 checkpoint / observability 供 `agent-admin` 查询。

| 事件类型                           | payload 关键字段                                                                                                                 | 说明                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `review_completed`                 | `{ reviewId: string; kind: string; verdict: "allow" \| "warn" \| "block" \| "unknown"; summary: string; findingCount?: number }` | 审查完成。             |
| `execution_step_blocked`           | `{ requestId?: string; reviewId: string; reasonCode: string; approvalId?: string; interruptId?: string }`                        | 审查阻断执行。         |
| `execution_step_resumed`           | `{ requestId?: string; reviewId: string; action: string; interruptId?: string }`                                                 | 审批恢复后继续或终止。 |
| `interrupt_pending`                | `{ interruptId: string; kind: "tool_execution"; reviewId: string; approvalId?: string }`                                         | 审查触发审批等待。     |
| `interrupt_resumed`                | `{ interruptId: string; kind: "tool_execution"; reviewId: string; action: string }`                                              | 审批恢复。             |
| `interrupt_rejected_with_feedback` | `{ interruptId: string; kind: "tool_execution"; reviewId: string; feedback?: string }`                                           | 带反馈打回。           |

`review_completed` 是稳定展示事件。阻断和恢复仍使用 interrupt / execution 事件，以便审批卡和执行状态复用同一套前端逻辑。

## Approval Resume Payload

`AutoReviewApprovalResumeInput`：

```ts
{
  interruptId?: string;
  action: "approve" | "reject" | "feedback" | "input" | "bypass" | "abort";
  reviewId: string;
  requestId?: string;
  approvalId?: string;
  feedback?: string;
  value?: string;
  payload?: {
    acceptedFindingIds?: string[];
    dismissedFindingIds?: string[];
    requiredFixSummary?: string;
    rerunAfterFix?: boolean;
    approvalScope?: "once" | "session" | "always";
    reasonCode?: string;
    [key: string]: unknown;
  };
}
```

恢复规则：

- `approve`：接受审查结论后的继续执行；如果 verdict 是 `block`，必须记录 actor、reason 和 approval scope。
- `reject`：拒绝继续执行，关联 request 或 task 应进入 blocked / cancelled 收口。
- `feedback`：要求 Runtime / specialist agent 按反馈修复，必须保留 `requiredFixSummary` 或 `feedback`。
- `input`：补充审查所需证据、artifact 或说明，后端可触发 rerun。
- `bypass`：仅限治理权限 actor，且必须保留 dismissed finding 和 reason。
- `abort`：取消本次审查恢复，相关 request 不得继续执行。

## Error Semantics

| 错误码                         | 建议 HTTP 状态 | 语义                                                 |
| ------------------------------ | -------------- | ---------------------------------------------------- |
| `auto_review_request_invalid`  | `400`          | 请求体不符合 schema，缺少 target、taskId 或 kind。   |
| `auto_review_not_found`        | `404`          | 指定 review 不存在或当前调用方不可见。               |
| `auto_review_forbidden`        | `403`          | 调用方无权查看、重跑或恢复该 review。                |
| `auto_review_blocked`          | `409`          | verdict 为 `block`，必须审批、修复或取消。           |
| `auto_review_conflict`         | `409`          | review 已终态、重复恢复、重复 rerun 或状态游标过期。 |
| `auto_review_evidence_missing` | `422`          | 审查所需证据或 artifact 缺失，无法形成有效结论。     |
| `auto_review_runner_failed`    | `500`          | 审查 runner 失败；不代表目标一定有问题。             |
| `auto_review_unavailable`      | `503`          | reviewer agent、模型、sandbox 或依赖服务不可用。     |

错误响应使用统一 error envelope，并优先附带 `reviewId`、`requestId`、`taskId`、`sandboxRunId`、`policyDecisionId`、`approvalId`、`interruptId`。

`reviewId` path 参数、body 中的 review / approval 标识，以及已存在 review 的 approval 必须对齐；空 route id 或 body id 返回 `auto_review_request_invalid`，不允许退化成 not found 或恢复其他 review。后端创建、重跑与恢复 review 时只保留白名单治理关联字段，例如 `requestId`、`sandboxRunId`、`policyDecisionId`、`approvalId`、`interruptId`；vendor-like raw metadata、未脱敏 diff/raw output 或第三方错误对象不得写入稳定 review record。

## 前后端职责

后端负责：

- 创建、重跑和查询 review record。
- 把 reviewer agent、sandbox、policy、tool result 的输出统一映射为 `AutoReviewRecord`。
- 将 `block` verdict 转成 interrupt / approval 恢复链路。
- 写入 SSE、checkpoint、runtime observability 和 admin projection。
- 对 finding 中的文件路径、diff、命令、证据摘要做脱敏和权限过滤。

`agent-chat` 负责：

- 展示 `review_completed`、warning、block 和审批卡。
- 对 `block` 使用统一 interrupt resume，不直接绕过 review verdict。
- 断流后通过 checkpoint、events 和 review detail 做终态校准。

`agent-admin` 负责：

- 展示 review 列表、finding、关联 request、sandbox run、policy decision 和 evidence。
- 支持 rerun、审批恢复和审计查看。
- 不从 raw task dump 自行推导审查结论。

## Compatibility Rules

- Auto Review 是结构化审查 contract；自然语言 reviewer summary 只能作为 `summary` 或 finding message。
- 新增 `kind`、`status`、`verdict` 或 finding 字段前，必须更新本文和真实 schema / parse 回归。
- `block` 不等同 `failed`；前者表示目标被审查阻断，后者表示审查流程失败。
- `warn` 不等同 `block`；warning finding 可继续执行，但调用方必须展示并保留 evidence。
- `review_completed` 可独立展示，但阻断和恢复必须继续使用统一 interrupt / approval 语义。
- Finding 不得泄漏调用方无权查看的文件内容、凭据、第三方原始错误或未脱敏执行输入。
