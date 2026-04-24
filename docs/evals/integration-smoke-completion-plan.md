# Integration / Smoke 完成计划

状态：snapshot
文档类型：plan
适用范围：`test/integration/`、`test/smoke/`、workspace 验证入口
最后更新：2026-04-23
最后核对：2026-04-23

## 1. 当前结论

workspace integration 与 workspace smoke 已经接入根级验证入口，但它们不是完整 E2E。当前正确定位是：

- `test/integration/`：跨包、跨宿主、跨链路的自动化协同验证。
- `test/smoke/`：证明关键入口仍可启动、可加载或可完成最小闭环。
- 不覆盖真实第三方服务、真实 LLM、真实浏览器 profile、真实持久化数据库。
- 若后续需要真实浏览器或真实网络验收，应新增 guarded acceptance 层，不要把脆弱外部依赖直接塞进阻塞 smoke。

## 2. 当前覆盖矩阵

| 链路                             | 当前测试                                                                  | 状态          | 说明                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------- |
| core -> runtime contract         | `test/integration/packages/core-to-runtime-contract.int-spec.ts`          | 已覆盖        | 覆盖稳定 schema 与 runtime 消费契约。                                                                                 |
| platform-runtime agent assembly  | `test/integration/packages/platform-runtime-agent-assembly.int-spec.ts`   | 已覆盖        | 覆盖官方 agent 装配与公开 facade。                                                                                    |
| runtime main chain contract      | `test/integration/runtime/runtime-main-chain.int-spec.ts`                 | 浅覆盖        | 主要验证 descriptor、preset、factory 出口。                                                                           |
| runtime graph execution          | `test/integration/runtime/runtime-graph-execution.int-spec.ts`            | 已补 baseline | 覆盖 main graph、approval recovery graph、learning graph 最小 invoke。                                                |
| approval / recover contract      | `test/integration/runtime/approval-recover-contract.int-spec.ts`          | 已覆盖        | 偏 schema 与 scope policy。                                                                                           |
| approval recovery state machine  | `test/integration/runtime/approval-recover-state-machine.int-spec.ts`     | 已补 baseline | 覆盖 approve -> execute -> finish 与 reject feedback recover 输入。                                                   |
| approval card actions            | `test/integration/frontend-backend/approval-card-actions.int-spec.ts`     | 已补 baseline | 覆盖 approve、reject with feedback、cancel、recover、recover-to-checkpoint 的 backend contract 与 frontend 状态投影。 |
| learning confirmation            | `test/integration/runtime/learning-confirmation.int-spec.ts`              | 已补 baseline | 覆盖 learning graph 最小确认路径。                                                                                    |
| SSE payload contract             | `test/integration/frontend-backend/sse-payload-contract.int-spec.ts`      | 已覆盖        | 覆盖 core chat event payload contract。                                                                               |
| Chat SSE merge                   | `test/integration/frontend-backend/chat-session-stream-merge.int-spec.ts` | 已补 baseline | 覆盖 token/final/terminal event 与 frontend message/checkpoint merge。                                                |
| Chat submit SSE lifecycle        | `test/integration/frontend-backend/chat-submit-sse-lifecycle.int-spec.ts` | 已补 baseline | 覆盖 backend stream event -> core schema -> frontend session/message/checkpoint lifecycle。                           |
| Backend SSE controller           | `test/integration/backend/chat-sse-controller.int-spec.ts`                | 已补 baseline | 覆盖 controller SSE header、historical replay、live token。                                                           |
| Backend startup smoke            | `test/smoke/backend/backend-startup.smoke.ts`                             | 浅覆盖        | 直接实例化 service，不启动 HTTP app。                                                                                 |
| Backend module smoke             | `test/smoke/backend/backend-module.smoke.ts`                              | 浅覆盖        | 验证 Nest module metadata。                                                                                           |
| Backend HTTP app smoke           | `test/smoke/backend/backend-http-app.smoke.ts`                            | 已补 baseline | 真实创建 Nest app 并通过 `/health` HTTP contract。                                                                    |
| agent-chat workspace smoke       | `test/smoke/apps/agent-chat-workspace.smoke.ts`                           | 已补 baseline | 覆盖 OpenClaw workspace helper、approvals、evidence、learning、skill reuse projection。                               |
| agent-admin dashboard smoke      | `test/smoke/apps/agent-admin-dashboard.smoke.ts`                          | 已覆盖        | 覆盖六大中心 dashboard title contract。                                                                               |
| agent-admin centers smoke        | `test/smoke/apps/agent-admin-centers.smoke.ts`                            | 已补 baseline | 覆盖六大中心 panel module import 与轻量 projection helper。                                                           |
| package public entrypoints smoke | `test/smoke/packages/package-public-entrypoints.smoke.ts`                 | 已覆盖        | 覆盖 packages 根入口可加载。                                                                                          |

## 3. 尚未完成的深覆盖缺口

以下内容仍不是当前 baseline 的完成范围，后续继续补齐时优先处理：

- `agent-chat -> backend -> runtime -> SSE -> frontend` 当前是 controller/mock lifecycle，不是真实 HTTP submit + runtime task 全链路。
- `approval / reject / recover / cancel` 当前覆盖 controller contract 与 frontend projection，尚未覆盖真实 RuntimeSessionService repository 状态持久化。
- runtime 主链当前有最小 graph invoke，尚未覆盖 evidence、learning suggestion、skill reuse badge 的完整真实状态生成。
- `agent-admin` 当前 smoke 能证明六大中心模块可加载，尚未覆盖全部中心的真实 API adapter + platform-runtime 聚合 DTO。
- backend HTTP smoke 需要本地端口监听权限；沙箱环境会因 `listen EPERM` 阻断，应在正常本地或 CI 环境执行。

## 4. 后续完成顺序

1. 先补 runtime evidence / learning / skill reuse graph integration。
2. 再补 RuntimeSessionService 持久化层的 approval recover lifecycle integration。
3. 再补 agent-admin 六大中心的 platform-runtime 聚合 contract integration。
4. 最后评估是否新增 guarded `test/acceptance/`，承载真实浏览器或真实后端进程验收。

## 5. 固定验证入口

本计划相关的最小验证入口：

```bash
pnpm test:workspace:integration
pnpm test:workspace:smoke
pnpm check:docs
```

全量收口仍以根级入口为准：

```bash
pnpm verify
```
