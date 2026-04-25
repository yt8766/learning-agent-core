# 前后端集成链路

状态：current
文档类型：integration
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-chat`、`apps/frontend/agent-admin`
最后核对：2026-04-25

本文只说明前后端如何协作调用。API 契约主入口是 [docs/api/README.md](/docs/api/README.md)。

本主题主文档：

- API 契约以 [docs/api/README.md](/docs/api/README.md) 为准
- 本文是前后端集成链路说明，不承载完整接口字段

本文只覆盖：

- 前后端调用顺序
- SSE、checkpoint 与历史补拉的协作关系
- `agent-chat` 与 `agent-admin` 的跨端职责边界
- API 文档与 integration 文档的总分关系

## 接口文档先行

前后端新增或修改联调能力时，顺序固定为：

1. 先更新 [docs/api](/docs/api/README.md) 中的接口契约。
2. 再落 schema / contract。
3. 再分别实现后端与前端。
4. 最后做联调、验证与文档回写。

接口风格选择以 [docs/api/interface-style-guidelines.md](/docs/api/interface-style-guidelines.md) 为准。

涉及 API、SSE、checkpoint payload、审批事件、runtime center DTO、admin center 聚合返回、导出字段或其他跨端接口时，不允许先按实现猜字段再补文档。

## API 入口

- 聊天、会话与 SSE：[agent-chat.md](/docs/api/agent-chat.md)
- Admin 控制台聚合：[agent-admin.md](/docs/api/agent-admin.md)
- Runtime Center：[runtime.md](/docs/api/runtime.md)
- Approvals 与恢复：[approvals.md](/docs/api/approvals.md)
- Run Observatory：[run-observatory.md](/docs/api/run-observatory.md)

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

## Admin 链路

`agent-admin` 不把 `/platform/console-shell` 当作所有页面详情来源。

- 首页和 `refreshAll` 优先读 shell。
- Runtime 页面读 Runtime Center。
- Approvals 页面读 Approvals Center。
- Run 详情读 Run Observatory detail。
- Console diagnostics 只做观测展示，不驱动业务状态。

## 命名与兼容

- 新运行语义优先使用 `supervisor / ministry / workflow / evidence / learning`。
- 旧 `manager / research / executor / reviewer` 事件只作兼容背景。
- 审批恢复优先使用 `interrupt_*` 事件；`approval_*` 只作 legacy fallback。
- 前端不应从 raw task dump 自行推导 observability、approval 或 runtime 状态。

## 联调建议

1. 启动 backend：`pnpm --dir apps/backend/agent-server start:dev`
2. 启动目标前端。
3. 先用 [docs/api](/docs/api/README.md) 核对路径、参数和响应。
4. 再按本文检查调用顺序、SSE 兜底和 center 粒度。
