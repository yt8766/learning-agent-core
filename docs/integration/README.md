# integration 文档目录

状态：current
文档类型：index
适用范围：`docs/integration/`
最后核对：2026-04-24

本目录用于沉淀跨模块链路、前后端对接、运行时协同与协议集成类文档。

首次接手建议按这个顺序阅读：

1. [frontend-backend-integration.md](/docs/integration/frontend-backend-integration.md)
2. [system-flow-current-state.md](/docs/integration/system-flow-current-state.md)
3. 按专题继续看 `chat-session-sse`、`approval-recovery`、`runtime-centers-api`

改前后端协议、SSE、审批恢复前，优先阅读：

- [frontend-backend-integration.md](/docs/integration/frontend-backend-integration.md)
- [chat-session-sse.md](/docs/integration/chat-session-sse.md)
- [approval-recovery.md](/docs/integration/approval-recovery.md)

本目录主文档：

- 总对接主文档：[frontend-backend-integration.md](/docs/integration/frontend-backend-integration.md)
- 系统运行闭环：[system-flow-current-state.md](/docs/integration/system-flow-current-state.md)

约定：

- 涉及多个模块共同参与的链路说明，优先放在 `docs/integration/`
- 当主题无法明确归属单一 package 或单一 app 时，使用本目录
- 当前 runtime invocation integration 额外约束：
  - `direct-reply` 模式下 capability hint 即使显式请求 MCP，也不会静默注入；runtime 会把拒绝结果写回 invocation trace
  - preprocess 阶段若命中 invocation cache，可直接以缓存文本结束本轮调用；这是一层 pipeline 级短路，不要求调用方感知额外 provider 往返
  - chat SSE 直连模型输出时也走 `modelInvocationFacade.invoke(...)`；`direct-reply` 会带上 profile system message、budget fallback 与重试上下文，而不是绕开 invocation pipeline
  - invocation pipeline 产出的 usage/billing 结果会通过主链 usage bridge 回写 task `llmUsage / budgetState`；调用方消费统一聚合结果，不直接依赖 provider 原始 usage 结构

当前优先阅读：

- [前后端对接文档](/docs/integration/frontend-backend-integration.md)
- [Current System Flow](/docs/integration/system-flow-current-state.md)
- [Chat Session And SSE](/docs/integration/chat-session-sse.md)
- [Runtime Centers API](/docs/integration/runtime-centers-api.md)
- [Approval Recovery](/docs/integration/approval-recovery.md)
- [Daily Tech Intelligence Briefing Design](/docs/integration/daily-tech-intelligence-briefing-design.md)

说明：

- 旧的 `docs/chat-stream-protocol.md` 已删除，相关 SSE / chat stream 内容统一并入主文档 `docs/integration/frontend-backend-integration.md`
