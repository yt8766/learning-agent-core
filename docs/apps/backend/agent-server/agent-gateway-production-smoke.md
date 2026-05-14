# Agent Gateway Production Smoke

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server/test/agent-gateway/agent-gateway-production-smoke.spec.ts`
最后核对：2026-05-13

`agent-gateway-production-smoke.spec.ts` 是 Agent Gateway 迁移可用性的最小闭环证明。它不连接公网 provider，不读取用户本机真实 OAuth token；CI 使用 deterministic local runtime harness，但覆盖生产链路必须保持的 contract 边界。

该 smoke 证明：

- 从既有 CLIProxyAPI source 读取 provider config、Auth File、quota snapshot 和 request log metadata；
- `CliProxyImportService.preview()` 先给出 safe/conflict 资源计划，`apply()` 再写入本地 repository；
- 本地创建 runtime client 和一次性显示的 client API key；
- `/v1/models` 通过 client API key 和 `RuntimeEngineFacade` 返回模型列表；
- `/v1/chat/completions` 通过 OpenAI-compatible controller 调用 runtime executor 并写 usage/request log；
- runtime health 暴露 active requests、active streams、usage audit queue 和 cooldown projection；
- client usage、client quota、request logs 和 provider quota projection 都可查询；
- provider quota 来自 Auth File projection，不暴露 raw OAuth token、raw upstream response 或 headers。

运行入口：

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-production-smoke.spec.ts
```

完整 Agent Gateway 回归入口：

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway apps/backend/agent-server/test/agent-gateway
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/frontend/agent-gateway typecheck
pnpm check:docs
```

2026-05-13 起，`apps/frontend/agent-gateway` 已直接替换为 CPAMC 页面与 `/v0/management` client。旧 `apps/frontend/agent-gateway/test` 仍引用已删除的 `src/app/*` 架构，暂不纳入 production smoke；前端证明入口改为 `typecheck` 与 `build`，后续需在明确清理旧测试后补 CPAMC 页面 smoke。

边界说明：

- smoke 中的 executor 是 deterministic local harness，不能被解读为真实 vendor SDK 已完成。
- smoke 中的 CLIProxyAPI source 是测试 fixture，真实迁移由 `CliProxyManagementClient` 按 `/v0/management` adapter 读取上游。
- OAuth credential 的查询投影只能返回 `secretRef`、账号、项目、scope、状态和过期时间；真实 token 只允许在 backend secret vault / Auth File 存储边界内解析。
