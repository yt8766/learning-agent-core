# adapters 包交接文档

状态：current
文档类型：guide
适用范围：`packages/adapters`
最后核对：2026-04-19

## 包定位

`packages/adapters` 是 provider、LLM、embedding、structured output、retry 与工厂封装的真实宿主。

## 当前主要目录

- `src/providers/`
- `src/factories/`
- `src/chat/`
- `src/embeddings/`
- `src/retry/`
- `src/structured-output/`
- `src/prompts/`

## 修改前先读

- [docs/packages-overview.md](/docs/packages-overview.md)
- [docs/adapters/README.md](/docs/adapters/README.md)
- [docs/adapters/package-structure-guidelines.md](/docs/adapters/package-structure-guidelines.md)

## 改动边界

- 这里负责模型与 provider 适配，不负责 agent prompt 编排或 graph orchestration。
- 新增 provider 能力时，优先沿 `contracts / providers / factories` 扩展，不要复制整条调用链。
- 共享 DTO 与稳定 schema 不应直接定义在这里，优先回到 `packages/core`。

## 验证

- `pnpm exec tsc -p packages/adapters/tsconfig.json --noEmit`
- `pnpm --dir packages/adapters test`
- `pnpm --dir packages/adapters test:integration`

## 交接提醒

- 如果只是接入新模型或重试策略，优先保持消费方接口稳定。
- 如果修改了 factories 或 structured output 行为，要同步检查下游 runtime / reviewer / supervisor 是否依赖既有语义。
