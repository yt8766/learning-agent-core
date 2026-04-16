# integration 文档目录

状态：current
文档类型：index
适用范围：`docs/integration/`
最后核对：2026-04-15

本目录用于沉淀跨模块链路、前后端对接、运行时协同与协议集成类文档。

首次接手建议按这个顺序阅读：

1. [frontend-backend-integration.md](/Users/dev/Desktop/learning-agent-core/docs/integration/frontend-backend-integration.md)
2. [system-flow-current-state.md](/Users/dev/Desktop/learning-agent-core/docs/integration/system-flow-current-state.md)
3. 按专题继续看 `chat-session-sse`、`approval-recovery`、`runtime-centers-api`

改前后端协议、SSE、审批恢复前，优先阅读：

- [frontend-backend-integration.md](/Users/dev/Desktop/learning-agent-core/docs/integration/frontend-backend-integration.md)
- [chat-session-sse.md](/Users/dev/Desktop/learning-agent-core/docs/integration/chat-session-sse.md)
- [approval-recovery.md](/Users/dev/Desktop/learning-agent-core/docs/integration/approval-recovery.md)

本目录主文档：

- 总对接主文档：[frontend-backend-integration.md](/Users/dev/Desktop/learning-agent-core/docs/integration/frontend-backend-integration.md)
- 系统运行闭环：[system-flow-current-state.md](/Users/dev/Desktop/learning-agent-core/docs/integration/system-flow-current-state.md)

约定：

- 涉及多个模块共同参与的链路说明，优先放在 `docs/integration/`
- 当主题无法明确归属单一 package 或单一 app 时，使用本目录

当前优先阅读：

- [前后端对接文档](/Users/dev/Desktop/learning-agent-core/docs/integration/frontend-backend-integration.md)
- [Current System Flow](/Users/dev/Desktop/learning-agent-core/docs/integration/system-flow-current-state.md)
- [Chat Session And SSE](/Users/dev/Desktop/learning-agent-core/docs/integration/chat-session-sse.md)
- [Runtime Centers API](/Users/dev/Desktop/learning-agent-core/docs/integration/runtime-centers-api.md)
- [Approval Recovery](/Users/dev/Desktop/learning-agent-core/docs/integration/approval-recovery.md)

说明：

- 旧的 `docs/chat-stream-protocol.md` 已删除，相关 SSE / chat stream 内容统一并入主文档 `docs/integration/frontend-backend-integration.md`
