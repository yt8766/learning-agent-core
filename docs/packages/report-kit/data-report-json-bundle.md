# Data Report JSON Bundle

状态：current
文档类型：reference
适用范围：`agents/data-report`、`packages/report-kit`、`apps/backend/agent-server`、`/Users/dev/Desktop/gosh_admin_fe`
最后核对：2026-04-24

## 1. 目标

`data-report-json.v1` 是面向 `gosh_admin_fe` 报表生成的 JSON-first bundle contract。它用于让大模型先生成结构化 JSON，再由确定性 renderer 生成前端文件，避免大模型直接拼 TSX、service、type 和路由代码。

当前补充：

- 外部聊天报表入口仍是 `POST /api/chat` + `responseFormat=report-schema`
- backend 直连报表链路现在以 `ReportBundle` 作为 canonical 结果对象；`schema` 不再由 backend 从 `primaryDocument` 或 `partialSchema` 反向投影成 bundle
- `/api/chat` 的 `schema_ready` 与最终 `done` 事件默认只携带 `bundle` 与运行元数据；`schema` 仅在上游流程天然返回且确有硬约束时才保留，backend 不再兜底构造
- `/api/chat` 保留 SSE 默认模式；当 `responseFormat=report-schema` 且调用方发送 `Accept: application/json`，或请求体显式传 `stream: false` 时，backend 直接返回普通 JSON：`{ content, status, bundle, elapsedMs, reportSummaries, runtime, events }`
- 普通 JSON 模式仍以 `bundle` 为报表 JSON 主体；调用方不要再读取旧版 `schema` 字段，单页报表应读取 `bundle.documents[0]`
- legacy `CHANGE_REQUEST + CURRENT_SCHEMA` 文本输入已从 `report-schema` 路径移除；编辑调用方必须显式传 `currentBundle`

这条链路支持一个或多个报表：

1. 大模型生成需求理解、数据源、报表集合、单报表视图 DSL、service/type、组件拆分等 JSON。
2. 所有 JSON 先经过 `DataReportJsonBundleSchema` 或相关子 schema 校验。
3. `packages/report-kit` 的 `renderDataReportJsonBundleFiles` 把 bundle 转为 `gosh_admin_fe` 风格文件计划。
4. 后续写入、审查、验证由上层 facade 或执行器负责，不在 backend service 内拼流程。

## 2. 稳定入口

- Bundle schema：`agents/data-report/src/types/schemas/data-report-json-bundle-schema.ts`
- Bundle types：`agents/data-report/src/types/data-report-json-bundle-schema.ts`
- 确定性 renderer：`packages/report-kit/src/json-renderer/data-report-json-renderer.ts`
- report-kit facade：`packages/report-kit/src/contracts/data-report-facade.ts`

`agents/data-report` 负责 data-report 领域 schema/type/graph contract 与 LLM graph 编排；`packages/report-kit` 保持确定性 renderer 与 blueprint/scaffold/assembly 宿主，不回指 core 旧 data-report contract；`apps/backend/*` 仍只能通过 facade 调用，不得直接重建 JSON 子流程。

## 3. Bundle 结构

核心结构：

```ts
type DataReportJsonBundle = {
  version: 'data-report-json.v1';
  targetProject: string;
  page: {
    routePath: string;
    pageDir: string;
    titleI18nKey: string;
    mode: 'single' | 'tabs' | 'dashboard';
  };
  shared: {
    searchParams: DataReportJsonBundleField[];
    defaultParams: Record<string, unknown>;
    formatters: DataReportJsonBundleFormatter[];
  };
  reports: DataReportJsonBundleReport[];
  files: DataReportJsonBundleFilePlan[];
  checks: string[];
};
```

`reports` 是并发生成的主要边界。多报表任务应先生成全局 `page/shared`，再对每个 report 并发生成 `service/dataModel/metrics/charts/tables/components`，最后统一进入 assembly/review。

## 4. 前端输出约定

当前 renderer 输出 `gosh_admin_fe` 既有 `dataDashboard` 风格：

- `src/pages/dataDashboard/<reportName>/config.tsx`
- `src/pages/dataDashboard/<reportName>/index.tsx`
- `src/pages/dataDashboard/<reportName>/components/<ReportComponent>/index.tsx`
- `src/services/data/<reportName>.ts`
- `src/types/data/<reportName>.ts`

renderer 只负责确定性文件内容生成，不负责实际写盘、不直接修改 `gosh_admin_fe`、不执行前端验证。

## 5. 真实宿主与 bundle-first 收口

这轮 bundle-first 的真实宿主已经明确分层，不建议再把主链路写回 service 胶水：

- `agents/data-report`
  - 负责 bundle-first 的 graph / flow / prompt / schema 编排
  - 负责把 `schema_ready.bundle`、`done.bundle` 和编辑态 `currentBundle` 串成稳定生成链
- `packages/report-kit`
  - 负责 JSON bundle 到前端文件计划的确定性渲染与 materialization
  - 负责 blueprint / scaffold / assembly / writer 的真实宿主
- `apps/backend/agent-server`
  - 只做 HTTP/SSE/鉴权/运行时装配
  - 只通过 `runtime/core/runtime-data-report-facade.ts` 和聊天侧兼容入口触达 bundle 能力
  - 不应在 service 内直接重建 bundle 子流程，也不应把 patch / schema / render 逻辑散在 controller
  - 不应再为 `schema_ready`、`schema_partial` 或 `done` 做 schema->bundle 兼容投影
- `gosh_admin_fe`
  - 只消费 `currentBundle` 与 `schema_ready.bundle` / `done.bundle`
  - 前端对单 document 的兼容投影只能作为显示层兜底，不应反向成为协议来源

如果后续 bundle-first 再扩展，优先改这三处：

1. `agents/data-report` 的 schema / contract / flow / prompt
2. `packages/report-kit` 的 renderer / writer
3. backend facade 与聊天侧兼容入口

## 6. 回归要求

改动本链路时至少覆盖：

- `DataReportJsonBundleSchema.parse` 成功与失败路径
- `renderDataReportJsonBundleFiles` 的文件路径、数量、关键内容
- `packages/report-kit` root export 与 facade export 是否仍指向真实宿主
- `gosh_admin_fe` 的 `ReportCopilot` bundle 合并、`currentBundle` 续接、`schema_ready.bundle`/`done.bundle` 消费路径

## 7. 最小验证矩阵

### 7.1 本轮可验证项

`learning-agent-core`：

- `pnpm check:docs`
  - 只验证本轮文档改动
  - 适合当前只更新 bundle-first 说明、不碰主实现的场景

如果需要顺手做 bundle-first 代码侧的定点回归，再补：

- `pnpm exec vitest run packages/report-kit/test/data-report-json-renderer.test.ts`
- `pnpm exec vitest run agents/data-report/test/data-report-planning-and-json-schemas.test.ts`
- `pnpm exec vitest run agents/data-report/test/report-bundle-generate-flow.test.ts agents/data-report/test/report-bundle-edit-flow.test.ts`
- `pnpm exec vitest run apps/backend/agent-server/test/chat/chat.report-bundle-compat.spec.ts`

`gosh_admin_fe`：

- `pnpm exec vitest run src/components/ReportCopilot/utils.test.ts`
- `pnpm exec tsc -p tsconfig.json --noEmit`

### 7.2 已知历史红灯

`learning-agent-core`：

- 根级 `pnpm verify` 当前已有仓库历史红灯，不应把它当成本轮文档改动的阻断结论
- 这轮优先以 `pnpm check:docs` 收口；若要做代码验证，建议只跑上面列出的 bundle-first 定点测试，而不是直接把整仓 `verify` 当作本轮门槛

`gosh_admin_fe`：

- 仓库当前有一批既有未提交改动，且我这轮没有修改它的主实现文件
- 因为工作区并不干净，`gosh_admin_fe` 这边的整包验证应视为“可选补充”，不应和本轮文档收口混为一谈
