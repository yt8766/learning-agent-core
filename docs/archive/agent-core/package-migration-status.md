# Agent-Core Package Migration Status

状态：completed  
文档类型：history
适用范围：`packages/runtime`、`packages/adapters`、`agents/supervisor`、`agents/data-report`、`agents/coder`、`agents/reviewer`、`docs/archive/agent-core/*`  
最后核对：2026-04-15

## 1. 结论

`packages/agent-core` 已完成删壳并从工作区删除。

原先承载在 `agent-core` 的能力，现已分别收敛到：

- `packages/runtime`
  - `runtime / session / governance`
  - `graphs/main / chat / recovery / learning`
  - `flows/approval / learning / 主链 stage orchestration`
  - `capability-pool`、context compression、runtime prompt / event / retry utilities
- `packages/adapters`
  - `adapters/llm`
  - prompt template、LLM retry、safe structured object、model fallback、reactive context retry、JSON safety prompt
- `agents/supervisor`
  - `bootstrap`、`main-route`、`subgraph-registry`、`workflows`
  - `flows/supervisor/*`
  - `LibuRouterMinistry`、`HubuSearchMinistry`、`LibuDocsMinistry`
- `agents/data-report`
  - `data-report.graph`
  - `data-report-json.graph`
  - `flows/data-report/*`
  - `flows/data-report-json/*`
- `agents/coder`
  - `ExecutorAgent`
  - `GongbuCodeMinistry`
  - `BingbuOpsMinistry`
- `agents/reviewer`
  - `ReviewerAgent`
  - `XingbuReviewMinistry`

## 2. 删除前提已满足

- `agents/* -> packages/agent-core/src/*` 已清零
- `agents/* -> packages/runtime/src/*` 已清零
- `packages/runtime/src/* -> packages/agent-core/src/*` 已清零
- `apps/backend/agent-server` 不再依赖 `@agent/agent-core`
- 根部 `tsconfig.json`、`tsconfig.node.json`、`vitest.config.js` 中的 `@agent/agent-core` alias 已移除
- `packages/adapters` 也已摆脱对 `agent-core` 的反向依赖

## 3. 当前代码层剩余提及

删包完成后，仓库代码层不再消费 `@agent/agent-core`。

当前允许保留的剩余提及主要属于：

- `docs/archive/agent-core/*`
  - 迁移历史与专题说明
- `pnpm-lock.yaml`
  - 如后续重新生成 lockfile，可一并消除历史工作区痕迹
- 个别测试标题或文案里的历史命名
  - 不再代表真实包边界

## 4. 后续约束

- 不允许重新创建 `packages/agent-core`
- 不允许在 app、packages、agents 中新增 `@agent/agent-core` 或 `packages/agent-core/src/*` 引用
- 主链 graph / flow / session / governance 改动优先进入 `packages/runtime`
- prompt / retry / schema-safe generation / provider fallback 改动优先进入 `packages/adapters`
- supervisor / data-report / coder / reviewer 的专项实现优先进入各自 `agents/*`

## 5. 本轮验证

- `pnpm exec tsc -p packages/adapters/tsconfig.json --noEmit`
- `pnpm exec tsc -p packages/runtime/tsconfig.json --noEmit`
- `pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit`
- `pnpm exec vitest run packages/runtime/test/agent-core-removal.test.ts`
- `pnpm exec vitest run packages/runtime/test/main-graph.test.ts packages/runtime/test/index.test.ts packages/runtime/test/utils.test.ts`
- `pnpm exec vitest run apps/backend/agent-server/test/runtime/architecture/runtime-architecture.service.spec.ts apps/backend/agent-server/test/chat/chat.service.spec.ts`

## 6. 后续 AI 应优先阅读

1. [packages-overview.md](/docs/packages-overview.md)
2. [README](/README.md)
3. [AGENTS.md](/AGENTS.md)
4. [项目规范总览](/docs/project-conventions.md)
