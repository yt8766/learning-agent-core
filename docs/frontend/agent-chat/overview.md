# agent-chat 概览

状态：current
文档类型：reference
适用范围：`apps/frontend/agent-chat`
最后核对：2026-04-16

`agent-chat` 是前线作战面，不是普通聊天壳子。

当前主要承载：

- Chat thread 与多轮会话切换
- Approval cards、Cancel、Recover 等消息流内操作
- Think / ThoughtChain / Event Timeline 运行态可视化
- Evidence / Sources / Learning suggestions 展示
- Runtime panel、session list、report schema 等执行辅助视图

## 当前目录职责

- `src/app`
  - 应用入口、路由装配、全局 provider
- `src/api`
  - 面向 `agent-server` 的接口封装与 SSE/HTTP 调用
- `src/features/chat`、`src/features/chat-thread`
  - 聊天发送、消息流、会话主链路
- `src/features/approvals`
  - 审批卡片、审批动作与恢复入口
- `src/features/event-timeline`
  - ThoughtChain / 事件时间线展示
- `src/features/runtime-panel`
  - 运行态侧栏与任务执行信息
- `src/features/learning`
  - 学习建议、复用提示等学习闭环 UI
- `src/features/session-list`
  - 会话列表与切换
- `src/features/report-schema`
  - 报表 schema / 结构化产物相关展示
  - `report-schema-workbench.tsx`
    - 只保留 workbench 容器、state 与 orchestration
  - `report-schema-workbench-editor.tsx`
    - 承载 goal / structured input / current schema / single-report form 编辑区
  - `report-schema-workbench-preview.tsx`
    - 承载 runtime、真实预览、meta、filters、data source、metrics、table 与 raw json 展示区
  - `report-schema-workbench-runtime.ts`
    - 承载流式 stage/schema/done/error 事件归并
  - `report-schema-workbench-support.ts`
    - 只保留 facade 导出
  - `report-schema-workbench-parser.ts`
    - 承载 JSON draft parse 与 schema normalize
  - `report-schema-workbench-formatter.ts`
    - 承载 schema section / filter / mapping / runtime summary / warning 的只读格式化与提取
  - `report-schema-workbench-patch-planner.ts`
    - 承载 structured input starter、single-report form values 推导与 patch 回写
  - `report-schema-workbench-preview-mapper.ts`
    - 承载 single-report mock preview model 映射
- `src/components`
  - 跨 feature 复用组件
- `src/hooks`
  - 视图层 hooks；`src/hooks/chat-session` 聚焦会话驱动
- `src/store`
  - 前端状态管理
- `src/pages`
  - 页面级路由；当前以 `chat-home`、`session-detail` 为主
  - `pages/chat-home/chat-home-workbench-sections.tsx`
    - 只保留 workbench section state 装配与导出 helper
  - `pages/chat-home/chat-home-workbench-section-renders.tsx`
    - 承载 approval / current progress / evidence / learning / reuse / event stream 等 section 渲染
- `src/styles`、`src/assets`、`src/types`、`src/lib`
  - 样式、静态资源、类型和轻量工具

## 启动

```bash
pnpm --dir apps/frontend/agent-chat dev
```

## 最低验证

```bash
pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit
```
