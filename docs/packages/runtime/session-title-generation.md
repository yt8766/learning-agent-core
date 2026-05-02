# Runtime Session Title Generation

状态：current
文档类型：reference
适用范围：`packages/runtime/src/session`
最后核对：2026-05-02

`SessionCoordinator` 负责生成 `agent-chat` 会话标题。当前标题不是前端可编辑字段，也不是简单截取用户原话。

## 当前行为

- 新会话默认标题仍为 `新会话`。
- 当首条用户消息进入 `appendMessage()` 或 `appendInlineCapabilityResponse()`，且当前标题仍可派生时，runtime 调用 `generateSessionTitleFromSummary()`。
- `generateSessionTitleFromSummary()` 会先请求 `ILLMProvider.generateText()` 生成短摘要标题。
- 大模型不可用、未配置、返回空标题或调用失败时，才回退到 `deriveSessionTitle()` 的本地短标题。
- 生成标题会写回 `ChatSessionRecord.title`，后续侧栏和会话头只展示该 runtime 标题。

## 约束

- 前端不要提供手动重命名入口。
- 标题 prompt 必须要求“摘要而不是照抄原文”，避免把完整用户请求直接暴露成侧栏标题。
- 兜底标题只用于可用性，不代表最终产品语义；后续若引入更稳定的标题 schema，应继续保持 runtime 统一生成，避免让 UI 或 API 调用方各自拼标题。
