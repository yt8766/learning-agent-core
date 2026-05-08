# Agent Gateway Frontend

状态：current
文档类型：architecture
适用范围：`apps/frontend/agent-gateway`
最后核对：2026-05-08

`apps/frontend/agent-gateway` 是独立的中转控制台前端，不属于 `agent-chat` 前线执行面，也不属于 `agent-admin` 六大治理中心。它只负责 Agent Gateway 的上游方、认证文件、配额、调用管线、日志、探测与 token 处理链路展示。

当前入口：

- Vite app：`apps/frontend/agent-gateway`
- 页面标题：`Agent Gateway Console`
- 登录态：`src/auth/auth-session.tsx`
- refresh token storage：`localStorage`，键为 `agent-gateway.refresh-token`
- API client：`src/api/agent-gateway-api.ts`
- API contract：`docs/contracts/api/agent-gateway.md`

当前前端按短 access token + 长 refresh token 工作：

- access token 只保存在 React session state 中。
- refresh token 通过 `auth-storage.ts` 写入 `localStorage`。
- API client 遇到 `401` 且错误码为 `ACCESS_TOKEN_EXPIRED` 时只刷新一次 access token，并重试原请求。

开发入口：

```bash
pnpm --dir apps/frontend/agent-gateway dev
pnpm --dir apps/frontend/agent-gateway typecheck
pnpm --dir apps/frontend/agent-gateway build
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-gateway/test
```

Vite dev server 默认端口是 `5175`，并把 `/agent-gateway/*` 代理到 `http://localhost:3000`；后端真实入口由 `agent-server` 的全局 `/api` 前缀提供，即 `/api/agent-gateway/*`。
