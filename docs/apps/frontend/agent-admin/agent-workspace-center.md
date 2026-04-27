# Agent Workspace Center 前端说明

状态：current
文档类型：reference
适用范围：`apps/frontend/agent-admin`
最后核对：2026-04-26

本文记录 `agent-admin` 中 Agent Workspace Center 的 dashboard 入口、API facade、测试和不得破坏的行为。跨端 API 字段以 [Agent Workspace API](/docs/contracts/api/agent-workspace.md) 为准。

## 当前入口

- API facade：`apps/frontend/agent-admin/src/api/admin-api-workspace.ts`
- Dashboard 分发：`apps/frontend/agent-admin/src/pages/dashboard/dashboard-center-content.tsx`
- 页面 header：`apps/frontend/agent-admin/src/pages/dashboard/dashboard-page.tsx`
- 侧边栏入口：`apps/frontend/agent-admin/src/components/app-sidebar.tsx`
- UI 面板：`apps/frontend/agent-admin/src/features/workspace-center/workspace-center-panel.tsx`
- 本地类型：`apps/frontend/agent-admin/src/features/workspace-center/workspace-center-types.ts`

## Dashboard 行为

- 侧边栏新增 `Agent Workspace` 中心，用于工作区、技能草稿与复用飞轮治理。
- Dashboard 进入 workspace center 时先使用空态 fallback，再调用 `getWorkspaceCenter()` 刷新真实 projection；API facade 会把后端 `workspaceId/skillDrafts/draftId` projection 归一化成面板消费的 `workspace/drafts/id` 本地视图。
- Draft 区域会先按 `lifecycle.nextAction` 做只读分组摘要，帮助治理侧快速识别需要复核、从 Skill Lab 安装、批准安装、重试安装、已可复用或无需动作的草稿数量。
- Draft 卡片展示标题、描述、状态、风险等级、置信度、来源任务、工具、连接器，以及后端已回填的安装状态、receipt id 和 lifecycle 下一步摘要；`install.status = "failed"` 会展示为“安装失败”，并只显示白名单失败代码，不展示 raw receipt path、失败堆栈或 provider payload。
- 点击批准时调用 `approveWorkspaceSkillDraft(draftId)`，成功后刷新 workspace center；如果响应包含 `intake.mode = "install-candidate"`，dashboard 还会刷新 Skill Sources Center，让 approved draft manifest 在对应治理中心可见。
- 点击拒绝时要求输入拒绝原因；空原因不会发请求，非空原因调用 `rejectWorkspaceSkillDraft(draftId, reason)`，成功后刷新 workspace center。

## 下一阶段落地说明

- Projection normalization 已在 API facade 层存在；后续后端追加 persistent draft store、真实 evidence / learning / reuse 字段时，应先在 `admin-api-workspace.ts` 兼容归一化，再交给 UI 渲染，避免组件同时理解后端 projection 和本地 view model。
- Persistent draft store 对前端应是透明迁移：approve / reject 成功后仍以刷新后的 projection 为准，不做本地乐观终态覆盖，也不假设 draft 在服务重启后一定丢失或一定保留。
- Workspace Center 可以展示 Skill Lab intake / install candidate 摘要；当前 API facade 已兼容 `draft + intake` rich response，会保留后端返回的真实 `reuseRecords`，并会透传 draft 上的 `install` / `provenance` / `lifecycle` 只读摘要，缺失时降级为空数组、未声明下一步或未请求状态。安装、启用、trust 提升、rollback 和 marketplace/source 同步仍属于 Skill Lab / Skill Source Center；Workspace Center 不应新增绕过 Skill Lab 的“一键安装”语义。
- 当真实 learning / evidence / reuse 聚合接入后，页面只展示白名单摘要与审计链接，不从 Runtime Center raw record、checkpoint、tool payload 或 provider response 衍生补充字段。

## API facade

`admin-api-workspace.ts` 只消费后端稳定路径：

| 方法                           | 路径                                                       |
| ------------------------------ | ---------------------------------------------------------- |
| `getWorkspaceCenter()`         | `/platform/workspace-center`                               |
| `listWorkspaceSkillDrafts()`   | `/platform/workspace-center/skill-drafts`                  |
| `approveWorkspaceSkillDraft()` | `/platform/workspace-center/skill-drafts/:draftId/approve` |
| `rejectWorkspaceSkillDraft()`  | `/platform/workspace-center/skill-drafts/:draftId/reject`  |

这里的路径由 admin API core 统一补齐 API base；组件不得绕过 facade 直接拼 fetch。后端 projection 字段演进时，兼容归一化应优先留在 `admin-api-workspace.ts`，不要把 `draftId` / `skillDrafts` 与 `id` / `drafts` 两套结构扩散到 UI 组件。

## 边界

- `agent-admin` 的 Workspace Center 是后台治理入口，不承担 `agent-chat` 的前线执行与消息流职责。
- 页面只消费 workspace projection 和 draft projection，不从 raw runtime task、checkpoint 原始结构或 provider payload 推导状态。
- Approve / reject 是治理动作，不能在前端本地乐观改写为最终成功状态；应以后端响应或刷新后的 projection 为准。
- Draft 的工具、连接器、证据和复用信息只能展示白名单摘要；不得渲染 raw input、raw output、完整 metadata 或 credential。
- 如果后端仍返回空 projection 或 not found，前端应保持可渲染空态，不应崩溃。
- Skill Lab intake / install receipt 字段在 Workspace Center 只做摘要展示，不承担安装流程本身，也不得展示 raw receipt path、失败堆栈、完整 metadata 或 vendor payload。

## 与 agent-chat 的分工

- `agent-admin`：展示 Workspace Center dashboard，治理 skill drafts 和复用飞轮信号。
- `agent-chat`：在 OpenClaw workbench 中展示 learning / reuse readiness，把 learning evaluation 和 skill reuse 放在工作台区域，而不是重新塞回主聊天线程。

## 回归入口

- `apps/frontend/agent-admin/test/api/admin-api-workspace.test.ts`
- `apps/frontend/agent-admin/test/pages/dashboard/dashboard-center-content.test.ts`
- `apps/frontend/agent-admin/test/features/workspace-center/workspace-center-panel.test.tsx`
- 关联 chat readiness：`apps/frontend/agent-chat/test/pages/chat-home/chat-home-workbench-sections.test.tsx`

文档-only 更新至少执行 `pnpm check:docs`。后续如改动组件、API facade 或 dashboard 分发，需要同步执行对应前端单测和 `agent-admin` TypeScript 检查。
