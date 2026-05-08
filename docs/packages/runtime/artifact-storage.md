# Runtime Artifact Storage

状态：current
文档类型：reference
适用范围：`packages/runtime/src/sandbox/*`、`agents/data-report/src/flows/data-report-json/runtime-cache.ts`
最后核对：2026-05-08

Runtime 与 specialist agent 的本地生成产物默认使用显式 `artifacts/*` 语义，不再把仓库根目录 `data/*` 作为 cache 或 generated artifact 默认目标。

当前默认路径：

- Browser replay / snapshot / screenshot fallback：`artifacts/runtime/browser-replays/<sessionId>/`
- Data-report JSON artifact cache：`artifacts/runtime/data-report-json-artifacts.json`
- Data-report bundle materialization fallback：`artifacts/report-kit/data-report-output`
- Generic report blueprint / template scaffold：`artifacts/report-kit/data-report`

业务模板源码里的 `src/services/data/*`、`src/types/data/*` 是目标项目代码结构，不属于 root `data/*` artifact cache，迁移时不能误改。

需要写入真实业务项目源码时，调用方必须显式传入 `baseDir` 或 `targetRoot`。需要跨机器访问、审计、下载或长期持久化时，应注入 artifact repository / writer facade，而不是让业务层直接读取本地 fallback 路径。
