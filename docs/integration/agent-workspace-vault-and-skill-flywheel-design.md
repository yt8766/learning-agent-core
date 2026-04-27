# Agent Workspace Vault + Skill Flywheel MVP 设计

状态：current
文档类型：integration
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-chat`、`apps/frontend/agent-admin`、`packages/runtime`、`packages/core`
最后核对：2026-04-26

本主题主文档：

- API 契约：[agent-workspace.md](/docs/contracts/api/agent-workspace.md)
- 集成设计：本文

本文只覆盖：

- Agent Workspace Vault + Skill Flywheel MVP 的跨模块设计边界
- Workspace current / summary、Skill Draft list / detail / approve / reject、task learning summary projection
- 当前 MVP 与下一步生产化缺口
- Heartbeat / Gateway / Memory / Rule 等后续扩展的非 MVP 边界

本文定义 Agent Workspace Vault + Skill Flywheel MVP 的跨模块设计边界。API 契约以 [agent-workspace.md](/docs/contracts/api/agent-workspace.md) 为准；本文只说明产品范围、链路分工和后续实现不得越界的事项。

## 当前 MVP 落地状态

截至 `2026-04-26`，本主题处于“骨架已接入、本地 file-backed draft store、真实 task projection、skill reuse record 持久投影与 workspace draft install 摘要已闭环，完整治理动作继续留在 Skill Lab / Skill Sources”的状态：

- `packages/skill-runtime/src/drafts/` 已提供 in-memory / file-backed skill draft repository 与 `SkillDraftService`，覆盖 create、list、approve、reject、promote、retire 和 reuse stats。
- `packages/platform-runtime/src/centers/runtime-workspace-center.*` 已提供 workspace projection builder，负责把 task、learning summary、evidence、reuse badge、capability gap 和 skill draft 裁剪成白名单 workspace 视图。
- `apps/backend/agent-server/src/platform/workspace-center.controller.ts` 已暴露 Workspace Center HTTP 入口，并通过 `RuntimeCentersService` facade 转发查询与决策。
- `apps/frontend/agent-admin` 已新增 Workspace Center dashboard 入口：侧边栏出现 `Agent Workspace`，dashboard content 会读取 `/platform/workspace-center` 并在 draft 卡片上触发 approve / reject 后刷新。
- `apps/frontend/agent-chat` workbench 已具备 learning / reuse readiness 展示：learning evaluation、reused memories / rules / skills 和 Skill Flywheel 候选输入只显示在 workbench 区域，不重新污染主聊天线程。

需要保持准确的边界：

- 当前后端 workspace 查询已读取 context-aware draft store；默认 runtime context 带有 `workspaceRoot` 时使用本地 JSON file-backed store，并从 runtime task 记录投影 learning summary、EvidenceRecord 摘要、reuse badges 和 capability gaps，同时从 `RuntimeStateSnapshot.workspaceSkillReuseRecords` 输出真实 `reuseRecords`。
- 当前 `approveWorkspaceSkillDraft` / `rejectWorkspaceSkillDraft` 已接入 agent-server draft store；缺失 draft 返回 not found，存在 draft 时必须修改状态，并保持 approve / reject 幂等和冲突语义。
- 当前 workspace draft 安装 receipt 会携带 `sourceDraftId`；Workspace Center 会按 `sourceDraftId` 或 `workspace-draft-<draftId>` skill id 回读 receipt，并在 draft 上输出 `install` / `provenance` / `lifecycle` 白名单摘要。
- 当前 file-backed store 是 MVP 本地持久化，不是最终治理数据库；它承诺重启后可读本地 JSON，不承诺多进程并发写入、审计历史或数据库级事务。
- 当前 `agent-admin` API facade 已做 projection normalization，把后端 `workspaceId` / `skillDrafts` / `draftId` 归一化为面板本地视图；后续字段演进应继续在 facade 层兼容，不把两套形状扩散到 UI。

## 下一阶段生产化缺口

下一阶段目标不是重写 MVP，而是在现有 projection / facade / draft service 基础上补齐生产链路：

1. Persistent draft store
   - 在 `packages/skill-runtime` 已有 file-backed repository 基础上继续扩展，保存 decision history、risk gate、evidence refs、reuse stats 和安装候选状态。
   - 保留现有 `SkillDraftService` 语义：approve / reject 幂等、相反终态冲突、高风险 evidence gate、reuse stats 不穿透 raw metadata。
   - Agent-server 只能依赖 repository / service 抽象，不应在 controller 或 runtime facade 内直接访问数据库结构。
2. Workspace projection 聚合真实 learning / evidence / reuse
   - `packages/platform-runtime` projection builder 继续作为白名单裁剪边界；当前输入已接入真实 task learning summary、EvidenceRecord 摘要、reuse badge、capability gap 和 sourceTaskId 关系。
   - `packages/runtime` 在已安装 skill 复用被 `recordExecutionResult` 接受后，会写入 `AgentSkillReuseRecord`，由 Workspace Center 回读并投影为 `reuseRecords`。
   - 当前 skill draft provenance 已能输出 source evidence id、关联数量和白名单 evidence 摘要；后续继续补更细的分页 / filter。
   - 聚合结果只输出可展示摘要：evidence id / title / citation、learning summary、reuse badge、draft 状态和 totals；不得把 raw checkpoint、raw tool payload、provider response 或完整 metadata 塞进 projection。
   - `agent-chat` 和 `agent-admin` 都消费同一套 projection；不得分别从 raw task dump 重算 learning、evidence 或 reuse 状态。
3. Approve 后进入 Skill Lab / 安装链路
   - 当前 approve 会把 draft 标记为 `active`，返回白名单 install candidate 摘要，并让 `active` / `trusted` draft 通过 `workspace-skill-drafts` 内部 source 暴露为 Skill Sources manifest；这仍不等同于已安装 skill。
   - `workspace-draft:<draftId>` entry 已能由 `SkillArtifactFetcher` materialize 为 `SKILL.md` 与 `manifest.json`，然后经既有 install lifecycle 安装到内部 skill package 目录。
   - 当前 Workspace API 已能回读 install receipt / artifact provenance / lifecycle 的只读摘要；更完整的 receipt 明细、安装动作、信任提升、回滚或退役仍由 skill governance 决定。
   - Workspace API 可以返回 `target: "skill-lab"`、install candidate 或 receipt 摘要，但不能直接执行远程安装、修改 `.agents/skills/*` 或绕过 Skill Lab 的 trust / compatibility / receipt 规则。
4. Chat Workspace Vault cards
   - `agent-chat` 下一步应把 workspace projection 渲染为 OpenClaw workbench 内的 Workspace Vault cards：当前任务、evidence、learning summary、reuse badges、skill draft readiness、capability gaps。
   - Cards 应靠近 ThoughtChain / Evidence / Learning / Skill reuse 区域，但不把治理摘要塞回主聊天消息流。
   - Chat 侧 approve / reject 如果开放，只能调用 Workspace API 并以刷新后的 projection 为准，不做本地乐观终态覆盖。

## 目标

Agent Workspace Vault 是前线工作区的当前态与摘要投影层，用于让 `agent-chat` 和 `agent-admin` 以同一套白名单 projection 观察当前任务、会话、证据、学习和技能草案。

Skill Flywheel 是从任务复盘中产生 skill draft，并由用户或治理端批准、拒绝的最小闭环。MVP 只负责“发现候选、展示草案、审批决策、投影回 workspace”，不负责自动安装远程 skill、不负责 marketplace 同步，也不直接修改运行时技能注册表。

## MVP 范围

本轮 MVP 只包含：

- Workspace current：当前 session / task 的工作区投影。
- Workspace summary：最近任务、学习候选、skill draft 和证据的轻量摘要。
- Skill Draft list / detail：读取 skill draft 列表与详情。
- Skill Draft approve / reject：对 skill draft 做治理决策。
- Task learning summary projection：按 task 输出学习摘要投影，供 workspace 和 draft 详情复用。

MVP 不包含：

- Heartbeat：不定义实时心跳、presence、worker liveness 或浏览器 tab 活跃协议。
- Gateway：不定义 LLM Gateway、provider credential、外部消息通道或 connector gateway 的新入口。
- Memory：不新增 memory CRUD、memory promotion 或 memory conflict API；只能读取 learning summary 中已经白名单化的 memory hint 摘要。
- Rule：不新增 rule CRUD、rule invalidation 或 rule supersede API；只能读取 learning summary 中已经白名单化的 rule hint 摘要。
- Skill install / marketplace：不在本接口内安装远程 skill；批准 draft 只把 draft 标记为可进入后续 skill governance 流程。

## 产品分工

`agent-chat` 是前线作战面：

- 在 OpenClaw workspace 中展示 current projection。
- 在消息流、学习建议和 skill reuse badge 附近展示 skill draft 摘要。
- 允许用户对来自当前任务的 draft 做 approve / reject。
- 不从 raw task dump、checkpoint 原始结构或 runtime 内部字段自行推导 workspace 状态。

`agent-admin` 是后台指挥面：

- 在 Learning Center / Skill Lab 中读取 workspace summary、draft list 和 draft detail。
- 对 skill draft 做治理审批、拒绝和审计查看。
- 不把 workspace API 当成 Runtime Center、Approvals Center 或 Skill Source Center 的替代入口。

后端 `agent-server` 是 HTTP 适配层：

- 只暴露 API 文档定义的 projection。
- 不在 controller 中重建 runtime 主链、学习主链或 skill 安装流程。
- 不透传 provider、tool executor、checkpoint、memory repository、rule repository 或 marketplace 的原始对象。

`packages/runtime` / 真实宿主负责：

- 从 task、checkpoint、learning evaluation、evidence、skill draft 构造 workspace projection。
- 保持 task learning summary 与 skill draft 的来源关系可追踪。
- 确保 approve / reject 决策可审计、可幂等、可被后续治理流程消费。

`packages/core` 后续应承接稳定 JSON schema：

- Workspace current / summary projection。
- Task learning summary projection。
- Skill draft list item / detail / decision request / decision result。

## 最小链路

1. Runtime 完成或更新任务时，真实宿主生成 task learning summary projection。
2. Skill draft 生成逻辑根据 learning summary、evidence、reused skill 和 capability gap 生成 draft，并记录 `sourceTaskId`。
3. 已安装 skill 被实际复用后，runtime learning flow 写入 `RuntimeStateSnapshot.workspaceSkillReuseRecords`；Workspace Center 回读并投影为 `reuseRecords`，同时用于去重 skill reuse badge。
4. 前端读取 `GET /api/platform/workspace-center` 展示当前 workspace 与摘要投影。
5. 前端读取 `GET /api/platform/workspace-center/skill-drafts` 展示候选 skill。
6. 用户或管理员调用 approve / reject。
7. 后端写出 draft 决策状态，并让 workspace current / summary 能立即反映最新状态。

下一阶段生产链路在第 7 步之后继续：

8. Approved draft 先通过 `buildSkillDraftInstallCandidate(draft)` 生成白名单 install candidate，并经 `runtime-workspace-skill-draft-manifests.ts` 投影为 `workspace-skill-drafts` 内部 manifest，供 Skill Sources / install governance 后续消费。
9. Skill Lab 校验 manifest、tool / connector capability、trust policy、兼容性和 evidence gate。
10. 安装或启用结果写入 skill-runtime install receipt / lifecycle state，workspace draft 安装写入 `sourceDraftId` 以保留来源关系。
11. Workspace projection 回读安装摘要、provenance、复用 readiness 和审计链接，不直接承载安装执行细节，也不输出 staging path、失败堆栈或 raw metadata。

当前回归用例已经覆盖到的链路：

- `packages/skill-runtime/test/skill-draft-service.test.ts`：in-memory draft store 的创建、approve、reject、高风险 evidence gate 和 reuse stats。
- `packages/skill-runtime/test/skill-draft-file-repository.test.ts`：file-backed draft repository 的本地 JSON 持久化、重启读取和 raw metadata 防泄漏。
- `packages/skill-runtime/test/skill-draft-install-candidate.test.ts`：approved draft 到 install candidate 的白名单投影。
- `packages/platform-runtime/test/runtime-workspace-center.test.ts`：workspace projection 白名单裁剪、status counts 和 metadata 防泄漏。
- `packages/runtime/test/learning-flow-skill-reuse.test.ts`：已安装 skill 复用成功时写出 workspace skill reuse record，未命中 skill 时不写。
- `apps/backend/agent-server/test/runtime/actions/runtime-skill-install-actions.local.test.ts` 与 `packages/core/test/core-type-contracts.test.ts`：workspace draft 安装 receipt 写入并保留 `sourceDraftId`。
- `apps/backend/agent-server/test/platform/platform-workspace-center.controller.spec.ts`：HTTP controller 到 runtime facade 的方法转发。
- `apps/backend/agent-server/test/runtime/centers/runtime-centers-query.service.workspace.test.ts`：workspace projection、draft store 读取、真实 task learning / evidence / reuse / capability gap 聚合的稳定形状。
- `apps/backend/agent-server/test/runtime/centers/runtime-centers.service.workspace.test.ts`：runtime centers facade 暴露查询与治理方法，以及缺失 draft 的 not found 行为。
- `apps/backend/agent-server/test/runtime/centers/runtime-centers-workspace-drafts.test.ts`：agent-server draft store adapter 的状态映射、决策更新和 raw metadata 防泄漏。
- `apps/frontend/agent-admin/test/api/admin-api-workspace.test.ts` 与 `test/features/workspace-center/workspace-center-panel.test.tsx`：Admin API facade、dashboard 卡片、approve / reject 控件与刷新入口。
- `apps/backend/agent-server/test/runtime/domain/skills/runtime-workspace-skill-draft-manifests.test.ts` 与 `test/runtime/skills/runtime-skill-sources.service.test.ts`：approved / trusted draft manifest 投影和 Skill Sources 合并。
- `packages/skill-runtime/test/skill-artifact-fetcher.test.ts`、`apps/backend/agent-server/test/runtime/skills/workspace-draft-skill-artifact-fetcher.test.ts` 与 `apps/backend/agent-server/test/runtime/skills/runtime-skill-install.service.test.ts`：`workspace-draft:` artifact materialization 和安装闭环。
- `apps/frontend/agent-chat/test/pages/chat-home/chat-home-workbench-sections.test.tsx`：chat workbench 中 learning / reuse readiness 的展示位置与主线程隔离。

## 状态语义

Skill draft 状态使用下列 MVP 枚举：

- `draft`：已生成但尚未进入可自动复用态。
- `shadow`：可展示、可被推荐，但不能自动调用。
- `active`：已批准进入后续 skill governance 流程，可在策略允许时复用。
- `trusted`：多次复用成功后的高信任状态，仍受工具、连接器和审批策略约束。
- `rejected`：已拒绝，不应再次自动推送给同一 workspace。
- `retired`：被更新版本、更高质量草案或治理决策退役。

Approve / reject 必须是幂等动作：

- 对已 `active` 或 `trusted` 的 draft 再次 approve 返回当前结果。
- 对已 `rejected` 的 draft 再次 reject 返回当前 rejected 结果。
- 对相反终态执行决策应返回冲突错误，不得静默覆盖审计历史。

## Projection 约束

Workspace projection 只能暴露前端可展示、可治理、可追踪的白名单字段：

- task / session / workspace id。
- summary、status、updatedAt、generatedAt。
- evidence 摘要与 citation id。
- learning summary 摘要。
- skill draft 摘要、状态和决策信息。
- skill draft install / provenance / lifecycle 只读摘要。
- reuse badges 与 capability gap 摘要。

不得透传：

- raw prompt、raw model output、tool raw input / output。
- checkpoint 完整对象。
- memory / rule repository 原始记录。
- provider SDK response、vendor error、credential、connector secret。
- 未经裁剪的 `metadata`。
- install receipt 的 `downloadRef`、`failureDetail`、`installCommand`、`installLocation`、raw staging path。

## 与既有中心关系

- Runtime Center 仍负责任务、队列、模型、成本和运行态治理。
- Approvals Center 仍负责 interrupt / approval 恢复。
- Learning Center 仍负责学习治理总览。
- Skill Lab / Skill Source Center 仍负责正式 skill、skill source、install receipt 和 marketplace 治理。
- Agent Workspace API 是面向 workspace 的投影层，只把这些中心的必要摘要聚合到当前任务上下文中。

生产化接线时的 ownership：

| 能力                             | MVP 当前状态                                                                                                                                                                                                    | 下一步 owner                                                          | 不得做的事                                    |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------- |
| Draft store                      | agent-server 本地 file-backed store 已闭环                                                                                                                                                                      | `packages/skill-runtime` repository / service                         | controller 直连数据库或绕过 service 决策语义  |
| Learning / evidence / reuse 聚合 | task learning / evidence / reuse badge 与真实 reuse record 持久化 / projection 已闭环                                                                                                                           | `packages/platform-runtime` + 真实 runtime / learning / evidence 宿主 | 前端从 raw task dump 自行聚合                 |
| Approve 后安装                   | approve 返回 install candidate，approved / trusted draft 已作为 `workspace-skill-drafts` manifest 暴露，`workspace-draft:` entry 已可 materialize，receipt / provenance / lifecycle 以摘要回填 Workspace Center | Skill Lab / Skill Source Center / skill-runtime install lifecycle     | Workspace API 直接安装或写 `.agents/skills/*` |
| Chat Vault cards                 | workbench 已展示 learning / reuse readiness                                                                                                                                                                     | `agent-chat` OpenClaw workbench                                       | 把 cards 作为普通聊天消息刷屏                 |

## 后续扩展

以下能力只能作为后续扩展，不属于 MVP 实现要求：

- Heartbeat / presence / tab activity。
- Gateway / provider / connector gateway 状态。
- Memory CRUD、memory promotion、memory conflict merge。
- Rule CRUD、rule supersede / invalidate / restore。
- Skill install、remote marketplace sync、source trust refresh；这些只能由 Skill Lab / Skill Source Center / skill-runtime install lifecycle 承接，Workspace API 只读取摘要。
- SSE 增量事件；MVP 可先用 HTTP query + 既有 chat SSE 补充。

扩展这些能力前必须先更新对应 API 文档与 schema，不能把字段直接塞进 workspace projection。
