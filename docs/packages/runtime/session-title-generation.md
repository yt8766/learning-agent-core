# Runtime Session Title Generation

状态：current
文档类型：reference
适用范围：`packages/runtime/src/session`
最后核对：2026-05-02

`SessionCoordinator` 负责生成 `agent-chat` 会话标题。标题可以由 runtime 自动摘要，也可以由用户在前端侧栏手动重命名；两者通过 `ChatSessionRecord.titleSource` 区分。

## 当前行为

- 新会话默认标题仍为 `新会话`。
- 新会话会记录 `titleSource: "placeholder"`；自动摘要成功或本地兜底派生后记录 `titleSource: "generated"`。
- 当首条用户消息进入 `appendMessage()` 或 `appendInlineCapabilityResponse()`，且当前标题仍可派生时，runtime 调用 `generateSessionTitleFromSummary()`。
- `generateSessionTitleFromSummary()` 会先请求 `ILLMProvider.generateText()` 生成短摘要标题；该调用是 best-effort，最多等待 1.5 秒，避免标题模型异常导致聊天发送态一直 loading。
- 大模型不可用、未配置、超时、返回空标题、调用失败，或返回内容疑似复述“用户要求 / 生成会话标题 / 必须是”等 prompt 指令时，会回退到 `deriveSessionTitle()` 的本地短标题。
- `deriveSessionTitle()` 对常见首问有确定性兜底，例如“你是谁 / 你是谁，你会做什么”会生成 `能力介绍`，“现在codex是什么 / codex 是什么”会生成 `Codex 介绍`，避免把整句问题或标题生成指令暴露到侧栏。
- 生成标题会写回 `ChatSessionRecord.title`，后续侧栏和会话头只展示该 runtime 标题。
- `PATCH /api/chat/sessions/:id` 用于手动重命名，前端必须传 `titleSource: "manual"`；runtime 收到后锁定标题，后续消息不会触发自动摘要覆盖。

## 约束

- 前端允许手动重命名，但必须走 `PATCH /api/chat/sessions/:id`，不能只改本地侧栏状态。
- 只有 `titleSource` 缺省或为 `placeholder` 且标题仍为空 / `新会话` 时，runtime 才能自动生成标题。
- 标题 prompt 必须要求“摘要而不是照抄原文”，并且 sanitizer 必须拒绝 prompt 泄漏式输出，避免把完整用户请求或标题生成指令直接暴露成侧栏标题。
- 兜底标题只用于可用性，不代表最终产品语义；后续若引入更稳定的标题 schema，应继续保持 runtime 统一生成，避免让 UI 或 API 调用方各自拼标题。用户手动标题是显式偏好，优先级高于 runtime 自动标题。
- 直接回复链路的 `streamText()` 同样必须有超时失败收口；当前 direct reply 最多等待 30 秒，超时后 runtime 写入 `session_failed`、把 session/checkpoint 标记为 failed，并清理 `thinkState.loading`，避免前端一直显示 loading。
- direct reply 或任务启动阶段抛错时，runtime 必须确保最近一条用户消息之后至少存在一条 assistant 可见失败回复；不能只写 `session_failed` 状态，否则 `agent-chat` 主聊天区会只剩用户气泡，看起来像 AI 回复“消失”。
- direct reply 的意图判断不能把“现在 X 是什么”这类身份/定义问题仅因为包含“现在”就路由到任务编排；这类问题应保持在通用 AI 回复快路径，确保会话里能直接产生 assistant 消息。
- direct reply 带会话摘要或 recent turns 时，历史上下文必须合并进同一条 `system` message，不能追加第二条 `system`。MiniMax 国内 OpenAI-compatible `/chat/completions` 会对多条 `system` 返回 `400 invalid chat setting (2013)`；runtime 的 model invocation context assembler 同样会把 profile system 与请求 system 合并后再调用 provider。
