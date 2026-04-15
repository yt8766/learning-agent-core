# agent-admin 概览

状态：current
适用范围：`apps/frontend/agent-admin`
最后核对：2026-04-14

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
- `src/features/approvals-center`
  - 审批中心
- `src/features/learning-center`
  - 学习治理与学习记录视图
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
