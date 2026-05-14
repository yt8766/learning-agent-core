# Agent Gateway CLI Proxy Parity

状态：current  
文档类型：reference  
适用范围：`apps/frontend/agent-gateway`、`apps/backend/agent-server/src/domains/agent-gateway`、`packages/core/src/contracts/agent-gateway`  
最后核对：2026-05-13

本文记录 `apps/frontend/agent-gateway` 与 `/Users/dev/Desktop/Cli-Proxy-API-Management-Center` 的对齐状态。2026-05-13 起，前端已从“本仓库自研 Agent Gateway Console + 部分 CPAMC 组件”切换为“直接采用 CPAMC 页面与样式”的实现。

## 前端现状

已删除的旧前端入口：

- `apps/frontend/agent-gateway/src/app/*`
- `apps/frontend/agent-gateway/src/api/*`
- `apps/frontend/agent-gateway/src/auth/*`
- `apps/frontend/agent-gateway/src/shims/*`

已迁入的 CPAMC 入口：

- `src/App.tsx`
- `src/router/*`
- `src/pages/*`
- `src/components/*`
- `src/features/*`
- `src/services/api/*`
- `src/stores/*`
- `src/i18n/*`
- `src/styles/*`
- `src/assets/*`
- `src/types/*`
- `src/utils/*`

前端现在通过 `src/services/api/client.ts` 直接请求 CLIProxyAPI Management API，基础路径按 `src/utils/connection.ts` 归一化为：

```text
<apiBase>/v0/management
```

登录页只展示账号和密码。账号用于保留旧 Agent Gateway 登录体验；密码按 CLIProxyAPI management key 处理，请求头包含 `Authorization: Bearer <managementKey>`。这与 CLIProxyAPI 官方 Management API 文档一致。当前前端不再消费 `@agent/core` 的 Agent Gateway projection，也不再经由 `AgentGatewayApiClient` 调用本仓库 `/api/agent-gateway/*` 管理接口。

## 与后端的关系

`agent-server` 中的内建 Agent Gateway、schema-first contract、runtime engine、迁移 adapter 和 `/api/agent-gateway/*` 仍然存在。2026-05-13 起，后端新增 `CliProxyManagementCompatController`，直接暴露 CLIProxyAPI-compatible `/v0/management/*` surface，供当前 CPAMC 页面原样调用。

当前前端不需要改回 `/api/agent-gateway/*`。兼容层会把本仓库 `AgentGatewayManagementClient` 的 TypeScript 领域投影转换为 CPAMC 需要的 hyphen-case/raw shape，覆盖 config、API keys、provider keys、OpenAI compatibility、Auth Files、logs、OAuth、model definitions、latest-version、`api-call` 与 Ampcode 基础配置入口。`agent-server` 的全局 `/api` prefix 已排除 `/v0/management`，因此前端默认同源访问 `<origin>/v0/management/*`。

不要再次恢复旧 `src/app/GatewayWorkspace*` 混合架构，也不要把前端服务层改成同时请求 `/api/agent-gateway/*` 与 `/v0/management/*` 两套入口；这会让页面、接口和测试重新分叉。

后端兼容层的真实实现与验证入口见 [Agent Gateway Backend](/docs/apps/backend/agent-server/agent-gateway.md)。

## 验证入口

当前前端替换后的可证明入口：

```bash
pnpm --dir apps/frontend/agent-gateway typecheck
pnpm --dir apps/frontend/agent-gateway build
```

旧 `apps/frontend/agent-gateway/test` 仍引用已删除的旧入口，暂不能作为 parity 证明。安全审查已拦截整目录删除；需要后续明确授权后清理并重写为 CPAMC 页面/服务 smoke。
