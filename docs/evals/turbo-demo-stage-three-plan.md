# Turbo Demo 三阶段迁移方案

状态：snapshot
文档类型：plan
适用范围：workspace 根包、`packages/*`、`agents/*`、`apps/*`
最后核对：2026-04-16

本主题配套文档：

- [验证体系规范](/Users/dev/Desktop/learning-agent-core/docs/evals/verification-system-guidelines.md)
- [测试规范](/Users/dev/Desktop/learning-agent-core/docs/test-conventions.md)
- [Turbo 验证二阶段迁移方案](/Users/dev/Desktop/learning-agent-core/docs/evals/turbo-verification-stage-two-plan.md)

本文只覆盖：

- `Demo`
- `test:demo:affected`
- `verify:affected` 中的 Demo 层接入策略

## 1. 结论

第三阶段的核心结论已经在当前仓库中得到验证：

- `Demo` 适合接入 Turbo
- 接入方式应当使用现有 `demo` 任务名，而不是额外新增 `turbo:test:demo`
- 对本仓库来说，`Demo` 最稳妥的语义是：
  - 由 Turbo 负责受影响范围筛选与依赖构建
  - 由各 workspace 继续保留自己的 `pnpm demo` 实现

当前已落地的根级入口：

- `pnpm test:demo:affected`
- `pnpm verify:affected`

当前已验证通过的真实命令：

- `pnpm test:demo:affected`
- `pnpm verify:affected`

最近一次核对日期为 `2026-04-16`。

## 2. 为什么 Demo 可以先于全量 Type/Test 主链接入 Turbo

`Demo` 与 `typecheck` / `test:unit` / `test:integration` 的关键区别在于：

- 它本身不是沿 package graph 做拓扑传播的分析任务
- 它更像“每个宿主自带的最小闭环 smoke 入口”
- 它天然允许每个 workspace 自主决定要不要先 `build:lib`

因此在本仓库里：

- `typecheck` 直接走 Turbo package graph，容易触发 `runtime <-> agents/*` 的循环依赖问题
- `Demo` 则可以把依赖关系收敛为：
  - 当前宿主的 `build:lib`
  - 上游工作空间依赖的 `build:lib`
  - 当前宿主自己的 `demo`

这使得 `Demo` 成为一个适合比 Type/Test 更早完成 Turbo 化的验证层。

## 3. 当前采用的任务模型

当前 `turbo.json` 中的 `demo` 任务采用：

```json
{
  "tasks": {
    "demo": {
      "dependsOn": ["build:lib", "^build:lib"],
      "inputs": ["demo/**", "src/**", "package.json", "tsconfig.json", "tsconfig.*.json"],
      "outputs": []
    }
  }
}
```

当前根级聚合入口采用：

```json
{
  "scripts": {
    "test:demo:affected": "turbo run demo --filter='...[origin/main]'",
    "verify:affected": "pnpm verify:governance && pnpm test:spec:affected && turbo run turbo:typecheck turbo:test:unit demo turbo:test:integration --filter='...[origin/main]'"
  }
}
```

这个设计的实际语义是：

- `turbo run demo --filter='...[origin/main]'` 只选择受影响闭包中的 workspace
- 对于真正声明了 `demo` 脚本的宿主，Turbo 会执行其 `demo`
- 在执行 `demo` 之前，Turbo 会先补齐当前宿主和其上游依赖的 `build:lib`
- 没有 `demo` 脚本的宿主不会因为在 scope 中就被强行执行失败

当前 `inputs` 的选择逻辑：

- `demo/**`
  - 任何 demo 入口、fixture、smoke helper 改动都应使 demo 重新执行
- `src/**`
  - Demo 需要跟随真实源码变化失效
- `package.json`
  - `demo` 命令本身、依赖声明与脚本变更会影响闭环行为
- `tsconfig.json` / `tsconfig.*.json`
  - 当前大量 demo 直接运行 TypeScript 源码，编译边界变化必须进入缓存键

当前没有保留这类宿主级 demo 例外：

- 通用 scaffold 能力已经迁回 `packages/tools` 的测试与 integration
- `turbo demo` 不再需要为已删除的独立 scaffold 宿主追踪额外模板目录

## 4. 为什么选 A，不选 B

### 4.1 选现有 `demo`，不选新增 `turbo:test:demo`

不选：

- 新增 `turbo:test:demo`

原因：

- `Demo` 本来就是面向宿主的最小闭环入口，不需要再造一层别名
- 会让“真实闭环命令”和“Turbo 专用闭环命令”出现双轨
- 后续维护者更难判断应该更新哪个脚本

选择：

- 直接让 Turbo 调度既有 `demo`

收益：

- 单包本地执行与 Turbo 调度复用同一条闭环命令
- 文档和开发习惯更统一
- 不需要为 Demo 再维护第二套 task 命名体系

### 4.2 选 `dependsOn: ["build:lib", "^build:lib"]`，不选在 `demo` 脚本里手工串联构建

不选：

- 每个 `demo` 脚本都手工写 `pnpm build:lib && pnpm demo`

原因：

- 依赖构建逻辑分散到各 workspace，难以统一缓存行为
- 无法让 Turbo 明确感知“先构建，再 smoke”的任务边界
- 一旦依赖构建图变化，只能逐个脚本修正

选择：

- 让 Turbo 统一声明 `demo -> build:lib -> ^build:lib`

收益：

- 依赖构建由 Turbo 统一编排
- `build:lib` 能正常缓存，`demo` 作为 smoke 层独立执行
- 受影响范围验证时，不必手工拼装先后顺序

### 4.3 选“app 无 demo 时由 integration 兜底”，不选强制所有 workspace 都补 `demo`

不选：

- 立刻要求 `apps/*`、`server`、所有宿主都新增 `demo`

原因：

- 这会把“第三阶段接入 Turbo”变成“全仓补一轮新 smoke 脚本”
- 对现有前端和后端宿主来说，很多真实最小闭环已经由 integration 覆盖
- 短期收益不如成本高

选择：

- 当前优先让已有 `demo` 的 `packages/*` 与 `agents/*` 接入 Turbo
- 对未单独维护 `demo` 的宿主，继续由 integration 或现有最小闭环承担 Demo 责任

收益：

- 可以先拿到受影响范围筛选和构建缓存收益
- 不会把迁移任务升级成一次高风险仓库整改
- 保持五层验证语义成立，同时尊重各宿主现状

## 5. 当前仓库的真实观察

截至 `2026-04-16`，仓库中明确维护 `demo` 脚本的主要宿主集中在：

- `packages/*`
- `agents/*`

当前 `pnpm test:demo:affected` 的真实表现：

- Turbo 能正确解析 `...[origin/main]`
- `demo` 任务会先触发相关依赖的 `build:lib`
- 受影响范围内的 `demo` 全部执行通过
- 典型输出为各包的 export summary、最小 happy path 信息或 scaffold smoke 结果

最近一次通过结果中：

- `Tasks: 36 successful, 36 total`
- 总耗时约 `33.6s`

这说明：

- 第三阶段不是理论设计，而是已经被当前仓库验证过的可执行方案

## 6. 后续收敛建议

第三阶段已经可用，但还有三类后续工作值得继续推进：

### 6.1 明确 Demo 输入边界

当前全局基线已经收敛为：

- `demo/**`
- `src/**`
- `package.json`
- `tsconfig.json`
- `tsconfig.*.json`

这已经能避免无关文档改动导致所有 demo 失效。

后续还可以继续按宿主做更细粒度增强，例如：

- 依赖额外配置文件的宿主
  - 可按需把对应配置加入 `inputs`

### 6.2 为 app/server 决定是否补显式 demo

当前不强制，但后续可以按价值判断：

- `agent-chat` 是否需要一个更轻量的 UI smoke demo
- `agent-admin` 是否需要一个治理面最小闭环 demo
- `server` 是否需要一个面向 facade 或契约的 smoke demo

前提是：

- 这些 demo 必须比现有 integration 更轻
- 否则就不值得新增

当前推荐的宿主分层规则：

- `packages/*`
  - 默认应该维护显式 `demo/` 与 `demo` 脚本
- `agents/*`
  - 默认应该维护显式 `demo/` 与 `demo` 脚本
- `apps/*`
  - 当前允许由 integration 或等价 UI / API smoke 闭环承担 Demo 责任
- `apps/backend/agent-server`
  - 当前允许由 integration 与最小契约链路承担 Demo 责任

### 6.3 决定 `pnpm verify` 是否最终并入 Turbo 聚合

当前建议仍保持：

- `pnpm verify` 作为根级稳定主入口
- `pnpm verify:affected` 作为 Turbo 受影响范围入口

是否要让两者进一步收敛，要等以下条件更成熟后再评估：

- Type/Test 的循环依赖治理进一步完成
- `apps/*`、`agents/*`、`packages/*` 的任务边界更统一
- 各层 `inputs`/`outputs` 足够稳定

### 6.4 第二批宿主例外候选审计结果

截至 `2026-04-16`，已对当前仓库所有显式 `demo` 宿主完成一轮审计：

- `packages/*/demo/*.ts`
- `agents/*/demo/*.ts`

当前结论：

- 其余当前显式 demo 宿主
  - 暂不需要额外例外
  - 主要原因是它们只读取当前宿主自己的 `build/cjs` 产物或当前宿主源码对应的构建结果

当前未发现仍在使用的显式 demo 宿主依赖外部模板目录、跨宿主静态资产目录或额外脚手架根目录。

这意味着当前第五阶段的审计工作已经完成，但后续仍有一个持续性动作：

- 只要新增 Demo 宿主，或现有 Demo 开始读取外部模板、配置、fixture、资产目录，就要重新评估是否需要新的宿主级 `inputs` 例外

## 7. 推荐使用方式

本仓库当前推荐：

```bash
pnpm test:demo
pnpm test:demo:affected
pnpm verify:affected
```

推荐场景：

- 本地快速验证受影响闭环：`pnpm test:demo:affected`
- 提交前对受影响包跑五层收口：`pnpm verify:affected`
- 需要全仓五层验证时：`pnpm verify`

## 8. 结语

第三阶段在本仓库中的正确理解不是“把 Demo 重新发明成 Turbo 专用任务”，而是：

- 保留各宿主已有的 `demo`
- 借助 Turbo 为 `demo` 增加：
  - 受影响范围筛选
  - 依赖构建编排
  - 缓存复用能力

这条路线已经与当前 monorepo 的真实结构对齐，并且已通过仓库级实际命令验证。
