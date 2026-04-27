# agent-chat 文档目录

状态：current
文档类型：index
适用范围：`docs/apps/frontend/agent-chat/`
最后核对：2026-04-15

本目录用于沉淀 `apps/frontend/agent-chat` 相关文档。

当前对应实现目录：

- `src/app`
  - 应用入口与路由装配
- `src/api`
  - 聊天、会话、SSE 与后台接口封装
- `src/features/chat`、`src/features/chat-thread`
  - 消息流与会话主界面
- `src/features/approvals`
  - 审批卡与审批动作
- `src/features/event-timeline`
  - ThoughtChain / timeline 展示
- `src/lib/agent-tool-execution-api.ts`、`src/lib/agent-tool-event-projections.ts`
  - Agent Tool Execution REST helper 与 SSE/tool event 投影 helper
- `src/pages/chat-home/*`
  - 轻量聊天壳、多会话侧栏、快速/专家入口、当前会话锚点浮条与高级 workbench 承载区
  - 消费 `tool_*`、`execution_step_*`、`tool_execution` interrupt 与 workspace projection 摘要；Workspace Vault 作为高级摘要，不作为默认主聊天视图
- `src/features/runtime-panel`
  - 运行态面板
- `src/features/learning`
  - 学习建议与复用提示
- `src/features/session-list`
  - 会话列表
- `src/components`、`src/hooks`、`src/store`
  - 通用组件、hooks、状态管理

约定：

- `agent-chat` 的专项文档统一放在 `docs/apps/frontend/agent-chat/`
- 聊天壳、侧栏、锚点浮条、审批卡、ThoughtChain、运行态消费或交互协议变化后，需同步更新本目录文档
- 工具执行展示只消费项目稳定事件投影，不直接渲染第三方 executor、MCP、终端或浏览器原始 payload

当前文档：

- [overview.md](/docs/apps/frontend/agent-chat/overview.md)
