# integration 文档目录

状态：current
文档类型：index
适用范围：`docs/integration/`
最后核对：2026-04-25

本目录用于沉淀跨模块链路、运行时协同与联调说明。API 契约统一放在 [docs/api](/docs/api/README.md)。

首次接手建议按这个顺序阅读：

1. [API 文档目录](/docs/api/README.md)
2. [frontend-backend-integration.md](/docs/integration/frontend-backend-integration.md)
3. [system-flow-current-state.md](/docs/integration/system-flow-current-state.md)

改前后端协议、SSE、审批恢复前，优先阅读：

- [API 文档目录](/docs/api/README.md)
- 接口风格选择以 [docs/api/interface-style-guidelines.md](/docs/api/interface-style-guidelines.md) 为准；integration 文档只补充调用顺序、联调和排障背景。
- [前后端集成链路](/docs/integration/frontend-backend-integration.md)

本目录主文档：

- 前后端集成链路：[frontend-backend-integration.md](/docs/integration/frontend-backend-integration.md)
- 系统运行闭环：[system-flow-current-state.md](/docs/integration/system-flow-current-state.md)
- LLM Gateway 登录 PostgreSQL 部署：[llm-gateway-postgres-login.md](/docs/integration/llm-gateway-postgres-login.md)
- LLM Gateway Provider Runtime：[llm-gateway-provider-runtime.md](/docs/integration/llm-gateway-provider-runtime.md)
- LLM Gateway UI Hydration Notes：[llm-gateway-ui-hydration.md](/docs/integration/llm-gateway-ui-hydration.md)
- LLM Gateway Vercel Preview 验收：[llm-gateway-vercel-preview.md](/docs/integration/llm-gateway-vercel-preview.md)

约定：

- 涉及多个模块共同参与的链路说明，优先放在 `docs/integration/`
- API 路径、参数、响应、SSE 事件和兼容规则统一放在 `docs/api/`
- 当主题无法明确归属单一 package 或单一 app 时，使用本目录
- 当前 runtime invocation integration 额外约束：
  - `direct-reply` 模式下 capability hint 即使显式请求 MCP，也不会静默注入；runtime 会把拒绝结果写回 invocation trace
  - preprocess 阶段若命中 invocation cache，可直接以缓存文本结束本轮调用；这是一层 pipeline 级短路，不要求调用方感知额外 provider 往返
  - chat SSE 直连模型输出时也走 `modelInvocationFacade.invoke(...)`；`direct-reply` 会带上 profile system message、budget fallback 与重试上下文，而不是绕开 invocation pipeline
  - invocation pipeline 产出的 usage/billing 结果会通过主链 usage bridge 回写 task `llmUsage / budgetState`；调用方消费统一聚合结果，不直接依赖 provider 原始 usage 结构

当前优先阅读：

- [API 文档目录](/docs/api/README.md)
- [前后端集成链路](/docs/integration/frontend-backend-integration.md)
- [Current System Flow](/docs/integration/system-flow-current-state.md)
- [Daily Tech Intelligence Briefing Design](/docs/integration/daily-tech-intelligence-briefing-design.md)
- [LLM Gateway 登录 PostgreSQL 部署](/docs/integration/llm-gateway-postgres-login.md)
- [LLM Gateway Provider Runtime](/docs/integration/llm-gateway-provider-runtime.md)
- [LLM Gateway UI Hydration Notes](/docs/integration/llm-gateway-ui-hydration.md)
- [LLM Gateway Vercel Preview 验收](/docs/integration/llm-gateway-vercel-preview.md)

说明：

- 旧的 API 专题文档已从 `docs/integration/` 迁到 `docs/api/`
