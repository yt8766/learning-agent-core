# Agent Gateway Frontend

状态：current  
文档类型：architecture  
适用范围：`apps/frontend/agent-gateway`  
最后核对：2026-05-13

`apps/frontend/agent-gateway` 现在直接采用 `/Users/dev/Desktop/Cli-Proxy-API-Management-Center/src` 的页面、路由、store、服务层、i18n、样式和图标资产。旧的本仓库自研 `src/app/*` 工作区、`src/api/*` schema client、`src/auth/*` Identity 登录壳和旧 motion shims 已删除，不再作为前端入口。

## 当前入口

- Vite app：`apps/frontend/agent-gateway`
- 主入口：`src/main.tsx`
- 应用入口：`src/App.tsx`
- 路由入口：`src/router/MainRoutes.tsx`
- API client：`src/services/api/client.ts`
- 登录态：`src/stores/useAuthStore.ts`
- 样式入口：`src/styles/global.scss`
- 页面目录：`src/pages/*`

前端使用 `createHashRouter`，对齐 CPAMC 的 `management.html#/...` 形态。默认管理 API 基础地址由浏览器地址推断，也可在登录页填写自定义地址；请求最终归一化到 CLIProxyAPI Management API：

```text
<apiBase>/v0/management
```

登录页保留 Agent Gateway 旧版的账号 / 密码表单、Agent Gateway 图标和 `Agent Gateway Management Center` 名称，不再展示 CPAMC 的语言选择、当前地址、自定义连接地址或“管理密钥”字段。实现上仍兼容 CLIProxyAPI Management API：密码会作为 management key，经 `Authorization: Bearer <key>` 发送；API base 默认由当前浏览器地址推断，历史保存的 base 仍可复用。这套前端不再调用 `/api/identity/*`，也不再依赖 `AgentGatewayApiClient`、`@agent/core` 前端 projection 或 TanStack Query。后端内建 Agent Gateway 与 `@agent/core` contract 仍保留在 `agent-server`，但当前前端页面目标是直接复用 CLIProxyAPI 官方管理中心体验。

## 页面与能力

当前页面来自 CPAMC：

- `/dashboard`
- `/config`
- `/ai-providers`
- `/ai-providers/gemini/:index`
- `/ai-providers/codex/:index`
- `/ai-providers/claude/:index`
- `/ai-providers/openai/:index`
- `/ai-providers/vertex/:index`
- `/ai-providers/ampcode`
- `/auth-files`
- `/auth-files/oauth-excluded`
- `/auth-files/oauth-model-alias`
- `/oauth`
- `/quota`
- `/logs`
- `/system`

服务层按 CLIProxyAPI Management API 使用 `/config`、`/api-keys`、provider、auth-files、OAuth、quota、logs、system 等原生管理端点。CLIProxyAPI README 指向的 Management API 当前基础路径是 `http://localhost:8317/v0/management`，并且新版 usage 聚合不再由 CPAMC 内置；需要用量统计时应接入 CLIProxyAPI 官方文档推荐的外部 usage 服务。

## 构建配置

`agent-gateway` manifest 已补齐 CPAMC 所需依赖：CodeMirror、i18next、react-i18next、motion、motion-dom、yaml、vite-plugin-singlefile 等。`vite.config.ts` 保留本仓库开发端口 `5176`，并启用：

- `@` -> `src` alias
- SCSS modules camelCase
- `@use "@/styles/variables.scss" as *;`
- `__APP_VERSION__`
- single-file production bundle

## 遗留与清理

旧 `apps/frontend/agent-gateway/test` 测试仍留在工作区中，但它们引用已删除的 `src/app/*`、`src/api/*`、`src/auth/*` 入口，已经不再代表当前前端。整目录删除测试曾被安全审查拦截；后续清理需要明确授权后重写为 CPAMC 页面测试，或删除旧测试并新增针对 `src/services/api/*`、`src/router/MainRoutes.tsx` 和关键页面的 smoke。

## 验证入口

当前已验证的前端闭环：

```bash
pnpm --dir apps/frontend/agent-gateway typecheck
pnpm --dir apps/frontend/agent-gateway build
```

旧命令 `pnpm exec vitest run --config vitest.config.js apps/frontend/agent-gateway/test` 暂不可作为当前前端证明入口，因为测试仍指向旧页面架构。
