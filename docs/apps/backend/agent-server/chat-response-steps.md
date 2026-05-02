# Chat Response Steps

状态：snapshot
文档类型：reference
适用范围：`apps/backend/agent-server/src/chat`
最后核对：2026-05-02

`chat-response-steps.adapter.ts` maps existing chat events into `@agent/core` response-step schemas for the frontend chat surface.

The adapter does not own runtime execution. It only projects already-emitted chat/session/tool/approval events into UI-friendly steps:

- incremental payload: `projection = "chat_response_step"`
- snapshot payload: `projection = "chat_response_steps"`

Both payloads are sent as normal `ChatEventRecord` frames, usually with `type = "node_progress"`. Consumers that do not understand the projection can ignore it. The chat frontend should render these projections as assistant response-step summaries, not as raw node/execution system cards in the main thread.

`ChatService.listEvents()` replays raw historical events plus derived response-step projections. `ChatService.subscribe()` seeds its projection state from historical raw events before subscribing, so realtime steps continue the same assistant message ownership and sequence. Steps are stored per assistant `messageId`, preventing snapshots for later replies from inheriting earlier reply steps.

`user_message` is a response-step ownership boundary. When a new user turn arrives, the projection state clears the previous assistant owner; process events without their own `messageId` must wait until the new assistant `assistant_token` / `assistant_message` establishes ownership. This prevents response-step summaries from leaking across user turns.

Do not put prompt logic, graph nodes, model parsing, or tool execution in this adapter. Those belong in runtime, agent flows, or tool hosts.
