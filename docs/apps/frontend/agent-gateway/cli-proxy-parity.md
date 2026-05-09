# Agent Gateway CLI Proxy Parity

状态：current
文档类型：reference
适用范围：`apps/frontend/agent-gateway`、`apps/backend/agent-server/src/domains/agent-gateway`、`packages/core/src/contracts/agent-gateway`
最后核对：2026-05-09

本文记录 `apps/frontend/agent-gateway` 与 `/Users/dev/Desktop/Cli-Proxy-API-Management-Center` 的管理能力对齐状态。参考项目是 CLI Proxy API Management API 的 Web UI；本仓库当前对齐的是管理面，不是生产 LLM 流量转发。

## 已落地

- Remote management connection：`GatewaySaveConnectionProfileRequestSchema`、`GatewayConnectionProfileSchema`、`GatewayConnectionStatusResponseSchema`，后端默认由 `MemoryAgentGatewayManagementClient` 提供 deterministic projection，前端由 `ConnectionPage` 展示。
- Raw config：`GatewayRawConfigResponseSchema`、`GatewaySaveRawConfigRequestSchema`、`GatewayConfigDiffResponseSchema`、`GatewayReloadConfigResponseSchema`，前端由 `ConfigEditorPage` 展示 raw YAML editor、diff、save、reload 入口。
- Proxy API keys：`GatewayApiKeyListResponseSchema`、`GatewayReplaceApiKeysRequestSchema`、`GatewayUpdateApiKeyRequestSchema`、`GatewayDeleteApiKeyRequestSchema`，查询 projection 只返回 masked prefix、状态和 usage，不返回明文 key。
- Request logs：`GatewayLogSearchRequestSchema`、`GatewayRequestLogListResponseSchema`、`GatewayLogFileListResponseSchema`、`GatewayClearLogsResponseSchema`，前端由 `LogsManagerPage` 展示 tail/search/hide-management/clear/download 操作入口。
- Quota detail：`GatewayQuotaDetailListResponseSchema` 已作为 provider-specific quota projection 的稳定外壳。
- System：`GatewaySystemVersionResponseSchema`、`GatewaySystemModelsResponseSchema`，前端由 `SystemPage` 展示版本、latest、quick links 和 grouped model discovery。
- Workflow controls：`ConfirmDialog`、`NotificationCenter`、`useUnsavedChangesGuard` 已作为 destructive/mutable flow 的 UI 基础件。
- Provider/Auth/OAuth UI：`ProviderConfigPage`、`AuthFilesManagerPage`、`OAuthPolicyPage` 已接入 `GatewayWorkspace` 导航，覆盖 provider-specific config、Auth Files 批量治理、OAuth excluded models/model aliases/fork alias/callback polling/Vertex import 的页面骨架。
- Dashboard：`DashboardPage` 已接入 workspace，用 `GatewayDashboardSummaryResponseSchema` 展示连接、API Base、版本、API keys、Auth Files、provider keys、模型数量和 routing 摘要。
- Quota Detail：`QuotaDetailPage` 已接入 workspace，用 `GatewayQuotaDetailListResponseSchema` 展示通过 management `api-call` 归一化的 provider-specific quota projection。
- Gap contracts：`agent-gateway-cli-proxy-parity.schemas.ts` 已补 dashboard summary、provider-specific config、OAuth model alias rule、Vertex credential import、management api-call、request-log setting、clear-login-storage、Ampcode upstream/model mapping 的 schema-first contract。
- Real adapter mode：`AgentGatewayModule` 默认仍使用 deterministic memory implementation；显式设置 `AGENT_GATEWAY_MANAGEMENT_MODE=cli-proxy`、`AGENT_GATEWAY_MANAGEMENT_API_BASE`、`AGENT_GATEWAY_MANAGEMENT_KEY` 后会使用 `CliProxyManagementClient`。

## 仍不覆盖

- 生产 OpenAI-compatible relay 流量转发、计费、长期持久化和数据库迁移仍不属于本 parity surface。
- `CliProxyManagementClient` 对真实 vendor payload 采用保守 normalizer；新增 CLI Proxy 字段时必须先扩展 `@agent/core` schema 和 adapter 测试，再暴露给 controller/UI。
- Backend `clearLoginStorage` 只是 command projection；真实清理只允许由前端 auth storage helper 处理，后端不得触碰 Chrome profile、Cookie、Local Storage、Session Storage、IndexedDB 或站点缓存目录。

## 验证入口

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway apps/backend/agent-server/test/agent-gateway apps/frontend/agent-gateway/test
pnpm exec tsc -p packages/core/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/frontend/agent-gateway typecheck
pnpm check:docs
```
