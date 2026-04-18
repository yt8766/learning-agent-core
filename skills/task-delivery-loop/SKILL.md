---
name: task_delivery_loop
description: Use this skill when the user asks to implement a requirement, fix a bug, refactor code, or deliver a change in learning-agent-core with requirement analysis, TDD, implementation, verification, documentation sync, and review-ready output.
version: '1.0.0'
publisher: workspace
license: Proprietary
compatibility: Requires repository access. Prefer existing pnpm scripts and repository conventions.
metadata:
  author: learning-agent-core
  ministry: gongbu-implementation
triggers:
  - implement
  - fix
  - refactor
  - requirement
  - tdd
  - verification
  - review-ready
recommended-ministries:
  - gongbu-implementation
  - xingbu-review
  - libu-delivery
recommended-specialists:
  - technical-architecture
  - risk-compliance
allowed-tools:
  - read_local_file
  - list_directory
  - run_terminal
  - apply_patch
execution-hints:
  - Default to continuous execution: analyze, write failing tests, implement, verify, document, and summarize without pausing unless a real blocker appears.
  - Prefer repository-level verification entrypoints first, then fall back to affected-scope commands with explicit blocker notes.
compression-hints:
  - Keep progress updates short and user-facing, but preserve the final evidence chain: scope, tests, implementation, verification, docs, risks.
approval-policy: high-risk-only
risk-level: medium
---

# Task Delivery Loop

本 skill 用于把“收到需求后如何稳定落地”收敛成一个默认执行闭环，适用于新增功能、缺陷修复、重构和中等复杂度的联动改动。

## 何时使用

在这些场景下优先使用：

- 用户要求实现某个需求或修复某个问题
- 用户要求按 TDD 推进
- 用户要求补测试、补验证、补文档
- 任务需要最终达到可 review、可交付、可继续接手的状态

如果用户只是要纯 review，优先改用 `skills/code-review`；如果只是发布前检查，优先改用 `skills/release-check`。

## 核心思路

把用户给出的 6 步流程升级为一个更稳的 9 段闭环：

1. 任务定级与完成条件
2. 需求与影响面分析
3. Red：先补失败测试
4. Green：最小实现让测试转绿
5. Refactor：整理结构但不改变语义
6. Cleanup：清理死代码、废弃实现、过时文件与失效规范
7. Verification：按仓库五层验证收口
8. Docs：同步文档与规范
9. Delivery：输出 review-ready 总结

这样做的目的不是增加流程感，而是避免常见漏项：

- 直接写代码，忘了先补回归测试
- 测试过了，但没补类型 / Spec / Integration
- 代码改了，但文档和规范没同步
- 已经废弃的文件、旧规范、死代码继续残留在仓库里
- 交付时只说“已完成”，没有说明风险、验证和后续关注点

## 默认执行步骤

### 0. 任务定级与完成条件

先快速判断任务属于哪类，再决定后面的动作强度：

- `feature`
  - 新功能、新流程、新页面、新 contract
- `fix`
  - 缺陷修复、回归修复、边界行为修复
- `refactor`
  - 拆文件、提炼 helper、迁移 contract、收敛目录
- `docs-only`
  - 纯文档或纯技能说明更新
- `review-only`
  - 只读审查，不写代码

开始前先明确本轮“完成”至少意味着什么：

- 需求被实现或结论被确认
- 相关测试与验证完成，或 blocker 已清楚记录
- 文档与规范已同步
- 用户能直接据此继续 review、合并或下一步联调

### 1. 需求与影响面分析

先做最小必要的代码库扫描，不要盲改：

- 阅读 `AGENTS.md`、`README.md` 和相关模块文档
- 定位目标入口、调用链、共享 contract、测试目录
- 识别影响范围：
  - 后端接口 / DTO / SSE
  - 前端页面 / 路由 / 状态流
  - graph / flow / prompt / schema
  - `packages/core`、`packages/runtime` 与相关宿主本地类型层
- 评估副作用：
  - 是否会破坏 `agent-chat` OpenClaw 主链
  - 是否会让 `agent-admin` 退化成普通 dashboard
  - 是否会破坏 approval / recover / learning / evidence
  - 是否影响 `@agent/*` 对外 contract

如果修改某个手写源码文件且它已超过 `400` 行，本轮必须顺手拆分，不把结构债务继续留下。

### 2. Red：先写失败测试

默认遵循 TDD，优先从使用者视角定义预期行为。

做法：

- 先补最小失败用例，再写实现
- 测试文件放到对应宿主的 `test/` 目录
- 测试名称直接表达业务意图，不写 “should work”
- 优先覆盖：
  - 成功路径
  - 边界路径
  - 失败或回退路径

按改动类型选择测试：

- 稳定结构化 contract：先补 `Spec`
- 纯逻辑与映射：先补 `Unit`
- 跨模块协作、SSE、审批恢复、前后端闭环：先补 `Integration`
- 最小可运行链路：补 `Demo` 或由 integration/smoke 承担

如果任务确实不适合完整 TDD，例如纯文档、纯搬运、极轻微配置同步，要在最终交付里明确说明为什么没有完整走 Red。

### 3. Green：最小实现让测试转绿

只写让当前失败测试通过所需的最小代码，不在这一步提前堆额外抽象。

强约束：

- 应用层只通过 `@agent/*` 依赖共享包
- 不直接从应用层连 `packages/*/src`
- 稳定 JSON / DTO / payload / event contract 默认 schema-first
- 高变动逻辑下沉到 `flows/`、`runtime/`、`adapters/`、`repositories/`
- graph 文件只做 wiring，不回塞大量业务逻辑

如果需要新增能力，优先新增：

- `schema`
- `adapter`
- `facade`
- `provider`
- `node`

不要在旧入口继续堆大型 `if/else`。

### 4. Refactor：在测试保护下整理结构

当 Red/Green 跑通后，再做结构性整理：

- 拆超长文件
- 提炼重复逻辑
- 收敛 helper / types / adapters / schemas 落位
- 清理未使用导出、死代码、未接线节点
- 修正命名，让边界更贴近真实语义

注意：

- 不要为了“更优雅”破坏既有 contract
- 兼容迁移时优先保留 compat re-export，而不是直接断调用方
- 如果有 barrel 目录，就让主要实现物理落在对应目录里

### 5. Cleanup：清理死代码、废弃实现、过时文件与失效规范

这一步建议固定为默认动作，而不是“有空再做”。

每次实现或重构完成后，默认顺手检查这些内容：

- 是否存在本轮改动后已经不再使用的：
  - helper
  - type
  - schema
  - node
  - re-export
  - 配置项
  - 测试夹具
- 是否存在已经被新实现替代、但仍残留的：
  - 旧文档
  - 旧规范
  - 旧脚手架
  - 未接线 graph 分支
  - 兼容迁移已完成却还没删除的过渡文件
- 是否出现“目录已经收敛，但旧路径和旧中转文件还留着”的半完成状态

默认原则：

- 不保留已经确认无调用、无兼容价值的死文件
- 不让旧规范继续和新实现并存造成误导
- 不把“后面再删”当成默认结论；如果本轮已经确认无用，优先本轮直接删除

删除或清理时要注意：

- 只删除自己能证明已经废弃的内容
- 如果文件仍承担兼容迁移职责，先补清晰注释或同步迁移说明
- 不删除用户未授权的重要数据或与当前任务无关的用户文件

### 6. Verification：按仓库五层验证收口

代码、配置、模板、脚手架、测试文件有改动时，默认优先执行：

```bash
pnpm verify
```

如果根级验证被与本轮无关的问题阻断，再按受影响范围逐层补齐：

- `Type`
  - `pnpm typecheck`
  - 或对应项目 `tsc --noEmit`
- `Spec`
  - `pnpm test:spec`
  - 或 `pnpm test:spec:affected`
- `Unit`
  - `pnpm test:unit`
  - 或受影响模块对应测试
- `Demo`
  - `pnpm test:demo`
  - 或 `pnpm test:demo:affected`
  - 或等价最小闭环
- `Integration`
  - `pnpm test:integration`
  - 或受影响模块协同测试

纯文档改动至少执行：

```bash
pnpm check:docs
```

如果改动涉及目录收敛、barrel、包边界或架构分层，顺手考虑：

```bash
pnpm check:barrel-layout
pnpm check:architecture
```

如果改动涉及 `packages/*`，优先补：

```bash
pnpm build:lib
pnpm --dir apps/backend/agent-server build
```

详细命令与交付清单见 [Execution Checklist](./references/execution-checklist.md)。

### 7. Docs：同步文档与规范

代码完成后，不要只补注释，还要检查：

- 模块文档是否需要更新
- 相关规范文档是否已过时
- 是否产生了互相冲突的说明
- 是否需要删除或标记旧文档

当前仓库要求：

- 后端文档放 `docs/backend/`
- `agent-chat` 文档放 `docs/frontend/agent-chat/`
- `agent-admin` 文档放 `docs/frontend/agent-admin/`
- 跨模块链路放 `docs/integration/`
- 仓库级代理 skill 直接维护在 `skills/*`

如果本轮交付物本身就是 skill、规范或文档，仍然要检查相邻索引文档是否需要同步。

除了业务文档，规范本身也要同步考虑：

- `AGENTS.md`
- `docs/project-conventions.md`
- 模块 `README`
- 各类 `*-conventions.md` / `*-guidelines.md`

如果真实实现已经变化，就不要让旧规范继续留在仓库里误导后续代理。

### 8. Delivery：输出 review-ready 结果

最终交付不要只给“做了什么”，还要给 reviewer 和下一个接手者真正有用的信息：

- 需求与根因摘要
- 核心改动点
- 测试与验证结果
- 文档同步结果
- 风险点与关注点
- 建议的 commit message 或 PR 描述

输出可以参考 [Delivery Template](./references/delivery-template.md)。

## 补充建议

你给出的原始 6 步已经很接近可执行流程了，我建议额外固定 5 个补充点：

1. 增加“任务定级与完成条件”
   - 避免一上来就写代码，结果 feature / fix / refactor 的验证强度混在一起
2. 把文档同步独立成显式步骤
   - 否则很容易被埋进“Verification”里然后漏掉
3. 增加“Cleanup”作为固定步骤
   - 让删除旧规范、旧文件、死代码、过时说明成为默认动作，而不是额外想起来才做
4. 明确 blocker 处理规则
   - 同一阻断先自修复，最多连续尝试 3 次，再上报
5. 固定最终输出结构
   - 让每次交付都能直接进入 review，而不是靠临场发挥

## 不同任务的裁剪方式

- 纯文档任务
  - 可以跳过 Red/Green，但仍要做影响面分析、文档校验和交付总结
- 纯 review 任务
  - 使用 `code-review` skill，不默认进入实现闭环
- 轻量配置任务
  - Red 可以退化为最小可证明检查，但要说明原因
- 跨包或主链任务
  - 必须提高 Integration 和文档同步权重

## 推荐联动文件

- [AGENTS.md](/Users/dev/Desktop/learning-agent-core/AGENTS.md)
- [项目规范总览](/Users/dev/Desktop/learning-agent-core/docs/project-conventions.md)
- [测试规范](/Users/dev/Desktop/learning-agent-core/docs/test-conventions.md)
- [验证体系规范](/Users/dev/Desktop/learning-agent-core/docs/evals/verification-system-guidelines.md)
- [GitHub Flow 规范](/Users/dev/Desktop/learning-agent-core/docs/github-flow.md)
- [Execution Checklist](./references/execution-checklist.md)
- [Delivery Template](./references/delivery-template.md)
