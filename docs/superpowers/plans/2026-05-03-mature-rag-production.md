# Mature RAG Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

状态：snapshot
文档类型：plan
适用范围：`packages/knowledge`、`apps/backend/knowledge-server`、`apps/frontend/knowledge`
最后核对：2026-05-03

**Goal:** Build a production-usable Knowledge Chat Lab backed by LLM-first planning, pgvector semantic retrieval, persistent conversations, selectable RAG model profiles, and clear diagnostics.

**Architecture:** `packages/knowledge` owns stable schema-first RAG contracts and runtime behavior. `apps/backend/knowledge-server` owns product APIs, model profile resolution, conversation/message persistence, provider wiring, pgvector search, fallback keyword search, and SSE/HTTP projection. `apps/frontend/knowledge` consumes only `KnowledgeApiProvider`, renders model profile selection, restores conversations from the backend, and displays planner/retrieval/answer diagnostics.

**Tech Stack:** TypeScript, NestJS, React, Ant Design X, Zod, Vitest, pnpm, Postgres pgvector via existing Knowledge SDK runtime RPC.

---

## Scope Check

This spec spans SDK contracts, backend product APIs, retrieval quality, frontend Chat Lab UX, and docs. It should stay one implementation plan because the accepted target is one vertical product capability: a usable mature RAG Chat Lab. The plan is split into serial tasks that each produce working, testable software in the current checkout. Do not use `git worktree`.

## File Structure Map

- `packages/knowledge/src/rag/schemas/knowledge-rag-result.schema.ts`
  - Extend stable answer diagnostics with planner/retrieval/generation display projections.
- `packages/knowledge/src/rag/schemas/knowledge-rag-stream.schema.ts`
  - Ensure stream events can carry planner and retrieval diagnostics used by the frontend.
- `packages/knowledge/test/knowledge-rag-contracts.test.ts`
  - Contract parse coverage for new diagnostics and stream payloads.
- `apps/backend/knowledge-server/src/knowledge/domain/knowledge-document.types.ts`
  - Product DTOs for `RagModelProfileSummary`, persistent conversations, messages, and diagnostics.
- `apps/backend/knowledge-server/src/knowledge/domain/knowledge-document.schemas.ts`
  - Zod schemas for new API request/response surfaces.
- `apps/backend/knowledge-server/src/knowledge/repositories/knowledge.repository.ts`
  - Repository contract for conversations, messages, and feedback attachment.
- `apps/backend/knowledge-server/src/knowledge/repositories/knowledge-memory.repository.ts`
  - Test/demo persistence implementation.
- `apps/backend/knowledge-server/src/knowledge/repositories/knowledge-postgres.repository.ts`
  - Postgres implementation and table access for conversations/messages.
- `apps/backend/knowledge-server/src/knowledge/runtime/knowledge-schema.sql.ts`
  - SQL schema for conversations/messages if not already present.
- `apps/backend/knowledge-server/src/knowledge/rag/knowledge-rag-model-profile.service.ts`
  - Resolve configured RAG model profiles and expose display-safe summaries.
- `apps/backend/knowledge-server/src/knowledge/rag/knowledge-rag-planner.provider.ts`
  - LLM structured planner provider.
- `apps/backend/knowledge-server/src/knowledge/rag/knowledge-server-search-service.adapter.ts`
  - pgvector-first retrieval adapter with keyword/Chinese substring fallback diagnostics.
- `apps/backend/knowledge-server/src/knowledge/rag/knowledge-rag-sdk.facade.ts`
  - Wire model profile, planner provider, search adapter, diagnostics, and persistent response projection.
- `apps/backend/knowledge-server/src/knowledge/knowledge-rag.service.ts`
  - Persist user/assistant messages and trace outcomes around non-streaming and streaming chat.
- `apps/backend/knowledge-server/src/knowledge/knowledge-document.service.ts`
  - Conversation/message API service methods.
- `apps/backend/knowledge-server/src/knowledge/knowledge-frontend-mvp.controller.ts`
  - Endpoints for model profiles, conversations, messages, chat, and SSE.
- `apps/backend/knowledge-server/test/knowledge/*.spec.ts`
  - Backend tests for model profiles, persistence, planner, retrieval fallback, and streaming completion.
- `apps/frontend/knowledge/src/types/chat.ts`
  - Frontend chat/model/diagnostics types.
- `apps/frontend/knowledge/src/api/knowledge-api-provider.tsx`
  - API contract additions for model profiles and conversations.
- `apps/frontend/knowledge/src/api/knowledge-api-client.ts`
  - Real HTTP client methods.
- `apps/frontend/knowledge/src/api/mock-knowledge-api-client.ts`
  - Mock client parity for tests/demo.
- `apps/frontend/knowledge/src/hooks/use-knowledge-chat.ts`
  - Preserve stream diagnostics and final response mapping.
- `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-page.tsx`
  - Model profile selector, backend conversation loading, diagnostics panel, no fake search button.
- `apps/frontend/knowledge/test/*.test.tsx`
  - Frontend behavior tests.
- `docs/contracts/api/knowledge.md`
  - Canonical API contract update.
- `docs/apps/backend/knowledge-server/knowledge-server.md`
  - Backend architecture update.
- `docs/apps/frontend/knowledge/knowledge-chat-lab.md`
  - Chat Lab product behavior update.

## Task 1: SDK Diagnostics Contract

**Files:**

- Modify: `packages/knowledge/src/rag/schemas/knowledge-rag-result.schema.ts`
- Modify: `packages/knowledge/src/rag/schemas/knowledge-rag-stream.schema.ts`
- Test: `packages/knowledge/test/knowledge-rag-contracts.test.ts`

- [ ] **Step 1: Write failing contract tests**

Add tests that parse the mature diagnostics projection and a `retrieval.completed` event carrying executed queries.

```ts
it('parses mature RAG diagnostics with executed retrieval queries', () => {
  const parsed = KnowledgeRagResultSchema.parse({
    runId: 'rag_run_1',
    plan: {
      id: 'plan_1',
      originalQuery: '检索前技术名词',
      rewrittenQuery: 'PreRetrievalPlanner query rewrite pre-retrieval routing query variants',
      queryVariants: ['PreRetrievalPlanner query rewrite', '检索前规划 查询改写 查询变体'],
      selectedKnowledgeBaseIds: ['kb_core'],
      searchMode: 'hybrid',
      selectionReason: 'Selected SDK knowledge base',
      confidence: 0.86,
      fallbackPolicy: 'search-all-accessible',
      routingDecisions: [{ knowledgeBaseId: 'kb_core', selected: true, source: 'llm', reason: 'SDK terms matched' }],
      diagnostics: {
        planner: 'llm',
        consideredKnowledgeBaseCount: 1,
        rewriteApplied: true,
        fallbackApplied: false,
        durationMs: 12
      }
    },
    retrieval: {
      hits: [],
      citations: [],
      diagnostics: {
        normalizedQuery: 'PreRetrievalPlanner query rewrite pre-retrieval routing query variants',
        queryVariants: ['PreRetrievalPlanner query rewrite', '检索前规划 查询改写 查询变体'],
        executedQueries: [
          { query: 'PreRetrievalPlanner query rewrite', mode: 'vector', hitCount: 2 },
          { query: '检索前规划 查询改写 查询变体', mode: 'keyword', hitCount: 0, fallbackReason: 'vector-no-hit' }
        ],
        effectiveSearchMode: 'hybrid',
        vectorHitCount: 2,
        keywordHitCount: 0,
        finalHitCount: 2
      }
    },
    answer: {
      text: '依据不足。',
      citations: [],
      diagnostics: {
        provider: 'openai-compatible',
        model: 'knowledge-answer',
        durationMs: 30
      }
    },
    diagnostics: {
      durationMs: 50
    }
  });

  expect(parsed.retrieval.diagnostics?.executedQueries).toHaveLength(2);
  expect(parsed.retrieval.diagnostics?.effectiveSearchMode).toBe('hybrid');
});
```

- [ ] **Step 2: Run the failing test**

Run: `pnpm exec vitest run --config vitest.config.js packages/knowledge/test/knowledge-rag-contracts.test.ts`

Expected: FAIL because the current schema rejects `executedQueries`, `effectiveSearchMode`, `vectorHitCount`, `keywordHitCount`, `finalHitCount`, or answer diagnostics.

- [ ] **Step 3: Extend result schemas**

Update the schemas with explicit stable fields.

```ts
export const KnowledgeRagExecutedQuerySchema = z.object({
  query: z.string().min(1),
  mode: z.enum(['vector', 'keyword', 'substring']),
  hitCount: z.number().int().min(0),
  fallbackReason: z.string().min(1).optional()
});

export const KnowledgeRagRetrievalDiagnosticsSchema = z.object({
  normalizedQuery: z.string().min(1).optional(),
  queryVariants: z.array(z.string().min(1)).default([]),
  executedQueries: z.array(KnowledgeRagExecutedQuerySchema).default([]),
  effectiveSearchMode: z.enum(['vector', 'keyword', 'hybrid', 'fallback-keyword', 'none']).optional(),
  vectorHitCount: z.number().int().min(0).optional(),
  keywordHitCount: z.number().int().min(0).optional(),
  finalHitCount: z.number().int().min(0).optional()
});

export const KnowledgeRagAnswerDiagnosticsSchema = z.object({
  provider: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  inputTokens: z.number().int().min(0).optional(),
  outputTokens: z.number().int().min(0).optional(),
  durationMs: z.number().min(0).optional()
});
```

- [ ] **Step 4: Wire schemas into result and stream event contracts**

Use `KnowledgeRagRetrievalDiagnosticsSchema` on retrieval results and `KnowledgeRagAnswerDiagnosticsSchema` on answer results. Ensure `retrieval.completed` and `rag.completed` parse the same diagnostics object.

- [ ] **Step 5: Run contract tests**

Run: `pnpm exec vitest run --config vitest.config.js packages/knowledge/test/knowledge-rag-contracts.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/knowledge/src/rag/schemas/knowledge-rag-result.schema.ts packages/knowledge/src/rag/schemas/knowledge-rag-stream.schema.ts packages/knowledge/test/knowledge-rag-contracts.test.ts
git commit -m "feat: extend knowledge rag diagnostics contract"
```

## Task 2: Backend Model Profiles and Conversation Contracts

**Files:**

- Modify: `apps/backend/knowledge-server/src/knowledge/domain/knowledge-document.types.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/domain/knowledge-document.schemas.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/repositories/knowledge.repository.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/repositories/knowledge-memory.repository.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/repositories/knowledge-postgres.repository.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/runtime/knowledge-schema.sql.ts`
- Create: `apps/backend/knowledge-server/src/knowledge/rag/knowledge-rag-model-profile.service.ts`
- Test: `apps/backend/knowledge-server/test/knowledge/knowledge-rag-model-profile.spec.ts`
- Test: `apps/backend/knowledge-server/test/knowledge/knowledge-conversation-repository.spec.ts`

- [ ] **Step 1: Write failing model profile service tests**

```ts
it('returns display-safe RAG model profile summaries', () => {
  const service = new KnowledgeRagModelProfileService({
    profiles: [
      {
        id: 'coding-pro',
        label: '用于编程',
        description: '更专业的回答与控制',
        useCase: 'coding',
        plannerModelId: 'planner-coding',
        answerModelId: 'answer-coding',
        embeddingModelId: 'embedding-default',
        enabled: true
      }
    ]
  });

  expect(service.listSummaries()).toEqual([
    {
      id: 'coding-pro',
      label: '用于编程',
      description: '更专业的回答与控制',
      useCase: 'coding',
      enabled: true
    }
  ]);
});

it('rejects disabled profiles when resolving for chat', () => {
  const service = new KnowledgeRagModelProfileService({
    profiles: [
      {
        id: 'daily-balanced',
        label: '适合日常工作',
        useCase: 'daily',
        plannerModelId: 'planner-daily',
        answerModelId: 'answer-daily',
        embeddingModelId: 'embedding-default',
        enabled: false
      }
    ]
  });

  expect(() => service.resolveEnabled('daily-balanced')).toThrow('rag_model_profile_disabled');
});
```

- [ ] **Step 2: Write failing conversation repository tests**

```ts
it('persists and lists chat conversations with messages', async () => {
  const repository = createTestKnowledgeRepository();
  const conversation = await repository.createChatConversation({
    userId: 'user_1',
    title: '检索前技术名词',
    activeModelProfileId: 'coding-pro'
  });

  await repository.appendChatMessage({
    conversationId: conversation.id,
    userId: 'user_1',
    role: 'user',
    content: '检索前技术名词',
    modelProfileId: 'coding-pro'
  });

  await repository.appendChatMessage({
    conversationId: conversation.id,
    userId: 'user_1',
    role: 'assistant',
    content: '依据如下。',
    modelProfileId: 'coding-pro',
    citations: [],
    diagnostics: {
      planner: {
        queryVariants: ['PreRetrievalPlanner'],
        selectedKnowledgeBaseIds: ['kb_core'],
        routingDecisions: [],
        confidence: 0.9,
        fallbackApplied: false
      },
      retrieval: {
        effectiveSearchMode: 'vector',
        executedQueries: [{ query: 'PreRetrievalPlanner', mode: 'vector', hitCount: 1 }],
        vectorHitCount: 1,
        keywordHitCount: 0,
        finalHitCount: 1
      }
    }
  });

  await expect(repository.listChatConversationsForUser('user_1')).resolves.toMatchObject({
    items: [expect.objectContaining({ id: conversation.id, activeModelProfileId: 'coding-pro' })]
  });
  await expect(repository.listChatMessages(conversation.id, 'user_1')).resolves.toMatchObject({
    items: [
      expect.objectContaining({ role: 'user', content: '检索前技术名词' }),
      expect.objectContaining({ role: 'assistant', diagnostics: expect.any(Object) })
    ]
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-rag-model-profile.spec.ts apps/backend/knowledge-server/test/knowledge/knowledge-conversation-repository.spec.ts
```

Expected: FAIL because service, repository methods, and schemas do not exist.

- [ ] **Step 4: Add DTO and schema types**

Add backend-local types:

```ts
export interface RagModelProfile {
  id: string;
  label: string;
  description?: string;
  useCase: 'coding' | 'daily' | 'balanced';
  plannerModelId: string;
  answerModelId: string;
  embeddingModelId: string;
  enabled: boolean;
}

export interface RagModelProfileSummary {
  id: string;
  label: string;
  description?: string;
  useCase: 'coding' | 'daily' | 'balanced';
  enabled: boolean;
}

export interface KnowledgeChatConversationRecord {
  id: string;
  userId: string;
  title: string;
  activeModelProfileId: string;
  createdAt: string;
  updatedAt: string;
}
```

Add matching Zod schemas and export them from the existing domain schema barrel used by controllers.

- [ ] **Step 5: Extend repository interface**

Add methods:

```ts
createChatConversation(input: {
  userId: string;
  title: string;
  activeModelProfileId: string;
}): Promise<KnowledgeChatConversationRecord>;

listChatConversationsForUser(userId: string): Promise<PageResult<KnowledgeChatConversationRecord>>;

appendChatMessage(input: CreateKnowledgeChatMessageRecordInput): Promise<KnowledgeChatMessageRecord>;

listChatMessages(conversationId: string, userId: string): Promise<PageResult<KnowledgeChatMessageRecord>>;
```

- [ ] **Step 6: Implement memory repository**

Store conversations and messages in arrays/maps owned by the memory repository instance. Generate IDs with the repository's existing ID helper pattern. Sort conversations by `updatedAt` descending and messages by `createdAt` ascending.

- [ ] **Step 7: Implement Postgres schema and repository methods**

Add SQL tables:

```sql
create table if not exists knowledge_chat_conversations (
  id text primary key,
  user_id text not null,
  title text not null,
  active_model_profile_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knowledge_chat_messages (
  id text primary key,
  conversation_id text not null references knowledge_chat_conversations(id) on delete cascade,
  user_id text not null,
  role text not null,
  content text not null,
  model_profile_id text,
  trace_id text,
  citations jsonb not null default '[]'::jsonb,
  route jsonb,
  diagnostics jsonb,
  feedback jsonb,
  created_at timestamptz not null default now()
);
```

Implement repository methods with parameterized queries and JSON serialization for citations, route, diagnostics, and feedback.

- [ ] **Step 8: Implement model profile service**

Create a service that accepts configured profiles, exposes `listSummaries()`, `resolveEnabled(id?: string)`, and returns the first enabled profile when `id` is omitted.

- [ ] **Step 9: Run tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-rag-model-profile.spec.ts apps/backend/knowledge-server/test/knowledge/knowledge-conversation-repository.spec.ts
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/backend/knowledge-server/src/knowledge/domain apps/backend/knowledge-server/src/knowledge/repositories apps/backend/knowledge-server/src/knowledge/runtime/knowledge-schema.sql.ts apps/backend/knowledge-server/src/knowledge/rag/knowledge-rag-model-profile.service.ts apps/backend/knowledge-server/test/knowledge/knowledge-rag-model-profile.spec.ts apps/backend/knowledge-server/test/knowledge/knowledge-conversation-repository.spec.ts
git commit -m "feat: add knowledge rag model profiles and chat persistence"
```

## Task 3: Backend Conversation and Model Profile APIs

**Files:**

- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge-document.service.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge-frontend-mvp.controller.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge.module.ts`
- Test: `apps/backend/knowledge-server/test/knowledge/knowledge-frontend-mvp.controller.test.ts`

- [ ] **Step 1: Write failing controller tests**

```ts
it('serves RAG model profile summaries', async () => {
  const response = await controller.listRagModelProfiles(makeUser());
  expect(response).toEqual({
    items: [
      expect.objectContaining({
        id: 'coding-pro',
        label: '用于编程',
        useCase: 'coding',
        enabled: true
      })
    ]
  });
});

it('lists persisted conversations and messages', async () => {
  const chat = await controller.chat(makeUser(), {
    model: 'coding-pro',
    messages: [{ role: 'user', content: '检索前技术名词' }],
    stream: false
  });

  const conversations = await controller.listConversations(makeUser(), {});
  expect(conversations.items[0]).toMatchObject({
    id: chat.conversationId,
    activeModelProfileId: 'coding-pro'
  });

  const messages = await controller.listConversationMessages(makeUser(), chat.conversationId, {});
  expect(messages.items.map(item => item.role)).toEqual(['user', 'assistant']);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-frontend-mvp.controller.test.ts`

Expected: FAIL because endpoints and service methods are missing.

- [ ] **Step 3: Register model profile service**

Provide `KnowledgeRagModelProfileService` in `KnowledgeModule` with default profiles:

```ts
[
  {
    id: 'coding-pro',
    label: '用于编程',
    description: '更专业的回答与控制',
    useCase: 'coding',
    plannerModelId: process.env.KNOWLEDGE_PLANNER_MODEL ?? process.env.KNOWLEDGE_CHAT_MODEL ?? 'knowledge-chat',
    answerModelId: process.env.KNOWLEDGE_CHAT_MODEL ?? 'knowledge-chat',
    embeddingModelId: process.env.KNOWLEDGE_EMBEDDING_MODEL ?? 'knowledge-embedding',
    enabled: true
  },
  {
    id: 'daily-balanced',
    label: '适合日常工作',
    description: '同样强大，技术细节更少',
    useCase: 'daily',
    plannerModelId: process.env.KNOWLEDGE_PLANNER_MODEL ?? process.env.KNOWLEDGE_CHAT_MODEL ?? 'knowledge-chat',
    answerModelId: process.env.KNOWLEDGE_CHAT_MODEL ?? 'knowledge-chat',
    embeddingModelId: process.env.KNOWLEDGE_EMBEDDING_MODEL ?? 'knowledge-embedding',
    enabled: true
  }
];
```

- [ ] **Step 4: Add service methods**

Add `listRagModelProfiles(actor)`, `listConversations(actor, query)`, and `listConversationMessages(actor, conversationId, query)` to `KnowledgeDocumentService`.

- [ ] **Step 5: Add controller routes**

Add:

```ts
@Get('rag/model-profiles')
listRagModelProfiles(@CurrentUser() user: KnowledgeActor) {
  return this.requireDocuments().listRagModelProfiles(user);
}

@Get('conversations')
listConversations(@CurrentUser() user: KnowledgeActor, @Query() query: PageQuery) {
  return this.requireDocuments().listConversations(user, query);
}

@Get('conversations/:id/messages')
listConversationMessages(@CurrentUser() user: KnowledgeActor, @Param('id') id: string, @Query() query: PageQuery) {
  return this.requireDocuments().listConversationMessages(user, id, query);
}
```

- [ ] **Step 6: Run controller tests**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-frontend-mvp.controller.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/knowledge-server/src/knowledge/knowledge-document.service.ts apps/backend/knowledge-server/src/knowledge/knowledge-frontend-mvp.controller.ts apps/backend/knowledge-server/src/knowledge/knowledge.module.ts apps/backend/knowledge-server/test/knowledge/knowledge-frontend-mvp.controller.test.ts
git commit -m "feat: expose knowledge chat profiles and conversations"
```

## Task 4: LLM Structured Planner Provider

**Files:**

- Create: `apps/backend/knowledge-server/src/knowledge/rag/knowledge-rag-planner.provider.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/rag/knowledge-rag-sdk.providers.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/rag/knowledge-rag-sdk.facade.ts`
- Test: `apps/backend/knowledge-server/test/knowledge/knowledge-rag-planner-provider.spec.ts`
- Test: `apps/backend/knowledge-server/test/knowledge/knowledge-rag-sdk.facade.spec.ts`

- [ ] **Step 1: Write failing planner provider tests**

```ts
it('uses the chat provider to produce structured planner output', async () => {
  const chatProvider = {
    generate: vi.fn(async () => ({
      text: JSON.stringify({
        rewrittenQuery: 'PreRetrievalPlanner query rewrite pre-retrieval routing query variants',
        queryVariants: ['PreRetrievalPlanner query rewrite', '检索前规划 查询改写 查询变体'],
        selectedKnowledgeBaseIds: ['kb_core'],
        searchMode: 'hybrid',
        selectionReason: 'SDK terms matched',
        confidence: 0.86
      }),
      model: 'planner-model',
      providerId: 'test'
    }))
  };

  const provider = createKnowledgeRagPlannerProvider({
    chatProvider,
    modelProfile: makeProfile({ plannerModelId: 'planner-model' }),
    preferredKnowledgeBaseIds: []
  });

  await expect(
    provider.plan({
      query: '检索前技术名词',
      accessibleKnowledgeBases: [{ id: 'kb_core', name: 'Knowledge SDK' }],
      policy: makeRagPolicy(),
      metadata: {}
    })
  ).resolves.toMatchObject({
    rewrittenQuery: 'PreRetrievalPlanner query rewrite pre-retrieval routing query variants',
    queryVariants: ['PreRetrievalPlanner query rewrite', '检索前规划 查询改写 查询变体'],
    selectedKnowledgeBaseIds: ['kb_core'],
    confidence: 0.86
  });

  expect(chatProvider.generate).toHaveBeenCalledWith(
    expect.objectContaining({
      model: 'planner-model',
      messages: expect.arrayContaining([
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({ role: 'user', content: expect.stringContaining('检索前技术名词') })
      ])
    })
  );
});
```

- [ ] **Step 2: Run planner tests to verify failure**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-rag-planner-provider.spec.ts`

Expected: FAIL because the provider file and model-aware factory do not exist.

- [ ] **Step 3: Implement JSON extraction and schema parse**

Implement `createKnowledgeRagPlannerProvider()` so it:

- Builds a system prompt that asks for JSON only.
- Includes accessible knowledge base summaries.
- Calls `chatProvider.generate({ model: modelProfile.plannerModelId, messages, metadata })`.
- Extracts a JSON object from raw text.
- Parses via `KnowledgeStructuredPlannerProviderResultSchema`.
- Throws a normal `Error` on invalid JSON so SDK fallback handles it.

Use this extraction helper:

````ts
export function extractPlannerJson(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return JSON.parse(trimmed);
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1]);
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error('Planner provider did not return JSON.');
}
````

- [ ] **Step 4: Wire facade to model profiles**

Change `KnowledgeRagSdkFacade` input to include `modelProfile`. Use the LLM planner provider when runtime is enabled. Keep deterministic planner only for disabled runtime or explicit fallback path.

- [ ] **Step 5: Run planner and facade tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-rag-planner-provider.spec.ts apps/backend/knowledge-server/test/knowledge/knowledge-rag-sdk.facade.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/knowledge-server/src/knowledge/rag/knowledge-rag-planner.provider.ts apps/backend/knowledge-server/src/knowledge/rag/knowledge-rag-sdk.providers.ts apps/backend/knowledge-server/src/knowledge/rag/knowledge-rag-sdk.facade.ts apps/backend/knowledge-server/test/knowledge/knowledge-rag-planner-provider.spec.ts apps/backend/knowledge-server/test/knowledge/knowledge-rag-sdk.facade.spec.ts
git commit -m "feat: add llm pre retrieval planner provider"
```

## Task 5: pgvector-First Retrieval Adapter With Fallback

**Files:**

- Modify: `apps/backend/knowledge-server/src/knowledge/rag/knowledge-server-search-service.adapter.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/rag/knowledge-rag-sdk.facade.ts`
- Test: `apps/backend/knowledge-server/test/knowledge/knowledge-server-search-service.adapter.spec.ts`

- [ ] **Step 1: Write failing vector search test**

```ts
it('executes vector search for query variants before keyword fallback', async () => {
  const vectorStore = {
    search: vi.fn(async input => ({
      hits: [
        {
          chunkId: 'chunk_1',
          documentId: 'doc_1',
          sourceId: 'doc_1',
          knowledgeBaseId: input.filters.knowledgeBaseIds[0],
          title: 'RAG SDK',
          content: 'PreRetrievalPlanner supports query rewrite.',
          score: 0.92,
          citation: {
            sourceId: 'doc_1',
            chunkId: 'chunk_1',
            title: 'RAG SDK',
            quote: 'PreRetrievalPlanner supports query rewrite.'
          }
        }
      ],
      total: 1
    }))
  };
  const embeddingProvider = {
    embedText: vi.fn(async ({ text }) => ({ embedding: [text.length], model: 'embedding-default' }))
  };
  const adapter = new KnowledgeServerSearchServiceAdapter(makeRepository(), {
    vectorStore,
    embeddingProvider
  });

  const result = await adapter.search({
    query: 'PreRetrievalPlanner query rewrite',
    filters: { knowledgeBaseIds: ['kb_core'] },
    limit: 5,
    queryVariants: ['PreRetrievalPlanner query rewrite', '检索前规划 查询改写']
  });

  expect(embeddingProvider.embedText).toHaveBeenCalledTimes(2);
  expect(vectorStore.search).toHaveBeenCalledTimes(2);
  expect(result.hits[0].score).toBeGreaterThan(0.9);
  expect(result.diagnostics.executedQueries[0]).toMatchObject({
    query: 'PreRetrievalPlanner query rewrite',
    mode: 'vector',
    hitCount: 1
  });
});
```

- [ ] **Step 2: Write failing Chinese substring fallback test**

```ts
it('falls back to Chinese substring search when vector has no hits', async () => {
  const repository = makeRepositoryWithReadyChunk({
    baseId: 'kb_core',
    documentId: 'doc_1',
    chunkId: 'chunk_1',
    content: '这里解释检索前技术名词和查询改写。'
  });
  const adapter = new KnowledgeServerSearchServiceAdapter(repository, {
    vectorStore: { search: vi.fn(async () => ({ hits: [], total: 0 })) },
    embeddingProvider: { embedText: vi.fn(async () => ({ embedding: [1], model: 'embedding-default' })) }
  });

  const result = await adapter.search({
    query: '检索前技术名词',
    filters: { knowledgeBaseIds: ['kb_core'] },
    limit: 5,
    queryVariants: ['检索前技术名词']
  });

  expect(result.hits).toHaveLength(1);
  expect(result.diagnostics.effectiveSearchMode).toBe('fallback-keyword');
  expect(result.diagnostics.executedQueries).toEqual(
    expect.arrayContaining([expect.objectContaining({ query: '检索前技术名词', mode: 'substring', hitCount: 1 })])
  );
});
```

- [ ] **Step 3: Run adapter tests to verify failure**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-server-search-service.adapter.spec.ts`

Expected: FAIL because adapter only supports token scoring and lacks vector dependencies/diagnostics.

- [ ] **Step 4: Extend adapter constructor**

Accept dependencies:

```ts
interface KnowledgeServerSearchServiceAdapterOptions {
  vectorStore?: {
    search(input: {
      query: string;
      embedding: number[];
      filters: { knowledgeBaseIds: string[] };
      limit: number;
    }): Promise<RetrievalResult>;
  };
  embeddingProvider?: {
    embedText(input: { text: string }): Promise<{ embedding: number[]; model: string }>;
  };
}
```

- [ ] **Step 5: Implement vector-first search**

For each query variant, call `embeddingProvider.embedText()`, then `vectorStore.search()`. Merge hits by `documentId + chunkId`, keeping the highest score. Record each vector query in `executedQueries`.

- [ ] **Step 6: Implement fallback keyword and substring search**

Use repository chunks only when vector has zero hits or vector dependencies are absent. Implement:

```ts
function buildChinesePhrases(query: string): string[] {
  const compact = query.replace(/\s+/g, '');
  if (!/[\u4e00-\u9fa5]/u.test(compact)) {
    return [];
  }
  const phrases = new Set<string>();
  if (compact.length >= 2) {
    phrases.add(compact);
  }
  for (let size = 4; size >= 2; size -= 1) {
    for (let index = 0; index <= compact.length - size; index += 1) {
      phrases.add(compact.slice(index, index + size));
    }
  }
  return [...phrases];
}
```

Score substring hits below vector hits:

```ts
const substringScore = Math.min(0.65, 0.35 + (matchedPhraseCount / Math.max(phrases.length, 1)) * 0.3);
```

- [ ] **Step 7: Return diagnostics**

Attach:

```ts
{
  (executedQueries, effectiveSearchMode, vectorHitCount, keywordHitCount, finalHitCount);
}
```

- [ ] **Step 8: Wire facade runtime dependencies**

Construct the adapter with `sdkRuntime.runtime.vectorStore` and `sdkRuntime.runtime.embeddingProvider` when enabled. Keep repository-only fallback when disabled.

- [ ] **Step 9: Run adapter tests**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-server-search-service.adapter.spec.ts`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/backend/knowledge-server/src/knowledge/rag/knowledge-server-search-service.adapter.ts apps/backend/knowledge-server/src/knowledge/rag/knowledge-rag-sdk.facade.ts apps/backend/knowledge-server/test/knowledge/knowledge-server-search-service.adapter.spec.ts
git commit -m "feat: add pgvector first knowledge retrieval"
```

## Task 6: Persist Chat Results and SSE Completion

**Files:**

- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge-rag.service.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge-document.service.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/rag/knowledge-rag-sdk.facade.ts`
- Test: `apps/backend/knowledge-server/test/knowledge/knowledge-document-chat.service.spec.ts`
- Test: `apps/backend/knowledge-server/test/knowledge/knowledge-chat-stream.spec.ts`

- [ ] **Step 1: Write failing non-stream persistence test**

```ts
it('persists user and assistant messages for non-stream chat', async () => {
  const service = makeKnowledgeDocumentService();
  const response = await service.chat(makeActor('user_1'), {
    model: 'coding-pro',
    messages: [{ role: 'user', content: '检索前技术名词' }],
    stream: false
  });

  const messages = await repository.listChatMessages(response.conversationId, 'user_1');
  expect(messages.items).toEqual([
    expect.objectContaining({ role: 'user', content: '检索前技术名词', modelProfileId: 'coding-pro' }),
    expect.objectContaining({
      role: 'assistant',
      content: response.answer,
      traceId: response.traceId,
      diagnostics: expect.any(Object),
      citations: response.citations
    })
  ]);
});
```

- [ ] **Step 2: Write failing SSE completion persistence test**

```ts
it('persists final assistant message after rag.completed stream event', async () => {
  const service = makeKnowledgeDocumentService();
  const events: unknown[] = [];

  for await (const event of service.streamChat(makeActor('user_1'), {
    model: 'coding-pro',
    messages: [{ role: 'user', content: '检索前技术名词' }],
    stream: true
  })) {
    events.push(event);
  }

  expect(events.some(event => isRecord(event) && event.type === 'rag.completed')).toBe(true);
  const conversationId = readCompletedConversationId(events);
  const messages = await repository.listChatMessages(conversationId, 'user_1');
  expect(messages.items.map(item => item.role)).toEqual(['user', 'assistant']);
  expect(messages.items[1]).toMatchObject({ diagnostics: expect.any(Object), modelProfileId: 'coding-pro' });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-document-chat.service.spec.ts apps/backend/knowledge-server/test/knowledge/knowledge-chat-stream.spec.ts
```

Expected: FAIL because chat response is not persisted or stream completion is not written.

- [ ] **Step 4: Resolve model profile in chat service**

In `KnowledgeDocumentService.chat()` and `streamChat()`, resolve the model profile from `input.model`. Pass it into `KnowledgeRagService`.

- [ ] **Step 5: Create or reuse conversation**

If `metadata.conversationId` exists, verify it belongs to actor and append to it. If it is absent, create a conversation with title derived from the user message and `activeModelProfileId`.

- [ ] **Step 6: Persist user message before RAG execution**

Persist the user message with role `user`, content, modelProfileId, and conversationId before calling RAG. This makes failed answer attempts visible for retry.

- [ ] **Step 7: Persist assistant message after success**

After non-streaming success or stream `rag.completed`, persist role `assistant` with answer text, citations, route, diagnostics, traceId, and modelProfileId.

- [ ] **Step 8: Mark failed traces without success message**

On provider error or stream interruption, finish trace as error. Do not write a successful assistant message. If the repository supports failed assistant records, use role `assistant` with `metadata.status = "failed"`; otherwise leave only the user message.

- [ ] **Step 9: Run persistence tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-document-chat.service.spec.ts apps/backend/knowledge-server/test/knowledge/knowledge-chat-stream.spec.ts
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/backend/knowledge-server/src/knowledge/knowledge-rag.service.ts apps/backend/knowledge-server/src/knowledge/knowledge-document.service.ts apps/backend/knowledge-server/src/knowledge/rag/knowledge-rag-sdk.facade.ts apps/backend/knowledge-server/test/knowledge/knowledge-document-chat.service.spec.ts apps/backend/knowledge-server/test/knowledge/knowledge-chat-stream.spec.ts
git commit -m "feat: persist knowledge chat conversations"
```

## Task 7: Frontend API and Types

**Files:**

- Modify: `apps/frontend/knowledge/src/types/chat.ts`
- Modify: `apps/frontend/knowledge/src/api/knowledge-api-provider.tsx`
- Modify: `apps/frontend/knowledge/src/api/knowledge-api-client.ts`
- Modify: `apps/frontend/knowledge/src/api/mock-knowledge-api-client.ts`
- Test: `apps/frontend/knowledge/test/knowledge-api-client.test.ts`
- Test: `apps/frontend/knowledge/test/knowledge-api-provider.test.tsx`

- [ ] **Step 1: Write failing API client tests**

```ts
it('fetches RAG model profiles', async () => {
  const fetcher = vi.fn(async () =>
    jsonResponse({
      items: [{ id: 'coding-pro', label: '用于编程', useCase: 'coding', enabled: true }]
    })
  );
  const client = new KnowledgeApiClient({ baseUrl: 'http://knowledge.local/api', fetcher });

  await expect(client.listRagModelProfiles()).resolves.toEqual({
    items: [{ id: 'coding-pro', label: '用于编程', useCase: 'coding', enabled: true }]
  });
  expect(fetcher).toHaveBeenCalledWith(
    'http://knowledge.local/api/rag/model-profiles',
    expect.objectContaining({ method: 'GET' })
  );
});

it('fetches conversation messages', async () => {
  const fetcher = vi.fn(async () => jsonResponse({ items: [], total: 0, page: 1, pageSize: 20 }));
  const client = new KnowledgeApiClient({ baseUrl: 'http://knowledge.local/api', fetcher });

  await client.listConversationMessages('conv_1');
  expect(fetcher).toHaveBeenCalledWith(
    'http://knowledge.local/api/conversations/conv_1/messages',
    expect.objectContaining({ method: 'GET' })
  );
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm exec vitest run --config vitest.config.js apps/frontend/knowledge/test/knowledge-api-client.test.ts apps/frontend/knowledge/test/knowledge-api-provider.test.tsx`

Expected: FAIL because API methods and types are missing.

- [ ] **Step 3: Add frontend types**

Add:

```ts
export interface RagModelProfileSummary {
  id: ID;
  label: string;
  description?: string;
  useCase: 'coding' | 'daily' | 'balanced';
  enabled: boolean;
}

export interface KnowledgeChatConversation {
  id: ID;
  title: string;
  activeModelProfileId: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
```

Extend diagnostics to include planner/retrieval/generation nested fields matching the backend contract.

- [ ] **Step 4: Add provider interface methods**

Add:

```ts
listRagModelProfiles(): Promise<{ items: RagModelProfileSummary[] }>;
listConversations(): Promise<PageResult<KnowledgeChatConversation>>;
listConversationMessages(conversationId: ID): Promise<PageResult<ChatMessage>>;
```

- [ ] **Step 5: Implement real client methods**

Use GET paths:

- `/rag/model-profiles`
- `/conversations`
- `/conversations/:id/messages`

- [ ] **Step 6: Implement mock client parity**

Return two model profiles and persist mock conversations/messages in memory so tests and demo behave like the real API.

- [ ] **Step 7: Run API tests**

Run: `pnpm exec vitest run --config vitest.config.js apps/frontend/knowledge/test/knowledge-api-client.test.ts apps/frontend/knowledge/test/knowledge-api-provider.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/knowledge/src/types/chat.ts apps/frontend/knowledge/src/api/knowledge-api-provider.tsx apps/frontend/knowledge/src/api/knowledge-api-client.ts apps/frontend/knowledge/src/api/mock-knowledge-api-client.ts apps/frontend/knowledge/test/knowledge-api-client.test.ts apps/frontend/knowledge/test/knowledge-api-provider.test.tsx
git commit -m "feat: add knowledge chat profile and conversation api"
```

## Task 8: Chat Lab Model Selector and Conversation Restore

**Files:**

- Modify: `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-page.tsx`
- Modify: `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-helpers.ts`
- Modify: `apps/frontend/knowledge/src/hooks/use-knowledge-chat.ts`
- Test: `apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx`
- Test: `apps/frontend/knowledge/test/knowledge-production-workflows.test.tsx`

- [ ] **Step 1: Write failing Chat Lab restore test**

```tsx
it('restores conversations from the backend when switching Chat Lab pages', async () => {
  renderWithKnowledgeApi(<ChatLabPage />, {
    api: makeKnowledgeApi({
      conversations: [
        {
          id: 'conv_1',
          title: '检索前技术名词',
          activeModelProfileId: 'coding-pro',
          createdAt: '2026-05-03T00:00:00.000Z',
          updatedAt: '2026-05-03T00:00:00.000Z'
        }
      ],
      messages: {
        conv_1: [
          {
            id: 'msg_1',
            conversationId: 'conv_1',
            role: 'assistant',
            content: 'PreRetrievalPlanner 是检索前规划器。',
            citations: [],
            createdAt: '2026-05-03T00:00:00.000Z'
          }
        ]
      }
    })
  });

  expect(await screen.findByText('检索前技术名词')).toBeInTheDocument();
  await userEvent.click(screen.getByText('检索前技术名词'));
  expect(await screen.findByText('PreRetrievalPlanner 是检索前规划器。')).toBeInTheDocument();
});
```

- [ ] **Step 2: Write failing model selector test**

```tsx
it('sends the selected RAG model profile when asking a question', async () => {
  const send = vi.fn(async () => makeChatResponse({ conversationId: 'conv_1' }));
  renderWithKnowledgeApi(<ChatLabPage />, {
    api: makeKnowledgeApi({
      modelProfiles: [
        { id: 'coding-pro', label: '用于编程', description: '更专业的回答与控制', useCase: 'coding', enabled: true },
        {
          id: 'daily-balanced',
          label: '适合日常工作',
          description: '同样强大，技术细节更少',
          useCase: 'daily',
          enabled: true
        }
      ],
      chat: send
    })
  });

  await userEvent.click(await screen.findByText('适合日常工作'));
  await userEvent.type(screen.getByPlaceholderText('要求后续变更'), '检索前技术名词');
  await userEvent.keyboard('{Enter}');

  expect(send).toHaveBeenCalledWith(expect.objectContaining({ model: 'daily-balanced' }));
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx apps/frontend/knowledge/test/knowledge-production-workflows.test.tsx
```

Expected: FAIL because Chat Lab uses local-only conversations and hard-coded `knowledge-rag`.

- [ ] **Step 4: Load model profiles and conversations on mount**

Use `api.listRagModelProfiles()` and `api.listConversations()` in effects. Keep loading and error states display-safe.

- [ ] **Step 5: Render card-style model selector**

Render enabled profile cards in the top bar. Use selected state similar to the reference image:

- `用于编程`
- `适合日常工作`

Do not expose raw planner/answer/embedding model IDs.

- [ ] **Step 6: Restore messages on conversation switch**

When `activeConversationKey` changes to a backend conversation id, call `api.listConversationMessages(id)` and replace that conversation's messages with returned messages.

- [ ] **Step 7: Send selected model**

Replace hard-coded `model: 'knowledge-rag'` with selected profile id. If none is selected, use the first enabled profile id returned by the API.

- [ ] **Step 8: Remove or downgrade fake search button**

If search has no backend endpoint, remove the button from the sidebar. If keeping it, make it filter loaded conversation labels locally.

- [ ] **Step 9: Run Chat Lab tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx apps/frontend/knowledge/test/knowledge-production-workflows.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/frontend/knowledge/src/pages/chat-lab/chat-lab-page.tsx apps/frontend/knowledge/src/pages/chat-lab/chat-lab-helpers.ts apps/frontend/knowledge/src/hooks/use-knowledge-chat.ts apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx apps/frontend/knowledge/test/knowledge-production-workflows.test.tsx
git commit -m "feat: restore knowledge chat conversations"
```

## Task 9: Chat Lab Diagnostics Panel

**Files:**

- Modify: `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-page.tsx`
- Modify: `apps/frontend/knowledge/src/hooks/use-knowledge-chat.ts`
- Test: `apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx`

- [ ] **Step 1: Write failing diagnostics test**

```tsx
it('shows planner and retrieval diagnostics for a completed answer', async () => {
  renderWithKnowledgeApi(<ChatLabPage />, {
    api: makeKnowledgeApi({
      conversations: [makeConversation({ id: 'conv_1' })],
      messages: {
        conv_1: [
          makeAssistantMessage({
            content: '依据不足。',
            diagnostics: {
              planner: {
                rewrittenQuery: 'PreRetrievalPlanner query rewrite',
                queryVariants: ['PreRetrievalPlanner query rewrite', '检索前规划'],
                selectedKnowledgeBaseIds: ['kb_core'],
                routingDecisions: [{ knowledgeBaseId: 'kb_core', selected: true, reason: 'SDK terms matched' }],
                confidence: 0.86,
                fallbackApplied: false
              },
              retrieval: {
                effectiveSearchMode: 'fallback-keyword',
                executedQueries: [
                  { query: 'PreRetrievalPlanner query rewrite', mode: 'vector', hitCount: 0 },
                  { query: '检索前规划', mode: 'substring', hitCount: 1, fallbackReason: 'vector-no-hit' }
                ],
                vectorHitCount: 0,
                keywordHitCount: 1,
                finalHitCount: 1
              }
            }
          })
        ]
      }
    })
  });

  await userEvent.click(await screen.findByText('检索诊断'));
  expect(screen.getByText('PreRetrievalPlanner query rewrite')).toBeInTheDocument();
  expect(screen.getByText('fallback-keyword')).toBeInTheDocument();
  expect(screen.getByText('vector-no-hit')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run diagnostics test to verify failure**

Run: `pnpm exec vitest run --config vitest.config.js apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx`

Expected: FAIL because diagnostics panel is not rendered.

- [ ] **Step 3: Preserve stream diagnostics**

In `useKnowledgeChat`, update `toChatResponse()` so `planner.completed`, `retrieval.completed`, `answer.completed`, and `rag.completed` progressively merge diagnostics into `streamState` and final `ChatResponse`.

- [ ] **Step 4: Render diagnostics panel**

Add a compact collapsible block under assistant messages named `检索诊断`. Display:

- Planner rewritten query and variants.
- Selected knowledge bases and confidence.
- Retrieval effective mode.
- Executed query rows with mode, hit count, fallback reason.
- Generation provider/model/token usage when present.

- [ ] **Step 5: Run diagnostics test**

Run: `pnpm exec vitest run --config vitest.config.js apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/knowledge/src/pages/chat-lab/chat-lab-page.tsx apps/frontend/knowledge/src/hooks/use-knowledge-chat.ts apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx
git commit -m "feat: show knowledge rag diagnostics"
```

## Task 10: API and Module Documentation

**Files:**

- Modify: `docs/contracts/api/knowledge.md`
- Modify: `docs/apps/backend/knowledge-server/knowledge-server.md`
- Modify: `docs/apps/frontend/knowledge/knowledge-chat-lab.md`
- Modify if contradicted: `docs/superpowers/specs/2026-05-03-knowledge-rag-sdk-runtime-architecture-design.md`
- Modify if contradicted: `docs/superpowers/specs/2026-05-03-trustworthy-rag-workbench-design.md`

- [ ] **Step 1: Update API contract**

In `docs/contracts/api/knowledge.md`, replace the old `stream:true 尚未承诺` paragraph with:

```markdown
`stream: true` is supported for `POST /chat` through Server-Sent Events. The server emits SDK RAG events including `planner.completed`, `retrieval.completed`, `answer.delta`, `answer.completed`, `rag.completed`, and `rag.error`. Clients must treat `rag.completed.result` as the final persisted answer projection.
```

Add sections for:

- `GET /rag/model-profiles`
- `GET /conversations`
- `GET /conversations/:id/messages`
- mature `KnowledgeChatDiagnostics`

- [ ] **Step 2: Update backend module doc**

Document that `knowledge-server` owns:

- RAG model profiles.
- LLM structured planner provider.
- pgvector-first retrieval adapter.
- keyword/Chinese substring fallback.
- persistent conversations/messages.

- [ ] **Step 3: Update frontend Chat Lab doc**

Document:

- Model selector behavior.
- Backend conversation restoration.
- Diagnostics panel.
- Citation grounding.
- No fake search button behavior.

- [ ] **Step 4: Check older RAG docs for contradiction**

If an older doc says Chat Lab is deterministic-only, stream is unsupported, or query variants are not displayed, update the line to point to this production plan or mark it as superseded by the mature RAG plan.

- [ ] **Step 5: Run docs check**

Run: `pnpm check:docs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add docs/contracts/api/knowledge.md docs/apps/backend/knowledge-server/knowledge-server.md docs/apps/frontend/knowledge/knowledge-chat-lab.md docs/superpowers/specs/2026-05-03-knowledge-rag-sdk-runtime-architecture-design.md docs/superpowers/specs/2026-05-03-trustworthy-rag-workbench-design.md
git commit -m "docs: update mature knowledge rag contracts"
```

## Task 11: Affected Verification and Cleanup

**Files:**

- Inspect: all files changed by Tasks 1-10.
- Modify only if needed: stale exports, fake UI controls, obsolete docs.

- [ ] **Step 1: Run package-level knowledge tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/knowledge-rag-contracts.test.ts packages/knowledge/test/run-knowledge-rag.test.ts packages/knowledge/test/stream-knowledge-rag.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run backend knowledge-server tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge
```

Expected: PASS.

- [ ] **Step 3: Run frontend knowledge tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/knowledge/test
```

Expected: PASS.

- [ ] **Step 4: Run affected TypeScript checks**

Run:

```bash
pnpm exec tsc -p apps/backend/knowledge-server/tsconfig.json --noEmit
pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit
```

Expected: PASS.

- [ ] **Step 5: Run docs check**

Run: `pnpm check:docs`

Expected: PASS.

- [ ] **Step 6: Inspect for dead code and fake controls**

Run:

```bash
rg -n "knowledge-rag|stream:true 尚未承诺|Selected all accessible knowledge bases by deterministic planner fallback|搜索" apps/frontend/knowledge apps/backend/knowledge-server docs/contracts/api docs/apps docs/superpowers/specs
```

Expected:

- No frontend request is hard-coded to `model: 'knowledge-rag'`.
- No current API doc says `stream:true 尚未承诺`.
- Deterministic planner fallback text only appears in fallback tests or fallback implementation.
- Chat Lab search control is either real local filtering or removed.

- [ ] **Step 7: Commit cleanup if any file changed**

```bash
git add apps/frontend/knowledge apps/backend/knowledge-server packages/knowledge docs
git commit -m "chore: clean up mature rag integration"
```

Skip this commit if Step 6 requires no changes.

## Final Verification Matrix

Before claiming the plan is complete, run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/knowledge-rag-contracts.test.ts packages/knowledge/test/run-knowledge-rag.test.ts packages/knowledge/test/stream-knowledge-rag.test.ts
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge
pnpm exec vitest run --config vitest.config.js apps/frontend/knowledge/test
pnpm exec tsc -p apps/backend/knowledge-server/tsconfig.json --noEmit
pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit
pnpm check:docs
```

If a command is blocked by unrelated existing red lights, record:

- command run,
- failing layer,
- exact blocker,
- whether the blocker belongs to this plan.

## Self-Review

- Spec coverage:
  - LLM-first planner provider: Task 4.
  - query rewrite and query variants execution: Tasks 4 and 5.
  - pgvector semantic retrieval: Task 5.
  - keyword / Chinese substring fallback: Task 5.
  - model profile selection: Tasks 2, 3, 7, 8.
  - persistent conversations/messages: Tasks 2, 3, 6, 8.
  - planner/retrieval/answer diagnostics: Tasks 1, 5, 6, 9.
  - SSE completion persistence: Task 6.
  - docs and stale description cleanup: Task 10.
  - verification: Task 11.
- Placeholder scan:
  - This plan has no unresolved placeholder markers or open-ended implementation steps.
- Type consistency:
  - `RagModelProfile` is backend internal.
  - `RagModelProfileSummary` is frontend/API display.
  - `KnowledgeChatDiagnostics` contains `planner`, `retrieval`, and optional `generation`.
  - `executedQueries` uses `mode: 'vector' | 'keyword' | 'substring'`.
