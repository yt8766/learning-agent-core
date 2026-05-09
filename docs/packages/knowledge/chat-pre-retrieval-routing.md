# Knowledge Chat Pre-Retrieval Routing

状态：current
文档类型：reference
适用范围：`packages/knowledge`
最后核对：2026-05-02

## Purpose

`packages/knowledge/src/retrieval/knowledge-chat-routing.ts` owns the deterministic pre-retrieval routing helper used by knowledge chat hosts.

This helper does not generate answers, call a model, enforce HTTP auth, or read repositories. It only converts the current user-accessible knowledge base metadata plus chat hints into an ordered retrieval scope.

## Public API

The root entrypoint `@agent/knowledge` exports:

- `resolveKnowledgeChatRoute(input)`
- `KnowledgeChatRoutingError`
- `KnowledgeChatRouteBase`
- `KnowledgeChatRouteMention`
- `ResolveKnowledgeChatRouteInput`
- `ResolveKnowledgeChatRouteResult`

Hosts should import from `@agent/knowledge`, not from app-local helpers.

## Routing Order

`resolveKnowledgeChatRoute()` applies routing in this order:

1. `legacyBaseIds`: migration compatibility for old callers that still send direct knowledge base ids.
2. `metadata.knowledgeBaseId(s)`: compatibility only; new Chat Lab should not send these fields.
3. `mentions`: explicit `@知识库名` selections, bound by id first and then by normalized name.
4. Metadata match: deterministic token overlap between the user message and knowledge base `name`, `description`, or string/number metadata values.
5. Fallback: all accessible bases.

If an explicit mention cannot be bound to the accessible base list, the helper throws `KnowledgeChatRoutingError` with `code: "knowledge_mention_not_found"`.

## Host Boundary

`apps/backend/agent-server Knowledge domain` adapts this package error into its own `KnowledgeServiceError`, then maps it to HTTP `400`.

The package helper deliberately does not check membership itself. The host must pass only current-user-accessible bases and must still verify membership before reading documents or chunks.
