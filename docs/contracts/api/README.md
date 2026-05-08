# API 文档目录

状态：current
文档类型：index
适用范围：`docs/contracts/api/`
最后核对：2026-05-05

本目录是前后端 API 契约的唯一主入口。后端按这里实现接口，前端按这里接入接口；跨模块调用时序和联调背景放在 [integration](/docs/integration/README.md)。

本目录主文档：

- 接口风格选择：[interface-style-guidelines.md](/docs/contracts/api/interface-style-guidelines.md)
- 聊天 API：[agent-chat.md](/docs/contracts/api/agent-chat.md)
- Agent Chat Runtime V2 API：[agent-chat-runtime-v2.md](/docs/contracts/api/agent-chat-runtime-v2.md)；下一代会话化 Agent 执行协议，覆盖 ChatRun、view-stream、自动审查和自然语言确认。当前已有 schema、run 查询/取消、view-stream、自然语言工具审批 bridge 与前端 composer 引导落地；继续扩展前必须先按本文确认字段。
- Chat 数据模型：[chat-data-model.md](/docs/contracts/api/chat-data-model.md)
- Admin API：[agent-admin.md](/docs/contracts/api/agent-admin.md)
- Auth Service API：[auth.md](/docs/contracts/api/auth.md)
- Admin Auth API：[admin-auth.md](/docs/contracts/api/admin-auth.md)
- Runtime API：[runtime.md](/docs/contracts/api/runtime.md)
- Knowledge API：[knowledge.md](/docs/contracts/api/knowledge.md)
- Knowledge Ingestion API：[knowledge-ingestion.md](/docs/contracts/api/knowledge-ingestion.md)
- Knowledge Admin Governance API：[knowledge-admin-governance.md](/docs/contracts/api/knowledge-admin-governance.md)
- Approvals API：[approvals.md](/docs/contracts/api/approvals.md)
- Run Observatory API：[run-observatory.md](/docs/contracts/api/run-observatory.md)
- Agent Tool Execution API：[tool-execution.md](/docs/contracts/api/tool-execution.md)
- Sandbox API：[sandbox.md](/docs/contracts/api/sandbox.md)
- Auto Review API：[auto-review.md](/docs/contracts/api/auto-review.md)
- Execution Fabric API：[execution-fabric.md](/docs/contracts/api/execution-fabric.md)；`/api/execution/*` 是 planned governance / projection endpoint，当前真实工具执行入口仍是 `/api/agent-tools/*`。
- Task Trajectory API：[task-trajectory.md](/docs/contracts/api/task-trajectory.md)
- Agent Workspace API：[agent-workspace.md](/docs/contracts/api/agent-workspace.md)；`/api/platform/workspace-center` 是 Workspace Vault + Skill Flywheel MVP projection endpoint，覆盖 workspace summary 和 skill draft list / approve / reject。
- Agent Gateway API：[agent-gateway.md](/docs/contracts/api/agent-gateway.md)；Agent Gateway Console 契约，已落 `@agent/core` schema、双 token auth、Provider/Auth File/Quota/Logs/Usage/Probe、token / preprocess / accounting 后端入口与独立中转前端骨架，真实 relay、OAuth 写链路与持久化配置仍按契约扩展。

## 阅读顺序

1. [interface-style-guidelines.md](/docs/contracts/api/interface-style-guidelines.md)
2. [agent-chat.md](/docs/contracts/api/agent-chat.md)
3. [agent-chat-runtime-v2.md](/docs/contracts/api/agent-chat-runtime-v2.md)
4. [chat-data-model.md](/docs/contracts/api/chat-data-model.md)
5. [agent-admin.md](/docs/contracts/api/agent-admin.md)
6. [auth.md](/docs/contracts/api/auth.md)
7. [admin-auth.md](/docs/contracts/api/admin-auth.md)
8. [runtime.md](/docs/contracts/api/runtime.md)
9. [knowledge.md](/docs/contracts/api/knowledge.md)
10. [knowledge-ingestion.md](/docs/contracts/api/knowledge-ingestion.md)
11. [knowledge-admin-governance.md](/docs/contracts/api/knowledge-admin-governance.md)
12. [approvals.md](/docs/contracts/api/approvals.md)
13. [run-observatory.md](/docs/contracts/api/run-observatory.md)
14. [execution-fabric.md](/docs/contracts/api/execution-fabric.md)
15. [task-trajectory.md](/docs/contracts/api/task-trajectory.md)
16. [agent-workspace.md](/docs/contracts/api/agent-workspace.md)
17. [agent-gateway.md](/docs/contracts/api/agent-gateway.md)
18. [tool-execution.md](/docs/contracts/api/tool-execution.md)
19. [sandbox.md](/docs/contracts/api/sandbox.md)
20. [auto-review.md](/docs/contracts/api/auto-review.md)

## 工具执行治理 API 关系

`tool-execution.md`、`sandbox.md` 与 `auto-review.md` 是同一条工具执行治理链路的三个稳定接口面，不是三套互相替代的入口。`execution-fabric.md` 记录 planned `/api/execution/*` governance / projection endpoint，与当前 `/api/agent-tools/*` 工具执行入口共享 canonical schema 背景，但不是第二套已落地执行入口。

| 文档                                                       | 稳定入口             | 负责内容                                                                | 与另外两份文档的关系                                                                                                       |
| ---------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [tool-execution.md](/docs/contracts/api/tool-execution.md) | `/api/agent-tools/*` | 创建工具执行 request、策略判定、排队、审批恢复、结果与治理 projection。 | 主入口。创建 request 后调用 sandbox preflight；低风险可执行路径再调用 auto review。SSE / projection 只暴露白名单治理字段。 |
| [sandbox.md](/docs/contracts/api/sandbox.md)               | `/api/sandbox/*`     | profile、permission scope、preflight、受控执行 run、sandbox 审批恢复。  | 安全边界。通常由 agent-tools 在执行前调用；直接调用只用于治理、预检、contract 回归或 sandbox run 查询。                    |
| [auto-review.md](/docs/contracts/api/auto-review.md)       | `/api/auto-review/*` | 结构化 review、finding、verdict、阻断与审查审批恢复。                   | 审查门。通常由 agent-tools 在 sandbox allow 后创建；block verdict 通过 agent-tools 统一审批恢复。                          |

跨端事件仍统一落到 `ChatEventRecord`。其中 agent tool 相关 SSE payload、`/api/agent-tools/events` 与 `/api/agent-tools/projection.events` 的治理字段必须是白名单：允许 `requestId`、`sandboxRunId`、`sandboxDecision`、`sandboxProfile`、`reviewId`、`autoReviewId`、`autoReviewVerdict`、`verdict`、`findingCount` 等可展示摘要；`reviewId` 是 auto-review 规范关联字段，`autoReviewId` 仅作历史兼容字段；不得透传 `input`、`rawInput`、`rawOutput`、完整 `metadata`、vendor/provider 原始对象或第三方 response。

## 前后端开发入口

后端开发先按本文档确认入口边界，再落实现到真实宿主：

| 能力                 | 后端入口                                      | 前端消费入口                                                                                                                        | 回归入口                                                                                                                 |
| -------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Agent Tool Execution | `apps/backend/agent-server/src/agent-tools/*` | `apps/frontend/agent-chat` 的工具执行 projection helper；`apps/frontend/agent-admin` 的 runtime / observability projection helper。 | `test/integration/frontend-backend/sse-payload-contract.int-spec.ts` 与 agent-tools facade/service/controller 相关测试。 |
| Sandbox              | `apps/backend/agent-server/src/sandbox/*`     | `apps/frontend/agent-admin` sandbox API facade；chat 侧通过 SSE / checkpoint / agent-tools projection 消费状态。                    | sandbox service/controller/repository 测试与 SSE payload contract 白名单断言。                                           |
| Auto Review          | `apps/backend/agent-server/src/auto-review/*` | `apps/frontend/agent-admin` auto review API facade；chat 侧通过 `review_completed` 与 interrupt 事件展示。                          | auto-review service/controller/repository 测试与 SSE payload contract 白名单断言。                                       |

如果新增字段会进入前端、checkpoint、SSE、tool result 或治理 projection，必须先更新对应 API 文档与 schema/contract 回归，再同步前后端实现。仅内部 executor、provider 或 reviewer 私有字段不得直接穿透到这些入口。

## 维护规则

- 新增或修改 API、SSE event、DTO、审批事件、checkpoint payload 或跨端字段前，先更新本目录对应文档并确认；前端和后端都必须按同一份 API 文档开发，禁止先实现再倒推协议。
- 稳定 JSON 契约必须与 `packages/core` 或真实宿主的 `schemas/`、`contracts/` 保持一致。
- `docs/contracts/api/*` 只写接口契约：入口、参数、响应或事件、错误语义、兼容规则、前后端职责。
- `docs/integration/*` 只写链路说明：调用顺序、跨模块协作、联调排障和历史背景。
- 不在多个文档重复维护同一接口字段；需要背景说明时，从 integration 链接回本目录。

## 文档归属

- `agent-chat.md`：`apps/frontend/agent-chat` 当前消费的聊天、会话、SSE 与 direct reply 接口。
- `agent-chat-runtime-v2.md`：下一代会话化 Agent 执行协议，规定 `ChatRunRecord`、`ChatMessageFragment`、`ChatViewStreamEvent`、自动审查与自然语言确认；当前已有核心 schema 与最小前后端链路落地，后续扩展必须先以本文为准。
- `chat-data-model.md`：`agent-chat` 前后端交互的完整数据模型契约，含前后端不一致清单与类型来源速查。
- `agent-admin.md`：`apps/frontend/agent-admin` 的控制台聚合入口和刷新语义。
- `auth.md`：`agent-server` Identity domain 的统一登录、用户管理、JWT 双 Token 与权限边界契约；`/api/auth/*` 只作 legacy alias。
- `admin-auth.md`：`agent-server` 历史 admin auth 兼容契约；新增统一登录优先读 `auth.md`。
- `runtime.md`：Runtime Center 查询、导出与筛选契约。
- `knowledge.md`：`apps/frontend/knowledge`、`apps/backend/agent-server/src/domains/knowledge`、legacy internal `apps/backend/agent-server/src/knowledge` 与 `packages/knowledge/client` 的 Knowledge App MVP API 契约；`/api/knowledge/v1/*` 只作 legacy alias。
- `knowledge-ingestion.md`：规范化 source payload 写入统一 source/chunk/receipt snapshot 与 vector 边界的 ingestion 契约。
- `knowledge-admin-governance.md`：`apps/frontend/agent-admin` 消费的知识治理 projection 契约；入口为 `/api/platform/knowledge/governance`，只返回脱敏后的 `KnowledgeGovernanceProjection`。
- `approvals.md`：Approvals Center、聊天审批动作、恢复与 interrupt 兼容契约。
- `run-observatory.md`：workflow catalog、run list/detail 与 observability 投影契约。
- `tool-execution.md`：Agent Tool 执行请求、策略判定、SSE、审批恢复与错误语义。
- `sandbox.md`：sandbox profile、preflight、run 状态、审批恢复与权限边界。
- `auto-review.md`：自动审查请求、finding、verdict、阻断恢复与前后端职责。
- `execution-fabric.md`：执行节点、能力、策略判定、执行请求与结果投影契约；引用 `@agent/core` canonical schemas，不重复定义字段。
- `task-trajectory.md`：任务轨迹、轨迹步骤、轨迹产物与 replay 状态投影契约；引用 `@agent/core` canonical schemas，不重复定义字段。
- `agent-workspace.md`：Workspace current / summary、task learning summary projection 与 skill draft list / detail / approve / reject 契约；MVP 不包含 Heartbeat、Gateway、Memory CRUD、Rule CRUD 或 skill install。
- `agent-gateway.md`：Agent Gateway Console API 契约；从 CLI Proxy 管理中心参考项目提炼 Provider、Auth File、Quota、Logs、OAuth、Config、API Probe 与 invocation pipeline 领域模型，当前第一阶段实现已落 schema-first contract 和中转入口。
