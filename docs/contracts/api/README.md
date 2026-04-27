# API 文档目录

状态：current
文档类型：index
适用范围：`docs/contracts/api/`
最后核对：2026-04-26

本目录是前后端 API 契约的唯一主入口。后端按这里实现接口，前端按这里接入接口；跨模块调用时序和联调背景放在 [integration](/docs/integration/README.md)。

本目录主文档：

- 接口风格选择：[interface-style-guidelines.md](/docs/contracts/api/interface-style-guidelines.md)
- 聊天 API：[agent-chat.md](/docs/contracts/api/agent-chat.md)
- Admin API：[agent-admin.md](/docs/contracts/api/agent-admin.md)
- Runtime API：[runtime.md](/docs/contracts/api/runtime.md)
- Approvals API：[approvals.md](/docs/contracts/api/approvals.md)
- Run Observatory API：[run-observatory.md](/docs/contracts/api/run-observatory.md)
- Agent Tool Execution API：[tool-execution.md](/docs/contracts/api/tool-execution.md)
- Sandbox API：[sandbox.md](/docs/contracts/api/sandbox.md)
- Auto Review API：[auto-review.md](/docs/contracts/api/auto-review.md)
- Execution Fabric API：[execution-fabric.md](/docs/contracts/api/execution-fabric.md)；`/api/execution/*` 是 planned governance / projection endpoint，当前真实工具执行入口仍是 `/api/agent-tools/*`。
- Task Trajectory API：[task-trajectory.md](/docs/contracts/api/task-trajectory.md)
- Agent Workspace API：[agent-workspace.md](/docs/contracts/api/agent-workspace.md)；`/api/platform/workspace-center` 是 Workspace Vault + Skill Flywheel MVP projection endpoint，覆盖 workspace summary 和 skill draft list / approve / reject。

## 阅读顺序

1. [interface-style-guidelines.md](/docs/contracts/api/interface-style-guidelines.md)
2. [agent-chat.md](/docs/contracts/api/agent-chat.md)
3. [agent-admin.md](/docs/contracts/api/agent-admin.md)
4. [runtime.md](/docs/contracts/api/runtime.md)
5. [approvals.md](/docs/contracts/api/approvals.md)
6. [run-observatory.md](/docs/contracts/api/run-observatory.md)
7. [execution-fabric.md](/docs/contracts/api/execution-fabric.md)
8. [task-trajectory.md](/docs/contracts/api/task-trajectory.md)
9. [agent-workspace.md](/docs/contracts/api/agent-workspace.md)
10. [tool-execution.md](/docs/contracts/api/tool-execution.md)
11. [sandbox.md](/docs/contracts/api/sandbox.md)
12. [auto-review.md](/docs/contracts/api/auto-review.md)

## 工具执行治理 API 关系

`tool-execution.md`、`sandbox.md` 与 `auto-review.md` 是同一条工具执行治理链路的三个稳定接口面，不是三套互相替代的入口。`execution-fabric.md` 记录 planned `/api/execution/*` governance / projection endpoint，与当前 `/api/agent-tools/*` 工具执行入口共享 canonical schema 背景，但不是第二套已落地执行入口。

| 文档                                                       | 稳定入口             | 负责内容                                                                | 与另外两份文档的关系                                                                                                       |
| ---------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [tool-execution.md](/docs/contracts/api/tool-execution.md) | `/api/agent-tools/*` | 创建工具执行 request、策略判定、排队、审批恢复、结果与治理 projection。 | 主入口。创建 request 后调用 sandbox preflight；低风险可执行路径再调用 auto review。SSE / projection 只暴露白名单治理字段。 |
| [sandbox.md](/docs/contracts/api/sandbox.md)               | `/api/sandbox/*`     | profile、permission scope、preflight、受控执行 run、sandbox 审批恢复。  | 安全边界。通常由 agent-tools 在执行前调用；直接调用只用于治理、预检、contract 回归或 sandbox run 查询。                    |
| [auto-review.md](/docs/contracts/api/auto-review.md)       | `/api/auto-review/*` | 结构化 review、finding、verdict、阻断与审查审批恢复。                   | 审查门。通常由 agent-tools 在 sandbox allow 后创建；block verdict 通过 agent-tools 统一审批恢复。                          |

跨端事件仍统一落到 `ChatEventRecord`。其中 agent tool 相关 SSE payload 的治理字段必须是白名单：允许 `requestId`、`sandboxRunId`、`sandboxDecision`、`sandboxProfile`、`autoReviewId`、`autoReviewVerdict`、`reviewId`、`verdict`、`findingCount` 等可展示摘要；不得透传 `input`、`rawInput`、`rawOutput`、完整 `metadata`、vendor/provider 原始对象或第三方 response。

## 前后端开发入口

后端开发先按本文档确认入口边界，再落实现到真实宿主：

| 能力                 | 后端入口                                      | 前端消费入口                                                                                                                        | 回归入口                                                                                                                 |
| -------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Agent Tool Execution | `apps/backend/agent-server/src/agent-tools/*` | `apps/frontend/agent-chat` 的工具执行 projection helper；`apps/frontend/agent-admin` 的 runtime / observability projection helper。 | `test/integration/frontend-backend/sse-payload-contract.int-spec.ts` 与 agent-tools facade/service/controller 相关测试。 |
| Sandbox              | `apps/backend/agent-server/src/sandbox/*`     | `apps/frontend/agent-admin` sandbox API facade；chat 侧通过 SSE / checkpoint / agent-tools projection 消费状态。                    | sandbox service/controller/repository 测试与 SSE payload contract 白名单断言。                                           |
| Auto Review          | `apps/backend/agent-server/src/auto-review/*` | `apps/frontend/agent-admin` auto review API facade；chat 侧通过 `review_completed` 与 interrupt 事件展示。                          | auto-review service/controller/repository 测试与 SSE payload contract 白名单断言。                                       |

如果新增字段会进入前端、checkpoint、SSE、tool result 或治理 projection，必须先更新对应 API 文档与 schema/contract 回归，再同步前后端实现。仅内部 executor、provider 或 reviewer 私有字段不得直接穿透到这些入口。

## 维护规则

- 新增或修改 API、SSE event、DTO、审批事件、checkpoint payload 或跨端字段前，先更新本目录对应文档。
- 稳定 JSON 契约必须与 `packages/core` 或真实宿主的 `schemas/`、`contracts/` 保持一致。
- `docs/contracts/api/*` 只写接口契约：入口、参数、响应或事件、错误语义、兼容规则、前后端职责。
- `docs/integration/*` 只写链路说明：调用顺序、跨模块协作、联调排障和历史背景。
- 不在多个文档重复维护同一接口字段；需要背景说明时，从 integration 链接回本目录。

## 文档归属

- `agent-chat.md`：`apps/frontend/agent-chat` 消费的聊天、会话、SSE 与 direct reply 接口。
- `agent-admin.md`：`apps/frontend/agent-admin` 的控制台聚合入口和刷新语义。
- `runtime.md`：Runtime Center 查询、导出与筛选契约。
- `approvals.md`：Approvals Center、聊天审批动作、恢复与 interrupt 兼容契约。
- `run-observatory.md`：workflow catalog、run list/detail 与 observability 投影契约。
- `tool-execution.md`：Agent Tool 执行请求、策略判定、SSE、审批恢复与错误语义。
- `sandbox.md`：sandbox profile、preflight、run 状态、审批恢复与权限边界。
- `auto-review.md`：自动审查请求、finding、verdict、阻断恢复与前后端职责。
- `execution-fabric.md`：执行节点、能力、策略判定、执行请求与结果投影契约；引用 `@agent/core` canonical schemas，不重复定义字段。
- `task-trajectory.md`：任务轨迹、轨迹步骤、轨迹产物与 replay 状态投影契约；引用 `@agent/core` canonical schemas，不重复定义字段。
- `agent-workspace.md`：Workspace current / summary、task learning summary projection 与 skill draft list / detail / approve / reject 契约；MVP 不包含 Heartbeat、Gateway、Memory CRUD、Rule CRUD 或 skill install。
