# Direct Reply System Prompt 单一来源

状态：current
文档类型：reference
适用范围：`packages/core/src/prompts`、`packages/runtime/src/session`、`agents/supervisor/src/flows/supervisor/prompts`、`apps/backend/agent-server/src/chat`
最后核对：2026-05-03

## 概述

直答（direct reply）场景下的 LLM system prompt 由 `packages/core` 中的 `buildManagerDirectReplySystemPrompt` 统一生成。该函数是所有直答链路的**单一来源**（single source of truth），避免三条入口各自维护一份规则导致质量漂移。

## 三条入口

| 入口                | 所在文件                                                             | 如何使用 core prompt                                                                                |
| ------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Session 快路        | `packages/runtime/src/session/session-coordinator-direct-reply.ts`   | `buildDirectReplyMessages` 内直接调用 `buildManagerDirectReplySystemPrompt` 作为首条 system message |
| Supervisor 走图直答 | `agents/supervisor/src/flows/ministries/libu-router-ministry.ts`     | `replyDirectly()` 调用 `buildSupervisorDirectReplySystemPrompt(modelId)`，后者委派 core builder     |
| HTTP Direct         | `apps/backend/agent-server/src/chat/chat-direct-response.helpers.ts` | `streamChat` 在调用 `modelInvocationFacade.invoke` 前向 messages 前置 core system prompt            |

## 规则要点

core prompt 面向教学质量，关键约束包括：

- 概念对比题必须包含：核心结论、双类比（生活 + 编程）、多维度对比表、底层机制（如分层/可写层/写时复制）、多实例演示命令、数据持久化提示、收尾总结。
- 禁止暴露任务编排、六部流程、工具调用等内部机制。
- 系统/工具类问题需分类展开（系统设置、临时命令、长期设置、第三方工具）。

## 扩展

- 传入 `modelId` 可让 prompt 附带模型身份行。
- 传入 `roleHeading` 可覆盖默认「内阁首辅」角色标题。
- `directReplyProfile`（`packages/runtime/src/runtime/model-invocation/profiles/direct-reply-profile.ts`）不再注入额外 system message（返回空数组），规则完全由调用方通过 core builder 注入。
