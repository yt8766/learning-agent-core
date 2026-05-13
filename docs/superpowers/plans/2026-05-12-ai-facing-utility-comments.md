# AI-Facing Utility Comments Implementation Plan

状态：completed  
文档类型：plan  
适用范围：`packages/adapters`、`packages/knowledge`、`apps/backend/agent-server`、`agents/data-report`、`agents/supervisor`、`apps/frontend/agent-chat`、`docs/conventions/javascript-typescript-style.md`  
最后核对：2026-05-12

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为当前仓库中最容易被 AI 误改或误复用的工具方法补充短注释，帮助后续 AI 理解隐藏契约、边界和不可破坏语义。

**Architecture:** 不给普通业务代码批量加注释，只给跨边界工具方法、归一化/解析器、重试/脱敏/缓存/投影 helper 加 AI-facing 注释。注释以函数级 TSDoc 或相邻短行注释为主，说明“为什么这样做、调用方应依赖什么、不应假设什么”，避免复述实现。

**Tech Stack:** TypeScript, TSDoc, pnpm docs/type checks.

**Execution result on 2026-05-12:** Completed. The implementation added AI-facing comments only, with no runtime logic changes. The docs convention now records when utility helpers should carry short boundary comments. Scoped type checks passed for adapters, knowledge, data-report, supervisor, and agent-chat. The previously noted backend typecheck blocker in `apps/backend/agent-server/src/domains/agent-gateway/management/cli-proxy-management-client.helpers.ts` was resolved later by tightening the Auth File metadata projection value type.

---

## Feasibility And Comment Policy

可行。当前仓库已有注释规范：`docs/conventions/javascript-typescript-style.md` 要求“只在代码本身无法表达意图时写注释”，JSDoc 主要用于公共 API、复杂签名或工具提示。用户补充的目标是“给 AI 理解是否可行”，因此本轮应把注释限定在这些场景：

- AI 需要知道该 helper 是稳定 contract、边界 adapter、兼容层或过渡层。
- 函数名无法表达排序、去重、fallback、缓存 key、错误分类、脱敏、幂等或安全边界。
- 未来改动很容易破坏前后端事件投影、RAG 召回语义、LLM JSON 修复循环、日志安全或 data-report patch cache。

不应补注释的场景：

- 纯 UI 展示组件、明显的 label formatter、简单 URL builder。
- 测试 fixture/helper，除非它复制了生产协议语义。
- 只复述代码执行步骤的注释，例如“遍历数组”“返回结果”。

## Target Files

- Modify: `packages/adapters/src/structured-output/safe-generate-object.ts`
  - 说明结构化输出 helper 的四态 `parseStatus`、schema parse 失败才进入 LLM retry、`invoke` 分支不会追加 JSON safety messages。
- Modify: `packages/adapters/src/resilience/llm-retry.ts`
  - 说明 retry 只把错误反馈追加为新的最后一条 user message，并且每轮从原始 messages 重建，避免把失败输出继续污染上下文。
- Modify: `packages/adapters/src/shared/metadata/normalize-metadata.ts`
  - 说明 metadata 只保留 JSON-safe 值，`undefined/function/symbol` 会被丢弃，`bigint/Date/URL` 会被字符串化。
- Modify: `packages/adapters/src/shared/ids/stable-id.ts`
  - 说明 `\x00` 分隔符是稳定 ID contract，避免不同 parts 拼接碰撞；slice 长度是外部可见 ID 长度，不能随意改。
- Modify: `packages/knowledge/src/runtime/defaults/default-query-normalizer.helpers.ts`
  - 说明 query rewrite 的优先级：先中文口语归一化，再去英文问句/请求前缀；query variants 需要保留原始 query 作为召回 fallback。
- Modify: `packages/knowledge/src/runtime/defaults/post-retrieval-selection-trace.ts`
  - 说明 selection trace 采用“首个 drop stage 胜出，最终 output 统一标 selected”的可观测语义。
- Modify: `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts`
  - 说明 normalizer chain、query 去重、multi-query hit merge 保留最高分，以及 observer error swallow 的边界。
- Modify: `packages/knowledge/src/adapters/shared/langchain-message.ts`
  - 说明 LangChain content 支持 string 与 text part array，未知结构返回空字符串而非抛错，是 provider adapter 边界。
- Modify: `apps/backend/agent-server/src/logger/logging.utils.ts`
  - 说明 `sanitizeForLogging` 是日志边界脱敏，不是权限检查或深度 clone API；key 匹配是 case-insensitive exact match。
- Modify: `apps/backend/agent-server/src/runtime/helpers/runtime-platform-console.normalize.ts`
  - 说明 normalize helpers 用于读取旧/损坏 projection 时保持 Admin Console 可渲染，不应用作写入 schema。
- Modify: `apps/backend/agent-server/src/runtime/domain/session/runtime-session-message-dedupe.ts`
  - 说明 transient assistant messages 与 committed assistant messages 的折叠规则，避免重复流式/最终回答。
- Modify: `apps/backend/agent-server/src/message-gateway/message-gateway-normalizer.ts`
  - 说明 webhook verification 的“环境变量未配置则跳过”是本地/测试兼容边界，生产要靠配置打开。
- Modify: `agents/data-report/src/flows/data-report-json/nodes/schema-patch-shared-utils.ts`
  - 说明 label -> field 解析顺序：table column、metric、chart series，最后才 fallback 到 normalized identifier。
- Modify: `agents/data-report/src/flows/data-report-json/nodes/schema-patch-filter-utils.ts`
  - 说明筛选项匹配先按 label 长度降序，避免短 label 抢占长 label；`user_type` options 是确定性演示 fallback。
- Modify: `agents/data-report/src/flows/data-report-json/nodes/patch-helpers.ts`
  - 说明 node-scoped patch target 只在唯一 target 时返回；cache key 包含 section fingerprint，避免旧 schema patch 污染新 schema。
- Modify: `agents/supervisor/src/utils/prompts/runtime-output-sanitizer.ts`
  - 说明 sanitizer 只清理运行时作战噪声和 think block，不应作为通用 Markdown sanitizer 或安全过滤器。
- Modify: `apps/frontend/agent-chat/src/hooks/chat-session/chat-session-message-sync-helpers.ts`
  - 说明前端流式消息同步的 transient/committed equivalence 规则，避免 UI 同时显示 token stream 与最终回答。
- Modify: `apps/frontend/agent-chat/src/utils/chat-response-step-projections.ts`
  - 说明 projection folding 支持 snapshot 与 event 两种输入；snapshot 是权威覆盖，event 是增量 upsert。
- Modify: `apps/frontend/agent-chat/src/utils/chat-trajectory-projections.ts`
  - 说明这些 copy builder 是后端事件 payload 的宽容投影层，未知字段应降级为空文案片段而不是抛错。

## Task 1: Add Adapter Boundary Comments

**Files:**

- Modify: `packages/adapters/src/structured-output/safe-generate-object.ts`
- Modify: `packages/adapters/src/resilience/llm-retry.ts`
- Modify: `packages/adapters/src/shared/metadata/normalize-metadata.ts`
- Modify: `packages/adapters/src/shared/ids/stable-id.ts`

- [ ] **Step 1: Add comment above `safeGenerateObject`**

Add this TSDoc:

```ts
/**
 * Shared structured-output boundary for LLM calls.
 * Only schema/JSON-shaped failures are retried with corrective feedback; provider failures become fallback metadata.
 */
```

- [ ] **Step 2: Add comment above `withLlmRetry`**

Add this TSDoc:

```ts
/**
 * Retries an LLM call by appending one corrective user message to the original prompt.
 * Each attempt restarts from the original messages so failed model output is not carried forward as context.
 */
```

- [ ] **Step 3: Add comment above `normalizeMetadataValue`**

Add this TSDoc:

```ts
/**
 * Converts arbitrary provider metadata into JSON-safe values.
 * Unsupported runtime values are dropped, while bigint/date/url values are stringified to preserve auditability.
 */
```

- [ ] **Step 4: Add comment above `stableId`**

Add this TSDoc:

```ts
/**
 * Creates short deterministic IDs from structured parts.
 * The NUL separator is part of the collision-avoidance contract; do not replace it with plain string concat.
 */
```

- [ ] **Step 5: Verify adapters**

Run:

```bash
pnpm exec tsc -p packages/adapters/tsconfig.json --noEmit
pnpm check:docs
```

Expected: both commands pass.

## Task 2: Add Knowledge Retrieval Comments

**Files:**

- Modify: `packages/knowledge/src/runtime/defaults/default-query-normalizer.helpers.ts`
- Modify: `packages/knowledge/src/runtime/defaults/post-retrieval-selection-trace.ts`
- Modify: `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts`
- Modify: `packages/knowledge/src/adapters/shared/langchain-message.ts`

- [ ] **Step 1: Add comment above `rewriteQueryText`**

Add this TSDoc:

```ts
/**
 * Applies deterministic rewrite rules before retrieval.
 * Chinese colloquial normalization wins before English request-prefix removal so CJK intent words are preserved.
 */
```

- [ ] **Step 2: Add comment above `buildQueryVariants`**

Add this TSDoc:

```ts
/**
 * Builds the ordered fallback query list used by retrieval.
 * Keep the normalized query first and original query second so recall can recover when rewriting is too aggressive.
 */
```

- [ ] **Step 3: Add comment above `buildPostRetrievalSelectionTrace`**

Add this TSDoc:

```ts
/**
 * Builds explainability for post-retrieval selection.
 * A dropped hit is attributed to the first stage that removed it; final output hits are marked selected in order.
 */
```

- [ ] **Step 4: Add comment above `resolveNormalizerChain`**

Add this short block comment:

```ts
/**
 * Normalizers compose sequentially: each stage receives the previous stage result.
 * This lets hosts add deterministic or LLM rewrites without changing the retrieval pipeline contract.
 */
```

- [ ] **Step 5: Add comment above `mergeHitsByChunkId`**

Add this TSDoc:

```ts
/**
 * Merges multi-query retrieval candidates by chunk id.
 * When the same chunk appears in multiple query variants, keep the highest-scoring hit and sort globally by score.
 */
```

- [ ] **Step 6: Add comment above `extractLangChainText`**

Add this TSDoc:

```ts
/**
 * Reads text from LangChain-style results without leaking provider-specific shapes upward.
 * Unknown payloads intentionally collapse to an empty string so adapters can decide fallback behavior.
 */
```

- [ ] **Step 7: Verify knowledge**

Run:

```bash
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
pnpm check:docs
```

Expected: both commands pass.

## Task 3: Add Backend Runtime Boundary Comments

**Files:**

- Modify: `apps/backend/agent-server/src/logger/logging.utils.ts`
- Modify: `apps/backend/agent-server/src/runtime/helpers/runtime-platform-console.normalize.ts`
- Modify: `apps/backend/agent-server/src/runtime/domain/session/runtime-session-message-dedupe.ts`
- Modify: `apps/backend/agent-server/src/message-gateway/message-gateway-normalizer.ts`

- [ ] **Step 1: Add comment above `sanitizeForLogging`**

Add this TSDoc:

```ts
/**
 * Redacts known secret-shaped fields before values cross the logging boundary.
 * This is not an authorization guard or general-purpose sanitizer; callers must still avoid logging unsafe payloads.
 */
```

- [ ] **Step 2: Add comment above `normalizePlatformConsoleRuntimeRecord`**

Add this TSDoc:

```ts
/**
 * Recovers enough runtime projection shape for Admin Console reads when persisted records are old or partial.
 * Use this only on read paths; write paths should still emit schema-valid records.
 */
```

- [ ] **Step 3: Add comment above `dedupeSessionMessages`**

Add this TSDoc:

```ts
/**
 * Collapses assistant stream placeholders with their committed final messages.
 * Equivalence is task-based first and content-prefix based second to avoid duplicate UI answers after stream recovery.
 */
```

- [ ] **Step 4: Add comment above `verifyTelegramWebhook`**

Add this TSDoc:

```ts
/**
 * Verifies Telegram webhook tokens only when the deployment configured one.
 * The no-secret path is kept for local tests and must not be mistaken for production hardening.
 */
```

- [ ] **Step 5: Add comment above `verifyFeishuWebhook`**

Add this TSDoc:

```ts
/**
 * Verifies Feishu token/signature only when matching environment secrets are configured.
 * This helper normalizes vendor webhook auth but does not replace gateway-level network policy.
 */
```

- [ ] **Step 6: Verify backend**

Run:

```bash
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm check:docs
```

Expected: both commands pass.

## Task 4: Add Data Report Patch Comments

**Files:**

- Modify: `agents/data-report/src/flows/data-report-json/nodes/schema-patch-shared-utils.ts`
- Modify: `agents/data-report/src/flows/data-report-json/nodes/schema-patch-filter-utils.ts`
- Modify: `agents/data-report/src/flows/data-report-json/nodes/patch-helpers.ts`
- Modify: `agents/supervisor/src/utils/prompts/runtime-output-sanitizer.ts`

- [ ] **Step 1: Add comment above `resolveFieldFromLabel`**

Add this TSDoc:

```ts
/**
 * Resolves user-facing labels back to schema field names.
 * The lookup prefers explicit table/metric/chart bindings before falling back to normalized text.
 */
```

- [ ] **Step 2: Add comment above `resolveFilterField`**

Add this TSDoc:

```ts
/**
 * Matches the most specific filter field mentioned in a request.
 * Longer labels are tested first so broad labels do not steal edits meant for nested or similarly named fields.
 */
```

- [ ] **Step 3: Add comment above `buildRegeneratedOptions`**

Add this TSDoc:

```ts
/**
 * Provides deterministic option regeneration for known demo fields.
 * Unknown fields keep their existing options because LLM patching owns semantic option discovery.
 */
```

- [ ] **Step 4: Add comment above `resolveNodeScopedPatchTarget`**

Add this TSDoc:

```ts
/**
 * Narrows a patch request to one schema target only when the intent is unambiguous.
 * Ambiguous requests return undefined so the broader patch flow can inspect the full schema.
 */
```

- [ ] **Step 5: Add comment above `applySchemaModificationWithCache`**

Add this TSDoc:

```ts
/**
 * Applies schema patching with a section-scoped cache.
 * The cache key includes affected section ids and a section fingerprint so edits from an older schema are not reused.
 */
```

- [ ] **Step 6: Add comment above `stripOperationalBoilerplate`**

Add this TSDoc:

```ts
/**
 * Removes supervisor/runtime narration before content is reused as model context.
 * This is prompt hygiene, not a Markdown or security sanitizer.
 */
```

- [ ] **Step 7: Verify data-report and supervisor**

Run:

```bash
pnpm exec tsc -p agents/data-report/tsconfig.json --noEmit
pnpm exec tsc -p agents/supervisor/tsconfig.json --noEmit
pnpm check:docs
```

Expected: all commands pass.

## Task 5: Add Frontend Projection Comments

**Files:**

- Modify: `apps/frontend/agent-chat/src/hooks/chat-session/chat-session-message-sync-helpers.ts`
- Modify: `apps/frontend/agent-chat/src/utils/chat-response-step-projections.ts`
- Modify: `apps/frontend/agent-chat/src/utils/chat-trajectory-projections.ts`

- [ ] **Step 1: Add comment above `syncMessageFromEvent`**

Add this TSDoc:

```ts
/**
 * Folds streaming chat events into visible messages while suppressing transient/final assistant duplicates.
 * Keep this aligned with backend session message dedupe semantics.
 */
```

- [ ] **Step 2: Add comment above `foldChatResponseStepProjection`**

Add this TSDoc:

```ts
/**
 * Folds both authoritative snapshots and incremental response-step events into UI state.
 * Snapshots replace message state; event projections upsert one step and derive summary locally.
 */
```

- [ ] **Step 3: Add comment above `buildProjectedEventSummary`**

Add this TSDoc:

```ts
/**
 * Converts wide backend trajectory payloads into tolerant UI copy.
 * Unknown event shapes should degrade to undefined instead of throwing during stream rendering.
 */
```

- [ ] **Step 4: Verify agent-chat**

Run:

```bash
pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit
pnpm check:docs
```

Expected: both commands pass.

## Task 6: Documentation Cleanup And Guardrail

**Files:**

- Modify: `docs/conventions/javascript-typescript-style.md`

- [ ] **Step 1: Extend comment convention with AI-facing utility comment rule**

Under `### 3.11 注释`, append one bullet:

```md
- 工具方法若承担跨边界转换、兼容兜底、缓存 key、重试、脱敏、排序/去重或事件投影语义，应补一段短注释说明调用契约、不可破坏语义或常见误用；注释面向 AI/维护者理解边界，不复述实现步骤。
```

- [ ] **Step 2: Run stale-doc scan**

Run:

```bash
rg -n "注释|comment|JSDoc|TSDoc|工具方法|helper" docs AGENTS.md README.md
```

Expected: no conflicting guidance saying internal utility comments are forbidden. Existing “内部 helper 不强制 JSDoc” can remain because the new rule is selective, not mandatory blanket JSDoc.

- [ ] **Step 3: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: pass.

## Completion Criteria

- All target comments are short and explain hidden contracts rather than implementation mechanics.
- No ordinary UI/business code receives blanket comments.
- `docs/conventions/javascript-typescript-style.md` records the AI-facing utility comment rule.
- Affected TypeScript checks pass for touched packages/apps.
- `pnpm check:docs` passes after documentation changes.
