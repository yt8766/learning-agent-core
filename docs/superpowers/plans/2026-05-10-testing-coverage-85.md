# Testing Coverage 85 Implementation Plan

状态：completed
文档类型：plan
适用范围：根级 `test/`、`packages/*/test`、`agents/*/test`、`apps/**/test`、`packages/*/demo`
最后核对：2026-05-10

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `pnpm test:coverage` run to completion and reach `>= 85%` for global and configured project-level coverage thresholds.

**Architecture:** Treat this as a staged verification hardening effort: clear existing red tests first, calibrate coverage only for non-runtime files, then add high-value TDD tests by package/app using the generated coverage summary. Keep all work in the current checkout; this repository forbids `git worktree`.

**Tech Stack:** Vitest 4, V8 coverage, Nest testing utilities, React Testing Library, TypeScript, pnpm workspace scripts, existing package `test/` and `demo/` conventions.

---

## Files And Responsibilities

- Modify `packages/adapters/test/minimax-chat-model.factory.test.ts`: replace real `http.Server.listen(0)` with a constructor-level `ChatOpenAI` mock so the MiniMax request-shape contract is tested without opening a port.
- Modify `test/smoke/backend/backend-http-app.smoke.ts`: replace real HTTP `supertest` port binding with a Nest module/controller-level smoke that proves `AppModule` compiles and `/health` remains contract-compatible.
- Modify `apps/backend/agent-server/test/platform/knowledge-ingestion.http-smoke.spec.ts`: replace `supertest(app.getHttpServer())` calls with direct controller invocations while preserving ingestion + runtime-center projection assertions.
- Modify `vitest.config.js`: exclude only non-runtime coverage noise that meets the design rules, such as pure type files, barrel-only entries, and frontend bootstrap files.
- Create `scripts/summarize-coverage-gaps.js`: deterministic local helper that reads `artifacts/coverage/vitest/coverage-summary.json` and prints ranked gaps by configured scope.
- Modify `docs/packages/evals/testing-coverage-baseline.md`: update the current baseline after each meaningful coverage milestone.
- Modify `docs/conventions/test-conventions.md`: document allowed and forbidden coverage exclusions.
- Add or modify tests under:
  - `packages/runtime/test/**`
  - `apps/backend/agent-server/test/**`
  - `apps/frontend/agent-chat/test/**`
  - `apps/frontend/agent-admin/test/**`
  - `apps/frontend/knowledge/test/**`
  - `packages/tools/test/**`
  - `packages/skill/test/**`
  - `packages/templates/test/**`
  - `agents/audio/test/**`
  - `agents/video/test/**`

## Task 1: Make MiniMax Adapter Test Sandbox-Safe

**Files:**

- Modify: `packages/adapters/test/minimax-chat-model.factory.test.ts`
- Read: `packages/adapters/src/minimax/chat/minimax-chat-model.factory.ts`
- Read: `packages/adapters/src/openai-compatible/chat/chat-openai-model.factory.ts`

- [ ] **Step 1: Replace the port-listening test with a failing constructor-contract test**

Use this test shape:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const chatOpenAIMock = vi.fn();

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: chatOpenAIMock
}));

describe('createMiniMaxChatModel', () => {
  beforeEach(() => {
    chatOpenAIMock.mockReset();
    chatOpenAIMock.mockImplementation(function ChatOpenAITestDouble(this: unknown, options: unknown) {
      return { __options: options };
    });
  });

  it('uses only MiniMax-compatible chat settings when constructing the model', async () => {
    const { createMiniMaxChatModel } = await import('../src/minimax/chat/minimax-chat-model.factory');

    const model = createMiniMaxChatModel({
      model: 'MiniMax-M2.7',
      apiKey: 'test-key',
      baseUrl: 'https://example.test/minimax/v1',
      streamUsage: false,
      thinking: false,
      temperature: 0.2,
      maxTokens: 1200
    });

    expect(model).toEqual({
      __options: expect.objectContaining({
        model: 'MiniMax-M2.7',
        apiKey: 'test-key',
        streamUsage: false,
        maxTokens: undefined,
        temperature: undefined,
        configuration: { baseURL: 'https://example.test/minimax/v1' },
        modelKwargs: { max_completion_tokens: 1200 }
      })
    });
    expect(chatOpenAIMock).toHaveBeenCalledTimes(1);
    expect(chatOpenAIMock.mock.calls[0]?.[0]).not.toHaveProperty('thinking');
  });

  it('caps MiniMax max_completion_tokens at 2048 and omits invalid values', async () => {
    const { createMiniMaxChatModel } = await import('../src/minimax/chat/minimax-chat-model.factory');

    createMiniMaxChatModel({ model: 'MiniMax-M2.7', apiKey: 'test-key', maxTokens: 9000 });
    createMiniMaxChatModel({ model: 'MiniMax-M2.7', apiKey: 'test-key', maxTokens: 0 });

    expect(chatOpenAIMock.mock.calls[0]?.[0]).toMatchObject({
      modelKwargs: { max_completion_tokens: 2048 }
    });
    expect(chatOpenAIMock.mock.calls[1]?.[0]).not.toHaveProperty('modelKwargs');
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails before any production change**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/adapters/test/minimax-chat-model.factory.test.ts
```

Expected before the edit is complete: failure from the old `listen EPERM` or from mismatched constructor assertions.

- [ ] **Step 3: Make the test pass without touching production code**

The production factory already normalizes MiniMax options; the intended implementation change is only the test rewrite. If the constructor assertion exposes a real mismatch, fix `packages/adapters/src/minimax/chat/minimax-chat-model.factory.ts` instead of relaxing the assertion.

- [ ] **Step 4: Verify the adapter scope**

Run:

```bash
pnpm --dir packages/adapters test
```

Expected: all `packages/adapters/test` unit tests pass without opening a local HTTP port.

## Task 2: Make Backend Smoke Tests Sandbox-Safe

**Files:**

- Modify: `test/smoke/backend/backend-http-app.smoke.ts`
- Modify: `apps/backend/agent-server/test/platform/knowledge-ingestion.http-smoke.spec.ts`
- Read: `apps/backend/agent-server/src/app/app.controller.ts`
- Read: `apps/backend/agent-server/src/platform/knowledge-ingestion.controller.ts`
- Read: `apps/backend/agent-server/src/platform/runtime-center.controller.ts`

- [ ] **Step 1: Rewrite the backend health smoke around Nest module compilation and controller invocation**

Use this shape in `test/smoke/backend/backend-http-app.smoke.ts`:

```ts
import type { INestApplication } from '../../../apps/backend/agent-server/node_modules/@nestjs/common';
import { NestFactory } from '../../../apps/backend/agent-server/node_modules/@nestjs/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { HealthCheckResultSchema } from '@agent/core';

import { AppController } from '../../../apps/backend/agent-server/src/app/app.controller';
import { AppModule } from '../../../apps/backend/agent-server/src/app.module';

const BACKEND_HTTP_APP_HOOK_TIMEOUT_MS = 30_000;

describe('backend app smoke', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    await app.init();
  }, BACKEND_HTTP_APP_HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await app?.close();
  });

  it('boots the real Nest application module and serves the health contract through AppController', async () => {
    const response = await app.get(AppController).health();

    expect(response).toMatchObject({
      status: 'ok',
      service: 'server',
      knowledgeSearchStatus: {
        configuredMode: expect.any(String),
        effectiveMode: expect.any(String),
        vectorConfigured: expect.any(Boolean),
        hybridEnabled: expect.any(Boolean)
      }
    });
    expect(() => HealthCheckResultSchema.parse(response)).not.toThrow();
  });
});
```

- [ ] **Step 2: Rewrite knowledge ingestion smoke to call controllers directly**

Keep the existing `beforeEach` testing module. Replace each `request(server).post(...).send(...).expect(...)` with direct calls on:

```ts
const knowledgeController = app.get(KnowledgeIngestionController);
const runtimeCenterController = app.get(RuntimeCenterController);
```

For the first test, use this assertion shape:

```ts
const ingestResult = await knowledgeController.ingestSources({
  payloads: [
    {
      sourceId: 'upload-smoke-1',
      sourceType: 'user-upload',
      uri: '/uploads/runtime-policy.md',
      title: 'Runtime Policy Upload',
      trustClass: 'internal',
      content: 'runtime policy upload content for backend smoke',
      metadata: {
        docType: 'uploaded-policy',
        status: 'active',
        allowedRoles: ['admin']
      }
    }
  ]
});

expect(ingestResult).toMatchObject({
  sourceCount: 1,
  chunkCount: 1,
  embeddedChunkCount: 1
});

const runtimeCenter = await runtimeCenterController.getRuntimeCenter();
expect(runtimeCenter.knowledgeOverview).toMatchObject({
  sourceCount: 1,
  chunkCount: 1,
  latestReceipts: [
    expect.objectContaining({
      sourceId: 'upload-smoke-1',
      sourceType: 'user-upload',
      status: 'completed',
      chunkCount: 1
    })
  ]
});
```

Apply the same direct-controller pattern to the existing user-upload, catalog-sync, web-curated, and connector-sync tests. Preserve the same request bodies and projection assertions already present in the file.

- [ ] **Step 3: Run the failing smoke files**

Run:

```bash
pnpm exec vitest run --config vitest.config.js test/smoke/backend/backend-http-app.smoke.ts apps/backend/agent-server/test/platform/knowledge-ingestion.http-smoke.spec.ts
```

Expected: both files pass without `listen EPERM`.

- [ ] **Step 4: Run workspace smoke**

Run:

```bash
pnpm test:workspace:smoke
```

Expected: all root smoke tests pass.

## Task 3: Add Coverage Gap Summarizer

**Files:**

- Create: `scripts/summarize-coverage-gaps.js`
- Modify: `package.json`

- [ ] **Step 1: Add the script**

Create `scripts/summarize-coverage-gaps.js`:

```js
import fs from 'node:fs';

const summaryPath = 'artifacts/coverage/vitest/coverage-summary.json';
const scopes = [
  'packages/runtime/src/',
  'apps/backend/agent-server/src/',
  'apps/frontend/agent-chat/src/',
  'apps/frontend/agent-admin/src/',
  'apps/frontend/knowledge/src/',
  'packages/tools/src/',
  'packages/skill/src/',
  'packages/templates/src/',
  'agents/audio/src/',
  'agents/video/src/'
];

if (!fs.existsSync(summaryPath)) {
  console.error(`[coverage-gaps] missing ${summaryPath}; run pnpm test:coverage first`);
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const rows = Object.entries(summary)
  .filter(([filePath]) => filePath !== 'total')
  .map(([filePath, metrics]) => ({
    filePath,
    lines: metrics.lines.pct,
    statements: metrics.statements.pct,
    functions: metrics.functions.pct,
    branches: metrics.branches.pct,
    score: metrics.lines.pct + metrics.statements.pct + metrics.functions.pct + metrics.branches.pct
  }));

console.log('[coverage-gaps] total', JSON.stringify(summary.total));

for (const scope of scopes) {
  const scopeRows = rows
    .filter(row => row.filePath.includes(scope))
    .filter(row => row.lines < 85 || row.statements < 85 || row.functions < 85 || row.branches < 85)
    .sort((left, right) => left.score - right.score)
    .slice(0, 20);

  if (scopeRows.length === 0) continue;

  console.log(`\n## ${scope}`);
  for (const row of scopeRows) {
    console.log(
      [
        row.lines.toFixed(2),
        row.statements.toFixed(2),
        row.functions.toFixed(2),
        row.branches.toFixed(2),
        row.filePath
      ].join('\t')
    );
  }
}
```

- [ ] **Step 2: Add a package script**

Add to root `package.json` scripts:

```json
"coverage:gaps": "node ./scripts/summarize-coverage-gaps.js"
```

Keep JSON key ordering near the other test/coverage scripts.

- [ ] **Step 3: Run script before coverage summary exists and after coverage exists**

Run:

```bash
pnpm coverage:gaps
```

Expected after a coverage run: it prints `[coverage-gaps] total` plus ranked module sections. If no summary exists, it exits with a clear message.

## Task 4: Calibrate Coverage Include/Exclude Rules

**Files:**

- Modify: `vitest.config.js`
- Modify: `docs/conventions/test-conventions.md`
- Modify: `docs/packages/evals/testing-coverage-baseline.md`

- [x] **Step 1: Add only allowed non-runtime coverage excludes**

In `vitest.config.js`, extend `coverage.exclude` with explicit rules:

```js
('**/*.types.ts',
  '**/*.types.tsx',
  '**/src/**/types.ts',
  '**/src/**/index.ts',
  '**/src/**/index.tsx',
  'apps/frontend/*/src/main.tsx',
  'apps/frontend/*/src/main.ts',
  'packages/templates/src/starters/**');
```

Before applying this, inspect any `index.ts` that contains runtime logic. If a barrel contains runtime logic, do not rely on the glob; instead remove the broad index rule and list only confirmed barrel-only files. The final config must not exclude schema, adapter, facade, repository, controller, service, graph node, or runtime policy files.

- [x] **Step 2: Run coverage and summarize gaps**

Run:

```bash
pnpm test:coverage
pnpm coverage:gaps
```

Expected: `pnpm test:coverage` still fails on thresholds until enough tests are added, but no longer fails because of the 7 red tests from Task 1 and Task 2. `pnpm coverage:gaps` prints a ranked list.

- [x] **Step 3: Document the rules**

In `docs/conventions/test-conventions.md`, add a coverage section that states:

```md
### Coverage Include / Exclude Rules

`pnpm test:coverage` uses V8 coverage and `all: true`. Exclusions are limited to non-runtime files: pure type files, barrel-only entries, frontend bootstrap entries, and generated/template starter examples that are covered through registry or scaffold contract tests.

Do not exclude schema, adapter, facade, repository, controller, service, graph node, runtime policy, or any file that contains branching business behavior. Low coverage in those files must be addressed with tests or with a real code cleanup that removes dead production paths.
```

- [x] **Step 4: Update baseline**

Update `docs/packages/evals/testing-coverage-baseline.md` with the new command date, the post-red-light coverage numbers, and the top gap scopes printed by `pnpm coverage:gaps`.

- [x] **Step 5: Verify docs**

Run:

```bash
pnpm check:docs
```

Expected: docs check passes.

## Task 5: Raise `packages/runtime` Coverage First

**Files:**

- Modify or create tests under `packages/runtime/test/**`
- Prefer targets printed by `pnpm coverage:gaps` for `packages/runtime/src/`

- [ ] **Step 1: Write failing tests for session compression helpers**

Create or extend `packages/runtime/test/session-compression-helpers.test.ts` with tests that exercise JSON extraction, fallback heuristic summaries, truncation, and malformed JSON:

```ts
import { describe, expect, it } from 'vitest';

import {
  createHeuristicConversationSummary,
  formatCompressionSummaryText,
  normalizeMessageSnippet,
  parseStructuredCompressionSummary,
  truncateSummary
} from '../src/session/session-compression-helpers';

describe('session compression helpers', () => {
  it('parses structured compression JSON and normalizes array fields', () => {
    const result = parseStructuredCompressionSummary(
      JSON.stringify({
        period_or_topic: 'coverage push',
        primary_focuses: ['runtime tests', '', 'backend smoke'],
        key_deliverables: ['coverage baseline'],
        risks_and_gaps: ['branch coverage gap'],
        next_actions: ['add runtime tests'],
        raw_supporting_points: ['V8 coverage'],
        decision_summary: 'Use staged rollout',
        confirmed_preferences: ['No broad excludes'],
        open_loops: ['runtime session coverage']
      }),
      500
    );

    expect(result).toMatchObject({
      periodOrTopic: 'coverage push',
      focuses: ['runtime tests', 'backend smoke'],
      keyDeliverables: ['coverage baseline'],
      risks: ['branch coverage gap'],
      nextActions: ['add runtime tests'],
      decisionSummary: 'Use staged rollout',
      confirmedPreferences: ['No broad excludes'],
      openLoops: ['runtime session coverage'],
      supportingFacts: ['V8 coverage']
    });
  });

  it('returns undefined for malformed structured summaries', () => {
    expect(parseStructuredCompressionSummary('{broken', 100)).toBeUndefined();
    expect(parseStructuredCompressionSummary(JSON.stringify({ summary: '' }), 100)).toBeUndefined();
  });

  it('builds heuristic summaries from user and assistant messages', () => {
    const result = createHeuristicConversationSummary(
      [
        {
          id: 'm1',
          role: 'user',
          content: '1. 优先补 runtime 覆盖率\n必须避免大面积 exclude',
          createdAt: '2026-05-10T00:00:00.000Z'
        },
        {
          id: 'm2',
          role: 'assistant',
          content: '关键交付：coverage baseline\n风险：branch gap\n下一步：继续补测试',
          createdAt: '2026-05-10T00:00:01.000Z'
        }
      ],
      500
    );

    expect(result.source).toBe('heuristic');
    expect(result.focuses).toContain('优先补 runtime 覆盖率');
    expect(result.risks).toContain('风险：branch gap');
    expect(result.summary).toContain('一级重点');
  });

  it('truncates long snippets and formatted summaries predictably', () => {
    expect(normalizeMessageSnippet('x '.repeat(100))).toHaveLength(123);
    expect(truncateSummary('abcdef', 4)).toBe('abcd');
    expect(
      formatCompressionSummaryText(
        {
          periodOrTopic: 'coverage',
          focuses: ['runtime'],
          risks: ['branch']
        },
        80
      )
    ).toContain('主题：coverage');
  });
});
```

- [ ] **Step 2: Run the focused runtime test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/runtime/test/session-compression-helpers.test.ts
```

Expected: failing assertions first if behavior differs, then pass after aligning tests to actual exported behavior.

- [ ] **Step 3: Add approval policy tests**

Extend `packages/runtime/test/session-coordinator-helpers.test.ts` or create `packages/runtime/test/session-coordinator-approval-policy.test.ts` to cover:

```ts
import { describe, expect, it, vi } from 'vitest';

import {
  buildApprovalScopeMatchInput,
  findRuntimeApprovalScopePolicy,
  persistApprovalScopePolicy,
  recordPolicyAutoAllow,
  upsertRuntimeApprovalPolicy,
  upsertSessionApprovalPolicy
} from '../src/session/coordinator/session-coordinator-approval-policy';

describe('session coordinator approval policy helpers', () => {
  it('builds match input from pending approval and interrupt payload', () => {
    expect(
      buildApprovalScopeMatchInput({
        id: 'task-1',
        currentMinistry: 'bingbu-ops',
        pendingApproval: {
          intent: 'run-command',
          toolName: 'terminal',
          reasonCode: 'high-risk',
          requestedBy: 'human'
        },
        activeInterrupt: {
          intent: 'ignored',
          payload: { riskCode: 'payload-risk', commandPreview: 'pnpm verify' }
        }
      } as never)
    ).toMatchObject({
      intent: 'run-command',
      toolName: 'terminal',
      riskCode: 'payload-risk',
      requestedBy: 'human',
      commandPreview: 'pnpm verify'
    });
  });

  it('upserts session and runtime policies without changing existing ids', () => {
    const existing = {
      id: 'policy-existing',
      scope: 'session',
      status: 'active',
      matchKey: 'tool:terminal',
      actor: 'human',
      approvalScope: 'session',
      createdAt: '2026-05-10T00:00:00.000Z',
      updatedAt: '2026-05-10T00:00:00.000Z',
      matchCount: 0
    } as const;
    const next = { ...existing, id: 'policy-next', updatedAt: '2026-05-10T00:01:00.000Z', matchCount: 2 };

    expect(upsertSessionApprovalPolicy([existing], next as never)[0]).toMatchObject({
      id: 'policy-existing',
      matchCount: 2
    });
    expect(upsertRuntimeApprovalPolicy([existing as never], { ...next, scope: 'always' } as never)[0]).toMatchObject({
      id: 'policy-next',
      scope: 'always'
    });
  });

  it('persists session scoped policies locally and always scoped policies in runtime state', async () => {
    const snapshot: Record<string, unknown> = {};
    const repository = {
      load: vi.fn(async () => snapshot),
      save: vi.fn(async () => undefined)
    };
    const session = { id: 'session-1' };
    const task = {
      id: 'task-1',
      currentMinistry: 'bingbu-ops',
      pendingApproval: { intent: 'run-command', toolName: 'terminal' }
    };

    await persistApprovalScopePolicy({
      runtimeStateRepository: repository as never,
      session: session as never,
      task: task as never,
      dto: { actor: 'human', approvalScope: 'session' } as never
    });
    expect(session).toHaveProperty('approvalPolicies.sessionAllowRules.0.scope', 'session');

    await persistApprovalScopePolicy({
      runtimeStateRepository: repository as never,
      session: session as never,
      task: task as never,
      dto: { actor: 'human', approvalScope: 'always' } as never
    });
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        governance: expect.objectContaining({
          approvalScopePolicies: [expect.objectContaining({ scope: 'always' })]
        })
      })
    );
  });
});
```

- [ ] **Step 4: Run runtime unit tests and coverage gaps**

Run:

```bash
pnpm --dir packages/runtime test
pnpm test:coverage
pnpm coverage:gaps
```

Expected: runtime tests pass; coverage still may fail globally but `packages/runtime/src/**` improves. Repeat this task with the next `packages/runtime/src/` files printed by `pnpm coverage:gaps` until runtime reaches `>= 85%` or the remaining gaps are all documented non-runtime exclusions.

## Task 6: Raise Backend Coverage

**Files:**

- Modify or create tests under `apps/backend/agent-server/test/**`
- Prefer targets printed by `pnpm coverage:gaps` for `apps/backend/agent-server/src/`

- [ ] **Step 1: Add controller and pipe tests before production edits**

Add tests for the gap files named by `pnpm coverage:gaps`, starting with:

```ts
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { ParseOptionalIntPipe } from '../../src/common/pipes/parse-optional-int.pipe';

describe('ParseOptionalIntPipe', () => {
  it('returns undefined for missing optional values', () => {
    expect(new ParseOptionalIntPipe().transform(undefined)).toBeUndefined();
    expect(new ParseOptionalIntPipe().transform('')).toBeUndefined();
  });

  it('parses integer strings and rejects invalid values', () => {
    const pipe = new ParseOptionalIntPipe();

    expect(pipe.transform('42')).toBe(42);
    expect(() => pipe.transform('4.2')).toThrow(BadRequestException);
    expect(() => pipe.transform('abc')).toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: Run focused backend tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/common apps/backend/agent-server/test/platform apps/backend/agent-server/test/agent-gateway
```

Expected: focused backend tests pass.

- [ ] **Step 3: Repeat with next backend gaps**

For each backend file below 85, write tests that assert request DTO handling, service delegation, error mapping, and returned project-owned schema. Do not test third-party internals or real database/network IO.

- [ ] **Step 4: Verify backend type and coverage**

Run:

```bash
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm test:coverage
pnpm coverage:gaps
```

Expected: backend project-level coverage reaches `>= 85%` across lines/statements/functions/branches before moving to frontend-heavy work.

## Task 7: Raise Frontend Coverage By User-Visible State

**Files:**

- Modify or create tests under `apps/frontend/agent-chat/test/**`
- Modify or create tests under `apps/frontend/agent-admin/test/**`
- Modify or create tests under `apps/frontend/knowledge/test/**`

- [ ] **Step 1: Add `agent-chat` memory API facade tests before component tests**

Create `apps/frontend/agent-chat/test/api/chat-memory-api.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { postMock, patchMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
  patchMock: vi.fn()
}));

vi.mock('@/utils/http-client', () => ({
  http: {
    post: postMock,
    patch: patchMock
  }
}));

import { overrideChatMemory, patchChatProfile, recordChatMemoryFeedback } from '@/api/chat-memory-api';

describe('chat-memory-api', () => {
  beforeEach(() => {
    postMock.mockReset();
    patchMock.mockReset();
  });

  it('records feedback with encoded memory ids', async () => {
    postMock.mockResolvedValueOnce({ data: { ok: true } });

    await expect(recordChatMemoryFeedback('memory/1', 'adopted')).resolves.toEqual({ ok: true });

    expect(postMock).toHaveBeenCalledWith('/memory/memory%2F1/feedback', { kind: 'adopted' });
  });

  it('defaults override actor to agent-chat-user', async () => {
    postMock.mockResolvedValueOnce({ data: { id: 'memory-1' } });

    await expect(
      overrideChatMemory('memory 1', {
        summary: 'summary',
        content: 'content',
        reason: 'correction',
        tags: ['runtime']
      })
    ).resolves.toEqual({ id: 'memory-1' });

    expect(postMock).toHaveBeenCalledWith('/memory/memory%201/override', {
      summary: 'summary',
      content: 'content',
      reason: 'correction',
      tags: ['runtime'],
      actor: 'agent-chat-user'
    });
  });

  it('defaults profile patch actor while preserving explicit actor', async () => {
    patchMock.mockResolvedValueOnce({ data: { id: 'user-1' } }).mockResolvedValueOnce({ data: { id: 'user-2' } });

    await patchChatProfile('user/1', { displayName: 'User One' });
    await patchChatProfile('user/2', { displayName: 'User Two', actor: 'admin' });

    expect(patchMock).toHaveBeenNthCalledWith(1, '/profiles/user%2F1', {
      displayName: 'User One',
      actor: 'agent-chat-user'
    });
    expect(patchMock).toHaveBeenNthCalledWith(2, '/profiles/user%2F2', {
      displayName: 'User Two',
      actor: 'admin'
    });
  });
});
```

- [ ] **Step 2: Add hook and component tests for branching state**

Use React Testing Library to cover loading, empty, error, success, and user action branches. Prefer visible text and role assertions over snapshots.

- [ ] **Step 3: Run frontend type checks**

Run:

```bash
pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit
pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit
pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit
```

Expected: all three frontend type checks pass.

- [ ] **Step 4: Run focused frontend tests and coverage**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-chat/test apps/frontend/agent-admin/test apps/frontend/knowledge/test
pnpm test:coverage
pnpm coverage:gaps
```

Expected: each configured frontend scope reaches `>= 85%`.

## Task 8: Close Global Coverage Drag

**Files:**

- Modify or create tests under `packages/tools/test/**`
- Modify or create tests under `packages/skill/test/**`
- Modify or create tests under `packages/templates/test/**`
- Modify or create tests under `agents/audio/test/**`
- Modify or create tests under `agents/video/test/**`

- [ ] **Step 1: Use coverage gaps to choose the next global files**

Run:

```bash
pnpm test:coverage
pnpm coverage:gaps
```

Expected: project-level thresholds are green, while global thresholds may still show remaining drag files.

- [ ] **Step 2: Add unit tests for registry and policy files**

For registry/policy modules, tests must assert:

- exported records include stable ids;
- invalid or disabled entries are filtered as intended;
- error states return project-owned error messages;
- no third-party response shape leaks through public output.

- [ ] **Step 3: Add package demo depth only where it proves a real contract**

For any package whose `demo/smoke.ts` only imports the root entrypoint, add `demo/contract.ts` or `demo/flow.ts` when the package has a meaningful runtime contract. Run:

```bash
pnpm test:demo -- packages/tools
pnpm test:demo -- packages/skill
pnpm test:demo -- packages/templates
```

Expected: demo runner executes smoke plus any contract/flow file for the target packages.

- [ ] **Step 4: Verify global thresholds**

Run:

```bash
pnpm test:coverage
```

Expected: global and project-level coverage thresholds are all `>= 85%`.

## Task 9: Final Verification And Documentation Cleanup

**Files:**

- Modify: `docs/packages/evals/testing-coverage-baseline.md`
- Modify: `docs/conventions/test-conventions.md`
- Modify: `docs/packages/evals/verification-system-guidelines.md` if verification semantics changed
- Modify: `README.md` only if command or CI behavior changed

- [ ] **Step 1: Run documentation stale scan**

Run:

```bash
rg -n "coverage|test:coverage|85|coverage-main|testing-coverage-baseline|listen 0.0.0.0|supertest" docs README.md AGENTS.md
```

Expected: every hit that describes old coverage baselines, unsupported smoke behavior, or outdated CI semantics is updated or explicitly marked historical.

- [ ] **Step 2: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: docs check passes.

- [ ] **Step 3: Run affected and full verification**

Run:

```bash
pnpm verify:affected
pnpm verify
```

Expected: both commands pass. If full `pnpm verify` fails because of an external blocker unrelated to this work, capture the exact failing command, error, and whether `pnpm test:coverage` remained green.

- [ ] **Step 4: Record final coverage**

Run:

```bash
pnpm test:coverage
pnpm coverage:gaps
```

Expected: `pnpm test:coverage` exits 0. `pnpm coverage:gaps` either prints no below-threshold rows for configured scopes or only non-threshold global files that are already covered by the green total.

## Self-Review

- Spec coverage: Tasks 1-2 clear red tests, Task 3 adds a deterministic gap reader, Task 4 implements coverage rules and docs, Tasks 5-8 raise module coverage by priority, Task 9 handles stale docs and final verification.
- Placeholder scan: The plan contains no deferred placeholders. Task 7 uses a concrete `chat-memory-api` test instead of a symbolic facade example.
- Type consistency: The plan uses existing Vitest, Nest, pnpm, and coverage paths. It does not introduce new test frameworks or worktrees.
