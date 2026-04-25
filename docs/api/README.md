# API 文档目录

状态：current
文档类型：index
适用范围：`docs/api/`
最后核对：2026-04-25

本目录是前后端 API 契约的唯一主入口。后端按这里实现接口，前端按这里接入接口；跨模块调用时序和联调背景放在 [integration](/docs/integration/README.md)。

本目录主文档：

- 接口风格选择：`interface-style-guidelines.md`
- 聊天 API：[agent-chat.md](/docs/api/agent-chat.md)
- Admin API：[agent-admin.md](/docs/api/agent-admin.md)
- Runtime API：[runtime.md](/docs/api/runtime.md)
- Approvals API：[approvals.md](/docs/api/approvals.md)
- Run Observatory API：[run-observatory.md](/docs/api/run-observatory.md)

## 阅读顺序

1. `interface-style-guidelines.md`
2. [agent-chat.md](/docs/api/agent-chat.md)
3. [agent-admin.md](/docs/api/agent-admin.md)
4. [runtime.md](/docs/api/runtime.md)
5. [approvals.md](/docs/api/approvals.md)
6. [run-observatory.md](/docs/api/run-observatory.md)

## 维护规则

- 新增或修改 API、SSE event、DTO、审批事件、checkpoint payload 或跨端字段前，先更新本目录对应文档。
- 稳定 JSON 契约必须与 `packages/core` 或真实宿主的 `schemas/`、`contracts/` 保持一致。
- `docs/api/*` 只写接口契约：入口、参数、响应或事件、错误语义、兼容规则、前后端职责。
- `docs/integration/*` 只写链路说明：调用顺序、跨模块协作、联调排障和历史背景。
- 不在多个文档重复维护同一接口字段；需要背景说明时，从 integration 链接回本目录。

## 文档归属

- `agent-chat.md`：`apps/frontend/agent-chat` 消费的聊天、会话、SSE 与 direct reply 接口。
- `agent-admin.md`：`apps/frontend/agent-admin` 的控制台聚合入口和刷新语义。
- `runtime.md`：Runtime Center 查询、导出与筛选契约。
- `approvals.md`：Approvals Center、聊天审批动作、恢复与 interrupt 兼容契约。
- `run-observatory.md`：workflow catalog、run list/detail 与 observability 投影契约。
