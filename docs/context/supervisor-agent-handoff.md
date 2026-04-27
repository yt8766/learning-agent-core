# supervisor Agent 交接文档

状态：current
文档类型：guide
适用范围：`agents/supervisor`
最后核对：2026-04-19

## 包定位

`agents/supervisor` 是 supervisor 主控、workflow route、workflow preset、specialist routing 与 ministry 宿主。

## 当前主要目录

- `src/graphs/`
- `src/flows/`
- `src/workflows/`
- `src/bootstrap/`
- `src/runtime/`

## 修改前先读

- [docs/agents/supervisor/README.md](/docs/agents/supervisor/README.md)
- [docs/agents/supervisor/package-structure-guidelines.md](/docs/agents/supervisor/package-structure-guidelines.md)
- [docs/maps/packages-overview.md](/docs/maps/packages-overview.md)

## 改动边界

- 稳定子 Agent 主链应通过 `src/graphs/*` 进入，不要把长流程继续堆回 `workflows/*`。
- prompt、schema、解析、节点逻辑应优先落在 `src/flows/*`，graph 只做 wiring。
- 通用 contract 仍应回到 `packages/core`，不要在这里发明新的伪共享层。

## 验证

- `pnpm exec tsc -p agents/supervisor/tsconfig.json --noEmit`
- `pnpm --dir agents/supervisor test`
- `pnpm --dir agents/supervisor test:integration`

## 交接提醒

- 这是多 agent 路由核心之一，规划、specialist route、dispatch 语义改动要格外谨慎。
