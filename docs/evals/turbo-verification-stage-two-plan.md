# Turbo 验证二阶段迁移方案

状态：snapshot
文档类型：plan
适用范围：根级验证入口、`packages/*`、`agents/*`、`apps/*`
最后核对：2026-04-16

本主题主文档：

- [验证体系规范](/docs/evals/verification-system-guidelines.md)
- [Turbo Demo 三阶段迁移方案](/docs/evals/turbo-demo-stage-three-plan.md)

本文只覆盖：

- `typecheck`
- `test:unit`
- `test:integration`
- 这些验证在 Turborepo 中的第二阶段迁移路线

不覆盖：

- `Demo`
- `test:demo:affected`
- `verify:affected` 中的 Demo 编排

上述内容已单独收敛到 [Turbo Demo 三阶段迁移方案](/docs/evals/turbo-demo-stage-three-plan.md)。

## 1. 背景与结论

第一阶段已经把根级治理校验接入 Turbo：

- `check:docs`
- `check:architecture`

并且已经确认：

- 根级 `pnpm verify` 仍可作为五层验证主入口
- `pnpm verify:governance` 已能利用 Turbo 缓存
- 当前仓库的循环依赖 warning 不会阻断 root task 方案

第二阶段的目标不是立刻把根级 `pnpm verify` 替换成 `turbo run verify`，而是先新增一条“包级 Turbo 验证通道”，让以下三层逐步获得：

- 缓存
- `--filter`
- `--dry-run`
- `--graph`

适用的验证层：

- `Type`
- `Unit`
- `Integration`

## 1.1 当前落地状态

当前仓库已经完成 Phase 2A 的第一步：

- `packages/*` 与 `agents/*` 已补齐：
  - `turbo:typecheck`
  - `turbo:test:unit`
  - `turbo:test:integration`
- `apps/frontend/agent-chat`
- `apps/frontend/agent-admin`
- `apps/backend/agent-server`
- `apps/worker`

也已补齐对应 Turbo-only 入口。

当前语义：

- 这些脚本专门服务于 Turbo 包级验证通道
- 默认不替代原有 `typecheck`、`test`、`test:integration`、`verify`
- `apps/backend/agent-server` 在 Turbo-only 通道中暂时以根级 Vitest 配置作为宿主，原有 Jest 入口继续保留
- `turbo:typecheck` 当前直接代理到各 workspace 的 `typecheck` 脚本：
  - 各 workspace 自身声明的 `tsconfig` 是唯一事实来源
  - `turbo:typecheck` 与日常 `pnpm typecheck` 语义保持一致
  - 不再依赖额外的 `run-package-typecheck` 包装脚本

当前根级也已补齐受影响范围入口：

- `pnpm typecheck:affected`
- `pnpm test:unit:affected`
- `pnpm test:integration:affected`
- `pnpm verify:affected`

## 2. 当前阻塞点

当前仓库不能直接把现有 `typecheck` / `test` Turbo 化的原因，不在于 Turbo 不可用，而在于“当前任务名 + 当前依赖图 + 当前脚本形态”组合起来会踩雷。

### 2.1 当前强循环依赖簇

当前至少存在以下强循环依赖簇：

- `@agent/runtime`
- `@agent/agents-supervisor`
- `@agent/agents-coder`
- `@agent/agents-reviewer`
- `@agent/agents-data-report`

关键现状：

- `@agent/runtime` 依赖多个 `agents/*`
- `@agent/agents-supervisor` 依赖 `@agent/runtime`，并继续依赖 `coder`、`reviewer`
- `@agent/agents-data-report` 依赖 `@agent/agents-supervisor`

因此，只要 Turbo task 继续使用：

```json
{
  "dependsOn": ["^typecheck"]
}
```

或：

```json
{
  "dependsOn": ["^build"]
}
```

就会沿 package graph 展开，并在这个强连通分量里报 cyclic dependency。

### 2.2 根级脚本和包级脚本语义混在一起

当前验证入口分为两类：

- 根级全仓脚本：
  - `pnpm typecheck`
  - `pnpm test:unit`
  - `pnpm test:integration`
- 包级脚本：
  - `pnpm --dir <pkg> typecheck`
  - `pnpm --dir <pkg> test`
  - `pnpm --dir <pkg> test:integration`

其中根级脚本不是真正的“Turbo 可拆分任务”：

- 根级 `typecheck` 由 [scripts/typecheck.js](/scripts/typecheck.js) 顺序扫描多个 `tsconfig`
- 根级 `test:unit` 与 `test:integration` 都直接调用根 [vitest.config.js](/vitest.config.js)

所以即使对根级任务使用 Turbo `--filter`，很多情况下也仍然是在执行“一个会扫全仓的根任务”，很难获得按包精确裁剪的收益。

### 2.3 `apps/*` 的包级验证入口还不完全对齐

当前大多数 `packages/*` 与 `agents/*` 已经具备：

- `typecheck`
- `test`
- `test:integration`

但 `apps/*` 还不完全统一：

- `apps/frontend/agent-admin` 只有 `typecheck`
- `apps/frontend/agent-chat` 还没有独立 `typecheck` / `test` / `test:integration`
- `apps/backend/agent-server` 仍保留 Jest 入口，而根级主链使用的是 Vitest 聚合

这意味着第二阶段不能假设“所有 workspace 都已具备一致的 Turbo task 宿主”。

## 3. 二阶段核心策略

第二阶段推荐采用：

- 保留现有根级 `pnpm verify`
- 新增 Turbo-only 的包级验证任务
- 不直接复用当前的 `typecheck` / `test` / `test:integration` Turbo 定义

### 3.1 为什么不直接复用现有任务名

不推荐直接把现有 Turbo 配置改成：

- `typecheck` 去掉 `^typecheck`
- `test` 去掉 `^build`

原因：

- 这会把“根级主入口语义”和“包级 Turbo 验证通道语义”混在一起
- 很难在不影响现有开发习惯的前提下逐步迁移
- 一旦某个任务需要按包细化 `inputs`，就会和当前全仓脚本共享同一个任务名，后续演进空间变差

更稳妥的做法是新增 Turbo-only 任务名，例如：

- `turbo:typecheck`
- `turbo:test:unit`
- `turbo:test:integration`

这样可以做到：

- 根级 `pnpm verify` 完全不变
- 包级验证先逐步接入 Turbo
- 后续如果要替换主入口，再决定是否做任务名收敛

## 4. 推荐的任务设计

## 4.1 包级 Turbo-only 任务

第二阶段推荐在各 workspace package 中逐步补齐以下脚本：

```json
{
  "scripts": {
    "turbo:typecheck": "pnpm typecheck",
    "turbo:test:unit": "pnpm test",
    "turbo:test:integration": "pnpm test:integration"
  }
}
```

说明：

- 对已经具备 `typecheck` / `test` / `test:integration` 的 `packages/*` 与 `agents/*`，这只是轻量别名
- 对尚未补齐入口的 `apps/*`，需要先补对齐脚本，再接入 Turbo
- `apps/backend/agent-server` 可以在二阶段先新增 Vitest 风格的包级脚本，不必立刻废弃 Jest

### 4.2 `turbo.json` 推荐定义

二阶段推荐新增以下任务，而不是修改现有 `typecheck` / `test`：

```json
{
  "tasks": {
    "turbo:typecheck": {
      "outputs": [],
      "inputs": ["src/**", "test/**", "package.json", "tsconfig.json", "tsconfig.*.json"]
    },
    "turbo:test:unit": {
      "outputs": [],
      "inputs": ["src/**", "test/**", "package.json", "vitest.config.js", "tsconfig.json", "tsconfig.*.json"]
    },
    "turbo:test:integration": {
      "outputs": [],
      "inputs": [
        "src/**",
        "test/**",
        "package.json",
        "vitest.config.js",
        "scripts/run-package-integration-tests.js",
        "tsconfig.json",
        "tsconfig.*.json"
      ]
    }
  }
}
```

关键约束：

- 默认不要给这三个任务加 `dependsOn: ["^..."]`
- 第二阶段的核心目标是“获得包级缓存与筛选”，不是让 Turbo 负责类型或测试的拓扑排序

### 4.3 为什么这里不加 `dependsOn`

这是二阶段最关键的取舍。

不选：

- `dependsOn: ["^typecheck"]`
- `dependsOn: ["^build"]`

原因：

- 会直接把当前强循环依赖簇重新引入任务图
- 使 `runtime <-> agents/*` 再次成为整个 Turbo 验证通道的 blocker

选“不加 `dependsOn`”的原因：

- 当前 `tsc --noEmit` 与根 Vitest 聚合本来就主要基于源码直接工作
- 实测 `build:lib` 这类不带 `^dependsOn` 的 package-local Turbo task，即使面对 `@agent/runtime` 也能正常 dry-run
- 先获得缓存、筛选和可观测性，比强行把依赖拓扑也一起做对更现实

## 5. 迁移顺序

### 5.1 Phase 2A：补齐 Turbo-only 包级入口

先做最低风险对齐：

- 为 `packages/*`、`agents/*` 补 `turbo:typecheck`
- 为已具备包级单测能力的项目补 `turbo:test:unit`
- 为已具备 `test:integration` 的项目补 `turbo:test:integration`
- 为 `apps/frontend/agent-chat`、`apps/frontend/agent-admin`、`apps/backend/agent-server` 补齐对应包级入口

完成标志：

- `turbo run turbo:typecheck --filter=@agent/core`
- `turbo run turbo:test:unit --filter=@agent/runtime`
- `turbo run turbo:test:integration --filter=@agent/agents-supervisor`

都能正常执行。

### 5.2 Phase 2B：新增受影响范围入口

在根 `package.json` 新增不替代主入口的命令，例如：

- `typecheck:affected`
- `test:unit:affected`
- `test:integration:affected`
- `verify:affected`

建议形态：

```bash
turbo run turbo:typecheck --filter="...[origin/main]"
turbo run turbo:test:unit --filter="...[origin/main]"
turbo run turbo:test:integration --filter="...[origin/main]"
```

`verify:affected` 推荐语义：

- 治理门槛继续跑 root task
- Spec 继续由根级受影响范围脚本负责
- Type / Unit / Integration 使用受影响范围过滤
- Demo 通过受影响范围的 Turbo `demo` 任务补齐

当前已落地语义：

- `pnpm verify:affected`
  - 先执行 `pnpm verify:governance`
  - 再执行 `pnpm test:spec:affected`
  - 再执行：

```bash
turbo run turbo:typecheck turbo:test:unit demo turbo:test:integration --filter="...[origin/main]"
```

这么做的原因：

- 治理门槛默认继续全量执行，避免 root task 与 `--filter` 语义纠缠
- 受影响范围裁剪只落在包级 Turbo-only 验证层
- 保持 `pnpm verify` 与 `pnpm verify:affected` 的职责边界清晰

### 5.3 Phase 2C：按宿主补前端与后端细化

这一步专门解决 `apps/*` 的不一致：

- `agent-chat`
  - 补 `typecheck`
  - 补包级 unit / integration 入口
- `agent-admin`
  - 补包级 unit / integration 入口
- `agent-server`
  - 明确二阶段是否继续以 Vitest 为 Turbo 宿主
  - 如保留 Jest，则需要额外说明“Jest 与 Vitest 的边界”

原则：

- 二阶段不强制统一所有测试框架
- 但 Turbo 入口对应的脚本必须稳定、可缓存、可单包执行

## 6. 不推荐的方案

### 6.1 不推荐直接把根级 `verify` 改成 `turbo run verify`

原因：

- 当前主验证入口语义清晰，且已稳定工作
- 一步替换会同时引入：
  - 根脚本与包脚本收敛
  - 循环依赖处理
  - `apps/*` 脚本对齐
  - 缓存输入设计

变更面太大，不适合二阶段。

### 6.2 不推荐继续沿用当前 `typecheck` / `test` Turbo 定义做硬迁移

原因：

- 当前 `typecheck` 带 `^typecheck`
- 当前 `test` 带 `^build`
- 这两个定义天然会触发当前循环依赖簇

二阶段应当通过新增 Turbo-only task 名避开，而不是在旧任务名上硬拧。

### 6.3 不推荐一开始就追求超细粒度 `inputs`

原因：

- 目前各宿主脚本形态还没完全收敛
- 过早缩小 glob 容易造成缓存误命中

二阶段建议：

- 先用偏稳妥的 `src/** + test/** + tsconfig* + package.json + 根配置`
- 等入口稳定后，再逐步细化

## 7. 推荐交付形态

如果继续推进实现，推荐拆成两次提交或两轮任务：

1. “补齐 Turbo-only 包级脚本 + turbo.json 任务定义”
2. “新增受影响范围入口 + 文档更新 + 最小验证”

这样做的好处：

- 每轮都能独立验证
- 不会把脚本对齐和验证入口替换混在一起
- 一旦某个 `apps/*` 宿主脚本还没准备好，可以局部跳过，不阻塞整个仓库

## 8. 当前建议

下一轮如果要继续落代码，优先顺序建议如下：

1. 为 `packages/*` 与 `agents/*` 批量补 `turbo:typecheck`、`turbo:test:unit`、`turbo:test:integration`
2. 为 `apps/frontend/agent-chat`、`apps/frontend/agent-admin` 补齐包级测试脚本
3. 单独决定 `apps/backend/agent-server` 的 Turbo 测试宿主边界
4. 在根级补 `*:affected` 命令
5. 再评估是否需要把 `Demo` 纳入 Turbo-only 通道
