# Knowledge Chat Lab Codex Routing Implementation Plan

状态：snapshot
文档类型：plan
适用范围：`apps/frontend/knowledge`、`apps/backend/knowledge-server`、`docs/contracts/api/knowledge.md`
最后核对：2026-05-02

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Knowledge Chat Lab into a Codex-style conversation workspace that sends messages and `@knowledge-base` mentions while backend routing selects the retrieval scope.

**Architecture:** Frontend owns local conversation UX and mention extraction only. Backend owns retrieval routing before chunk search, honoring explicit mentions first, then deterministic knowledge-base metadata scoring, then all accessible bases fallback. Existing OpenAI-compatible `/api/chat` request shape and `ChatResponse` response shape remain compatible.

**Tech Stack:** React, Ant Design X, TypeScript, NestJS, zod, Vitest.

---

### Task 1: Frontend Mention And Conversation Helpers

**Files:**

- Create: `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-helpers.ts`
- Test: `apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx`

- [ ] **Step 1: Write failing helper tests**

Add tests covering:

```ts
expect(parseKnowledgeMentions('@前端知识库 core包如何设计的', [knowledgeBase])).toEqual([
  { type: 'knowledge_base', id: 'kb_real_user', label: '前端知识库' }
]);
expect(stripKnowledgeMentions('@前端知识库 core包如何设计的', [knowledgeBase])).toBe('core包如何设计的');
expect(createChatLabConversation('动态导入有什么限制？')).toMatchObject({
  title: '动态导入有什么限制？'
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx`

Expected: FAIL because helper exports do not exist.

- [ ] **Step 3: Implement helpers**

Create helpers for:

- `parseKnowledgeMentions(message, knowledgeBases)`
- `stripKnowledgeMentions(message, knowledgeBases)`
- `createChatLabConversation(seedMessage?)`
- `deriveConversationTitle(message)`

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx`

Expected: PASS.

### Task 2: Codex-Style Chat Lab UI

**Files:**

- Modify: `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-page.tsx`
- Test: `apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx`
- Test: `apps/frontend/knowledge/test/knowledge-production-workflows.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Add assertions that:

```ts
expect(container?.textContent).toContain('新建会话');
expect(container?.textContent).not.toContain('选择对话知识库');
expect(client.chat).toHaveBeenCalledWith({
  model: 'knowledge-rag',
  messages: [{ role: 'user', content: '@前端知识库 动态导入有什么限制？' }],
  metadata: {
    conversationId: expect.any(String),
    debug: true,
    mentions: [{ type: 'knowledge_base', id: 'kb_real_user', label: '前端知识库' }]
  },
  stream: false
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx apps/frontend/knowledge/test/knowledge-production-workflows.test.tsx`

Expected: FAIL because the page still renders the Select and does not send `metadata.mentions`.

- [ ] **Step 3: Implement local conversation state**

Use helpers from Task 1 to manage local conversations. Add a “新建会话” action in the left card and render current conversation messages instead of one fixed `question + response` pair.

- [ ] **Step 4: Implement mention payload**

On submit, send OpenAI-compatible request with:

```ts
{
  model: 'knowledge-rag',
  messages: [{ role: 'user', content: rawMessage }],
  metadata: {
    conversationId: activeConversationKey,
    debug: true,
    mentions
  },
  stream: false
}
```

Do not send `metadata.knowledgeBaseIds` from Chat Lab.

- [ ] **Step 5: Run frontend tests**

Run:

```bash
pnpm exec vitest run apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx apps/frontend/knowledge/test/knowledge-production-workflows.test.tsx
pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit
```

Expected: PASS.

### Task 3: Backend Chat Routing

**Files:**

- Modify: `apps/backend/knowledge-server/src/knowledge/domain/knowledge-document.schemas.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/domain/knowledge-document.types.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge-document.service.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge.errors.ts`
- Test: `apps/backend/knowledge-server/test/knowledge/knowledge-frontend-mvp.controller.test.ts`

- [ ] **Step 1: Write failing backend routing tests**

Add tests for:

```ts
await frontend.chat(actor, {
  model: 'knowledge-rag',
  messages: [{ role: 'user', content: '@Frontend KB dynamic imports?' }],
  metadata: { mentions: [{ type: 'knowledge_base', label: 'Frontend KB' }] },
  stream: false
});
```

Expected behavior:

- Mentioned base is used.
- Missing mention returns `BadRequestException`.
- No mention with keyword hit routes to matching base.
- No mention with no hit searches all accessible bases.

- [ ] **Step 2: Run backend test to verify it fails**

Run: `pnpm exec vitest run apps/backend/knowledge-server/test/knowledge/knowledge-frontend-mvp.controller.test.ts`

Expected: FAIL because `metadata.mentions` is not supported and routing always uses first/default scope.

- [ ] **Step 3: Extend schema and types**

Add:

```ts
export interface KnowledgeChatMention {
  type: 'knowledge_base';
  id?: string;
  label?: string;
}
```

Allow `metadata.mentions?: KnowledgeChatMention[]`.

- [ ] **Step 4: Implement routing in service**

In `KnowledgeDocumentService.chat()`:

- Normalize message and metadata.
- Load accessible bases.
- Resolve legacy `knowledgeBaseIds` first.
- Resolve explicit mentions by id/name.
- Score accessible bases by message terms against name/description/tags.
- Fallback to all accessible bases.

- [ ] **Step 5: Map missing mention error**

Add `knowledge_mention_not_found` to `KnowledgeServerErrorCode` and map it to 400 in `KnowledgeFrontendMvpController`.

- [ ] **Step 6: Run backend checks**

Run:

```bash
pnpm exec vitest run apps/backend/knowledge-server/test/knowledge/knowledge-frontend-mvp.controller.test.ts
pnpm --dir apps/backend/knowledge-server typecheck
```

Expected: PASS.

### Task 4: Docs And Final Verification

**Files:**

- Modify: `docs/contracts/api/knowledge.md`
- Modify: `docs/apps/frontend/knowledge/knowledge-frontend.md`
- Modify: `docs/apps/backend/knowledge-server/knowledge-server.md`

- [ ] **Step 1: Update docs**

Document that Chat Lab no longer sends `knowledgeBaseIds`, uses `metadata.mentions`, and backend routing owns retrieval scope.

- [ ] **Step 2: Run full affected checks**

Run:

```bash
pnpm --dir apps/frontend/knowledge test
pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit
KNOWLEDGE_REPOSITORY=memory DATABASE_URL= pnpm --dir apps/backend/knowledge-server test -- --runInBand
pnpm --dir apps/backend/knowledge-server typecheck
pnpm --dir apps/backend/knowledge-server build
pnpm check:docs
```

Expected: PASS.
