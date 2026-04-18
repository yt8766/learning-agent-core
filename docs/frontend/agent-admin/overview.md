# agent-admin 概览

状态：current
文档类型：reference
适用范围：`apps/frontend/agent-admin`
最后核对：2026-04-16

`agent-admin` 是后台指挥面，负责治理与运营，不和 `agent-chat` 做重复聊天产品。

当前主要承载：

- Runtime Center
- Approvals Center
- Learning Center
- Skill Lab
- Evidence Center
- Connector & Policy Center
- 规则、任务轨迹、评测与归档等治理视图

## 当前目录职责

- `src/app`
  - 应用入口、路由、全局 provider
- `src/api`
  - 面向 `agent-server` 的后台治理接口封装
- `src/features/runtime-overview`
  - Runtime 总览与运行态聚合
  - `components/runtime-queue-section.tsx`
    - 只保留容器 wiring
  - `components/runtime-queue-run-list.tsx`
    - 承载 Run Queue 列表、筛选栏和队列摘要卡片
  - `components/runtime-queue-selected-run.tsx`
    - 承载 Selected Run 卡片装配
  - `components/runtime-queue-selected-run-summary.tsx`
    - 承载选中任务的 budget / routing / planning / critique / findings 摘要分区
  - `components/runtime-queue-trace-panels.tsx`
    - 承载 critical path、trace waterfall、latest traces 与 audit replay 面板
  - `components/runtime-queue-section-support.ts`
    - 承载 trace view、critical path、route confidence、execution summary 等派生逻辑
- `src/features/approvals-center`
  - 审批中心
- `src/features/learning-center`
  - 学习治理与学习记录视图
  - `learning-center-panel.tsx`
    - 只保留容器 orchestration、状态与派生装配
  - `learning-center-panel-support.ts`
    - 承载 chart data、selector filter 与规则候选派生逻辑
  - `learning-center-charts-card.tsx`
    - 承载 queue / conflict / ministry / trust 图表切换与渲染
  - `learning-center-summary-sections.tsx`
    - 承载知识库摘要、治理报告、trust 与 governance profile 分区
  - `learning-center-operations-sections.tsx`
    - 承载 selector 过滤与 conflict governance 操作区
  - `learning-center-record-sections.tsx`
    - 承载 queue、实验、隔离、规则、候选与 recent jobs 记录区
- `src/features/skill-lab`、`src/features/skill-sources-center`
  - 技能实验室、来源治理与安装来源管理
- `src/features/evidence-center`
  - 证据与引用治理
- `src/features/connectors-center`
  - Connector、策略和配置治理
- `src/features/task-traces`
  - 任务链路与可观测轨迹
- `src/features/evals-center`
  - Prompt / 质量评估中心
- `src/features/rules-browser`
  - 规则浏览与治理
- `src/features/archive-center`、`src/features/company-agents`
  - 归档与组织化运营视图
- `src/components`、`src/hooks`、`src/store`
  - 复用 UI、hooks、状态管理
- `src/pages`
  - 页面路由；当前含 `dashboard`、`approvals`、`tasks`、`skills`、`rules`
- `src/styles`、`src/assets`、`src/types`、`src/lib`
  - 样式、资源、类型和轻量工具

## 启动

```bash
pnpm --dir apps/frontend/agent-admin dev
```

## 最低验证

```bash
pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit
```

补充约束：

- `agent-admin` 的前端类型检查不能依赖本地已存在的 `packages/*/build` 产物兜底
- `tsconfig.app.json` 必须保持对 `@agent/*` workspace 源码入口的路径映射，这样 GitHub Actions 的干净环境也能直接完成 typecheck
