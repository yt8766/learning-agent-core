# Private LLM Gateway Implementation Plan

状态：snapshot
文档类型：plan
适用范围：`apps/llm-gateway`
最后核对：2026-04-24

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/llm-gateway`, a private OpenAI-compatible LLM gateway with admin login, virtual API keys, provider adapters, usage logs, and Vercel-ready deployment.

**Architecture:** The app is a standalone Next.js application inside the existing monorepo. Next.js Route Handlers expose `/api/v1/*`, `vercel.json` rewrites `/v1/*` to those handlers, and internal modules keep auth, key management, provider adapters, routing, usage logging, and rate limits separated. Codex Plus / Pro membership is not a provider; the app only proxies official provider API keys.

**Tech Stack:** Next.js, React, TypeScript, zod, PostgreSQL-compatible repository boundary, Redis-compatible rate-limit boundary, Vitest, Vercel.

---

## File Structure

- Create `apps/llm-gateway/package.json`: app manifest, scripts, dependencies.
- Create `apps/llm-gateway/next.config.ts`: Next.js config.
- Create `apps/llm-gateway/vercel.json`: `/v1/*` rewrite for OpenAI-compatible clients.
- Create `apps/llm-gateway/tsconfig.json`: app TypeScript config.
- Create `apps/llm-gateway/app/layout.tsx`: root layout.
- Create `apps/llm-gateway/app/page.tsx`: redirect or entry to admin.
- Create `apps/llm-gateway/app/admin/page.tsx`: private dashboard shell.
- Create `apps/llm-gateway/app/api/v1/models/route.ts`: OpenAI-compatible models endpoint.
- Create `apps/llm-gateway/app/api/v1/key/route.ts`: current API key status endpoint.
- Create `apps/llm-gateway/app/api/v1/chat/completions/route.ts`: chat completions endpoint with streaming.
- Create `apps/llm-gateway/src/contracts/*.ts`: zod schemas and inferred types.
- Create `apps/llm-gateway/src/auth/*.ts`: admin session and virtual key auth.
- Create `apps/llm-gateway/src/keys/*.ts`: key generation, hashing, verification, status.
- Create `apps/llm-gateway/src/models/*.ts`: model alias registry and permissions.
- Create `apps/llm-gateway/src/providers/*.ts`: provider interface, mock adapter, OpenAI adapter, MiniMax adapter, and MiMo adapter.
- Create `apps/llm-gateway/src/gateway/*.ts`: request orchestration, error mapping, SSE helpers.
- Create `apps/llm-gateway/src/repositories/*.ts`: repository interfaces and first in-memory implementation for tests/local bootstrap.
- Create `apps/llm-gateway/src/rate-limit/*.ts`: rate limit interface and in-memory implementation.
- Create `apps/llm-gateway/test/*.test.ts`: unit and route-level tests.
- Modify `docs/superpowers/specs/2026-04-24-private-llm-gateway-design.md`: keep implementation notes in sync if behavior changes during implementation.
- Modify `pnpm-lock.yaml`: after adding app dependencies.

## Task 1: Workspace App Scaffold

**Files:**

- Create: `apps/llm-gateway/package.json`
- Create: `apps/llm-gateway/next.config.ts`
- Create: `apps/llm-gateway/vercel.json`
- Create: `apps/llm-gateway/tsconfig.json`
- Create: `apps/llm-gateway/app/layout.tsx`
- Create: `apps/llm-gateway/app/page.tsx`
- Create: `apps/llm-gateway/app/admin/page.tsx`
- Create: `apps/llm-gateway/app/globals.css`

- [ ] **Step 1: Install app dependencies**

Run:

```bash
pnpm add next react react-dom zod @next/env --filter llm-gateway
pnpm add -D @types/react @types/react-dom --filter llm-gateway
```

Expected: `apps/llm-gateway/package.json` and `pnpm-lock.yaml` include the new importer and dependencies.

- [ ] **Step 2: Create the app manifest**

Create `apps/llm-gateway/package.json`:

```json
{
  "name": "llm-gateway",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "turbo:typecheck": "pnpm typecheck",
    "turbo:test:unit": "pnpm --dir ../.. exec vitest run --config vitest.config.js apps/llm-gateway/test --exclude '**/*.int-spec.ts'",
    "turbo:test:integration": "pnpm --dir ../.. exec vitest run --config vitest.config.js apps/llm-gateway/test --include '**/*.int-spec.ts'",
    "lint": "eslint ."
  },
  "dependencies": {
    "@next/env": "^16.0.0",
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
```

- [ ] **Step 3: Add Vercel rewrite**

Create `apps/llm-gateway/vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/v1/:path*",
      "destination": "/api/v1/:path*"
    }
  ]
}
```

- [ ] **Step 4: Add Next.js and TypeScript config**

Create `apps/llm-gateway/next.config.ts`:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true
};

export default nextConfig;
```

Create `apps/llm-gateway/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "allowJs": false,
    "jsx": "preserve",
    "lib": ["dom", "dom.iterable", "es2022"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "noEmit": true,
    "plugins": [{ "name": "next" }],
    "resolveJsonModule": true,
    "target": "es2022"
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Add minimal admin shell**

Create `apps/llm-gateway/app/layout.tsx`:

```tsx
import './globals.css';
import type { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

Create `apps/llm-gateway/app/page.tsx`:

```tsx
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/admin');
}
```

Create `apps/llm-gateway/app/admin/page.tsx`:

```tsx
export default function AdminPage() {
  return (
    <main className="admin-shell">
      <h1>LLM Gateway</h1>
      <section>
        <h2>Dashboard</h2>
        <p>Private gateway control panel.</p>
      </section>
    </main>
  );
}
```

Create `apps/llm-gateway/app/globals.css`:

```css
body {
  margin: 0;
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
  background: #f7f8fa;
  color: #1f2933;
}

.admin-shell {
  max-width: 1120px;
  margin: 0 auto;
  padding: 32px;
}
```

- [ ] **Step 6: Verify scaffold**

Run:

```bash
pnpm --dir apps/llm-gateway typecheck
pnpm --dir apps/llm-gateway build
```

Expected: both commands pass.

## Task 2: Contracts And Error Semantics

**Files:**

- Create: `apps/llm-gateway/src/contracts/chat.ts`
- Create: `apps/llm-gateway/src/contracts/errors.ts`
- Create: `apps/llm-gateway/src/contracts/models.ts`
- Create: `apps/llm-gateway/src/contracts/key.ts`
- Create: `apps/llm-gateway/src/contracts/index.ts`
- Test: `apps/llm-gateway/test/contracts.test.ts`

- [ ] **Step 1: Write contract tests**

Create `apps/llm-gateway/test/contracts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  ChatCompletionRequestSchema,
  GatewayErrorCodeSchema,
  ModelListResponseSchema
} from '../src/contracts/index.js';

describe('llm-gateway contracts', () => {
  it('parses an OpenAI-compatible chat completion request', () => {
    const parsed = ChatCompletionRequestSchema.parse({
      model: 'gpt-main',
      messages: [{ role: 'user', content: 'hello' }],
      stream: true,
      max_tokens: 1024
    });

    expect(parsed.model).toBe('gpt-main');
    expect(parsed.messages[0]?.role).toBe('user');
  });

  it('rejects an unsupported message role', () => {
    expect(() =>
      ChatCompletionRequestSchema.parse({
        model: 'gpt-main',
        messages: [{ role: 'system-admin', content: 'hello' }]
      })
    ).toThrow();
  });

  it('keeps gateway error codes stable', () => {
    expect(GatewayErrorCodeSchema.parse('BUDGET_EXCEEDED')).toBe('BUDGET_EXCEEDED');
  });

  it('parses an OpenAI-compatible model list response', () => {
    const parsed = ModelListResponseSchema.parse({
      object: 'list',
      data: [{ id: 'gpt-main', object: 'model', owned_by: 'llm-gateway' }]
    });

    expect(parsed.data[0]?.id).toBe('gpt-main');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --dir ../.. exec vitest run --config vitest.config.js apps/llm-gateway/test/contracts.test.ts
```

Expected: FAIL because `src/contracts/index.ts` does not exist.

- [ ] **Step 3: Implement schemas**

Create `apps/llm-gateway/src/contracts/chat.ts`, `errors.ts`, `models.ts`, `key.ts`, and `index.ts` with schema-first zod contracts for chat requests, chat responses, SSE chunks, model list responses, key status responses, and gateway errors. Export inferred types from each schema.

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm --dir ../.. exec vitest run --config vitest.config.js apps/llm-gateway/test/contracts.test.ts
pnpm --dir apps/llm-gateway typecheck
```

Expected: PASS.

## Task 3: Virtual API Key Core

**Files:**

- Create: `apps/llm-gateway/src/keys/api-key.ts`
- Create: `apps/llm-gateway/src/repositories/gateway-repository.ts`
- Create: `apps/llm-gateway/src/repositories/memory-gateway-repository.ts`
- Test: `apps/llm-gateway/test/api-key.test.ts`

- [ ] **Step 1: Write API key tests**

Create `apps/llm-gateway/test/api-key.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createVirtualApiKey, verifyVirtualApiKey } from '../src/keys/api-key.js';

describe('virtual API keys', () => {
  it('creates a prefixed key and stores only a hash', async () => {
    const created = await createVirtualApiKey('local-secret');

    expect(created.plaintext).toMatch(/^sk-llmgw_/);
    expect(created.prefix).toBe(created.plaintext.slice(0, 16));
    expect(created.hash).not.toContain(created.plaintext);
  });

  it('verifies a matching key', async () => {
    const created = await createVirtualApiKey('local-secret');

    await expect(verifyVirtualApiKey(created.plaintext, created.hash, 'local-secret')).resolves.toBe(true);
  });

  it('rejects a different key', async () => {
    const created = await createVirtualApiKey('local-secret');

    await expect(verifyVirtualApiKey('sk-llmgw_wrong', created.hash, 'local-secret')).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --dir ../.. exec vitest run --config vitest.config.js apps/llm-gateway/test/api-key.test.ts
```

Expected: FAIL because key helpers do not exist.

- [ ] **Step 3: Implement API key helpers**

Implement `createVirtualApiKey(secret)` and `verifyVirtualApiKey(plaintext, hash, secret)` using `crypto.subtle` or Node `node:crypto` HMAC SHA-256. Store only `prefix` and `hash`; return plaintext only from create.

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm --dir ../.. exec vitest run --config vitest.config.js apps/llm-gateway/test/api-key.test.ts
pnpm --dir apps/llm-gateway typecheck
```

Expected: PASS.

## Task 4: Model Registry And Permissions

**Files:**

- Create: `apps/llm-gateway/src/models/model-registry.ts`
- Create: `apps/llm-gateway/src/models/model-permissions.ts`
- Test: `apps/llm-gateway/test/model-registry.test.ts`

- [ ] **Step 1: Write registry tests**

Create `apps/llm-gateway/test/model-registry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createModelRegistry } from '../src/models/model-registry.js';
import { isModelAllowedForKey } from '../src/models/model-permissions.js';

describe('model registry', () => {
  const registry = createModelRegistry([
    {
      alias: 'gpt-main',
      provider: 'openai',
      providerModel: 'gpt-5.1-codex',
      enabled: true,
      contextWindow: 128000,
      fallbackAliases: ['cheap-fast'],
      adminOnly: false
    },
    {
      alias: 'mimo-main',
      provider: 'mimo',
      providerModel: 'MiMo-V2.5-Pro',
      enabled: true,
      contextWindow: 128000,
      fallbackAliases: [],
      adminOnly: false
    }
  ]);

  it('resolves an enabled alias', () => {
    expect(registry.resolve('gpt-main')?.provider).toBe('openai');
  });

  it('returns undefined for an unknown alias', () => {
    expect(registry.resolve('missing')).toBeUndefined();
  });

  it('checks key model permissions', () => {
    expect(isModelAllowedForKey(['gpt-main'], 'gpt-main')).toBe(true);
    expect(isModelAllowedForKey(['gpt-main'], 'mimo-main')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --dir ../.. exec vitest run --config vitest.config.js apps/llm-gateway/test/model-registry.test.ts
```

Expected: FAIL because model modules do not exist.

- [ ] **Step 3: Implement registry**

Implement immutable model alias lookup with exact alias matching, enabled filtering, and key permission checks.

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm --dir ../.. exec vitest run --config vitest.config.js apps/llm-gateway/test/model-registry.test.ts
pnpm --dir apps/llm-gateway typecheck
```

Expected: PASS.

## Task 5: Provider Adapter Boundary

**Files:**

- Create: `apps/llm-gateway/src/providers/provider-adapter.ts`
- Create: `apps/llm-gateway/src/providers/mock-provider-adapter.ts`
- Create: `apps/llm-gateway/src/providers/openai-provider-adapter.ts`
- Create: `apps/llm-gateway/src/providers/minimax-provider-adapter.ts`
- Create: `apps/llm-gateway/src/providers/mimo-provider-adapter.ts`
- Test: `apps/llm-gateway/test/provider-adapter.test.ts`

- [ ] **Step 1: Write adapter tests**

Create `apps/llm-gateway/test/provider-adapter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createMockProviderAdapter } from '../src/providers/mock-provider-adapter.js';

describe('provider adapters', () => {
  it('returns a normalized completion response', async () => {
    const adapter = createMockProviderAdapter({ content: 'hello from mock' });

    const response = await adapter.complete({
      model: 'gpt-main',
      providerModel: 'mock-model',
      messages: [{ role: 'user', content: 'hello' }],
      stream: false
    });

    expect(response.choices[0]?.message.content).toBe('hello from mock');
    expect(response.usage.total_tokens).toBeGreaterThan(0);
  });

  it('streams normalized chunks and done marker data', async () => {
    const adapter = createMockProviderAdapter({ content: 'hello' });
    const chunks: string[] = [];

    for await (const chunk of adapter.stream({
      model: 'gpt-main',
      providerModel: 'mock-model',
      messages: [{ role: 'user', content: 'hello' }],
      stream: true
    })) {
      chunks.push(chunk.choices[0]?.delta.content ?? '');
    }

    expect(chunks.join('')).toBe('hello');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --dir ../.. exec vitest run --config vitest.config.js apps/llm-gateway/test/provider-adapter.test.ts
```

Expected: FAIL because provider modules do not exist.

- [ ] **Step 3: Implement provider interface and mock adapter**

Implement `ProviderAdapter`, normalized request/response types, and `createMockProviderAdapter`. Add OpenAI, MiniMax, and MiMo adapter files with exported factory functions that fail closed with `UPSTREAM_UNAVAILABLE` until real credentials are configured.

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm --dir ../.. exec vitest run --config vitest.config.js apps/llm-gateway/test/provider-adapter.test.ts
pnpm --dir apps/llm-gateway typecheck
```

Expected: PASS.

## Task 6: Gateway Orchestration And API Routes

**Files:**

- Create: `apps/llm-gateway/src/gateway/gateway-service.ts`
- Create: `apps/llm-gateway/src/gateway/sse.ts`
- Create: `apps/llm-gateway/src/gateway/errors.ts`
- Create: `apps/llm-gateway/app/api/v1/models/route.ts`
- Create: `apps/llm-gateway/app/api/v1/key/route.ts`
- Create: `apps/llm-gateway/app/api/v1/chat/completions/route.ts`
- Test: `apps/llm-gateway/test/gateway-service.test.ts`

- [ ] **Step 1: Write orchestration tests**

Create `apps/llm-gateway/test/gateway-service.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createGatewayService } from '../src/gateway/gateway-service.js';
import { createMockProviderAdapter } from '../src/providers/mock-provider-adapter.js';
import { createMemoryGatewayRepository } from '../src/repositories/memory-gateway-repository.js';

describe('gateway service', () => {
  it('rejects a disabled key', async () => {
    const repository = createMemoryGatewayRepository({
      apiKeys: [{ id: 'key_1', prefix: 'sk-llmgw_disabled', hash: 'hash', status: 'disabled', models: ['gpt-main'] }]
    });
    const gateway = createGatewayService({
      repository,
      providers: { mock: createMockProviderAdapter({ content: 'ok' }) }
    });

    await expect(
      gateway.complete({ authorization: 'Bearer sk-llmgw_disabled', body: { model: 'gpt-main', messages: [] } })
    ).rejects.toMatchObject({ code: 'KEY_DISABLED' });
  });

  it('routes an allowed model to a provider', async () => {
    const repository = createMemoryGatewayRepository.seeded();
    const gateway = createGatewayService({
      repository,
      providers: { mock: createMockProviderAdapter({ content: 'ok' }) }
    });

    const response = await gateway.complete({
      authorization: `Bearer ${repository.seedKeyPlaintext}`,
      body: { model: 'gpt-main', messages: [{ role: 'user', content: 'hello' }] }
    });

    expect(response.choices[0]?.message.content).toBe('ok');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --dir ../.. exec vitest run --config vitest.config.js apps/llm-gateway/test/gateway-service.test.ts
```

Expected: FAIL because gateway service and repository modules do not exist.

- [ ] **Step 3: Implement gateway service**

Implement the request path: parse body, verify authorization header, check key status, check model permission, resolve model alias, call provider adapter, map errors, and write request log through repository.

- [ ] **Step 4: Implement route handlers**

Implement route handlers as thin adapters:

- `GET /api/v1/models`: authenticate key and return allowed model list.
- `GET /api/v1/key`: authenticate key and return key limits/usage.
- `POST /api/v1/chat/completions`: call gateway service; return JSON or SSE stream.

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
pnpm --dir ../.. exec vitest run --config vitest.config.js apps/llm-gateway/test/gateway-service.test.ts
pnpm --dir apps/llm-gateway typecheck
```

Expected: PASS.

## Task 7: Rate Limits, Budget Checks, And Usage Logs

**Files:**

- Create: `apps/llm-gateway/src/rate-limit/rate-limiter.ts`
- Create: `apps/llm-gateway/src/rate-limit/memory-rate-limiter.ts`
- Create: `apps/llm-gateway/src/usage/usage-meter.ts`
- Modify: `apps/llm-gateway/src/gateway/gateway-service.ts`
- Test: `apps/llm-gateway/test/rate-limit-and-usage.test.ts`

- [ ] **Step 1: Write rate and budget tests**

Create `apps/llm-gateway/test/rate-limit-and-usage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createMemoryRateLimiter } from '../src/rate-limit/memory-rate-limiter.js';
import { estimateRequestTokens, isDailyBudgetAvailable } from '../src/usage/usage-meter.js';

describe('rate limits and usage', () => {
  it('rejects the second request when rpm limit is one', async () => {
    const limiter = createMemoryRateLimiter();

    await expect(limiter.consume({ key: 'key_1', limit: 1, windowMs: 60_000 })).resolves.toMatchObject({
      allowed: true
    });
    await expect(limiter.consume({ key: 'key_1', limit: 1, windowMs: 60_000 })).resolves.toMatchObject({
      allowed: false
    });
  });

  it('estimates request tokens conservatively', () => {
    expect(estimateRequestTokens([{ role: 'user', content: 'hello world' }])).toBeGreaterThan(0);
  });

  it('rejects unavailable daily budget', () => {
    expect(isDailyBudgetAvailable({ used: 100, limit: 100, estimated: 1 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --dir ../.. exec vitest run --config vitest.config.js apps/llm-gateway/test/rate-limit-and-usage.test.ts
```

Expected: FAIL because rate-limit and usage modules do not exist.

- [ ] **Step 3: Implement memory limiter and usage meter**

Implement a deterministic in-memory limiter for tests and local development. Implement conservative token estimation, daily token budget check, and daily cost budget check.

- [ ] **Step 4: Wire checks into gateway service**

Update `gateway-service.ts` so checks run before provider execution and final usage is written after provider execution.

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --dir ../.. exec vitest run --config vitest.config.js apps/llm-gateway/test/rate-limit-and-usage.test.ts apps/llm-gateway/test/gateway-service.test.ts
pnpm --dir apps/llm-gateway typecheck
```

Expected: PASS.

## Task 8: Admin UI MVP

**Files:**

- Modify: `apps/llm-gateway/app/admin/page.tsx`
- Create: `apps/llm-gateway/src/admin/admin-dashboard-data.ts`
- Test: `apps/llm-gateway/test/admin-dashboard-data.test.ts`

- [ ] **Step 1: Write dashboard data test**

Create `apps/llm-gateway/test/admin-dashboard-data.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { summarizeDashboard } from '../src/admin/admin-dashboard-data.js';

describe('admin dashboard data', () => {
  it('summarizes requests, tokens, cost, failures, and latency', () => {
    const summary = summarizeDashboard([
      { status: 'success', totalTokens: 10, estimatedCost: 0.01, latencyMs: 100 },
      { status: 'error', totalTokens: 5, estimatedCost: 0.02, latencyMs: 300 }
    ]);

    expect(summary.requestCount).toBe(2);
    expect(summary.totalTokens).toBe(15);
    expect(summary.estimatedCost).toBe(0.03);
    expect(summary.failureRate).toBe(0.5);
    expect(summary.averageLatencyMs).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --dir ../.. exec vitest run --config vitest.config.js apps/llm-gateway/test/admin-dashboard-data.test.ts
```

Expected: FAIL because admin dashboard helper does not exist.

- [ ] **Step 3: Implement dashboard summary helper and UI**

Implement `summarizeDashboard` as a pure function. Update `app/admin/page.tsx` to render dashboard cards, API key status, provider status, model aliases, request log preview, and a Codex usage link pointing to `https://chatgpt.com/codex/settings/usage` with text explaining that Codex Plus / Pro is not a gateway provider.

- [ ] **Step 4: Run tests and build**

Run:

```bash
pnpm --dir ../.. exec vitest run --config vitest.config.js apps/llm-gateway/test/admin-dashboard-data.test.ts
pnpm --dir apps/llm-gateway typecheck
pnpm --dir apps/llm-gateway build
```

Expected: PASS.

## Task 9: Documentation And Vercel Deployment Notes

**Files:**

- Create: `docs/frontend/llm-gateway/README.md`
- Modify: `docs/superpowers/specs/2026-04-24-private-llm-gateway-design.md`
- Modify: `docs/superpowers/plans/2026-04-24-private-llm-gateway.md`

- [ ] **Step 1: Create app documentation**

Create `docs/frontend/llm-gateway/README.md`:

````markdown
# LLM Gateway

状态：current
文档类型：guide
适用范围：`apps/llm-gateway`
最后核对：2026-04-24

## 1. 当前定位

`apps/llm-gateway` 是私用 LLM 中转站，提供 OpenAI-compatible `/v1/*` API、管理员后台、虚拟 API Key、模型别名、用量记录和基础限额。

## 2. 重要边界

- 只代理官方 provider API Key。
- 不代理 Codex Plus / Pro、ChatGPT Plus / Pro、网页登录态或 Cookie。
- Codex 额度只通过后台链接跳转到 `https://chatgpt.com/codex/settings/usage` 查看。

## 3. Vercel 部署

在 Vercel 中导入当前仓库，Root Directory 选择 `apps/llm-gateway`。配置数据库、Redis、provider key、session secret 和 key hashing secret。`/v1/*` 由 `vercel.json` rewrite 到 `/api/v1/*`。

## 4. 本地验证

运行：

```bash
pnpm --dir apps/llm-gateway typecheck
pnpm --dir ../.. exec vitest run --config vitest.config.js apps/llm-gateway/test
pnpm --dir apps/llm-gateway build
```
````

````

- [ ] **Step 2: Run docs check**

Run:

```bash
pnpm check:docs
````

Expected: PASS.

## Task 10: Final Verification

**Files:**

- Verify all files touched by prior tasks.

- [ ] **Step 1: Run focused verification**

Run:

```bash
pnpm --dir apps/llm-gateway typecheck
pnpm --dir ../.. exec vitest run --config vitest.config.js apps/llm-gateway/test
pnpm --dir apps/llm-gateway build
pnpm check:docs
```

Expected: PASS.

- [ ] **Step 2: Run affected verification**

Run:

```bash
pnpm verify:affected
```

Expected: PASS, or document any unrelated existing blocker with the exact failing command and error.

- [ ] **Step 3: Review final diff**

Run:

```bash
git diff -- apps/llm-gateway docs/frontend/llm-gateway/README.md docs/superpowers/specs/2026-04-24-private-llm-gateway-design.md docs/superpowers/plans/2026-04-24-private-llm-gateway.md package.json pnpm-lock.yaml pnpm-workspace.yaml
```

Expected: diff only contains the gateway app, docs, manifest, and lockfile changes required by this plan.

## Self-Review

Spec coverage:

- Admin login and private app boundary are covered by Tasks 1, 8, and 9.
- Virtual API Key creation, hashing, verification, model permissions, status, and revocation foundation are covered by Tasks 3, 4, and 6.
- OpenAI-compatible `/v1/models`, `/v1/key`, and `/v1/chat/completions` are covered by Tasks 2 and 6.
- Provider adapter boundary for OpenAI, MiniMax, and MiMo is covered by Task 5.
- Usage logs, rate limits, token budget, and cost budget are covered by Task 7.
- Vercel deployment and `/v1/*` rewrite are covered by Tasks 1, 9, and 10.
- Codex Plus / Pro is explicitly excluded as a provider in the spec and documented in Task 9.

Placeholder scan:

- The plan contains no unresolved implementation slots.

Type consistency:

- Contract names use `ChatCompletionRequestSchema`, `ModelListResponseSchema`, and `GatewayErrorCodeSchema`.
- API key helpers use `createVirtualApiKey` and `verifyVirtualApiKey`.
- Provider helpers use `ProviderAdapter` and `createMockProviderAdapter`.
- Gateway entrypoint uses `createGatewayService`.
