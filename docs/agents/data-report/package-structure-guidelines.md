# data-report 包结构规范

状态：current
文档类型：convention
适用范围：`agents/data-report`
最后核对：2026-04-18

本文档说明 `agents/data-report` 如何继续作为报表生成智能体宿主收敛结构。

## 1. 目标定位

`agents/data-report` 负责：

- `data-report.graph.ts`
- `data-report-json.graph.ts`
- sandpack preview / JSON generation flow
- data-report 节点编排、prompt、schema、runtime facade
- `packages/report-kit` 之上的智能体层编排

它不负责：

- 报表 blueprint / scaffold / assembly / write 的确定性主实现
- runtime session / queue / approval orchestration
- backend controller / SSE 装配

## 2. 推荐结构

```text
agents/data-report/
├─ src/
│  ├─ graphs/
│  ├─ flows/
│  │  ├─ data-report/
│  │  └─ data-report-json/
│  ├─ types/
│  ├─ utils/
│  └─ index.ts
├─ test/
└─ package.json
```

各目录语义：

- `graphs/`
  - sandpack / JSON graph 入口
- `flows/data-report/`
  - preview、sandpack、stage meta、schema、prompt、runtime
- `flows/data-report-json/`
  - JSON schema generation、patch、lane runtime、node model policy
- `types/`
  - 本地域类型、schema 与 graph/flow contract 出口；data-report 领域不再从 `@agent/core` 取 contract

## 3. 当前收敛策略

当前已经明确：

- `packages/report-kit`
  - 只承载 blueprint / scaffold / routes / assembly / write
- `agents/data-report`
  - 只承载 graph / runtime facade / LLM 节点编排
- `runtime` 依赖边界
  - 如需共享 agent foundation，默认仅允许通过 `@agent/runtime` 根入口消费
  - runtime facade 仅允许通过 `@agent/runtime` 根入口消费
  - 不允许直接依赖 `packages/runtime/src/*`，也不允许依赖 `runtime/agent-bridges/*` 这类 runtime 内部过渡层

后续继续收敛时：

1. 不把确定性生成逻辑搬回 `agents/data-report`
2. 不把 preview / JSON graph 写回 backend service
3. 根入口继续暴露稳定 graph、runtime facade 与类型出口
4. 已纳入 root export 测试的 graph、schema parser、runtime facade 继续保持“根入口稳定 + flows/graphs 真实宿主明确”
5. `ReportBundle`、`DataReportJsonBundle`、data-report graph state 与 json graph state 均由 `src/types/schemas/*` 与 `src/types/contracts/*` schema-first 承接；`packages/core/src/data-report/*` 与 `packages/core/src/contracts/data-report/*` 不再作为宿主恢复
