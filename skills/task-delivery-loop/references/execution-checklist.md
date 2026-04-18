# Execution Checklist

在使用 `task_delivery_loop` 时，默认按下面的顺序检查，不需要每次完整复述到用户面前，但最终交付要能证明这些项目已被考虑。

## 1. 任务分类

- 这是 `feature`、`fix`、`refactor`、`docs-only` 还是 `review-only`
- 本轮完成条件是什么
- 是否涉及审批、高风险操作、外部依赖或需要人工确认的隐藏风险

## 2. 影响面分析

- 入口文件、调用链、共享 contract、测试目录是否已定位
- 是否影响：
  - `agent-chat` OpenClaw 主链
  - `agent-admin` 六大中心控制台
  - approval / recover / cancel
  - learning / evidence / skill reuse
  - `@agent/*` 对外 contract
- 是否触发文件拆分要求：
  - 任何本轮触达且超过 `400` 行的手写源码文件都要继续拆分

## 3. TDD / Red

- 是否先写了失败测试
- 测试是否放在对应宿主 `test/` 目录
- 测试名称是否表达业务意图
- 是否覆盖：
  - 成功路径
  - 边界路径
  - 失败或回退路径

## 4. Green / Refactor

- 是否只写了当前测试通过所需的最小实现
- 是否保持 schema-first contract
- 是否避免在 graph / service / controller 中内联长 prompt、解析和流程控制
- 是否清理了死代码、未使用导出、未接线节点
- 是否保持目录名和物理落位一致

## 5. Cleanup

- 是否删除了已无调用、无兼容价值的旧文件
- 是否清理了旧规范、旧说明、旧中转导出
- 是否删除了已废弃的 helper、schema、node、types、fixtures
- 是否避免留下“新旧实现并存但没有迁移说明”的状态
- 如果保留兼容文件，是否明确标注其过渡职责

## 6. 五层验证

优先：

```bash
pnpm verify
```

根级被无关 blocker 卡住时，至少说明并补齐受影响范围验证：

```bash
pnpm typecheck
pnpm test:spec
pnpm test:unit
pnpm test:demo
pnpm test:integration
```

可选受影响范围：

```bash
pnpm verify:affected
pnpm test:spec:affected
pnpm test:demo:affected
pnpm test:integration:affected
```

如需最低项目级检查：

```bash
pnpm exec tsc -p packages/runtime/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit
pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit
```

纯文档改动至少：

```bash
pnpm check:docs
```

涉及目录收敛或架构治理时，可加：

```bash
pnpm check:barrel-layout
pnpm check:architecture
```

涉及 `packages/*` 时，优先加：

```bash
pnpm build:lib
pnpm --dir apps/backend/agent-server build
```

## 7. 文档同步

- 是否更新了受影响模块的真实实现文档
- 是否检查并清理了过时文档或过时规范
- 是否避免在多个位置留下互相冲突的说明
- 是否检查了 `AGENTS.md`、`docs/project-conventions.md`、模块 `README` 等规范入口是否仍然有效

## 8. 交付准备

- 是否说明了核心改动
- 是否说明了验证命令和结果
- 是否明确 blocker 是否属于本轮改动
- 是否给出风险点和 reviewer 关注点
- 是否给出建议的 commit message 或 PR 描述
