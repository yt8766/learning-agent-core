# tools 包结构规范

状态：current
文档类型：convention
适用范围：`packages/tools`
最后核对：2026-05-08

本文档说明 `packages/tools` 如何继续按“工具平台能力层”收敛结构。

## 1. 目标定位

`packages/tools` 负责：

- tool registry
- tool definition
- executor
- sandbox
- approval preflight
- MCP transport

它不负责 agent orchestration。

## 2. 推荐结构

```text
packages/tools/
├─ src/
│  ├─ contracts/
│  ├─ registry/
│  ├─ definitions/
│  ├─ executors/
│  ├─ approval/
│  ├─ sandbox/
│  ├─ transports/
│  ├─ scaffold/
│  ├─ utils/
│  └─ index.ts
├─ test/
└─ package.json
```

补充：

- `registry/`、`approval/`、`sandbox/`、`mcp/`、`scaffold/` 当前已经是主要宿主
- 后续重点是把 executor 语义进一步统一到 `executors/`，并维持旧路径兼容
- `contracts/` 当前优先作为稳定 facade 入口，对外暴露 contract-friendly import；真实实现仍优先放在对应领域宿主目录

各目录语义补充：

- `definitions/`
  - tool definitions 的正式宿主，例如 filesystem、connectors、scheduling、runtime-governance
- `transports/`
  - MCP / local / stdio / http transport 与 transport handler
- watchdog 能力的真实宿主已收敛到 `@agent/runtime`；`@agent/tools` 根入口只保留 `ExecutionWatchdog` 的显式稳定转发，不再保留 `watchdog/` compat barrel

## 3. 当前收敛策略

本轮先做“新 executor / contract 宿主 + 旧入口兼容”，不重写现有工具实现。

后续优先顺序：

1. 先补 `definitions/`、`contracts/` 与 `executors/`
2. 再继续评估 `runtime-governance` 的命名和边界是否需要收紧
3. 将 `mcp/` 中偏 transport 的内容继续收敛到 `transports/`
4. 最后再看是否需要进一步拆 `registry/`

当前已落地：

- `executors/filesystem/`、`executors/connectors/`
  - 作为 filesystem / connectors executor 的真实宿主
- `executors/scaffold/`、`executors/scheduling/`、`executors/runtime-governance/`
  - 作为对应 executor 的真实宿主
- `registry/tool-registry.ts`、`registry/tool-risk-classifier.ts`
  - 作为 registry / classifier 的真实宿主
- `contracts/tool-registry.ts`、`contracts/tool-risk-classifier.ts`
  - 仅保留稳定 facade re-export，便于调用方通过 `contracts/` 获得显式入口
- 包根 `tool-registry.ts`、`tool-risk-classifier.ts`
  - 已删除
  - registry 语义统一收口到 `registry/*` 真实宿主与 `contracts/*` 稳定 facade
- `executors/scaffold/scaffold-executor.ts`、`executors/scheduling/scheduling-executor.ts`、`executors/runtime-governance/runtime-governance-executor.ts`
  - 作为对应 executor 的真实宿主
  - scheduling / runtime-governance executor 不直接写 workspace 根目录 `data/runtime/*`，需要持久化时通过 repository 注入

补充：

- 当前 `filesystem/`、`connectors/`、`scheduling/`、`runtime-governance/` 目录同时承载 definition 与 compat 入口
- 当前 `filesystem/`、`connectors/`、`scheduling/`、`runtime-governance/` 目录只保留目录聚合与 definition 入口
- 长期终态应是：
  - definition 收敛到 `definitions/`
  - execute 收敛到 `executors/`
  - 旧目录不再承载 executor 真实实现
- `packages/tools/test/data-report/*` 这类测试如果继续增长，说明报表能力边界正在反向流入工具平台，后续应优先迁回 `packages/report-kit`

当前已落地：

- `src/definitions/*`
  - 已作为 filesystem、connectors、runtime-governance、scheduling tool definition 的真实宿主
- `src/filesystem/index.ts`、`src/connectors/index.ts`、`src/runtime-governance/index.ts`、`src/scheduling/index.ts`
  - 当前只保留目录聚合职责，不再保留同目录 definition wrapper
- `src/scheduling/schedule-repository.ts`
  - 作为 schedule repository contract 与默认内存实现的真实宿主
- `src/runtime-governance/runtime-governance-repository.ts`
  - 作为 runtime governance artifact repository contract 与默认内存实现的真实宿主
- `executors/connectors/connectors-executor.ts`
  - 通过显式 `ConnectorDraftStorage` 读写 connector draft，未注入 storage 时使用包内内存实现
  - 不直接写 workspace 根目录 `data/runtime/connectors`
- `src/transports/*`
  - 已作为 HTTP / stdio / local-adapter transport 与 transport handler 的真实宿主
- `src/mcp/index.ts`
  - 当前直接聚合 `transports/*`，不再保留 `src/mcp/*.ts` transport wrapper

## 4. 当前最需要避免的误收敛

- 不要把“任何会执行的东西”都继续塞进 `executors/`，definition、execution、governance、transport 需要分开
- 不要让 `mcp/` 继续同时承担 capability registry、server registry、transport handler、session 管理四类语义而不再拆分
- 不要在 `tools` 中承接 graph、ministry、review、research 这类 agent orchestration 逻辑

## 5. 第一批执行清单

definitions 与 transports 的第一批物理收敛已完成，以下 thin wrapper 已删除：

- `src/filesystem/filesystem-tool-definitions.ts`
- `src/connectors/connector-tool-definitions.ts`
- `src/runtime-governance/runtime-governance-tool-definitions.ts`
- `src/scheduling/scheduling-tool-definitions.ts`
- `src/mcp/mcp-http-transport.ts`
- `src/mcp/mcp-local-adapter-transport.ts`
- `src/mcp/mcp-stdio-transport.ts`
- `src/mcp/mcp-transport-handlers.ts`

第一批预期新宿主：

- `src/definitions/`
- `src/transports/`

第一批验证重点：

- `packages/tools/test/filesystem/filesystem-executor.test.ts`
- `packages/tools/test/connectors/connectors-executor.test.ts`
- `packages/tools/test/runtime-governance/runtime-governance-executor.test.ts`
- `packages/tools/test/registry/tool-registry.test.ts`
- `packages/tools/test/mcp/mcp-client-manager.stdio.test.ts`
- `packages/tools/test/mcp/mcp-client-manager.local-http.test.ts`

## 6. 继续阅读

- [tools 文档目录](/docs/packages/tools/README.md)
- [runtime-governance-and-sandbox.md](/docs/packages/tools/runtime-governance-and-sandbox.md)
- [Packages 分层与依赖约定](/docs/conventions/package-architecture-guidelines.md)
