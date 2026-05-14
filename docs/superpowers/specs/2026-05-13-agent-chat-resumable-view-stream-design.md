# Agent Chat Resumable View Stream Design

状态：draft
文档类型：spec
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-chat`、`packages/core`
最后核对：2026-05-13
创建日期：2026-05-13

## 1. 背景

`vercel/chatbot` 的最新模板展示了几类值得借鉴的聊天体验能力：统一 UI message stream、工具执行中间态、artifact 生成过程展示、消息完成后统一落库，以及基于 `resumable-stream` 的断线恢复。

本项目已经有自己的 `Agent Chat Runtime V2`、`ChatViewStreamEvent`、Nest SSE controller、runtime event projection、OpenClaw 前端状态链路和 schema-first contract。直接迁移 `useChat`、AI SDK `UIMessage` 或 Next.js route handler 会让第三方协议穿透到业务层，并削弱当前的审批、checkpoint、恢复、治理审计边界。

因此本设计只迁移 Vercel Chatbot 的产品与协议思想，不迁移其框架边界。

## 2. 目标

- 强化 `/api/chat/view-stream`，让它成为 `agent-chat` 的稳定展示流入口。
- 通过 `seq + afterSeq` 支持刷新、断线、切 tab 后的展示恢复。
- 将工具执行、artifact 中间态、evidence/source 摘要纳入 `ChatViewStreamEvent`，但只暴露项目白名单字段。
- 保持 `ChatEventRecord` 作为事实流与审计来源，`view-stream` 只做 UI 投影。
- 保证取消、pending interaction、终态 close 与自动重连之间语义清晰。

## 3. 非目标

- 不把 `vercel/chatbot` 整体迁入本仓库。
- 不把 `@ai-sdk/react` 的 `useChat` 作为 `agent-chat` 主状态管理入口。
- 不把 AI SDK `UIMessage`、`UIMessageChunk`、tool raw input/output 或 provider raw response 暴露到 `packages/core`。
- 不用 `resumable-stream` 直接替代 `ChatViewStreamEvent` 契约。
- 不在本轮改变旧 `/api/chat/stream` 的事实流兼容职责。
- 不把通用 LLM direct、Sandpack、Report Schema 继续扩进 `/api/chat/*` 主链。

## 4. 方案对比

### 方案 A：强化现有 `seq + afterSeq`

继续使用项目自己的 `ChatViewStreamEvent`，后端为 `sessionId + runId` 保存有序事件，前端用 `lastSeq` 重连补发。

优点：

- 对齐现有 `Agent Chat Runtime V2`。
- 不引入 AI SDK UI protocol 穿透。
- 易于用 `@agent/core` schema-first contract 验证。
- 可以先做内存实现，再替换 Redis 或持久化 repository。

缺点：

- 需要补齐事件存储生命周期与前端幂等逻辑。
- 多进程部署下需要后续接入共享存储或 pub/sub。

### 方案 B：引入 Redis-backed resumable stream

参考 Vercel `resumable-stream`，通过 Redis 协调生产者和多个消费者。

优点：

- 跨 tab、跨实例、多消费者恢复能力更强。
- 更接近 Vercel Chatbot 的现成经验。

缺点：

- 取消语义更复杂，断开连接后 producer 可能继续运行。
- 需要 Redis 依赖、生命周期清理和孤儿流治理。
- 仍需要把 stream chunk 映射为项目自己的 `ChatViewStreamEvent`。

### 方案 C：直接采用 AI SDK UI stream protocol

后端输出 AI SDK data stream，前端使用 `useChat` 消费。

优点：

- 短期 demo 开发快。
- 能直接复用 AI SDK UI 的部分生态。

缺点：

- 会让第三方 UI 协议成为本项目稳定 contract。
- 难以表达当前审批、自然语言 pending interaction、checkpoint、run observability。
- 与 `agent-chat` OpenClaw 主界面和 `@agent/core` schema-first 要求冲突。

推荐采用方案 A，预留方案 B 的 repository/pubsub 扩展点，不采用方案 C。

## 5. 合同设计

正式实现前必须先更新 [Agent Chat Runtime V2 API](/docs/contracts/api/agent-chat-runtime-v2.md)，再更新 `packages/core/src/tasking/schemas/chat-view-stream.ts`。

`ChatViewStreamEvent` 继续采用显式 SSE event：

```text
event: <ChatViewStreamEventType>
data: <ChatViewStreamEvent JSON>
```

每个事件必须包含：

```ts
{
  id: string;
  seq: number;
  sessionId: string;
  runId: string;
  at: string;
  event: ChatViewStreamEventType;
  data: Record<string, unknown>;
}
```

新增或补强的事件：

- `run_status`：run 生命周期变化。
- `fragment_started`：开始一段可展示 fragment。
- `fragment_delta`：追加 fragment 增量。
- `fragment_completed`：校准 fragment 最终内容与状态。
- `tool_execution_started`：工具执行开始，只包含白名单摘要。
- `tool_execution_completed`：工具执行结束，只包含结果摘要、状态、耗时。
- `auto_review_completed`：执行前自动审查结果。
- `interaction_waiting`：等待自然语言确认或补充输入。
- `interaction_resolved`：pending interaction 被用户回复解决。
- `error`：发生的错误。
- `close`：流结束原因。

## 6. 恢复语义

`GET /api/chat/view-stream?sessionId=...&runId=...&afterSeq=...` 的语义固定为：

- 未传 `afterSeq`：发送当前可用的该 run 全量 view events，然后订阅实时事件。
- 传入 `afterSeq=N`：只发送 `seq > N` 的历史事件，然后订阅实时事件。
- 如果 run 已终态，仍补发 `seq > N` 的事件，并最终发送或包含已存在的 `close` 事件。
- 重连只恢复展示，不重新触发 runtime 执行。
- `close.reason = "completed" | "error" | "cancelled" | "idle"` 决定前端是否停止自动恢复。

`seq` 只要求在同一个 `sessionId + runId` 内单调递增。前端必须忽略 `seq <= lastSeq` 的事件。

## 7. 取消与 Pending Interaction

取消和恢复必须分开：

- 用户取消 run 时，后端应取消或标记对应 runtime task、interrupt、pending interaction。
- 取消后 view-stream 必须输出 `run_status` 和 `close.reason = "cancelled"`。
- 前端收到 `cancelled` close 后不得继续自动重连。
- pending interaction 存在时，重连应恢复 `interaction_waiting` 状态，不创建新 run。
- 用户对 pending interaction 的回复仍通过 `POST /api/chat/messages`，并返回 `handledAs = "pending_interaction_reply"`。
- 模糊回复不能放行高风险动作，仍按 `ApprovalReplyIntent` 的置信度和确认短语规则处理。

## 8. 事件存储生命周期

MVP 可以先实现进程内 repository，但必须定义可替换边界：

```ts
interface ChatViewStreamEventRepository {
  append(event: ChatViewStreamEvent): ChatViewStreamEvent;
  list(sessionId: string, runId: string, afterSeq?: number): ChatViewStreamEvent[];
  getLastSeq(sessionId: string, runId: string): number;
  markClosed(sessionId: string, runId: string, closeEvent: ChatViewCloseEvent): ChatViewStreamEvent;
}
```

约束：

- repository 是 view projection 存储，不是审计事实源。
- `append` 对同一 `id` 必须幂等，并返回 repository 内的 canonical event，避免多客户端订阅时同一源事件被重复分配或重复发送。
- service 在 `list` 与 `subscribe` 前必须从 `ChatEventRecord` 做 lazy backfill；`afterSeq` 只过滤投递范围，不能参与新事件 `seq` 分配。
- 长期事实仍来自 `ChatEventRecord`、checkpoint 和 runtime observability。
- 事件至少保留到 run 终态后一段可配置窗口。
- 后续 Redis 或数据库实现只能替换 repository，不应改变 controller、core schema 或前端协议。

## 9. 幂等与内容校准

前端 reducer 必须遵守：

- 所有事件先按 `seq` 去重，`seq <= lastSeq` 直接忽略。
- `fragment_delta` 只对未见过事件追加。
- `fragment_completed` 可以覆盖 fragment 最终内容，用于校准丢 token、重复 token 或服务端修正。
- 同一个 `fragmentId` 必须绑定稳定 `messageId` 和 `kind`。
- 正式 assistant message 落库后，临时 streaming fragment 不应生成重复主消息。
- `error` 不等于 `close`；收到 recoverable error 可以重连，收到终态 close 必须停止。

## 10. 工具与 Artifact 白名单

可进入 view-stream 的字段：

- `toolName`
- `toolDisplayName`
- `stage`
- `status`
- `riskLevel`
- `userFacingSummary`
- `artifactId`
- `artifactKind`
- `artifactTitle`
- `elapsedMs`
- `references`
- 脱敏后的公开结果摘要

禁止进入 view-stream 的字段：

- raw tool input
- 完整 stdout/stderr
- 第三方 provider raw response
- 凭据、token、cookie、secret ref 明文
- 未脱敏文件路径或用户隐私数据
- 可能诱导前端执行动作的未审查命令 payload

工具执行相关事件只服务 UI 展示，真实执行权限仍由 runtime、审批门和后端 service 控制。

## 11. 观测与调试

后端应记录：

- stream open / close
- `sessionId`、`runId`、`afterSeq`
- 补发事件数量
- 当前 last seq
- close reason
- invalid event projection error

前端应记录或暴露：

- invalid event count
- reconnect count
- lastSeq
- final close reason
- duplicate event ignored count

后续可在 `agent-admin` Runtime Center 展示 active streams、failed streams、reconnect rate，但本设计不要求首轮实现后台页面。

## 12. 验证策略

Contract / Spec：

- `packages/core/test/chat-runtime-v2-contracts.test.ts` 覆盖新增事件 schema。
- SSE payload parse 测试覆盖 `event:` + JSON envelope。

Backend Unit：

- repository `append/list/getLastSeq/markClosed`。
- service `afterSeq` 补发。
- projection adapter 对 assistant token、tool、interrupt、final response 的映射。

Frontend Unit：

- reducer 忽略重复 `seq`。
- 断线后用 `lastSeq` 续接。
- `fragment_completed` 校准最终正文。
- `close.cancelled` 停止自动恢复。
- `interaction_waiting` 恢复 pending 状态。

Integration / Demo：

- 正常流式回答。
- 回答中刷新页面后继续展示。
- 断线后按 `afterSeq` 补发，不重复 token。
- 取消 run 后不自动恢复。
- 工具执行中等待用户确认，刷新后仍显示 pending interaction。
- run 完成后重连只恢复终态，不重新执行。

## 13. 文档影响

必须更新：

- `/docs/contracts/api/agent-chat-runtime-v2.md`
- 必要时更新 `/docs/integration/frontend-backend-integration.md`
- 必要时更新 `/docs/conventions/frontend-conventions.md`

交付前必须围绕关键词 `view-stream`、`afterSeq`、`assistant_token`、`resumable`、`EventSource`、`/api/chat/stream` 扫描 `docs/**`、模块 README 与 `AGENTS.md`，清理与新入口冲突的旧说明。

## 14. 成功标准

- 新增和修改的 view-stream event 都有 `@agent/core` schema 和 contract tests。
- 前端刷新或断线后可以通过 `afterSeq` 恢复展示，不重复 assistant token。
- 取消 run 后不会自动恢复或重新执行。
- pending interaction 在重连后仍保持等待态。
- 工具执行中间态可展示，但不泄露 raw tool payload 或第三方原始响应。
- 旧 `/api/chat/stream` 保持兼容，不作为新 UI 展示能力的扩展入口。
- 文档、schema、后端、前端、测试按同一份 contract 收敛。
