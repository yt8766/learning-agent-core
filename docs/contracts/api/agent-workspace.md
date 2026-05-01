# Agent Workspace API

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-chat`、`apps/frontend/agent-admin`
最后核对：2026-04-30

本文定义 Agent Workspace Vault + Skill Flywheel MVP 的 HTTP API 契约。跨模块设计说明见 [agent-workspace-vault-and-skill-flywheel-design.md](/docs/integration/agent-workspace-vault-and-skill-flywheel-design.md)。

## 当前实现核对

截至 `2026-04-26`，当前仓库已经具备下列 MVP 骨架：

- 后端 HTTP 入口：`apps/backend/agent-server/src/platform/workspace-center.controller.ts`，挂在 `/api/platform/workspace-center`。
- 后端 runtime facade：`RuntimeCentersService` 已暴露 `getWorkspaceCenter`、`listWorkspaceSkillDrafts`、`approveWorkspaceSkillDraft`、`rejectWorkspaceSkillDraft`。
- 当前 workspace projection 构造入口：`packages/platform-runtime/src/centers/runtime-workspace-center.ts` 与 `runtime-workspace-center.build.ts`，只输出白名单字段，并在测试中断言不泄漏 `metadata` / `rawMetadata`、install raw staging path 或失败堆栈。
- Skill draft repository/service：`packages/skill/src/drafts/repository.ts` 提供 file-backed 与 in-memory repository，`packages/skill/src/drafts/service.ts` 提供 create / list / approve / reject / promote / retire / reuse 语义；默认 runtime context 带 `workspaceRoot` 时走 file-backed，本地短生命周期或测试可注入 in-memory。
- Admin 前端入口：`apps/frontend/agent-admin/src/api/admin-api-workspace.ts`、`src/features/workspace-center/workspace-center-panel.tsx`、`src/pages/dashboard/dashboard-center-content.tsx`，Workspace Center dashboard 已接入读取和 approve / reject 按钮；API facade 会把后端 runtime projection 归一化成面板消费的本地 workspace 视图。
- Chat 前线 readiness：`apps/frontend/agent-chat/src/pages/chat-home/chat-home-workbench-section-renders.tsx` 已在 workbench 的 learning / reuse 区展示 Workspace learning 与 Skill Flywheel readiness，不把 learning summary 重新塞回主线程消息。

当前实现核对 / 当前接线：

- `RuntimeCentersQueryService.getWorkspaceCenter()` 已接入 context-aware draft store，并从 runtime task 投影 current task、learning summaries、EvidenceRecord 摘要、reuse badges 和 capability gaps；workspace reuse record 读取与 session task id 查询由 backend-local workspace query helper 承接；同时会读取 `RuntimeStateSnapshot.workspaceSkillReuseRecords`，按 workspace 白名单输出 `reuseRecords`，并通过 backend-local workspace lifecycle helper 从 skill install receipt 回填 workspace draft 的 `install` / `provenance` / `lifecycle` 只读摘要。默认 runtime context 带有 `workspaceRoot` 时会使用本地 JSON file-backed store。
- `RuntimeCentersGovernanceService.approveWorkspaceSkillDraft()` 与 `rejectWorkspaceSkillDraft()` 已通过 `runtime-centers-workspace-drafts.ts` 修改 draft store 状态，并让下一次 workspace / draft list 查询立即反映最新状态；approve 会返回白名单 install candidate 摘要，缺失 draft 仍返回 `NotFoundException`。
- Skill Sources 接线：`workspace-skill-drafts` 是内部 source，`active` / `trusted` workspace draft 会经 `runtime-workspace-skill-draft-manifests.ts` 投影为 `SkillManifestRecord`，并应在 `/api/platform/skill-sources-center` 的 `manifests[]` 中以 `sourceId: "workspace-skill-drafts"` 出现，再由现有 Skill Sources Center / install governance 链路消费。
- `packages/core` 的长期稳定 schema-first contract 仍是后续收敛目标；当前前后端已按本契约和本地类型先行实现 MVP 骨架。

## 下一阶段落地边界

本文契约的下一阶段生产化目标如下；这些目标不能被误读为当前已经完成：

- Persistent draft store：当前 draft store 已有 `packages/skill` file-backed repository，可保存 draft、risk / evidence gate 所需字段和 reuse stats。后续生产化仍需要 decision history、数据库级并发控制和 install candidate 关联。
- 真实 workspace projection 聚合：当前 projection 已有稳定白名单形状，并能读到 runtime task 的 learning summary、EvidenceRecord 摘要、reuse badges、capability gaps、draft 状态、`AgentSkillReuseRecord` 持久记录和 workspace draft install receipt 摘要；后续需要补更丰富的 evidence provenance、分页和 filter。
- Approve 到 Skill Lab / 安装链路：当前 approve 会改变 draft 决策状态并返回 install candidate 摘要；Skill Sources 查询会额外暴露 approved / trusted draft manifest，`workspace-draft:` entry 已能 materialize 为安装 artifact，安装 receipt 会携带 `sourceDraftId` 并由 Workspace Center 回读为只读摘要。Workspace API 不直接安装 skill、不写 `.agents/skills/*`、不绕过 Skill Lab / Skill Source Center 的 trust、compatibility、receipt 和 rollback 规则。
- Chat Workspace Vault cards：`agent-chat` 下一步应消费当前 workspace projection，在 OpenClaw workbench 中渲染 Workspace Vault cards，用于展示 evidence、learning、reuse、draft readiness 和 capability gaps；cards 不进入主聊天消息流。

## 目的

Agent Workspace API 提供当前 workspace 投影、workspace 摘要、task learning summary projection，以及 skill draft 的读取和 approve / reject 决策入口。

MVP 只覆盖：

- Workspace current / summary。
- Skill Draft list / detail / approve / reject。
- Task learning summary projection。

MVP 不定义 Heartbeat、Gateway、Memory CRUD、Rule CRUD、Skill install 或 marketplace 同步接口。

## 总约定

- 统一路径前缀：`/api/platform/workspace-center`。
- 返回体必须是白名单 projection，不透传 raw task dump、checkpoint 完整对象、provider 原始响应、tool raw input / output、credential、完整 metadata。
- 稳定 JSON 契约应落到 `packages/core` 的 schema-first contract；当前 `AgentSkillDraftSchema` 已包含可选 `install` / `provenance` / `lifecycle` 摘要，后端和前端应逐步以该 schema 推导类型。
- 时间字段均使用 ISO 8601 字符串。
- `actor` 默认为当前认证用户；本地开发或未接鉴权时可由请求 body 显式传入。
- 查询接口不得隐式触发 skill install、memory promotion、rule mutation 或 gateway refresh。
- Approve / reject 接口不得隐式安装 skill；approve 返回的 Skill Lab intake / install candidate 摘要只能作为治理状态 projection。

## Endpoint 速查

| 方法   | 地址                                                           | 参数                                                                            | 返回值                               | 说明                                |
| ------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------ | ----------------------------------- |
| `GET`  | `/api/platform/workspace-center`                               | query: `sessionId?`、`taskId?`、`days?`、`limit?`                               | `AgentWorkspaceSummaryProjection`    | 读取当前 workspace 与轻量摘要投影。 |
| `GET`  | `/api/platform/workspace-center/skill-drafts`                  | query: `status?`、`source?`、`sourceTaskId?`、`sessionId?`、`limit?`、`cursor?` | `SkillDraftListResponse`             | 读取 skill draft 列表。             |
| `POST` | `/api/platform/workspace-center/skill-drafts/:draftId/approve` | path: `draftId`; body: `SkillDraftApproveRequest`                               | `SkillDraftDecisionResultProjection` | 批准 skill draft。                  |
| `POST` | `/api/platform/workspace-center/skill-drafts/:draftId/reject`  | path: `draftId`; body: `SkillDraftRejectRequest`                                | `SkillDraftDecisionResultProjection` | 拒绝 skill draft。                  |

## 请求参数

### Workspace 查询参数

| 参数        | 类型     | 默认值 | 说明                                                                  |
| ----------- | -------- | ------ | --------------------------------------------------------------------- |
| `sessionId` | `string` | 无     | Chat session id；与 `taskId` 至少提供一个，缺省时后端可使用当前会话。 |
| `taskId`    | `string` | 无     | Task id；优先级高于 `sessionId`。                                     |
| `days`      | `number` | `7`    | summary 查询窗口；由后端整数解析 pipe 处理。                          |
| `limit`     | `number` | `20`   | 列表或摘要条数上限。                                                  |

### Skill draft 查询参数

| 参数           | 类型                                                                      | 默认值 | 说明                                 |
| -------------- | ------------------------------------------------------------------------- | ------ | ------------------------------------ |
| `status`       | `"draft" \| "shadow" \| "active" \| "trusted" \| "rejected" \| "retired"` | 无     | 按 draft 状态筛选。                  |
| `source`       | `string`                                                                  | 无     | 按 draft 原始来源筛选。              |
| `sourceTaskId` | `string`                                                                  | 无     | 只读取来自某个 task 的 draft。       |
| `sessionId`    | `string`                                                                  | 无     | 只读取某个 session 关联的 draft。    |
| `limit`        | `number`                                                                  | `20`   | 返回条数上限。                       |
| `cursor`       | `string`                                                                  | 无     | 分页游标；由后端 opaque 生成和解析。 |

### Skill draft 决策请求

`SkillDraftApproveRequest`：

```ts
{
  actor?: string;
  note?: string;
  target?: "skill-governance" | "skill-lab";
}
```

`SkillDraftRejectRequest`：

```ts
{
  actor?: string;
  reason: string;
  note?: string;
}
```

`reason` 必须是非空字符串。前端可以提供自由文本；后端可在后续 schema 中补充推荐枚举，但不得破坏自由文本兼容。

## 响应 Schema 摘要

### AgentWorkspaceCurrentProjection

```ts
{
  workspaceId: string;
  sessionId?: string;
  taskId?: string;
  status: "idle" | "running" | "waiting_approval" | "completed" | "failed" | "canceled";
  generatedAt: string;
  updatedAt: string;
  currentTask?: {
    taskId: string;
    title?: string;
    status: string;
    executionMode?: "plan" | "execute" | "imperial_direct";
    interactionKind?: "approval" | "plan-question" | "supplemental-input";
  };
  learningSummary?: TaskLearningSummaryProjection;
  skillDrafts: SkillDraftListItemProjection[];
  evidence: AgentWorkspaceEvidenceSummary[];
  reuseBadges: AgentWorkspaceReuseBadge[];
  reuseRecords: AgentSkillReuseRecord[];
  capabilityGaps: AgentWorkspaceCapabilityGap[];
}
```

### AgentWorkspaceSummaryProjection

```ts
{
  workspaceId: string;
  generatedAt: string;
  window: {
    days: number;
    limit: number;
  };
  totals: {
    tasks: number;
    learningSummaries: number;
    skillDrafts: number;
    pendingSkillDrafts: number;
    reuseRecords: number;
  };
  recentTasks: Array<{
    taskId: string;
    title?: string;
    status: string;
    updatedAt: string;
  }>;
  skillDrafts: SkillDraftListItemProjection[];
  reuseRecords: AgentSkillReuseRecord[];
  learningSummaries: TaskLearningSummaryProjection[];
}
```

### TaskLearningSummaryProjection

```ts
{
  taskId: string;
  sessionId?: string;
  generatedAt: string;
  summary: string;
  outcome?: "succeeded" | "failed" | "canceled" | "partial";
  evidenceRefs: Array<{
    evidenceId: string;
    title?: string;
    sourceKind?: string;
  }>;
  memoryHints: Array<{
    id: string;
    summary: string;
    confidence?: number;
  }>;
  ruleHints: Array<{
    id: string;
    summary: string;
    confidence?: number;
  }>;
  skillDraftRefs: Array<{
    draftId: string;
    status: SkillDraftStatus;
  }>;
  capabilityGaps: AgentWorkspaceCapabilityGap[];
}
```

`memoryHints` 与 `ruleHints` 是只读摘要，不代表本 API 支持 memory / rule 写入或治理动作。

### SkillDraftListItemProjection

```ts
type SkillDraftStatus =
  | "draft"
  | "shadow"
  | "active"
  | "trusted"
  | "rejected"
  | "retired";

{
  draftId: string;
  status: SkillDraftStatus;
  title: string;
  summary: string;
  sourceTaskId?: string;
  sessionId?: string;
  confidence?: number;
  riskLevel?: "low" | "medium" | "high" | "critical";
  createdAt: string;
  updatedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  install?: SkillDraftInstallSummary;
  provenance?: SkillDraftProvenanceSummary;
  lifecycle?: SkillDraftLifecycleSummary;
}
```

### SkillDraftDetailProjection

```ts
SkillDraftListItemProjection & {
  description?: string;
  triggerReason?: string;
  proposedSkill: {
    name: string;
    description: string;
    allowedTools?: string[];
    requiredConnectors?: string[];
    compatibility?: string;
  };
  learningSummary?: TaskLearningSummaryProjection;
  evidenceRefs: AgentWorkspaceEvidenceSummary[];
  decisionHistory: Array<{
    action: "approve" | "reject";
    actor: string;
    reason?: string;
    note?: string;
    decidedAt: string;
  }>;
}
```

Approve 后可追加白名单 intake 摘要，例如 `intake.mode = "install-candidate"`、`intake.status = "ready"`、`intake.candidate`。这些字段不得把 Skill Lab 内部 install job、source credential 或 marketplace response 透传给 workspace API。

### SkillDraftDecisionResultProjection

```ts
{
  draft?: SkillDraftListItemProjection | SkillDraftDetailProjection;
  draftId?: string;
  action?: "approve" | "reject";
  dto?: Record<string, unknown>;
  intake?: {
    mode: "install-candidate";
    status: "ready";
    candidate?: {
      title: string;
      description?: string;
      bodyMarkdown: string;
      requiredTools?: string[];
      requiredConnectors?: string[];
      sourceTaskId: string;
      sourceEvidenceIds?: string[];
      riskLevel?: "low" | "medium" | "high" | "critical";
      confidence?: number;
    };
  };
}
```

### 共享子结构

```ts
type AgentWorkspaceEvidenceSummary = {
  evidenceId: string;
  title?: string;
  summary?: string;
  sourceKind?: string;
  citationId?: string;
};

type AgentWorkspaceReuseBadge = {
  kind: 'memory' | 'rule' | 'skill';
  id: string;
  label: string;
  confidence?: number;
};

type AgentSkillReuseRecord = {
  id: string;
  workspaceId: string;
  skillId: string;
  reusedBy: {
    id: string;
    label: string;
    kind: 'human' | 'agent' | 'system';
  };
  taskId?: string;
  sourceDraftId?: string;
  outcome: 'succeeded' | 'failed' | 'skipped';
  evidenceRefs: string[];
  reusedAt: string;
};

type SkillDraftInstallSummary = {
  receiptId: string;
  skillId: string;
  sourceId: string;
  version?: string;
  status: 'not_requested' | 'pending' | 'approved' | 'installing' | 'installed' | 'failed' | 'rejected';
  phase?: 'requested' | 'approved' | 'downloading' | 'verifying' | 'installing' | 'installed' | 'failed';
  installedAt?: string;
  failureCode?: string;
};

type SkillDraftProvenanceSummary = {
  sourceKind: 'workspace-draft';
  sourceTaskId?: string;
  sourceEvidenceIds?: string[];
  evidenceCount?: number;
  evidenceRefs?: AgentWorkspaceEvidenceSummary[];
  manifestId?: string;
  manifestSourceId?: 'workspace-skill-drafts';
};

type SkillDraftLifecycleSummary = {
  draftStatus: SkillDraftStatus;
  installStatus?: string;
  reusable: boolean;
  nextAction?:
    | 'review_draft'
    | 'install_from_skill_lab'
    | 'approve_install'
    | 'retry_install'
    | 'ready_to_reuse'
    | 'none';
};

type SkillInstallReceipt = {
  id: string;
  skillId: string;
  sourceId: string;
  version?: string;
  status: string;
  phase?: string;
  installedAt?: string;
  sourceDraftId?: string;
};

type AgentWorkspaceCapabilityGap = {
  capabilityId?: string;
  label: string;
  severity?: 'low' | 'medium' | 'high';
  suggestedAction?: string;
};
```

## 错误语义

| HTTP | code                            | 场景                                                          |
| ---- | ------------------------------- | ------------------------------------------------------------- |
| 400  | `AGENT_WORKSPACE_BAD_REQUEST`   | 参数缺失、`days/limit` 不是合法整数、reject reason 为空。     |
| 404  | `AGENT_WORKSPACE_NOT_FOUND`     | task、session、workspace 或 draft 不存在。                    |
| 409  | `SKILL_DRAFT_DECISION_CONFLICT` | 对已进入相反终态的 draft 执行决策，例如 rejected 后 approve。 |
| 422  | `SKILL_DRAFT_NOT_REVIEWABLE`    | draft 当前状态不可审批，例如 `retired`。                      |
| 500  | `AGENT_WORKSPACE_INTERNAL`      | projection 生成失败或真实宿主不可用。                         |

错误响应沿用项目通用 HTTP 错误形态；后续 schema 落地时至少应包含：

```ts
{
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
```

`details` 只能包含可展示诊断字段，不得包含 raw prompt、credential、provider response、tool raw payload 或完整 internal metadata。

## 兼容策略

- 新增字段必须向后兼容；前端必须忽略未知字段。
- 枚举扩展只能追加；前端遇到未知状态时展示为通用 unknown / pending，不得崩溃。
- `taskId` 优先于 `sessionId` 的解析规则不得改变。
- Approve / reject 的幂等语义不得改变；同一终态重复提交应返回当前结果。
- 从本地 file-backed draft store 迁移到数据库或外部 persistent draft store 时，不得改变已有 approve / reject response 形状、冲突语义或 `NotFoundException` 对应的 404 行为。
- Admin API facade 已承担后端 projection 到 UI 本地视图的 normalization；后端字段演进应追加兼容字段，前端 normalization 应集中在 facade，不把 `draftId` / `id`、`skillDrafts` / `drafts` 两套结构扩散到组件。
- `reuseRecords` 是向后兼容追加字段；旧后端或旧快照缺失时，前端必须按空数组处理，summary 的 `reuseRecordCount` 也应降级为 `0`。
- Skill draft 的 `install` / `provenance` / `lifecycle` 是向后兼容追加字段；旧后端或尚未安装的 draft 可缺失这些字段，前端必须降级为未请求、无收据或无 provenance evidence 状态。
- `provenance.evidenceRefs` 只能复用 `AgentWorkspaceEvidenceSummary` 白名单字段，`evidenceCount` 只表示 draft 关联的 source evidence id 数量；不得把 evidence metadata、rawMetadata、provider payload 或 checkpoint raw data 塞进 draft provenance。
- Workspace projection 只能输出 install receipt 白名单摘要；不得输出 `downloadRef`、`failureDetail`、`installCommand`、`installLocation`、raw `metadata`、vendor payload 或 staging path。
- MVP 不承诺 SSE 增量事件；后续如新增 SSE，必须先更新 `agent-chat.md` 或本文件的事件契约。
- 本 API 不替代既有 Runtime、Approvals、Learning、Skill Source、Memory、Rules 或 Gateway API；这些中心字段不得为了方便被内联进 workspace raw payload。

## 前后端边界

后端负责：

- 从 runtime / task / learning / evidence / skill draft 宿主读取数据并生成 projection。
- 从 runtime state 读取 `workspaceSkillReuseRecords`，只输出 `AgentSkillReuseRecord` 白名单字段，不透传 raw metadata、checkpoint、provider payload 或内部 registry 响应。
- 从 skill install receipt store 读取 workspace draft 安装结果，按 `sourceDraftId` 或 `workspace-draft-<draftId>` skill id 关联到 draft，并只输出 `install` / `provenance` / `lifecycle` 白名单摘要。
- 执行 skill draft approve / reject 决策、幂等检查和冲突检查。
- 裁剪敏感字段并写出审计信息。
- 保持 response 与 `packages/core` schema-first contract 对齐。

前端负责：

- `agent-chat` 使用 current projection 驱动 OpenClaw workspace、learning suggestions 和 skill draft cards。
- `agent-admin` 使用 summary、draft list 和 draft detail 驱动 Learning Center / Skill Lab 的治理视图。
- `agent-admin` API facade 负责 projection normalization；UI 组件只消费归一化后的本地视图。
- 不从 raw task dump、checkpoint 原始对象或内部 metadata 自行推导 workspace 状态。
- 对未知字段、未知枚举和空摘要做降级展示。

真实宿主边界：

- Runtime / learning / skill draft 构造逻辑应留在 `packages/runtime` 或对应真实宿主，不放进 backend controller。
- 稳定 JSON schema 应落在 `packages/core`；Workspace draft 的 install / provenance / lifecycle 摘要已经在 core schema 中保持 optional 兼容，高变实现细节留在宿主本地 `flows/`、`runtime/`、`repositories/` 或 `domain/`。
- Skill draft approved 只表示进入后续治理流程，不等同于已安装、已启用或已写入 `.agents/skills/*`。
- Persistent draft repository 应落在 `packages/skill` 的 repository / service 边界后面；backend 和 frontend 不得依赖具体存储表结构、Map 索引或 vendor payload。
