# Agent Workspace Center 后端说明

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server`
最后核对：2026-04-30

本文记录 `agent-server` 中 Agent Workspace Vault + Skill Flywheel MVP 的后端入口、边界和回归要求。跨端 API 字段以 [Agent Workspace API](/docs/contracts/api/agent-workspace.md) 为准，跨模块链路以 [Agent Workspace Vault + Skill Flywheel MVP 设计](/docs/integration/agent-workspace-vault-and-skill-flywheel-design.md) 为准。

## 当前入口

- HTTP controller：`apps/backend/agent-server/src/platform/workspace-center.controller.ts`
- Nest module 接线：`apps/backend/agent-server/src/platform/platform.module.ts`
- Runtime facade：`apps/backend/agent-server/src/runtime/centers/runtime-centers.service.ts`
- Query 实现：`apps/backend/agent-server/src/runtime/centers/runtime-centers-query.service.ts`
- Governance 实现：`apps/backend/agent-server/src/runtime/centers/runtime-centers-governance.service.ts`
- Agent-server draft store adapter：`apps/backend/agent-server/src/runtime/centers/runtime-centers-workspace-drafts.ts`
- Draft lifecycle projection helper：`apps/backend/agent-server/src/runtime/centers/runtime-centers-workspace-lifecycle.ts`
- Workspace query helper：`apps/backend/agent-server/src/runtime/centers/runtime-centers-workspace-query.ts`
- Projection builder：`packages/platform-runtime/src/centers/runtime-workspace-center.ts`
- Draft store MVP：`packages/skill/src/drafts/repository.ts` 与 `packages/skill/src/drafts/service.ts`

## 路由

`WorkspaceCenterController` 挂在 `@Controller('platform')`，对外经全局 API 前缀暴露：

| 方法   | 路径                                                           | 后端方法                       |
| ------ | -------------------------------------------------------------- | ------------------------------ |
| `GET`  | `/api/platform/workspace-center`                               | `getWorkspaceCenter()`         |
| `GET`  | `/api/platform/workspace-center/skill-drafts`                  | `listWorkspaceSkillDrafts()`   |
| `POST` | `/api/platform/workspace-center/skill-drafts/:draftId/approve` | `approveWorkspaceSkillDraft()` |
| `POST` | `/api/platform/workspace-center/skill-drafts/:draftId/reject`  | `rejectWorkspaceSkillDraft()`  |

Controller 只做 HTTP 适配和 facade 转发，不在 controller 内重建 runtime、learning 或 skill install 流程。

`GET /api/platform/workspace-center/skill-drafts` 当前保持数组返回形状，兼容既有 `listWorkspaceSkillDrafts()` 前端调用。它支持以下 query 参数：

| 参数           | 语义                                                                    |
| -------------- | ----------------------------------------------------------------------- |
| `status`       | 按 workspace draft 状态过滤，例如 `draft` / `active` / `rejected`。     |
| `source`       | 按 draft 原始来源过滤，例如 `workspace-vault`、`learning-suggestion`。  |
| `sourceTaskId` | 按产生 draft 的任务 id 过滤。                                           |
| `sessionId`    | 通过 runtime orchestrator task 的 `sessionId` 反查 source task 后过滤。 |
| `limit`        | 返回数组的最大长度；非正数或非法值按未传处理，当前最大钳制为 `100`。    |
| `cursor`       | 当前是 opaque base64 offset，例如 `MA==` 表示从第 `0` 条开始。          |

由于返回形状仍是数组，接口暂不返回 `nextCursor`。调用方需要翻页时可用 base64 编码后的 offset 继续请求；后续如果升级为 `{ items, nextCursor }`，必须先做前端兼容迁移。

## 当前行为

- `getWorkspaceCenter()` 返回稳定 MVP projection：包含 workspace id、status、generatedAt / updatedAt、learning summaries、skill drafts、evidence、reuse badges、capability gaps、totals 和 status counts。
- `runtime-centers-workspace-projection.ts` 从 `ctx.orchestrator.listTasks()` 的真实 task 记录中裁剪 current task、learning summaries、EvidenceRecord 摘要、reuse badges 和 capability gaps，再交给 `packages/platform-runtime` 的 workspace builder 做最终白名单 projection；Evidence 只保留可引用来源，不把 freshness/search plan/search result 这类过程元数据投影成 workspace evidence。
- `getWorkspaceCenter()` 会通过 `runtime-centers-workspace-query.ts` 读取 `RuntimeStateSnapshot.workspaceSkillReuseRecords`，按当前 `workspaceId` 过滤、按 `reusedAt` 倒序输出 `reuseRecords`；持久 reuse record 也会参与 skill reuse badge 去重，避免与 task 上的 `usedInstalledSkills` 重复显示。
- `getWorkspaceCenter()` 会读取 skill install receipt store，并委托 `runtime-centers-workspace-lifecycle.ts` 按 `receipt.sourceDraftId` 或 `workspace-draft-<draftId>` skill id 关联 workspace draft；返回给前端的 draft 只包含 `install`、`provenance`、`lifecycle` 白名单摘要。`provenance` 会保留 draft 的 `sourceEvidenceIds`，并用 workspace evidence 白名单摘要补出 `evidenceCount` 与 `evidenceRefs`，不透传 evidence metadata 或 receipt raw 字段。
- `listWorkspaceSkillDrafts()` 当前从 workspace projection 读取带 lifecycle 摘要的 `skillDrafts`，再委托 `runtime-centers-workspace-query.ts` 按 source draft id 交集、`status`、`sourceTaskId`、session task id 做只读过滤，最后由 `runtime-centers-workspace-drafts.ts` 用 `cursor` / `limit` 做 offset 分页；`sessionId -> sourceTaskId` 映射由 query helper 读取 orchestrator task 完成，`source` 过滤通过 draft store 先按原始 draft source 计算 draft id 交集，再回到 workspace projection，避免破坏 install / provenance / lifecycle 摘要。
- `approveWorkspaceSkillDraft()` 与 `rejectWorkspaceSkillDraft()` 通过 `runtime-centers-workspace-drafts.ts` 复用 `packages/skill` 的 `SkillDraftService` 修改 draft 状态；缺失 draft 会返回 `NotFoundException`。
- `approveWorkspaceSkillDraft()` 会在 draft 进入 `active` 后返回 `intake.mode = "install-candidate"` 的白名单候选摘要；候选内容来自 `packages/skill` 的 `buildSkillDraftInstallCandidate()`，不包含 raw metadata、workspace 内部作者字段或 credential。
- `workspace-skill-drafts` 是 Skill Sources Center 的内部 source。`runtime-workspace-skill-draft-manifests.ts` 只把 `active` / `trusted` draft 投影为 `SkillManifestRecord`，再由 `runtime-skill-sources.service.ts` 合并进现有 manifest 查询；安装和 receipt 仍走既有 Skill Sources / install governance。
- `workspace-draft:<draftId>` manifest entry 已由 `packages/skill` 的 `SkillArtifactFetcher` materialize：安装时会读取 file-backed draft store，生成 `SKILL.md` 与 `manifest.json`，再由 `finalizeSkillInstall()` 推到内部 skill package 目录并发布到 Skill Lab；本地安装 receipt 会写入 `sourceDraftId`，供 Workspace Center 后续回读。
- `runtime-centers-workspace-drafts.ts` 是 agent-server 的 MVP adapter，负责把 `AgentSkillDraft` 映射成 workspace projection，并防止 raw metadata 穿透到 controller 或前端。
- 默认 runtime context 带有 `settings.skillsRoot` 时，draft store 会落到 `profile-storage/<profile>/skills/drafts/workspace-drafts.json`；测试或短生命周期场景仍可注入 in-memory store。

## 下一阶段落地说明

- Persistent draft store：当前 agent-server 已通过 `packages/skill` 的 file-backed repository 获得本地 JSON 持久化能力，这是 MVP 持久化，不是最终治理数据库。生产化时应继续把数据库或外部存储能力放在 `packages/skill` repository / service 边界后面，agent-server 继续通过 `SkillDraftService` 或等价 facade 调用，不在 controller、query service 或 governance service 内直接访问数据库表、Map 索引或 vendor 存储对象。
- 真实 projection 聚合：当前已完成 task learning summary、EvidenceRecord 摘要、reuse badge、`AgentSkillReuseRecord` 持久记录、capability gap，以及 skill draft provenance evidence 关联摘要 / 计数的最小聚合；后续继续补更细的分页 / filter。
- Approve 后 Skill Lab 链路：当前 approve 已返回 install candidate 摘要，并让 approved / trusted draft 作为 `workspace-skill-drafts` manifest 出现在 Skill Sources 查询中；`workspace-draft:` entry 已能 materialize 为安装 artifact，receipt / provenance / lifecycle 已以只读摘要回填到 Workspace Center。更完整的安装操作、manifest 校验、trust policy、rollback 和 receipt 明细继续交给 Skill Lab / Skill Source Center / `packages/skill` install lifecycle。
- Chat Workspace Vault cards：backend 不为 chat 单独造另一套 payload；`agent-chat` 的 Vault cards 继续消费 `/api/platform/workspace-center` projection 或后续明确定义的兼容扩展。

## 边界

- 后端只返回白名单 projection，不透传 raw task dump、checkpoint 完整对象、tool raw input / output、provider response、credential 或完整 metadata。
- Workspace Center 不是 Runtime Center、Approvals Center、Learning Center 或 Skill Lab 的替代入口；它只聚合当前 workspace 需要展示和治理的摘要。
- Approve / reject 必须修改 store 状态，并让后续 workspace / draft list 查询立即反映状态变化。
- 接入真实 store 时必须保留高风险 draft evidence gate、幂等决策和冲突错误语义；不能把 reject 覆盖 active，也不能把 approve 覆盖 rejected。
- in-memory store 只用于测试、显式注入或缺少 `workspaceRoot` 的短生命周期场景；默认 file-backed store 承诺本地 JSON 跨重启读取，但不承诺多进程并发写入或数据库级事务。
- Backend 不得把 approve 实现成直接安装 skill、直接写 `.agents/skills/*` 或绕过 Skill Lab 的安装收据与信任策略。
- `workspaceSkillReuseRecords` 缺字段的旧 snapshot 必须按空数组兼容；写入端使用幂等 id 覆盖同一 run/task + skill 的重复记录，读取端按 `workspaceId` 过滤并只返回 core contract 字段。
- Workspace draft install 摘要不得透传 `downloadRef`、`failureDetail`、`installCommand`、`installLocation`、raw `metadata`、staging path 或 provider/vendor payload；失败只允许通过 `status`、`phase` 和可展示的 `failureCode` 表达。

## 回归入口

- `apps/backend/agent-server/test/platform/platform-workspace-center.controller.spec.ts`
- `apps/backend/agent-server/test/runtime/centers/runtime-centers-workspace-lifecycle.test.ts`
- `apps/backend/agent-server/test/runtime/centers/runtime-centers-workspace-projection.test.ts`
- `apps/backend/agent-server/test/runtime/centers/runtime-centers-workspace-query.test.ts`
- `apps/backend/agent-server/test/runtime/centers/runtime-centers-query.service.workspace.test.ts`
- `packages/runtime/test/learning-flow-skill-reuse.test.ts`
- `apps/backend/agent-server/test/runtime/centers/runtime-centers.service.workspace.test.ts`
- `apps/backend/agent-server/test/runtime/centers/runtime-centers-workspace-drafts.test.ts`
- `apps/backend/agent-server/test/runtime/domain/skills/runtime-workspace-skill-draft-manifests.test.ts`
- `apps/backend/agent-server/test/runtime/domain/skills/runtime-skill-sources-center-loader.test.ts`
- `apps/backend/agent-server/test/runtime/skills/runtime-skill-sources.service.test.ts`
- `apps/backend/agent-server/test/runtime/skills/workspace-draft-skill-artifact-fetcher.test.ts`
- `apps/backend/agent-server/test/runtime/skills/runtime-skill-install.service.test.ts`
- `apps/backend/agent-server/test/runtime/actions/runtime-skill-install-actions.local.test.ts`
- `packages/core/test/core-type-contracts.test.ts`
- `packages/platform-runtime/test/runtime-workspace-center.test.ts`
- `packages/skill/test/skill-draft-service.test.ts`

文档-only 更新至少执行 `pnpm check:docs`。后续接线真实 draft store 或改动代码时，还需要按 [验证体系规范](/docs/packages/evals/verification-system-guidelines.md) 补齐五层验证。
