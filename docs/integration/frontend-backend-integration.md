# 前后端集成链路

状态：current
文档类型：integration
适用范围：`apps/backend/agent-server`、`apps/backend/auth-server`、`apps/backend/knowledge-server`、`apps/frontend/agent-chat`、`apps/frontend/agent-admin`、`apps/frontend/knowledge`
最后核对：2026-05-02

本文只说明前后端如何协作调用。API 契约主入口是 [docs/contracts/api/README.md](/docs/contracts/api/README.md)。

本主题主文档：

- API 契约以 [docs/contracts/api/README.md](/docs/contracts/api/README.md) 为准
- 本文是前后端集成链路说明，不承载完整接口字段

本文只覆盖：

- 前后端调用顺序
- SSE、checkpoint 与历史补拉的协作关系
- `agent-chat` 与 `agent-admin` 的跨端职责边界
- API 文档与 integration 文档的总分关系

## 接口文档先行

前后端新增或修改联调能力时，顺序固定为：

1. 先更新 [docs/contracts/api](/docs/contracts/api/README.md) 中的接口契约。
2. 再落 schema / contract。
3. 再分别实现后端与前端。
4. 最后做联调、验证与文档回写。

接口风格选择以 [docs/contracts/api/interface-style-guidelines.md](/docs/contracts/api/interface-style-guidelines.md) 为准。

涉及 API、SSE、checkpoint payload、审批事件、runtime center DTO、admin center 聚合返回、导出字段或其他跨端接口时，不允许先按实现猜字段再补文档。

## API 入口

- Auth Service：[auth.md](/docs/contracts/api/auth.md)
- Knowledge Service：[knowledge.md](/docs/contracts/api/knowledge.md)
- 聊天、会话与 SSE：[agent-chat.md](/docs/contracts/api/agent-chat.md)
- Admin 控制台聚合：[agent-admin.md](/docs/contracts/api/agent-admin.md)
- Runtime Center：[runtime.md](/docs/contracts/api/runtime.md)
- Approvals 与恢复：[approvals.md](/docs/contracts/api/approvals.md)
- Run Observatory：[run-observatory.md](/docs/contracts/api/run-observatory.md)
- Agent Tool 执行：[tool-execution.md](/docs/contracts/api/tool-execution.md)
- Sandbox 预检与状态：[sandbox.md](/docs/contracts/api/sandbox.md)
- Auto Review 审查与阻断：[auto-review.md](/docs/contracts/api/auto-review.md)

## 前端请求层

当前两个前端的常规 HTTP 请求层统一到 `axios + @tanstack/react-query`。

- `agent-chat`：常规请求走 `src/api/*`；聊天流仍使用浏览器 `EventSource`。
- `agent-admin`：控制台和各 center 读取默认经由 react-query 调度。
- SSE、浏览器原生事件源和其他长连接链路不由 react-query 替代。

## Chat 链路

主链路：

1. 前端创建或续接 chat session。
2. 前端通过 `POST /api/chat/messages` 提交用户消息。
3. 后端启动 Runtime / Supervisor / worker 流程。
4. 前端通过 `GET /api/chat/stream?sessionId=...` 接收 SSE。
5. 前端按事件更新消息区、运行态、审批卡和学习确认。

可靠性约定：

- SSE 是首选实时通道。
- `checkpoint` 是运行态兜底。
- `messages / events` 只用于历史恢复与终态校准。
- 断流、idle close 或终态事件缺失时，前端先读 checkpoint 收口，再按需补拉历史。

## Tool / Sandbox / Auto Review 链路

当前已落地的最小实现：

- 后端 `AgentToolsModule` 已接入 `apps/backend/agent-server/src/app.module.ts`，真实 HTTP 路径是 `/api/agent-tools/*`。
- 后端 facade 当前以内存存储 request/result，适合作为前后端联调和 contract 回归入口；request 创建时已最小串联 sandbox preflight，低风险 allow 路径会创建 tool execution auto review，低风险与审批恢复已通过同步 executor queue 边界写出 `queued -> running -> succeeded` 观测语义，真实持久化、异步 worker、真实 sandbox/reviewer runner 和 SSE 广播还未接线。
- `agent-chat` 当前已提供 `src/lib/agent-tool-execution-api.ts` 与 `src/lib/agent-tool-event-projections.ts`，并在 OpenClaw workbench / ThoughtChain 中把 `tool_*`、`execution_step_*`、policy decision 与 `tool_execution` interrupt 事件投影成“工具执行”时间线；projection 补拉优先用当前 task id，缺失时才用 checkpoint task id 兜底。
- `agent-admin` 当前已提供 agent tool execution governance summary helper，以及 sandbox / auto review facade helper；Runtime Summary 的 Requests / Risk / Nodes / Policy / Event Log、Run Workbench 与 Run Observatory 只消费稳定 projection，不从 raw task dump 反推工具状态，并且只展示 sandbox / auto-review 白名单治理 badge。auto-review 关联字段优先使用 `reviewId`，`autoReviewId` 仅作兼容读取。
- `packages/tools` 已提供 local process 与 Docker sandbox provider，Docker provider 默认禁用网络并可通过 runner 注入在测试中验证命令计划。

主链路：

1. Runtime 或专项 Agent 选择工具能力，后端创建 execution request。
2. 后端按 [tool-execution.md](/docs/contracts/api/tool-execution.md) 做 capability / node 匹配和 policy decision。
3. 后端按 [sandbox.md](/docs/contracts/api/sandbox.md) 做 profile、permission scope 和 preflight 判定；`require_approval` 复用 agent-tools 审批入口。
4. sandbox 允许且 request 仍为低风险可执行路径时，后端按 [auto-review.md](/docs/contracts/api/auto-review.md) 创建 review record，并把 `block` verdict 转成 interrupt。
5. `agent-chat` 通过 SSE 展示 `tool_*`、`execution_step_*`、`review_completed` 和 `interrupt_*`；这些 payload 只消费治理白名单字段，auto-review 阻断/恢复用 `reviewId` 关联 review，兼容读取 `autoReviewId`。
6. Task Trajectory 通过既有 SSE 类型投影：单步使用 `execution_step_* + payload.trajectoryStep`，完整快照使用 `node_progress + payload.projection = "task_trajectory"`。后端投影入口是 `chat-trajectory-events.adapter.ts`，前端消费入口是 `chat-trajectory-projections.ts`。
7. 用户审批、拒绝、反馈或补充输入后，前端提交对应 approval resume payload。
8. 后端恢复 request，并在 metadata 存在 `sandboxRunId` / `reviewId ?? autoReviewId` 时同步恢复 sandbox run 或 review；随后把终态写入 checkpoint、events、Run Observatory 和 Admin projection。

边界约定：

- 工具执行、sandbox 和 auto review 的字段契约分别以 API 文档为准，本文只说明联调顺序。
- 新链路优先使用 `interrupt_*` 和 `execution_step_*`；旧 `approval_*` 只作历史 fallback。
- 前端展示不得展开 `metadata`、raw input/output、vendor/provider payload 或第三方 response；历史事件如果携带这些字段，也必须在 projection 边界被过滤。
- `agent-chat` 不直接解释第三方 executor、MCP、终端、浏览器或 reviewer 原始 payload。
- `agent-admin` 不从 raw task dump 推导工具、sandbox 或 review 状态，应消费后端 projection。
- 高风险工具、越权 sandbox 和 block review 都必须进入审批恢复链路。

## Admin 链路

`agent-admin` 不把 `/platform/console-shell` 当作所有页面详情来源。

- 首页和 `refreshAll` 优先读 shell。
- Runtime 页面读 Runtime Center。
- Approvals 页面读 Approvals Center。
- Run 详情读 Run Observatory detail。
- Console diagnostics 只做观测展示，不驱动业务状态。

## Auth / Knowledge Service Split

`agent-admin` 和 `apps/frontend/knowledge` 第一阶段直接调用 `auth-server` 完成登录。`apps/frontend/knowledge` 的知识库业务请求直接调用 `knowledge-server`，并携带 `auth-server` 签发的 Access Token。

```text
agent-admin login -> auth-server /api/auth/login
agent-admin users -> auth-server /api/auth/users
knowledge login -> auth-server /api/auth/login
knowledge bases -> knowledge-server /api/knowledge/bases
```

边界约定：

- `apps/backend/auth-server` 是统一登录、refresh、logout、当前用户和用户管理的 canonical 服务。
- `apps/backend/knowledge-server` 是 `apps/frontend/knowledge` 的 canonical knowledge business API 服务。
- `apps/backend/agent-server/src/knowledge` 只保留 legacy/internal runtime path；前端不要新增到 `/api/knowledge/v1` 的业务调用。
- 知识库权限由 `knowledge-server` 自己的 membership 治理，不从 auth 全局角色直接推导。

默认本地端口：

```text
auth-server      http://127.0.0.1:3010/api
knowledge-server http://127.0.0.1:3020/api
agent-server     http://127.0.0.1:3000/api
```

## 命名与兼容

- 新运行语义优先使用 `supervisor / ministry / workflow / evidence / learning`。
- 旧 `manager / research / executor / reviewer` 事件只作兼容背景。
- 审批恢复优先使用 `interrupt_*` 事件；`approval_*` 只作 legacy fallback。
- 前端不应从 raw task dump 自行推导 observability、approval 或 runtime 状态。

## 联调建议

1. 启动 `auth-server`：`pnpm --dir apps/backend/auth-server start:dev`
2. 启动 `knowledge-server`：`pnpm --dir apps/backend/knowledge-server start:dev`
3. 需要 chat/runtime/admin 旧中心时，再启动 `agent-server`：`pnpm --dir apps/backend/agent-server start:dev`
4. 启动目标前端。
5. 先用 [docs/contracts/api](/docs/contracts/api/README.md) 核对路径、参数和响应。
6. 再按本文检查调用顺序、SSE 兜底和 center 粒度。
