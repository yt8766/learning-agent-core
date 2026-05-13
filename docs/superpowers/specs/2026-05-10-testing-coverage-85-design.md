# Testing Coverage 85 Design

状态：draft
文档类型：spec
适用范围：根级 `test/`、`packages/*/test`、`agents/*/test`、`apps/**/test`、`packages/*/demo`
最后核对：2026-05-10

## Goal

把仓库测试体系收口到 `pnpm test:coverage` 可全绿，并让当前覆盖率门槛达到 `>= 85%`。本轮设计强调可维护的测试覆盖，而不是为了数字堆脆弱用例。

当前基线来自 2026-05-10 在当前 checkout 执行的 `pnpm test:coverage`：

| Scope                              |  Lines | Statements | Functions | Branches |
| ---------------------------------- | -----: | ---------: | --------: | -------: |
| All files                          | 69.83% |     69.32% |    71.34% |   56.54% |
| `packages/runtime/src/**`          | 42.76% |     42.52% |    45.65% |   32.01% |
| `apps/backend/agent-server/src/**` | 82.42% |     81.71% |    81.95% |   67.98% |
| `apps/frontend/agent-chat/src/**`  | 75.83% |     75.13% |    77.16% |   66.09% |
| `apps/frontend/agent-admin/src/**` | 70.84% |     70.57% |    70.43% |   59.39% |
| `apps/frontend/knowledge/src/**`   | 67.03% |     66.42% |    64.14% |   57.58% |

同一次覆盖率运行还暴露 7 个失败测试：

- `packages/adapters/test/minimax-chat-model.factory.test.ts`：本地 HTTP server `listen(0)` 在当前 sandbox 中触发 `EPERM`，测试最终超时。
- `test/smoke/backend/backend-http-app.smoke.ts`：`supertest` 触发 `listen 0.0.0.0`，sandbox 拒绝监听。
- `apps/backend/agent-server/test/platform/knowledge-ingestion.http-smoke.spec.ts`：5 个 HTTP smoke 用例同样被 `listen 0.0.0.0` 阻断。

## Recommended Approach

采用“红灯先清、口径校准、门槛项目优先、全仓收口”的分阶段策略。

1. 先修复当前失败测试，保证 coverage 能稳定跑到阈值判断阶段。
2. 校准 coverage 统计口径，只排除明确不可执行或不应作为覆盖目标的文件，例如纯类型文件、barrel-only 入口、Vite/React 启动入口、模板示例运行入口。业务逻辑、adapter、schema、facade、controller/service、UI 分支不得用 exclude 掩盖。
3. 优先补 `packages/runtime`，因为它是硬门槛中缺口最大且影响主链 graph、session、approval、learning、sandbox 的核心包。
4. 再补 backend 与三个前端硬门槛项目，按高收益文件建立测试批次。
5. 最后处理全仓剩余缺口，包括 `packages/tools`、`packages/skill`、`packages/templates`、`agents/audio`、`agents/video` 等未设置项目级阈值但拖低全局统计的模块。

## Scope

本设计覆盖：

- 根级 workspace smoke / integration 测试。
- 包级 `test/` 下的 unit、spec、integration 用例。
- `packages/*/demo` 的 smoke、contract、flow 分层 demo。
- 必要的 `vitest.config.js` coverage include/exclude 调整。
- 与测试入口、覆盖率门槛、demo 覆盖规则相关的文档更新。

非目标：

- 不降低 `85%` 阈值。
- 不通过大面积 exclude 隐藏业务代码。
- 不测试第三方库内部行为。
- 不为了覆盖率增加仅检查“组件能 render”但不覆盖真实状态、分支或用户流程的空测试。
- 不在本轮引入新的测试框架。

## Test Taxonomy

新增测试按以下层级归位：

- `Spec`：schema parse、DTO、contract、事件 payload、adapter 映射。
- `Unit`：纯函数、策略对象、repository helper、projection builder、normalizer、parser。
- `Demo`：包级最小闭环，默认 `demo/smoke.ts`，复杂包补 `demo/contract.ts` 或 `demo/flow.ts`。
- `Integration`：跨模块协作、graph state、HTTP/SSE 协议、frontend-backend payload 兼容。
- `Smoke`：根级真实入口探活，但必须 sandbox 友好，不依赖任意端口监听。

## Coverage Priority Files

第一批高收益目标来自当前 coverage summary。

### `packages/runtime`

优先补：

- `src/session/*`
- `src/session/coordinator/*`
- `src/flows/approval/*`
- `src/flows/chat/direct-reply/*`
- `src/flows/learning/*`
- `src/sandbox/*`
- `src/capabilities/*`

策略：

- 先测 helper、policy、projection、state transition。
- 对 LangGraph interrupt 相关节点，测试稳定 payload、resume 值、幂等前置条件，不用条件分支改变 interrupt 顺序。
- 对 session coordinator，优先覆盖 cancel/recover/observe、approval、checkpoint、stream sync 的状态机分支。

### Backend

优先补：

- `src/api/knowledge/knowledge-projections.controller.ts`
- `src/api/agent-gateway/*controller.ts`
- `src/workflow-runs/*`
- `src/common/pipes/parse-optional-int.pipe.ts`
- `src/infrastructure/config/backend-config.service.ts`
- `src/infrastructure/external-process/command-runner.ts`

策略：

- Controller 用 Nest testing module + mocked service，避免真实端口。
- Repository 只测项目自定义 contract 与错误语义，不直测数据库实现细节。
- HTTP smoke 改为 sandbox 友好入口，避免 `supertest` 触发 `listen 0.0.0.0`。

### `agent-chat`

优先补：

- `src/api/chat-memory-api.ts`
- `src/hooks/chat-session/*`
- `src/chat-runtime/agent-chat-session-provider.ts`
- `src/pages/chat-home/*`
- `src/components/cognition/*`
- `src/components/chat-response-steps/*`

策略：

- API client 测请求路径、错误归一化、响应 parse。
- hook 测状态转移与事件合并。
- 组件测用户可见状态、按钮行为、空态与错误态，避免纯快照。

### `agent-admin`

优先补：

- `src/pages/workflow-lab/*`
- `src/pages/auth/runtime/admin-refresh-coordinator.ts`
- `src/pages/company-agents/company-live-bundle-result.tsx`
- `src/pages/learning-center/*`
- `src/pages/runtime-overview/components/runtime-workflow-catalog-card.tsx`

策略：

- Workflow Lab 先测 API facade、node timeline、run history、node detail 状态分支。
- Runtime / Learning / Company pages 测真实运营视图投影，不把后台控制台退化成浅 render 测试。

### `apps/frontend/knowledge`

优先补：

- `src/hooks/use-knowledge-base-detail.ts`
- `src/pages/documents/document-upload-panel.tsx`
- `src/pages/knowledge-bases/knowledge-base-detail-page.tsx`
- `src/pages/settings/*`
- `src/pages/users/users-page.tsx`
- `src/app/layout/app-shell.tsx`

策略：

- 页面测试围绕 API facade 与用户流程：加载、错误、空态、提交、权限分支。
- 设置页测试 key/storage/model/security 的字段投影与保存行为。

### Global Drag

后续补：

- `packages/tools/src/*` 中 registry、filesystem、MCP transport、connector executor。
- `packages/skill/src/*` 中 registry、governance policy、install、source repository。
- `packages/templates/src/*` 中 registry 与模板生成 contract。
- `agents/audio/src/*` 与 `agents/video/src/*` 的 runtime domain descriptor 与 policy。

## Coverage Config Rules

允许排除：

- `**/*.d.ts`
- 纯类型文件，例如仅导出 `type` / `interface` 的 `*.types.ts`
- barrel-only `index.ts`，前提是没有运行时逻辑
- 浏览器或 Vite 启动入口，例如 `src/main.tsx`
- 模板示例 app 的展示入口，前提是另有模板 registry/contract 测试证明生成结果

禁止排除：

- schema、adapter、facade、repository、controller、service、graph node、runtime policy。
- 包含条件分支、错误语义、数据转换或副作用边界的任何文件。
- 为了让阈值通过而排除低覆盖但仍被生产路径调用的业务代码。

## Verification Plan

每个阶段完成后至少执行：

```bash
pnpm test:coverage
```

涉及代码改动时按受影响范围追加：

```bash
pnpm test:unit:affected
pnpm test:integration:affected
pnpm test:demo:affected
pnpm typecheck:affected
```

涉及 `packages/*` 时优先补：

```bash
pnpm build:lib
pnpm --dir apps/backend/agent-server build
```

涉及文档时执行：

```bash
pnpm check:docs
```

最终收口目标：

```bash
pnpm test:coverage
pnpm verify
```

如果 `pnpm verify` 被外部环境、凭据、网络或既有红灯阻断，交付时必须记录实际执行命令、失败层级、blocker 是否属于本轮改动。

## Documentation Impact

需要同步更新：

- `docs/packages/evals/testing-coverage-baseline.md`：用新的阶段性基线替换 2026-04-02 快照，或显式保留其历史性质并新增当前基线。
- `docs/conventions/test-conventions.md`：记录 coverage include/exclude 的允许与禁止规则。
- `docs/packages/evals/verification-system-guidelines.md`：如测试入口或 demo 分层规则变化，更新当前验证入口。
- `README.md`：只在命令或 CI 语义变化时更新。

## Cleanup Impact

补测过程中要清理：

- 失效的测试 helper。
- 不再运行的旧 smoke 入口。
- 与当前 coverage 口径冲突的过时文档。
- 只剩 re-export 且无运行时逻辑的 coverage 噪音入口，优先通过配置排除或合并到真实测试入口。

不得删除用户数据、浏览器 profile、登录态或站点缓存。

## Success Criteria

- `pnpm test:coverage` 全绿。
- 全仓 lines/statements/functions/branches 均 `>= 85%`。
- 当前项目级阈值均 `>= 85%`：
  - `packages/runtime/src/**`
  - `apps/backend/agent-server/src/**`
  - `apps/frontend/agent-chat/src/**`
  - `apps/frontend/agent-admin/src/**`
  - `apps/frontend/knowledge/src/**`
- 根级 smoke/integration 不依赖 sandbox 禁止的任意端口监听。
- 新测试覆盖真实 contract、状态分支、错误语义与用户流程。
- 文档基线与当前实现一致，没有留下互相冲突的覆盖率说明。
