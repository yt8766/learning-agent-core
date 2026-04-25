# agent-admin 概览

状态：current
文档类型：reference
适用范围：`apps/frontend/agent-admin`
最后核对：2026-04-25

`agent-admin` 是后台指挥面，负责治理与运营，不和 `agent-chat` 做重复聊天产品。

当前主要承载：

- 运行中枢
- 审批中枢
- 学习中枢
- 技能工坊
- 证据中心
- 连接器与策略
- 规则、任务轨迹、评测与归档等治理视图

## 导航约定

- 左侧主导航默认使用中文治理语义，不再直接复用英文产品导航文案。
- 侧栏主分组标题使用“治理中心与专项入口”，避免真实入口数超过六个后继续误导用户或后续代码代理。
- 主治理面仍以六大治理语义为主轴，对应：
  - 运行中枢
  - 审批中枢
  - 学习中枢
  - 记忆中枢
  - 画像中枢
- 与主治理面并列的次级入口固定收敛到：
  - 评测基线
  - 归档中心
  - 技能工坊
  - 证据与来源
  - 连接器设置
- “评测基线 / 归档中心 / 技能工坊” 当前作为侧栏内的折叠子分组呈现，默认在进入这些页面时自动展开，并支持点击父级右侧箭头展开或收起。
- “技能来源治理”“公司专员编排”作为专项编排入口保留在独立分组，避免和六大中心混成重复产品导航。
- 侧栏视觉应强调“治理控制台”而不是通用 SaaS 列表：允许使用分层卡片、状态徽标和摘要信息，但不要退回纯英文、纯列表式菜单。

## 当前目录职责

- `src/app`
  - 应用入口、路由、全局 provider
- `src/api`
  - 面向 `agent-server` 的后台治理接口封装
- `src/features/runtime-overview`
  - Runtime 总览与运行态聚合
  - 当前采用“摘要区 + 工作区切换”布局：摘要区固定展示治理概况，`运行队列 / 运行分析 / 架构视图` 在下方按需切换，避免运行页一次性平铺全部内容
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
