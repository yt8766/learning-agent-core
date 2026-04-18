# supervisor 包结构规范

状态：current
文档类型：convention
适用范围：`agents/supervisor`
最后核对：2026-04-18

本文档说明 `agents/supervisor` 如何继续按“主控 agent 宿主”而不是“共享杂物层”收敛目录结构。

## 1. 目标定位

`agents/supervisor` 负责：

- workflow preset / workflow route / specialist routing
- bootstrap skill registry
- supervisor planning / dispatch / direct reply / delivery flow
- `LibuRouterMinistry`、`HubuSearchMinistry`、`LibuDocsMinistry` 的真实实现
- subgraph descriptor 与 main-route graph

它不负责：

- runtime 主链 graph 编排与 session 协调
- app 层 controller / SSE / view model
- 通用 provider、memory、tools 实现

## 2. 推荐结构

```text
agents/supervisor/
├─ src/
│  ├─ graphs/
│  ├─ flows/
│  │  ├─ supervisor/
│  │  ├─ ministries/
│  │  └─ delivery/
│  ├─ workflows/
│  ├─ bootstrap/
│  ├─ runtime/
│  ├─ shared/
│  ├─ types/
│  ├─ utils/
│  └─ index.ts
├─ test/
└─ package.json
```

各目录语义：

- `graphs/`
  - supervisor graph 入口与 subgraph registry
- `flows/supervisor/`
  - 规划、dispatch、direct reply、delivery 前的主控节点与 prompts / schemas
- `flows/ministries/`
  - `libu-router`、`hubu-search`、`libu-docs` 的真实宿主
- `workflows/`
  - workflow preset、route、specialist、execution step 这类稳定 supervisor 策略
- `bootstrap/`
  - bootstrap skill registry
- `runtime/`
  - agent runtime facade / context helper
- `shared/`
  - 仅保留 supervisor 域内跨 flow 共享资产

## 3. 当前收敛策略

当前已经明确：

- `workflows/*`
  - 只放 workflow routing、preset、research-source planning、execution steps、specialist routing
- `flows/supervisor/*`
  - 只放 supervisor 节点、prompt、schema、planning helper
- `flows/ministries/*`
  - 承载真实 ministry 实现，不再回退到 `packages/runtime`
- `runtime` 依赖边界
  - 仅允许通过 `@agent/runtime` 根入口消费稳定 runtime facade
  - 不允许直接依赖 `packages/runtime/src/*`，也不允许依赖 `runtime/agent-bridges/*` 这类 runtime 内部过渡层

后续继续收敛时：

1. 不把新的可执行主链写回 `workflows/*`
2. 不把 ministry 实现重新搬进 `packages/runtime`
3. 对外继续只通过 `@agent/agents-supervisor` 根入口暴露稳定公共面
4. 已经纳入根入口边界测试的 bootstrap registry、workflow route/preset、main-route graph 继续保持“根入口稳定 + 真实宿主明确”
