# Knowledge Ant Design Pro UI Implementation Plan

状态：snapshot
文档类型：plan
适用范围：`apps/frontend/knowledge`
最后核对：2026-05-01

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `apps/frontend/knowledge` 迁移为 Ant Design Pro 风格的知识库治理控制台，并在对话实验室使用 `@ant-design/x`。

**Architecture:** 保留现有 Vite + React 独立前端和 mock API 数据源，替换 inline style 控制台为 Ant Design 组件化布局。应用层只维护 UI facade，不改后端协议和知识库运行时 contract。

**Tech Stack:** React 19、Vite 8、Ant Design 6、`@ant-design/icons`、`@ant-design/x`、Vitest server render smoke tests。

---

### Task 1: Dependency And Smoke Contract

**Files:**

- Modify: `apps/frontend/knowledge/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/frontend/knowledge/test/app-render.test.tsx`

- [ ] **Step 1: Write failing tests**

Add assertions that authenticated rendering includes Pro-style shell labels and the Ant Design X chat lab marker.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/frontend/knowledge test -- app-render.test.tsx`
Expected: FAIL because the shell does not yet render `Knowledge Pro` or `Ant Design X`.

- [ ] **Step 3: Install UI dependencies**

Run from `apps/frontend/knowledge`: `pnpm add antd@^6.3.3 @ant-design/icons@~6.1.0 @ant-design/x@^2.4.0 @ant-design/x-markdown@^2.4.0`

- [ ] **Step 4: Implement Pro-style shell and pages**

Replace custom inline widgets with Ant Design `Layout`, `Menu`, `Card`, `Statistic`, `Table`, `Tabs`, `Timeline`, `Form`, `Select`, `Tag`, and `Alert`. Use `@ant-design/x` sender/conversation primitives in chat lab.

- [ ] **Step 5: Verify affected frontend**

Run: `pnpm --dir apps/frontend/knowledge test`
Run: `pnpm --dir apps/frontend/knowledge typecheck`
Run: `pnpm --dir apps/frontend/knowledge build`

### Task 2: Documentation

**Files:**

- Create: `docs/apps/frontend/knowledge/antd-pro-ui.md`

- [ ] **Step 1: Document current implementation**

Record the new UI dependency boundary, page structure, mock data policy, chat lab `@ant-design/x` usage, and verification commands.

- [ ] **Step 2: Run docs check**

Run: `pnpm check:docs`
