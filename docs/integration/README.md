# integration 文档目录

状态：current
文档类型：index
适用范围：`docs/integration/`
最后核对：2026-04-25

本目录用于沉淀跨模块链路、运行时协同与联调说明。API 契约统一放在 [docs/contracts/api](/docs/contracts/api/README.md)。

首次接手建议按这个顺序阅读：

1. [API 文档目录](/docs/contracts/api/README.md)
2. [frontend-backend-integration.md](/docs/integration/frontend-backend-integration.md)

改前后端协议、SSE、审批恢复前，优先阅读：

- [API 文档目录](/docs/contracts/api/README.md)
- 接口风格选择以 [docs/contracts/api/interface-style-guidelines.md](/docs/contracts/api/interface-style-guidelines.md) 为准；integration 文档只补充调用顺序、联调和排障背景。
- [前后端集成链路](/docs/integration/frontend-backend-integration.md)

本目录主文档：

- 前后端集成链路：[frontend-backend-integration.md](/docs/integration/frontend-backend-integration.md)
- 系统运行闭环：[system-flow-current-state.md](/docs/maps/system-flow-current-state.md)
- Agent Workspace Vault + Skill Flywheel MVP：[agent-workspace-vault-and-skill-flywheel-design.md](/docs/integration/agent-workspace-vault-and-skill-flywheel-design.md)
- Knowledge SDK RAG Rollout：[knowledge-sdk-rag-rollout.md](/docs/integration/knowledge-sdk-rag-rollout.md)
- 上下文组装与生成链路：[context-assembly-and-generation.md](/docs/integration/context-assembly-and-generation.md)
- RAG 可观测前端接线：[rag-observability-frontend-integration.md](/docs/integration/rag-observability-frontend-integration.md)

约定：

- 涉及多个模块共同参与的链路说明，优先放在 `docs/integration/`
- API 路径、参数、响应、SSE 事件和兼容规则统一放在 `docs/contracts/api/`
- 当主题无法明确归属单一 package 或单一 app 时，使用本目录
- 当前 runtime invocation integration 额外约束：
  - `direct-reply` 模式下 capability hint 即使显式请求 MCP，也不会静默注入；runtime 会把拒绝结果写回 invocation trace
  - preprocess 阶段若命中 invocation cache，可直接以缓存文本结束本轮调用；这是一层 pipeline 级短路，不要求调用方感知额外 provider 往返
  - chat SSE 直连模型输出时也走 `modelInvocationFacade.invoke(...)`；`direct-reply` 会带上 profile system message、budget fallback 与重试上下文，而不是绕开 invocation pipeline
  - invocation pipeline 产出的 usage/billing 结果会通过主链 usage bridge 回写 task `llmUsage / budgetState`；调用方消费统一聚合结果，不直接依赖 provider 原始 usage 结构

当前优先阅读：

- [API 文档目录](/docs/contracts/api/README.md)
- [前后端集成链路](/docs/integration/frontend-backend-integration.md)
- [Current System Flow](/docs/maps/system-flow-current-state.md)
- [Daily Tech Intelligence Briefing Design](/docs/integration/daily-tech-intelligence-briefing-design.md)
- [Knowledge SDK RAG Rollout](/docs/integration/knowledge-sdk-rag-rollout.md)
- [上下文组装与生成链路](/docs/integration/context-assembly-and-generation.md)
- [RAG 可观测前端接线](/docs/integration/rag-observability-frontend-integration.md)

说明：

- 旧的 API 专题文档已从 `docs/integration/` 迁到 `docs/contracts/api/`
