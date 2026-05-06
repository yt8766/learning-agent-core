状态：current
文档类型：reference
适用范围：`apps/frontend/knowledge` Chat Lab
最后核对：2026-05-04

# Knowledge Retrieval Lab Streaming

检索实验室（原 Chat Lab）的默认对话路径是 `/api/chat` POST SSE，而不是 JSON polling。页面仍提交 OpenAI Chat Completions 风格 payload：

```json
{
  "model": "knowledge-rag",
  "messages": [{ "role": "user", "content": "检索前有什么" }],
  "metadata": {
    "conversationId": "conv_x",
    "debug": true,
    "mentions": []
  },
  "stream": true
}
```

`metadata.mentions` 可以为空。为空时前端不补 `knowledgeBaseIds`，由后端把当前用户可访问知识库交给 SDK pre-retrieval planner，让模型或 fallback planner 根据问题自动选库、rewrite query，再检索。

## Frontend Runtime

- `KnowledgeFrontendApi.streamChat(input)` 是唯一的流式入口。
- `KnowledgeFrontendApi.listRagModelProfiles()` 读取 `GET /rag/model-profiles`，用于恢复后端持久化会话的 `activeModelProfileId` 并作为后续发送的 `model`；Chat Lab 当前不再暴露顶部模型选择器，空会话默认仍使用 `knowledge-rag` 兼容 profile。
- `KnowledgeFrontendApi.listConversations()` 和 `listConversationMessages(conversationId)` 读取后端持久化会话与消息。返回空会话时，页面保留本地新会话空态；返回非空时默认激活第一条会话，并加载其消息。
- `KnowledgeApiClient.streamChat()` 使用 fetch POST，header 为 `Accept: text/event-stream` 和 Bearer token；由于浏览器 `EventSource` 不支持自定义 POST body 与 Authorization header，这里不能改成 EventSource。
- `knowledge-chat-stream.ts` 只解析 SSE frame，并校验最小事件形状：`type` 和 `runId`。
- `useXChat()` 负责消息状态，Knowledge 自定义 provider 额外维护 `streamState`，根据事件切换 `planner / retrieval / answer / completed / error` 阶段。
- `answer.delta` 只更新临时回答气泡；最终消息以 `answer.completed` 或 `rag.completed` 投影出的 `ChatResponse` 为准。

## Citation Projection

SDK stream event 中的 citation 使用 SDK retrieval contract：`sourceId/chunkId/sourceType/trustClass`。Chat Lab footer 使用前端展示 DTO：`id/documentId/chunkId/title/quote/score/uri`。因此 hook 必须做投影，页面不能直接消费 SDK citation 对象，也不能把 vendor 或 retrieval 内部字段穿透到 Bubble footer。

## UI Requirements

- Loading bubble 在没有 delta 时展示“正在检索知识库...”。
- 空会话欢迎态展示标题、副标题、quick prompts 和 assistant config 中的检索步骤标签；仍不展示“思考过程”时间线或内部推理调试外壳。
- 收到 delta 后同一条 AI bubble 进入 updating 状态并持续追加文本。
- 底部状态行展示当前阶段和已接收事件数，便于调试 planner、retrieval、answer 是否都进入主链。
- 底部诊断摘要从 `streamState.events` 派生，不新增协议字段：`planner.completed.plan` 展示 planner 类型、选择理由、search mode 和 confidence；`retrieval.completed.retrieval.diagnostics` 展示 effective search mode、第一条 executed query 与 final hit count。这样用户看到 0 hit 时可以直接知道选了哪些 query、走了哪种召回路径。
- 最终 assistant message 仍展示 Markdown 正文、复制、反馈、trace link 和 citation cards。
