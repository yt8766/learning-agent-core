# shared 退场完成说明

状态：completed
文档类型：history
适用范围：`packages/shared` 退场收尾、`docs/archive/shared/*` 历史归档
最后核对：2026-04-18

## 1. 完成结论

`packages/shared` 已于 `2026-04-18` 完成退场。

当前仓库状态：

- `packages/shared` 目录已从 workspace 删除
- 工具链中不再保留 `@agent/shared` 的路径别名或测试解析入口
- 业务源码与测试文件对 `@agent/shared` 的 import 已清到 `0`
- 各业务包 `package.json` 不再声明 `@agent/shared`
- `pnpm-lock.yaml` 已完成同步
- `docs/archive/shared/*` 保留为历史归档，而不是现役宿主说明

## 2. 本轮实际完成项

- 删除 `packages/shared` 包体：
  - `package.json`
  - `tsconfig*.json`
  - `tsup.config.ts`
  - `src/*`
  - `test/*`
- 删除根级与局部工具链对 `@agent/shared` 的解析入口：
  - `vitest.config.js`
  - `tsconfig.json`
  - `tsconfig.node.json`
  - `apps/backend/agent-server/tsconfig.json`
  - `apps/frontend/agent-chat/tsconfig.app.json`
  - `scripts/check-staged.js`
- 同步 shared 退场后的规范与阅读入口：
  - `README.md`
  - `AGENTS.md`
  - `docs/conventions/project-conventions.md`
  - `docs/conventions/package-architecture-guidelines.md`
  - `docs/maps/packages-overview.md`
  - `docs/maps/repo-directory-overview.md`
  - `docs/packages/core/*`
  - `docs/packages/evals/*`
  - `skills/*`

## 3. 验证结果

本轮已完成的关键验证包括：

- `pnpm install --lockfile-only`
- `pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit`
- `pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit`
- `pnpm exec vitest run --config vitest.config.js --exclude 'packages/shared/test/**'`
- `pnpm check:docs`

补充核对：

- 代码与配置侧对 `@agent/shared` / `packages/shared` 的窄范围搜索结果已为 `0`
- 文件系统中 `packages/shared` 目录已不存在

## 4. 现在的推荐边界

shared 退场后，后续默认按下面边界继续收敛：

- 稳定 contract：`packages/core`
- 运行态 aggregate / facade / compat：真实宿主本地
  - 例如 `packages/runtime/src/runtime/*`
  - `packages/runtime/src/session/*`
  - `packages/runtime/src/graphs/main/task/*`
  - `apps/backend/agent-server/src/runtime/*`
  - `apps/frontend/agent-admin/src/types/admin/*`
  - `packages/memory/src/repositories/*`
  - `agents/supervisor/src/workflows/*` 与 `src/flows/supervisor/*`

禁止回退：

- 不再新增 `@agent/shared`
- 不再恢复 `packages/shared`
- 不再把宿主本地 compat / facade 再次上提成新的公共包壳

## 5. 后续阅读顺序

后续 AI 如果要理解这次退场，优先阅读：

- [docs/archive/shared/README.md](/docs/archive/shared/README.md)
- [docs/archive/shared/shared-removal-completed.md](/docs/archive/shared/shared-removal-completed.md)
- [docs/conventions/project-conventions.md](/docs/conventions/project-conventions.md)
- [docs/conventions/package-architecture-guidelines.md](/docs/conventions/package-architecture-guidelines.md)
- [docs/packages/core/current-core-package-audit.md](/docs/packages/core/current-core-package-audit.md)

如需追历史迁移过程，再回看：

- [docs/archive/shared/shared-removal-feasibility.md](/docs/archive/shared/shared-removal-feasibility.md)
- [docs/packages/evals/runtime-agent-cycle-audit.md](/docs/packages/evals/runtime-agent-cycle-audit.md)
- [docs/packages/evals/turbo-cycle-reduction-stage-six-plan.md](/docs/packages/evals/turbo-cycle-reduction-stage-six-plan.md)
