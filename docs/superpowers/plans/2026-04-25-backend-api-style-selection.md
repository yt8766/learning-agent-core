# Backend API Style Selection Implementation Plan

状态：snapshot
文档类型：note
适用范围：`docs/api`、`docs/integration`、`docs/project-conventions.md`
最后核对：2026-04-25

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the approved backend API style selection into the repository's active API governance guidance for `agent-server` and `llm-gateway`.

**Architecture:** This is a docs-and-governance implementation. The canonical detailed design remains in `docs/superpowers/specs/2026-04-25-backend-api-style-selection-design.md`; active day-to-day guidance is added under `docs/api/` and linked from integration and project convention entry points. No backend runtime code, frontend code, dependency graph, or API behavior changes are part of this plan.

**Tech Stack:** Markdown documentation, existing `scripts/check-docs.js`, `pnpm check:docs`, Git.

---

## Scope Check

The spec covers one governance decision across two backend projects. It does not require separate implementation plans because the implementation is only to publish and connect the API style rule in the documentation tree.

Out of scope:

- Introducing GraphQL, tRPC, WebSocket, or new route handlers.
- Changing `apps/backend/agent-server` controllers.
- Changing `apps/llm-gateway` Next route handlers.
- Moving contracts between `apps/llm-gateway/src/contracts/*` and `packages/core`.
- Adding new package dependencies.

## File Structure

- Create `docs/api/interface-style-guidelines.md`
  - Canonical active guideline for choosing REST, SSE, Webhook, GraphQL, tRPC, and WebSocket in this repository.
  - Shorter and more operational than the design spec.
- Modify `docs/api/README.md`
  - Add the new guideline as the first reading item before endpoint-specific API docs.
- Modify `docs/integration/frontend-backend-integration.md`
  - Link the style guideline from the interface-documentation-first section and clarify that SSE/checkpoint remains the active realtime pattern.
- Modify `docs/project-conventions.md`
  - Add a small API style pointer so future agents find the rule from the global conventions entry point.
- Modify `docs/integration/README.md`
  - Add a link to the API style guideline if this index does not already point readers back clearly enough.

## Task 1: Publish Active API Style Guideline

**Files:**

- Create: `docs/api/interface-style-guidelines.md`
- Read: `docs/superpowers/specs/2026-04-25-backend-api-style-selection-design.md`

- [ ] **Step 1: Create the active guideline document**

Create `docs/api/interface-style-guidelines.md` with this content:

````markdown
# Interface Style Guidelines

状态：current
文档类型：guide
适用范围：`apps/backend/agent-server`、`apps/llm-gateway`、跨端 API 与 SSE 契约
最后核对：2026-04-25

本文是新增或修改后端接口时的接口风格判断入口。详细设计背景见 `docs/superpowers/specs/2026-04-25-backend-api-style-selection-design.md`。

## 1. 默认选择

当前仓库默认采用：

```text
RESTful JSON API + schema-first contract + SSE streaming
```
````

规则：

- RESTful JSON API 是默认查询、命令、CRUD、后台管理和 OpenAI-compatible HTTP 入口。
- SSE 是默认实时输出通道，用于 LLM streaming、Agent 执行事件、审批等待、完成和错误事件。
- 稳定 payload 必须 schema-first，优先落在 `packages/core` 或真实宿主的 `contracts/`、`schemas/`。
- GraphQL 暂不引入。
- tRPC 不作为跨端主协议。
- WebSocket 暂不引入；只有真实双向实时协同需求出现时再评估。
- Webhook 只用于外部系统主动回调，不作为内部前后端主通道。

## 2. `agent-server` 规则

`apps/backend/agent-server` 继续采用：

```text
REST command/query -> SSE observe -> checkpoint/history recover
```

使用方式：

- REST query：session、messages、events、checkpoint、runtime center、approvals center、learning center、evidence center、connector center。
- REST command：create session、append message、approve、reject、cancel、recover、confirm learning、refresh metrics。
- SSE observe：chat stream、runtime events、LLM response、approval pending、done/error。
- checkpoint/history：断流、刷新、idle close 或终态事件缺失后的恢复与校准。

约束：

- Controller 只做 HTTP/SSE/鉴权/参数装配，不内联 prompt、模型输出解析、graph 节点或长流程。
- 新增跨端 DTO、SSE event、checkpoint payload 或审批事件前，先更新 `docs/api/*`。
- 前端不从 raw task dump 自行推导 runtime、approval 或 evidence 状态，应消费后端 projection。

## 3. `llm-gateway` 规则

`apps/llm-gateway` 继续采用 OpenAI-compatible REST + SSE streaming。

公开调用面保持：

- `GET /api/v1/models`
- `GET /api/v1/key`
- `POST /api/v1/chat/completions`

后台管理面继续使用 REST：

- `POST /api/admin/auth/login`
- `POST /api/admin/auth/refresh`
- `POST /api/admin/auth/logout`
- `GET /api/admin/dashboard`
- `GET /api/admin/logs`
- `GET/POST/PATCH /api/admin/providers`
- `GET/POST/PATCH /api/admin/models`
- `GET/POST/PATCH /api/admin/keys`

约束：

- 对外 chat completions request、response、stream chunk 保持 OpenAI-compatible。
- Provider-specific response、error、SSE chunk、usage 必须先在 adapter 层转换成 gateway contract。
- Admin contract 继续放在 `apps/llm-gateway/src/contracts/*`，并用 zod parse 保护 route 和测试。
- 外部客户端不依赖 GraphQL、tRPC 或 monorepo 类型，只依赖 HTTP contract。

## 4. 何时重新评估其他协议

只有满足明确条件才重新评估：

- GraphQL：多个端持续需要同一实体的不同字段组合，REST projection 已明显膨胀，并且 schema、权限、缓存、错误语义可以统一治理。
- tRPC：只限局部内部工具，不对外公开，不替代 `docs/api` 契约，不绕过 schema-first contract。
- WebSocket：出现多人协作、高频双向控制或无法用 REST command + SSE observe 表达的实时需求。
- Webhook：外部系统主动调用本服务时使用，入口必须做鉴权、签名校验、幂等和 payload 归一化。

## 5. 新接口决策表

| 需求                 | 默认选择                          | 说明                                                          |
| -------------------- | --------------------------------- | ------------------------------------------------------------- |
| 后台 CRUD 或列表查询 | REST                              | 路径、方法、状态码、错误语义清晰                              |
| 平台动作命令         | REST command                      | approve、reject、cancel、recover、refresh 这类离散动作走 HTTP |
| Agent 执行观察       | SSE                               | 服务端单向持续推送为主                                        |
| 断线恢复             | checkpoint + messages/events REST | 长流程必须可恢复                                              |
| LLM chat completions | OpenAI-compatible REST            | 保持外部客户端兼容                                            |
| LLM streaming        | SSE                               | 与 OpenAI-compatible stream 一致                              |
| 外部平台回调         | Webhook                           | 第三方主动调用本服务                                          |
| Monorepo 类型同步    | zod schema + inferred type        | 不用 tRPC 替代正式 HTTP contract                              |

````

- [ ] **Step 2: Check the new guideline has no placeholders**

Run:

```bash
rg -n "待定|不确定|占位" docs/api/interface-style-guidelines.md
````

Expected: command exits with code `1` and prints no matches.

- [ ] **Step 3: Commit Task 1**

Run:

```bash
git add docs/api/interface-style-guidelines.md
git commit -m "docs: publish backend api style guidelines"
```

Expected: commit succeeds after `check:staged`.

## Task 2: Link the Guideline from API and Integration Entry Points

**Files:**

- Modify: `docs/api/README.md`
- Modify: `docs/integration/frontend-backend-integration.md`
- Modify: `docs/integration/README.md`

- [ ] **Step 1: Update `docs/api/README.md`**

In `docs/api/README.md`, add the new guideline to the main document list before endpoint-specific docs.

Change this section:

```markdown
本目录主文档：

- 聊天 API：[agent-chat.md](/docs/api/agent-chat.md)
```

To:

```markdown
本目录主文档：

- 接口风格选择：`interface-style-guidelines.md`
- 聊天 API：[agent-chat.md](/docs/api/agent-chat.md)
```

Then change the reading order from:

```markdown
1. [agent-chat.md](/docs/api/agent-chat.md)
2. [agent-admin.md](/docs/api/agent-admin.md)
```

To:

```markdown
1. `interface-style-guidelines.md`
2. [agent-chat.md](/docs/api/agent-chat.md)
3. [agent-admin.md](/docs/api/agent-admin.md)
```

Renumber the remaining items so the list stays sequential.

- [ ] **Step 2: Update `docs/integration/frontend-backend-integration.md`**

In the `## 接口文档先行` section, after the numbered list, add:

```markdown
接口风格选择以 `docs/api/interface-style-guidelines.md` 为准。当前默认模式是 RESTful JSON API + schema-first contract + SSE streaming；`agent-server` 继续采用 REST command/query -> SSE observe -> checkpoint/history recover，`llm-gateway` 继续采用 OpenAI-compatible REST + SSE streaming。
```

- [ ] **Step 3: Update `docs/integration/README.md`**

If `docs/integration/README.md` has an API or frontend-backend integration section, add this bullet near the existing frontend/backend integration link:

```markdown
- 接口风格选择以 `docs/api/interface-style-guidelines.md` 为准；integration 文档只补充调用顺序、联调和排障背景。
```

If the exact section does not exist, add the bullet under the closest existing list that links `docs/api` or frontend-backend integration.

- [ ] **Step 4: Run docs link validation**

Run:

```bash
pnpm check:docs
```

Expected:

```text
docs check passed
```

- [ ] **Step 5: Commit Task 2**

Run:

```bash
git add docs/api/README.md docs/integration/frontend-backend-integration.md docs/integration/README.md
git commit -m "docs: link api style guidance"
```

Expected: commit succeeds after `check:staged`.

## Task 3: Add Project Convention Pointer

**Files:**

- Modify: `docs/project-conventions.md`

- [ ] **Step 1: Find the API or integration convention section**

Run:

```bash
rg -n "API|接口|前后端|integration|contract|schema" docs/project-conventions.md
```

Expected: at least one matching section is printed.

- [ ] **Step 2: Add the API style pointer**

Add this paragraph to the closest section that governs API, contract, or frontend/backend integration:

```markdown
新增或修改后端接口前，必须先按 `docs/api/interface-style-guidelines.md` 判断接口形态。默认使用 RESTful JSON API + schema-first contract + SSE streaming；GraphQL、tRPC 和 WebSocket 都不是默认选项，只有满足指南中的重新评估条件时才允许另行设计。
```

Do not duplicate the full decision table in `docs/project-conventions.md`; keep the details in `docs/api/interface-style-guidelines.md`.

- [ ] **Step 3: Run docs validation**

Run:

```bash
pnpm check:docs
```

Expected:

```text
docs check passed
```

- [ ] **Step 4: Commit Task 3**

Run:

```bash
git add docs/project-conventions.md
git commit -m "docs: add api style convention pointer"
```

Expected: commit succeeds after `check:staged`.

## Task 4: Final Review and Delivery

**Files:**

- Read: `docs/api/interface-style-guidelines.md`
- Read: `docs/api/README.md`
- Read: `docs/integration/frontend-backend-integration.md`
- Read: `docs/integration/README.md`
- Read: `docs/project-conventions.md`

- [ ] **Step 1: Verify no placeholders across touched docs**

Run:

```bash
rg -n "待定|不确定|占位" docs/api/interface-style-guidelines.md docs/api/README.md docs/integration/frontend-backend-integration.md docs/integration/README.md docs/project-conventions.md
```

Expected: command exits with code `1` and prints no matches.

- [ ] **Step 2: Verify staged state is clean after commits**

Run:

```bash
git status --short docs/api/interface-style-guidelines.md docs/api/README.md docs/integration/frontend-backend-integration.md docs/integration/README.md docs/project-conventions.md
```

Expected: no output for these files.

- [ ] **Step 3: Run final docs check**

Run:

```bash
pnpm check:docs
```

Expected:

```text
docs check passed
```

- [ ] **Step 4: Summarize delivery**

Report:

```text
计划已完成。
新增 docs/api/interface-style-guidelines.md。
更新 docs/api/README.md、docs/integration/frontend-backend-integration.md、docs/integration/README.md、docs/project-conventions.md。
验证：pnpm check:docs 通过。
后续新增接口优先阅读 docs/api/interface-style-guidelines.md，再阅读具体 docs/api/* 契约。
```

## Self-Review

- Spec coverage: The plan publishes the REST + schema-first + SSE decision, documents `agent-server`, documents `llm-gateway`, states GraphQL/tRPC/WebSocket/Webhook boundaries, links the guideline from API and integration entry points, and adds a project convention pointer.
- Placeholder scan: The plan contains no placeholder markers or intentionally vague implementation steps.
- Type consistency: No code types are introduced. File paths and document names are consistent across tasks.
