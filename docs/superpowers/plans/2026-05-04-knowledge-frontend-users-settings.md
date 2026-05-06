# Knowledge Frontend Users And Settings Implementation Plan

状态：draft
文档类型：plan
适用范围：`apps/frontend/knowledge`
最后核对：2026-05-04

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐知识库前端智能代理参考界面缺失的用户管理页和系统设置子页面。

**Architecture:** 在 `apps/frontend/knowledge` 内复用现有 Ant Design、`AppShell`、`PageSection` 与 `knowledge-pro.css` 样式体系，新增用户管理和设置子路由。参考 `/Users/dev/Downloads/app` 的信息架构与展示内容，但不引入参考项目的 Tailwind、lucide 或 framer-motion 依赖。

**Tech Stack:** React 19、React Router、Ant Design 6、Vitest、TypeScript。

---

### Task 1: 路由与导航契约

**Files:**

- Modify: `apps/frontend/knowledge/test/app-render.test.tsx`
- Modify: `apps/frontend/knowledge/src/app/App.tsx`
- Modify: `apps/frontend/knowledge/src/app/layout/app-shell.tsx`

- [ ] **Step 1: Write the failing test**

Add assertions that authenticated navigation exposes `用户管理`, `模型配置`, `API 密钥`, `存储管理`, `安全策略`, and `resolveViewFromPath` maps `/users` plus `/settings/*` routes.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/frontend/knowledge test -- app-render.test.tsx`

- [ ] **Step 3: Write minimal routing and sidebar implementation**

Add `users`, `settingsModels`, `settingsKeys`, `settingsStorage`, and `settingsSecurity` to `KnowledgeView`, `pathByView`, `viewByMenuKey`, and the Ant Design menu structure.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/frontend/knowledge test -- app-render.test.tsx`

### Task 2: 用户管理页面

**Files:**

- Create: `apps/frontend/knowledge/src/pages/users/users-page.tsx`
- Create: `apps/frontend/knowledge/test/knowledge-users-settings-pages.test.tsx`
- Modify: `apps/frontend/knowledge/src/app/App.tsx`

- [ ] **Step 1: Write the failing test**

Render `/users` and assert the page contains search, invite action, user stats, role/status labels, and user table content.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/frontend/knowledge test -- knowledge-users-settings-pages.test.tsx`

- [ ] **Step 3: Implement the page**

Use Ant Design `Input`, `Button`, `Card`, `Statistic`, `Table`, `Tag`, and `Modal` with local mock records.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/frontend/knowledge test -- knowledge-users-settings-pages.test.tsx`

### Task 3: 设置子页面

**Files:**

- Create: `apps/frontend/knowledge/src/pages/settings/settings-models-page.tsx`
- Create: `apps/frontend/knowledge/src/pages/settings/settings-keys-page.tsx`
- Create: `apps/frontend/knowledge/src/pages/settings/settings-storage-page.tsx`
- Create: `apps/frontend/knowledge/src/pages/settings/settings-security-page.tsx`
- Modify: `apps/frontend/knowledge/test/knowledge-users-settings-pages.test.tsx`
- Modify: `apps/frontend/knowledge/src/app/App.tsx`

- [ ] **Step 1: Write the failing test**

Render each settings route and assert the expected title, primary action, and representative table/card content.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/frontend/knowledge test -- knowledge-users-settings-pages.test.tsx`

- [ ] **Step 3: Implement the pages**

Use local typed mock data and Ant Design controls. Keep settings cards compact and operational, matching the reference IA without copying its implementation stack.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/frontend/knowledge test -- knowledge-users-settings-pages.test.tsx`

### Task 4: 样式与文档

**Files:**

- Modify: `apps/frontend/knowledge/src/styles/knowledge-pro.css`
- Modify: `docs/apps/frontend/knowledge/knowledge-frontend.md`

- [ ] **Step 1: Add focused CSS**

Add layout helpers for settings groups, summary cards, table shells, and security controls.

- [ ] **Step 2: Update docs**

Document the new `用户管理` and `系统设置`子路由, including the fact that they use project-native components.

- [ ] **Step 3: Verify affected scope**

Run:

```bash
pnpm --dir apps/frontend/knowledge test -- app-render.test.tsx knowledge-users-settings-pages.test.tsx
pnpm --dir apps/frontend/knowledge typecheck
```
