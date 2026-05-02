# Agent Chat Thinking And Feedback Design

状态：snapshot
文档类型：plan
适用范围：`apps/frontend/agent-chat`、`apps/backend/agent-server`、`packages/runtime`、`agents/supervisor`
最后核对：2026-05-03

## 背景

当前 `agent-chat` 会在部分模型回复里直接显示 `<think>...</think>`。用户期望它参考主流聊天产品展示为“思考中 / 已思考（用时 X 秒）”的可展开区域，而不是把标签作为正文 Markdown 展示。

同时，assistant 消息底部目前主要只有复制按钮，缺少重新生成、点赞、点踩这些对话质量反馈入口。用户明确不需要分享按钮，也不需要预留“复制分享文本 / 后续真实分享链接”的半成品。

另一个可见问题是基础技术概念题回答质量偏薄。例如“Docker 容器和镜像的区别”应更接近成熟助手的答案结构：先给核心结论，再用类比、对比表、关键机制、命令示例和注意事项帮助理解。反馈闭环需要能把“太浅 / 格式不好 / 没答到点”等点踩信号沉淀为后续回答偏好。

## 目标

1. assistant 消息不再原样显示 `<think>` 标签。
2. `<think>` 内容默认展开显示为“思考中 / 已思考”区域。
3. assistant 消息底部提供复制、重新生成、点赞、点踩。
4. 用户消息底部保持复制，不增加赞踩或重试。
5. 点赞 / 点踩写入后端消息反馈记录，并能进入后续学习偏好候选。
6. 直答链路对基础技术解释题提供更稳定的回答结构。
7. 不实现分享按钮，不保存分享状态，不暴露分享入口。

## 非目标

- 不做真实公网分享链接。
- 不把反馈立即改写历史消息。
- 不把点踩弹窗做成复杂表单系统。
- 不重构整个聊天消息模型。
- 不改变审批、Evidence、ThoughtChain 侧栏等既有能力。

## 前端设计

### Think 解析模型

在 `agent-chat` 的消息适配层新增稳定解析能力，输入 assistant 原始 `content`，输出：

- `visibleContent`：移除 `<think>` 后的正文。
- `thinkContent`：一个或多个 `<think>...</think>` 块合并后的内容。
- `thinkingState`：`streaming`、`completed` 或 `none`。
- `hasMalformedThink`：存在 `<think>` 开头但未闭合等格式异常。

解析规则：

- 成对 `<think>...</think>` 从正文中移除，内容进入思考块。
- 多段 `<think>` 按出现顺序用空行拼接。
- 流式阶段出现未闭合 `<think>` 时，正文先不展示该未闭合块，思考块显示“思考中”。
- 完成后仍未闭合时，优先保护正文：剥离 `<think>` 开头到结尾的异常段，避免标签外露。
- 没有 `<think>` 但存在 `checkpoint.thinkState` 或 active `thoughtItems` 时，可用运行时状态生成思考摘要。

### Think 展示

assistant 气泡内容结构：

1. 顶部渲染 `MessageThinkingPanel`。
2. 下方渲染清洗后的 Markdown 正文。
3. Evidence、response steps 等既有内容继续按当前顺序插入。

`MessageThinkingPanel`：

- 默认展开。
- 流式时标题为“思考中”。
- 完成后标题为“已思考”，有耗时则显示“已思考（用时 2 秒）”。
- 右侧显示展开 / 收起图标。
- 内容使用灰色、缩进、较轻量的文本样式，参考用户提供的截图。

耗时来源优先级：

1. `checkpoint.thinkState.thinkingDurationMs`
2. `thoughtChain` 中同 messageId 的 `thinkingDurationMs`
3. 无耗时则不显示括号。

### 消息操作区

assistant 消息底部显示：

- 复制
- 重新生成
- 点赞
- 点踩

user 消息底部显示：

- 复制

交互规则：

- 图标按钮加 tooltip / `aria-label`，不显示大段文字。
- assistant 消息 hover 时显示；移动端保持可点击性。
- 会话 running 时禁用重新生成。
- 找不到上一条 user 消息时禁用重新生成。
- 点赞和点踩互斥；再次点击当前状态可取消反馈。
- 点踩后可以展示轻量原因入口，原因枚举先保持小集合：`too_shallow`、`incorrect`、`missed_point`、`bad_format`、`other`。
- 不渲染分享按钮。

### 重新生成

重新生成以当前 assistant 消息为锚点，查找它之前最近的一条 user 消息，复用该 user 消息的 payload 发起新一轮生成。

约束：

- 不覆盖原 assistant 消息。
- 新回复作为新的 assistant 消息追加。
- 如果该 assistant 消息存在点踩原因，可把原因作为本轮 regenerating hint 传给后端。

## 后端与契约设计

### Message Feedback API

新增或复用稳定接口：

`POST /chat/messages/:messageId/feedback`

请求 schema：

```json
{
  "sessionId": "string",
  "rating": "helpful | unhelpful | none",
  "reasonCode": "too_shallow | incorrect | missed_point | bad_format | other",
  "comment": "string"
}
```

字段规则：

- `sessionId` 必填。
- `rating` 必填，`none` 表示取消当前反馈。
- `reasonCode` 仅在 `unhelpful` 时需要。
- `comment` 可选，最大长度由后端限制。
- 只允许对 assistant 消息提交反馈。

响应 schema 当前返回更新后的 `ChatMessageRecord`，其中 `feedback` 为当前生效状态：

```json
{
  "id": "string",
  "sessionId": "string",
  "role": "assistant",
  "content": "string",
  "feedback": {
    "messageId": "string",
    "sessionId": "string",
    "rating": "helpful | unhelpful",
    "reasonCode": "string",
    "comment": "string",
    "updatedAt": "string"
  },
  "createdAt": "string"
}
```

错误语义：

- `404`：session 或 message 不存在。
- `409`：message 不属于 session。
- `422`：非 assistant 消息、非法 rating 或 reasonCode。

### 反馈存储

后端保存轻量 `MessageFeedbackRecord`：

- `id`
- `sessionId`
- `messageId`
- `rating`
- `reasonCode`
- `comment`
- `createdAt`
- `updatedAt`

同一 `sessionId + messageId` 保持一条当前反馈记录，重复提交覆盖状态。取消反馈时当前实现会删除消息上的 `feedback` 字段；前端读取结果表现为无反馈态。

### 学习沉淀

点踩原因进入学习候选时遵守受控来源优先：

- `too_shallow`：基础概念题需要更完整结构。
- `bad_format`：回答需要更清晰层级、表格或示例。
- `missed_point`：后续回答要先确认用户真正问点。
- `incorrect`：不自动生成学习候选，避免学习错误事实。
- 事件出口：`message_feedback_learning_candidate`，payload 包含 `messageId`、`rating`、`reasonCode`、`comment?`、`candidateText`、`source: "message_feedback"`。

示例偏好候选：

“基础技术概念题回答时，先给核心结论，再用类比、对比表、关键机制、命令示例和注意事项组织答案。”

## 直答质量设计

`agents/supervisor` 的 direct reply prompt 增加基础技术解释题偏好：

- 先给一句核心结论。
- 对容易混淆的概念优先使用对比表。
- 使用类比，但不要只靠类比。
- 补充关键机制，例如只读层、可写层、生命周期、数据卷。
- 给 2 到 5 条命令或最小示例。
- 避免任务汇报口吻。

后端最终回复清洗补齐 `<think>` 处理：

- 持久化 assistant 最终消息前移除 `<think>` 标签和内容。
- 前端仍保留解析层，用于流式阶段、历史脏数据和模型异常输出兜底。

## 数据流

1. 用户发送消息。
2. 后端直答或主链生成 assistant token。
3. 前端流式解析 assistant content。
4. `<think>` 内容进入默认展开的思考块，正文 Markdown 只渲染 `visibleContent`。
5. 用户点击赞 / 踩。
6. 前端乐观更新当前消息反馈态。
7. 后端保存 `MessageFeedbackRecord`。
8. 学习链路从点踩原因生成偏好候选。
9. 后续 direct reply 构造 prompt 时读取高置信偏好。

## 错误处理

- feedback API 失败：回滚乐观状态，展示轻量错误提示。
- 重新生成失败：保留原消息，不覆盖当前内容。
- `<think>` 异常：优先不泄漏标签，其次保留正文可读性。
- 找不到上一条 user 消息：禁用重新生成按钮。
- 运行中会话：禁用重新生成，保留赞踩入口可用性由接口能力决定。

## 测试计划

前端：

- parser 单测覆盖成对 `<think>`、多段 `<think>`、未闭合 `<think>`、无 `<think>`。
- 渲染测试覆盖思考块默认展开，正文不含 `<think>`。
- 操作区测试覆盖 assistant 的复制 / 重试 / 赞 / 踩，以及 user 只有复制。
- 反馈交互测试覆盖点赞点踩互斥、取消反馈、失败回滚。

后端 / contract：

- feedback payload schema parse 测试。
- feedback API 成功、非法 message、跨 session、非 assistant 消息测试。
- direct reply 清洗测试确保最终消息不持久化 `<think>`。
- direct reply prompt 回归覆盖基础技术概念题结构偏好。

验证命令按受影响范围选择：

- `pnpm exec vitest apps/frontend/agent-chat/test/pages/chat/chat-message-adapter-helpers.test.ts`
- `pnpm exec vitest apps/frontend/agent-chat/test/pages/chat/chat-message-adapter.test.tsx`
- `pnpm exec vitest apps/backend/agent-server/test/chat/chat.service.session.spec.ts`
- `pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit`
- `pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit`
- 如触达 `packages/runtime`，补 `pnpm exec tsc -p packages/runtime/tsconfig.json --noEmit`

## 文档更新

实现时需要同步更新：

- `docs/apps/frontend/agent-chat/README.md` 或相邻专题文档：记录思考块和消息操作区。
- `docs/contracts/api/agent-chat.md`：记录 message feedback API。
- `docs/packages/runtime/` 或 `docs/apps/backend/agent-server/`：记录反馈如何进入学习偏好。

如果旧文档仍描述消息底部只有复制按钮，必须同步改掉。

## 已确认决策与实施拆分

已确认：

- 思考块默认展开。
- 做完整反馈闭环。
- 不做分享按钮。

实施计划需要进一步拆分：

1. 前端 think parser 与渲染。
2. 前端消息操作区与反馈状态。
3. 后端 feedback contract / API / store。
4. 学习偏好候选接入。
5. direct reply prompt 与清洗。
6. 文档与验证收口。
