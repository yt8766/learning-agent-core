# Knowledge Chat Lab Codex-Style Routing Design

状态：snapshot
文档类型：plan
适用范围：`apps/frontend/knowledge`、`apps/backend/knowledge-server`、`docs/contracts/api/knowledge.md`
最后核对：2026-05-02

Date: 2026-05-02
Module: `apps/frontend/knowledge`, `apps/backend/knowledge-server`

## Goal

对话实验室要从“先选择知识库再问答”的表单式 RAG 页面，收敛成接近 Codex 的会话工作区。用户直接输入问题，系统在检索前根据当前消息、会话上下文和可访问知识库元信息选择检索范围；只有用户显式输入 `@知识库名` 时，才把该知识库作为强约束。

## UX Scope

- 左侧会话栏支持新建会话，默认会话不再绑定固定知识库。
- 主面板去除常驻知识库 Select。
- 输入框只保留消息输入；用户可输入 `@前端知识库 core包如何设计的` 这类 mention。
- 前端根据 `@mentions` 提取知识库 label/id，但不做自动知识库选择。
- 没有 `@mentions` 时，前端只发送消息、会话 ID 和 debug 标记。
- AI 回复参考 Codex 风格：正文直接给结论，下面展示引用段落、来源卡片、Trace、复制和反馈操作。
- 不支持图片上传或图片消息，本轮明确去除图片入口和图片语义。

## API Contract

`POST /api/chat` 继续使用 OpenAI Chat Completions 风格请求面：

```json
{
  "model": "knowledge-rag",
  "messages": [{ "role": "user", "content": "@前端知识库 core包如何设计的" }],
  "metadata": {
    "conversationId": "conv_20260502_x",
    "debug": true,
    "mentions": [{ "type": "knowledge_base", "label": "前端知识库" }]
  },
  "stream": false
}
```

字段约束：

- `metadata.mentions` 是前端从输入中提取的显式 mention，不代表自动路由结果。
- `metadata.knowledgeBaseIds` 保留兼容，但新 Chat Lab 不再发送。
- 后端返回继续保持当前 `ChatResponse`，避免本轮把响应强行切到 OpenAI `choices[]`。
- 后续如要暴露路由解释，可在 `ChatResponse.routing` 或 trace repository 中扩展；本轮优先用 citations 和 trace link 呈现证据。

## Backend Routing

新增检索前路由步骤，位置在 `KnowledgeDocumentService.chat()` 读取 documents/chunks 前。

路由输入：

- 当前用户可访问知识库列表。
- 用户最后一条 user message。
- `metadata.mentions` 中的显式知识库 mention。
- 兼容字段 `knowledgeBaseIds` / `knowledgeBaseId`。

MVP 路由规则：

1. 如果传入兼容 `knowledgeBaseIds`，先按旧协议使用这些 ID。
2. 如果存在 `@mentions`，按 knowledge base 的 `id`、`name`、`description`、`tags` 匹配；匹配到的知识库作为检索范围。
3. 如果没有 mention，使用 deterministic router：问题 tokens 与知识库 `name`、`description`、`tags` 做关键词打分。
4. 如果 deterministic router 有清晰命中，检索命中的知识库。
5. 如果无清晰命中，回退检索当前用户全部可访问知识库。

错误语义：

- 显式 mention 找不到可访问知识库时返回稳定 `400 knowledge_mention_not_found`。
- 自动路由无命中不是错误，回退全部可访问知识库。
- 目标知识库不存在返回 `404 knowledge_base_not_found`。
- 目标知识库无权限返回 `403 knowledge_permission_denied`。

## Frontend State

Chat Lab 本轮使用前端本地会话状态，先不引入持久 conversation repository。

会话模型：

- `id`
- `title`
- `messages`
- `createdAt`
- `updatedAt`

新建会话：

- 点击左侧“新建会话”生成本地会话。
- 标题初始为“新会话”，首次发送后从消息前 18 个字符派生。
- 切换会话时展示该会话自己的消息列表。

消息模型：

- user message：用户输入的原文。
- assistant message：`ChatResponse.answer`、`citations`、`traceId`、`assistantMessage.id`。
- loading message：通过 `Bubble.List.role.ai.loadingRender` 展示。

Mention 解析：

- 只解析文本中的 `@知识库名`。
- 前端根据当前 `listKnowledgeBases()` 返回的可访问知识库做 label/id 辅助匹配。
- 解析结果放入 `metadata.mentions`。
- 发送给后端的 `messages[].content` 保留原文，方便后端也能做二次解析和审计。

## Rendering

继续使用 Ant Design X：

- `Bubble.List.role.ai.contentRender` 渲染 Markdown。
- `Bubble.List.role.ai.footer` 渲染 `Actions.Copy`、`Actions.Feedback`、Trace 和引用。
- 引用卡片展示 `title`、`quote`、`score`、`uri` 或 document/chunk id。
- 加载态使用 `loadingRender`，文案为“正在检索知识库...”。

页面首屏不再出现“选择对话知识库”Select。若命中 `@mention`，可在消息或回答 footer 中显示轻量范围提示，例如 `@前端知识库` tag，但不是必须的阻塞条件。

## Testing

Frontend:

- Chat Lab 不渲染知识库 Select。
- 新建会话会创建并切换到空会话。
- 普通消息请求不包含 `metadata.knowledgeBaseIds`。
- `@知识库名` 消息请求包含 `metadata.mentions`。
- AI 回复保留 copy、feedback、Trace 和 citation cards。

Backend:

- mention 命中时只检索对应知识库。
- mention 不存在时返回 `knowledge_mention_not_found`。
- 无 mention 且关键词命中时自动选择对应知识库。
- 无 mention 且无关键词命中时回退全部可访问知识库。
- 旧 `knowledgeBaseIds` 请求保持兼容。

## Out Of Scope

- 图片消息、图片上传和多模态检索。
- 持久化 conversation repository。
- 大模型 query routing。
- SSE 流式响应。
- OpenAI 原生 `choices[]` 响应体迁移。
