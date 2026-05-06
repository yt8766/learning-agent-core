# Agent Chat Runtime V2 Implementation Plan

状态：current
文档类型：plan
适用范围：`packages/core`、`apps/backend/agent-server`、`apps/frontend/agent-chat`、`docs/contracts/api/agent-chat-runtime-v2.md`
最后核对：2026-05-05

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `agent-chat` runtime v2 contract so frontend and backend share one documented API for ChatRun, view-stream, auto review, and natural-language confirmation.

**Architecture:** Contract-first. `packages/core` owns stable schema-first records; `agent-server` projects existing chat/runtime events into v2 view-stream without rewriting the runtime graph first; `agent-chat` consumes view-stream for the primary chat experience while retaining v1 stream fallback.

**Tech Stack:** TypeScript, zod, NestJS, EventSource/SSE, React, Vitest, existing pnpm verification scripts.

---

## API Gate

Before touching implementation, re-read:

- [Agent Chat Runtime V2 API](/docs/contracts/api/agent-chat-runtime-v2.md)
- [Agent Chat API](/docs/contracts/api/agent-chat.md)
- [Chat API 数据模型](/docs/contracts/api/chat-data-model.md)
- [验证体系规范](/docs/packages/evals/verification-system-guidelines.md)

Implementation must not add fields that are absent from `agent-chat-runtime-v2.md`. If a field must change, update that API document first.

## Implementation Status

Status as of 2026-05-05:

- Tasks 1-6 are implemented and covered by targeted contract/backend/frontend tests.
- Task 7 is implemented for the critical natural-language approval reply path: `agent-chat-session-provider.ts` short-circuits `handledAs: pending_interaction_reply` and does not open a new stream or render a v2 approval card.
- Chat now has a thin bridge to existing `agent-tools` pending approvals: `ChatService.appendMessage()` can translate natural-language replies into `AgentToolsService.resumeApproval()` while leaving approval ID validation and linked sandbox/auto-review resume in `agent-tools`.
- `view-stream` now projects `interrupt_pending(kind=tool_execution)` into `interaction_waiting` so frontend v2 consumers can stay natural-language-only.
- The visible composer placeholder now switches to the required confirmation phrase for pending tool approval states, while keeping normal sessions on the default “给 Agent Chat 发送消息” copy.
- Task 8 docs were updated in `docs/apps/backend/agent-server/*` and `docs/apps/frontend/agent-chat/*`.
- Full Task 9 integration demo is still pending. Current proof is targeted schema/unit/type/doc verification, not a live browser-to-backend execution demo.

## File Structure

Planned ownership:

- `packages/core/src/tasking/schemas/chat-run.ts`  
  Owns `ChatRunRecordSchema`.
- `packages/core/src/tasking/schemas/chat-fragment.ts`  
  Owns `ChatMessageFragmentSchema`.
- `packages/core/src/tasking/schemas/chat-view-stream.ts`  
  Owns `ChatViewStreamEventSchema` and event payload schemas.
- `packages/core/src/tasking/schemas/chat-interaction.ts`  
  Owns `ChatPendingInteractionSchema` and `ApprovalReplyIntentSchema`.
- `packages/core/src/tasking/schemas/execution-auto-review.ts`  
  Owns `ExecutionAutoReviewRecordSchema`.
- `packages/core/src/tasking/types/*.ts` and `packages/core/src/tasking/schemas/index.ts`  
  Export zod-inferred types and schemas.
- `packages/core/test/chat-runtime-v2-contracts.test.ts`  
  Contract parse regression.
- `apps/backend/agent-server/src/chat/runs/*`  
  ChatRun lifecycle facade/repository.
- `apps/backend/agent-server/src/chat/view-stream/*`  
  SSE controller/service/adapter from existing `ChatEventRecord`.
- `apps/backend/agent-server/src/chat/interactions/*`  
  Pending interaction state and natural-language reply interpreter.
- `apps/backend/agent-server/src/chat/auto-review/*`  
  Rule-first execution auto review.
- `apps/backend/agent-server/test/chat/*`  
  Backend unit/integration tests for v2 behavior.
- `apps/frontend/agent-chat/src/api/chat-runtime-v2-api.ts`  
  v2 API helper.
- `apps/frontend/agent-chat/src/hooks/chat-session/use-chat-view-stream.ts`  
  EventSource consumer.
- `apps/frontend/agent-chat/src/types` or direct `@agent/core` imports  
  No new hand-written stable contract duplicates.
- `apps/frontend/agent-chat/test/**`  
  Frontend stream reducer and interaction UX tests.

## Task 1: Core Contract Schemas

**Files:**

- Create: `packages/core/src/tasking/schemas/chat-run.ts`
- Create: `packages/core/src/tasking/schemas/chat-fragment.ts`
- Create: `packages/core/src/tasking/schemas/chat-view-stream.ts`
- Create: `packages/core/src/tasking/schemas/chat-interaction.ts`
- Create: `packages/core/src/tasking/schemas/execution-auto-review.ts`
- Modify: `packages/core/src/tasking/schemas/index.ts`
- Modify/Create: `packages/core/src/tasking/types/*.ts`
- Test: `packages/core/test/chat-runtime-v2-contracts.test.ts`

- [ ] **Step 1: Write failing contract tests**

Add parse tests for:

- minimal `ChatRunRecord`
- `ChatMessageFragment` response delta target data
- `ChatViewStreamEvent` envelope with `ready`, `fragment_delta`, `auto_review_completed`, `interaction_waiting`, `error`, `close`
- `ExecutionAutoReviewRecord` allow / needs_confirmation / block
- `ApprovalReplyIntent` high-confidence approve and feedback

Run:

```bash
pnpm exec vitest run packages/core/test/chat-runtime-v2-contracts.test.ts
```

Expected: FAIL because schemas do not exist yet.

- [ ] **Step 2: Add minimal schemas**

Implement only the fields specified in [agent-chat-runtime-v2.md](/docs/contracts/api/agent-chat-runtime-v2.md). Use `z.object`, `z.enum`, and `z.discriminatedUnion` where event payloads have stable event names.

- [ ] **Step 3: Export schemas and inferred types**

Use `z.infer<typeof Schema>` only. Do not add long-lived public `interface` declarations without schemas.

- [ ] **Step 4: Run contract tests**

Run:

```bash
pnpm exec vitest run packages/core/test/chat-runtime-v2-contracts.test.ts
pnpm exec tsc -p packages/core/tsconfig.json --noEmit
```

Expected: PASS.

## Task 2: Backend ChatRun Lifecycle

**Files:**

- Create: `apps/backend/agent-server/src/chat/runs/chat-run.repository.ts`
- Create: `apps/backend/agent-server/src/chat/runs/chat-run.service.ts`
- Modify: `apps/backend/agent-server/src/chat/chat.module.ts`
- Modify: `apps/backend/agent-server/src/chat/chat.controller.ts`
- Test: `apps/backend/agent-server/test/chat/chat-run.service.spec.ts`

- [ ] **Step 1: Write failing tests**

Cover:

- creating a run links `sessionId`, `requestMessageId`, and `responseMessageId`
- listing runs by session
- cancelling a run marks status `cancelled`

Run:

```bash
pnpm --dir apps/backend/agent-server exec vitest run test/chat/chat-run.service.spec.ts
```

Expected: FAIL because service/repository do not exist.

- [ ] **Step 2: Implement in-memory repository first**

Mirror the existing session coordinator persistence style only as needed for v2 MVP. Do not rewrite runtime storage in this task.

- [ ] **Step 3: Add API endpoints**

Add:

```text
GET /api/chat/runs?sessionId=...
GET /api/chat/runs/:runId
POST /api/chat/runs/:runId/cancel
```

Validate inputs with schema-first DTOs or local zod schemas aligned to the API doc.

- [ ] **Step 4: Run backend tests and typecheck**

Run:

```bash
pnpm --dir apps/backend/agent-server exec vitest run test/chat/chat-run.service.spec.ts
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: PASS.

## Task 3: Auto Review Rules

**Files:**

- Create: `apps/backend/agent-server/src/chat/auto-review/execution-auto-review.rules.ts`
- Create: `apps/backend/agent-server/src/chat/auto-review/execution-auto-review.service.ts`
- Test: `apps/backend/agent-server/test/chat/execution-auto-review.service.spec.ts`

- [ ] **Step 1: Write failing rule tests**

Cover:

- read-only commands produce `allow`
- file writes / dependency install / push produce `needs_confirmation`
- destructive out-of-scope commands produce `block`
- high-risk confirmations include `requiredConfirmationPhrase`

Run:

```bash
pnpm --dir apps/backend/agent-server exec vitest run test/chat/execution-auto-review.service.spec.ts
```

Expected: FAIL.

- [ ] **Step 2: Implement rule-first reviewer**

Implement deterministic rules before any LLM review. The service must return `ExecutionAutoReviewRecord` exactly matching core schema.

- [ ] **Step 3: Run tests**

Run:

```bash
pnpm --dir apps/backend/agent-server exec vitest run test/chat/execution-auto-review.service.spec.ts
```

Expected: PASS.

## Task 4: Natural-Language Pending Interaction

**Files:**

- Create: `apps/backend/agent-server/src/chat/interactions/pending-interaction.service.ts`
- Create: `apps/backend/agent-server/src/chat/interactions/approval-reply-interpreter.ts`
- Modify: `apps/backend/agent-server/src/chat/chat.service.ts`
- Modify: `apps/backend/agent-server/src/chat/chat.controller.ts`
- Test: `apps/backend/agent-server/test/chat/approval-reply-interpreter.spec.ts`
- Test: `apps/backend/agent-server/test/chat/chat-message-pending-interaction.spec.ts`

- [ ] **Step 1: Write failing interpreter tests**

Cover:

- `确认执行` -> approve high confidence for medium risk
- `取消` -> reject high confidence
- `可以，但不要删除文件` -> feedback
- high-risk `requiredConfirmationPhrase = "确认推送"` rejects vague `确认` as `unknown`
- high-risk exact `确认推送` -> approve high confidence

- [ ] **Step 2: Implement deterministic interpreter**

Keep it rule-first. Do not call LLM in v2 MVP.

- [ ] **Step 3: Route `POST /api/chat/messages` through pending interaction first**

When pending interaction exists and the reply resolves it, return:

```ts
{
  handledAs: 'pending_interaction_reply',
  interactionResolution: ...
}
```

Do not create a new run in that path.

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm --dir apps/backend/agent-server exec vitest run test/chat/approval-reply-interpreter.spec.ts test/chat/chat-message-pending-interaction.spec.ts
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: PASS.

## Task 5: View Stream Projection

**Files:**

- Create: `apps/backend/agent-server/src/chat/view-stream/chat-view-stream.adapter.ts`
- Create: `apps/backend/agent-server/src/chat/view-stream/chat-view-stream.service.ts`
- Create: `apps/backend/agent-server/src/chat/view-stream/chat-view-stream.controller.ts`
- Modify: `apps/backend/agent-server/src/chat/chat.module.ts`
- Test: `apps/backend/agent-server/test/chat/chat-view-stream.adapter.spec.ts`
- Test: `apps/backend/agent-server/test/chat/chat-view-stream.controller.spec.ts`

- [ ] **Step 1: Write failing adapter tests**

Map existing events:

- `assistant_token` -> `fragment_started` if needed + `fragment_delta`
- `assistant_message` / `final_response_completed` -> `fragment_completed` + `run_status` + `close`
- `session_failed` -> `error` + `close`
- `node_progress` chat response step projection -> `step_updated`
- auto review and pending interaction records -> corresponding view events

- [ ] **Step 2: Implement adapter with stable seq**

Every emitted `ChatViewStreamEvent` must have `id`, `seq`, `sessionId`, `runId`, `at`, and `data`.

- [ ] **Step 3: Add SSE endpoint**

Add:

```text
GET /api/chat/view-stream?sessionId=...&runId=...&afterSeq=...
```

Use explicit SSE event names:

```text
event: fragment_delta
data: {...}
```

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm --dir apps/backend/agent-server exec vitest run test/chat/chat-view-stream.adapter.spec.ts test/chat/chat-view-stream.controller.spec.ts
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: PASS.

## Task 6: Frontend V2 API Helper and Stream Consumer

**Files:**

- Create: `apps/frontend/agent-chat/src/api/chat-runtime-v2-api.ts`
- Create: `apps/frontend/agent-chat/src/hooks/chat-session/use-chat-view-stream.ts`
- Modify: existing chat session stream manager files only where needed
- Test: `apps/frontend/agent-chat/test/hooks/chat-session/use-chat-view-stream.test.ts`

- [ ] **Step 1: Write failing frontend tests**

Cover:

- parsing `ready`
- appending `fragment_delta`
- closing on `close`
- marking pending interaction on `interaction_waiting`
- not treating pending interaction replies as new runs

- [ ] **Step 2: Implement API helper**

Use `@agent/core` v2 types/schemas. Do not duplicate stable contract interfaces in frontend local types.

- [ ] **Step 3: Implement stream hook**

Keep existing v1 stream fallback. v2 view-stream should be primary only when `runId` is available.

- [ ] **Step 4: Run frontend tests and typecheck**

Run:

```bash
pnpm --dir apps/frontend/agent-chat exec vitest run test/hooks/chat-session/use-chat-view-stream.test.ts
pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit
```

Expected: PASS.

## Task 7: Frontend Natural-Language Interaction UX

**Files:**

- Modify: chat composer/input placeholder area
- Modify: assistant message rendering for auto review summaries
- Test: relevant `apps/frontend/agent-chat/test/**`

- [ ] **Step 1: Write failing UX tests**

Cover:

- `interaction_waiting` changes input placeholder to required phrase when present
- no approval card is rendered for v2 interaction
- assistant message text remains the primary confirmation prompt

- [ ] **Step 2: Implement minimal UX**

Do not remove legacy approval card rendering yet; just stop using it for v2 interaction events.

- [ ] **Step 3: Run tests**

Run:

```bash
pnpm --dir apps/frontend/agent-chat exec vitest run test/pages/chat test/hooks/chat-session
pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit
```

Expected: PASS.

## Task 8: Docs and Compatibility Cleanup

**Files:**

- Update: `docs/contracts/api/agent-chat-runtime-v2.md`
- Update: `docs/contracts/api/chat-data-model.md`
- Update: `docs/apps/backend/agent-server/chat-api.md` if implementation changes backend behavior
- Update: `docs/apps/frontend/agent-chat/chat-api-integration.md` if frontend switches to v2 stream

- [ ] **Step 1: Update docs with actual implemented paths**

Mark any still-planned endpoint or limitation explicitly.

- [ ] **Step 2: Remove stale local frontend type duplicates only after all consumers are migrated**

Do not remove legacy card or v1 stream compatibility until tests prove no active consumer depends on it.

- [ ] **Step 3: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

## Task 9: End-to-End Verification

- [ ] **Step 1: Contract and affected tests**

Run:

```bash
pnpm exec vitest run packages/core/test/chat-runtime-v2-contracts.test.ts
pnpm --dir apps/backend/agent-server exec vitest run test/chat
pnpm --dir apps/frontend/agent-chat exec vitest run test/hooks/chat-session test/pages/chat
```

- [ ] **Step 2: Type checks**

Run:

```bash
pnpm exec tsc -p packages/core/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit
```

- [ ] **Step 3: Minimum integration demo**

Prove these flows:

- low-risk auto review `allow` streams `auto_review_completed` then execution events without user confirmation
- high-risk `needs_confirmation` creates `interaction_waiting` and resumes only after exact confirmation phrase
- `block` never executes the action and streams a user-facing explanation
- view-stream emits explicit SSE event names and valid `seq`

- [ ] **Step 4: Final docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

## Completion Criteria

- API contract remains the source of truth.
- Stable v2 schemas live in `packages/core` and are parse-tested.
- Backend exposes run and view-stream endpoints.
- Auto review gates tool execution with `allow / needs_confirmation / block`.
- Natural-language pending interaction works through `POST /api/chat/messages`.
- Frontend consumes view-stream as primary path and retains v1 fallback.
- Approval card is no longer the v2 main path.
- Required Type, Spec, Unit, Demo, Integration checks are documented and run or blockers recorded.
