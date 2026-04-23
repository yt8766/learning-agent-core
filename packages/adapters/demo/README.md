# adapters demo

本目录用于放置 `@agent/adapters` 的最小验证案例。

可用脚本：

- `pnpm --filter @agent/adapters demo`
- `pnpm --filter @agent/adapters demo:custom-provider-factory`
- `pnpm --filter @agent/adapters demo:routing-capabilities`
- `pnpm --filter @agent/adapters demo:retry-structured-output`

约束：

- demo 文件只能放在 `demo/`，不要放进 `src/`。
- demo 直接通过 `tsx` 加载 `src/index.ts`，用于验证 adapters 根入口的最小闭环。
- demo 的目标是验证最小可用路径，不替代单元测试。
- demo 文件统一使用 `.ts`，并只从 `src/index.ts` 进入，不在 `demo/` 里引入更深层内部路径。
- demo 统一使用 `node --import tsx demo/*.ts` 运行。

当前示例围绕本包真实职责组织：

- `custom-provider-factory.ts`
  - 验证 `createLlmProviderFactory(...)` 与 `createDefaultRuntimeLlmProvider(...)` 的最小 SDK 扩展路径。
- `routing-capabilities.ts`
  - 验证模型能力声明、能力约束选模与 routed provider 的最小闭环。
- `retry-structured-output.ts`
  - 验证 `generateObjectWithRetry(...)`、JSON 安全补强与结构化输出重试策略。
- `smoke.ts`
  - 验证 provider registry、capability routing 与 routed provider 的最小运行闭环。
