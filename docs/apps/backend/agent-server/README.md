# agent-server 文档目录

状态：current
文档类型：index
适用范围：`docs/apps/backend/agent-server/`
最后核对：2026-05-07

本目录用于沉淀 `apps/backend/agent-server` 的 HTTP/SSE、运行时装配、平台中心与后台服务说明。

当前文档：

- [agent-server-overview.md](/docs/apps/backend/agent-server/agent-server-overview.md)
- [chat-api.md](/docs/apps/backend/agent-server/chat-api.md) ⬅️ **Chat API 完整文档（新增）**
- [identity.md](/docs/apps/backend/agent-server/identity.md)
- [knowledge.md](/docs/apps/backend/agent-server/knowledge.md)
- [knowledge-auth.md](/docs/apps/backend/agent-server/knowledge-auth.md)
- [knowledge-api-stubs.md](/docs/apps/backend/agent-server/knowledge-api-stubs.md)
- [runtime-module-notes.md](/docs/apps/backend/agent-server/runtime-module-notes.md)
- [run-observatory.md](/docs/apps/backend/agent-server/run-observatory.md)
- [agent-workspace-center.md](/docs/apps/backend/agent-server/agent-workspace-center.md)
- [frontend-ai-intel-system-design.md](/docs/apps/backend/agent-server/frontend-ai-intel-system-design.md)
- [platform-console-performance-baseline.md](/docs/apps/backend/agent-server/platform-console-performance-baseline.md)
- [platform-console-staging-acceptance-template.md](/docs/apps/backend/agent-server/platform-console-staging-acceptance-template.md)

当前优先阅读：

1. [agent-server-overview.md](/docs/apps/backend/agent-server/agent-server-overview.md)
2. [identity.md](/docs/apps/backend/agent-server/identity.md)
3. [knowledge.md](/docs/apps/backend/agent-server/knowledge.md)
4. [knowledge-auth.md](/docs/apps/backend/agent-server/knowledge-auth.md)
5. [knowledge-api-stubs.md](/docs/apps/backend/agent-server/knowledge-api-stubs.md)
6. [runtime-module-notes.md](/docs/apps/backend/agent-server/runtime-module-notes.md)
7. [contracts/api/README.md](/docs/contracts/api/README.md)
8. [agent-workspace-center.md](/docs/apps/backend/agent-server/agent-workspace-center.md)

Chat Runtime v2 相关实现入口：

- `src/chat/runs/*`：`ChatRunRecord` 的内存 repository/service 与 run cancel 查询入口
- `src/chat/auto-review/*`：工具执行自动审查策略，低风险自动允许，高风险返回自然语言确认语，破坏性动作阻断
- `src/chat/interactions/*`：pending interaction 与自然语言审批回复解析
- `src/chat/view-stream/*`：`/api/chat/view-stream` 的显式 `event:` SSE 投影
- `src/agent-tools/*`：真实工具执行审批队列；chat v2 只做自然语言 bridge，不绕过 `AgentToolsService.resumeApproval()` 的审批 ID 校验和 sandbox/auto-review 恢复逻辑

涉及这些入口时，先更新 [agent-chat-runtime-v2.md](/docs/contracts/api/agent-chat-runtime-v2.md)，再改 controller/service/frontend。
