# Agent Gateway Completion Implementation Plan

状态：completed
文档类型：plan
适用范围：`apps/frontend/agent-gateway`、`apps/backend/agent-server/src/domains/agent-gateway`、`packages/core/src/contracts/agent-gateway`
最后核对：2026-05-08

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This repository forbids `git worktree`; execute in the current checkout only.

**Goal:** Finish Agent Gateway from the current first-stage console into a usable management and relay gateway with stable contracts, authenticated admin UI, persistence, provider routing, logging, verification, and docs.

**Architecture:** Keep stable DTOs schema-first in `packages/core/src/contracts/agent-gateway`. Put backend orchestration in `apps/backend/agent-server/src/domains/agent-gateway`, with adapters/repositories/providers split under that domain; controllers stay thin and only parse/return stable contracts. Keep the frontend as the independent Vite app `apps/frontend/agent-gateway`, consuming only `@agent/core` contracts through `src/api/agent-gateway-api.ts`.

**Tech Stack:** TypeScript, zod, NestJS, React 19, Vite, Vitest, `@agent/core`, `fs-extra` for filesystem access, existing pnpm workspace scripts.

---

## Current Status

Completed first-stage scope:

- `apps/frontend/agent-gateway` exists as an independent Vite app.
- Login/session scaffolding exists with access token in React state and refresh token in `localStorage`.
- API client exists for snapshot/logs/usage/probe/preprocess/accounting.
- Backend exposes first-stage read/probe/token/preprocess/accounting endpoints.
- `packages/core/src/contracts/agent-gateway` contains initial schema-first contracts.
- Current frontend checks pass:
  - `pnpm --dir apps/frontend/agent-gateway typecheck`
  - `pnpm exec vitest run --config vitest.config.js apps/frontend/agent-gateway/test`

Not completed yet:

- Provider / credential / quota / config data is still in-memory static demo data.
- Frontend navigation tabs are not real views; providers, credential files, quotas, pipeline, logs, probes, token handling are not feature-complete screens.
- Write operations are missing for provider config, credential records, quota policy, and runtime config.
- Production vendor SDK relay forwarding remains future work; current `relay` is a deterministic mock-provider smoke path behind the project-owned provider adapter.

---

## File Structure

### Stable Contracts

- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.schemas.ts`
  - Add command schemas for config updates, provider credential set upsert, credential file upsert/delete, quota policy update, relay request/response, and OAuth flow state.
- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.types.ts`
  - Export inferred types from the new schemas.
- Modify: `packages/core/test/agent-gateway/agent-gateway-auth-observability.schemas.test.ts`
  - Add parse regressions for new command and relay contracts.

### Backend Domain

- Create: `apps/backend/agent-server/src/domains/agent-gateway/repositories/agent-gateway.repository.ts`
  - Define repository interface for runtime config, providers, credential files, quotas, logs, usage, and OAuth state.
- Create: `apps/backend/agent-server/src/domains/agent-gateway/repositories/memory-agent-gateway.repository.ts`
  - Replace current static fields with an injectable in-memory repository for tests and local development.
- Create: `apps/backend/agent-server/src/domains/agent-gateway/providers/agent-gateway-provider.ts`
  - Define provider adapter interface independent of vendor SDK types.
- Create: `apps/backend/agent-server/src/domains/agent-gateway/providers/mock-agent-gateway-provider.ts`
  - Deterministic provider for unit and integration tests.
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime/agent-gateway-router.ts`
  - Select provider by routing strategy, status, priority, and requested model.
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime/agent-gateway-relay.service.ts`
  - Perform preprocess, route, provider invocation, postprocess, log, and usage accounting.
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/services/agent-gateway.service.ts`
  - Delegate state to repository and relay to relay service.
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/agent-gateway.module.ts`
  - Wire repository, provider registry, router, and relay service.
- Modify: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway.controller.ts`
  - Add command endpoints while keeping request parsing schema-first.
- Test: `apps/backend/agent-server/test/agent-gateway/agent-gateway.controller.spec.ts`
- Test: `apps/backend/agent-server/test/agent-gateway/agent-gateway-relay.service.spec.ts`
- Test: `apps/backend/agent-server/test/agent-gateway/agent-gateway-router.spec.ts`

### Frontend App

- Modify: `apps/frontend/agent-gateway/src/api/agent-gateway-api.ts`
  - Add methods for providers, credential files, quotas, config, relay, token count, and command endpoints.
- Create: `apps/frontend/agent-gateway/src/app/gateway-view-model.ts`
  - Derive UI summaries from stable contract types.
- Create: `apps/frontend/agent-gateway/src/app/components/GatewayMetric.tsx`
  - Small metric cell used by overview and runtime pages.
- Create: `apps/frontend/agent-gateway/src/app/components/GatewayTable.tsx`
  - Reusable dense table shell for providers, credentials, quotas, logs, and usage.
- Create: `apps/frontend/agent-gateway/src/app/pages/OverviewPage.tsx`
- Create: `apps/frontend/agent-gateway/src/app/pages/ProvidersPage.tsx`
- Create: `apps/frontend/agent-gateway/src/app/pages/CredentialFilesPage.tsx`
- Create: `apps/frontend/agent-gateway/src/app/pages/QuotasPage.tsx`
- Create: `apps/frontend/agent-gateway/src/app/pages/PipelinePage.tsx`
- Create: `apps/frontend/agent-gateway/src/app/pages/LogsProbePage.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/App.tsx`
  - Replace placeholder nav buttons with real tab state and page rendering.
- Modify: `apps/frontend/agent-gateway/src/app/App.css`
  - Make the console dense, operational, responsive, and non-marketing.
- Test: `apps/frontend/agent-gateway/test/agent-gateway-api.test.ts`
- Test: `apps/frontend/agent-gateway/test/app-render.test.tsx`
- Test: `apps/frontend/agent-gateway/test/agent-gateway-workspace.test.tsx`

### Docs

- Modify: `docs/contracts/api/agent-gateway.md`
  - Promote write endpoints and relay endpoint from future contract to current implemented contract as tasks land.
- Modify: `docs/apps/frontend/agent-gateway/README.md`
  - Document final screens, dev commands, and backend dependency.
- Modify: `docs/apps/backend/agent-server/agent-gateway.md`
  - Document repository/provider/router/relay boundaries and verification.

---

## Task 1: Contract Gap Closure

**Files:**

- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.schemas.ts`
- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.types.ts`
- Test: `packages/core/test/agent-gateway/agent-gateway-auth-observability.schemas.test.ts`

- [x] **Step 1: Add failing schema tests**

Add these tests to `packages/core/test/agent-gateway/agent-gateway-auth-observability.schemas.test.ts`:

```ts
import {
  GatewayRelayRequestSchema,
  GatewayRelayResponseSchema,
  GatewayUpdateConfigRequestSchema,
  GatewayUpsertProviderRequestSchema
} from '../../src/contracts/agent-gateway';

it('parses gateway command contracts', () => {
  expect(
    GatewayUpdateConfigRequestSchema.parse({
      retryLimit: 3,
      circuitBreakerEnabled: true,
      auditEnabled: true,
      inputTokenStrategy: 'hybrid',
      outputTokenStrategy: 'provider-reported'
    })
  ).toEqual({
    retryLimit: 3,
    circuitBreakerEnabled: true,
    auditEnabled: true,
    inputTokenStrategy: 'hybrid',
    outputTokenStrategy: 'provider-reported'
  });

  expect(
    GatewayUpsertProviderRequestSchema.parse({
      id: 'openai-primary',
      provider: 'OpenAI',
      modelFamilies: ['gpt-5.4'],
      status: 'healthy',
      priority: 1,
      baseUrl: 'https://api.openai.com/v1',
      timeoutMs: 60000,
      secretRef: 'secret://agent-gateway/openai-primary'
    })
  ).toMatchObject({ id: 'openai-primary', secretRef: 'secret://agent-gateway/openai-primary' });
});

it('parses relay request and response contracts without vendor payload leakage', () => {
  expect(
    GatewayRelayRequestSchema.parse({
      model: 'gpt-main',
      messages: [{ role: 'user', content: 'ping' }],
      stream: false,
      metadata: { traceId: 'trace-1' }
    })
  ).toMatchObject({ model: 'gpt-main', stream: false });

  expect(
    GatewayRelayResponseSchema.parse({
      id: 'relay-1',
      providerId: 'openai-primary',
      model: 'gpt-main',
      content: 'pong',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      logId: 'log-1'
    })
  ).toMatchObject({ providerId: 'openai-primary', content: 'pong' });
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway/agent-gateway-auth-observability.schemas.test.ts
```

Expected: FAIL because `GatewayRelayRequestSchema`, `GatewayRelayResponseSchema`, `GatewayUpdateConfigRequestSchema`, and `GatewayUpsertProviderRequestSchema` are not exported yet.

- [x] **Step 3: Add schema definitions**

Add to `packages/core/src/contracts/agent-gateway/agent-gateway.schemas.ts`:

```ts
export const GatewayUpdateConfigRequestSchema = GatewayConfigSchema.partial().refine(
  value => Object.keys(value).length > 0,
  { message: '至少需要一个配置字段' }
);

export const GatewayUpsertProviderRequestSchema = GatewayProviderCredentialSetSchema.extend({
  secretRef: z.string().min(1).optional()
});

export const GatewayDeleteProviderRequestSchema = z.object({ providerId: z.string().min(1) });

export const GatewayUpsertCredentialFileRequestSchema = GatewayCredentialFileSchema.extend({
  content: z.string().min(1).optional()
});

export const GatewayDeleteCredentialFileRequestSchema = z.object({ credentialFileId: z.string().min(1) });

export const GatewayUpdateQuotaRequestSchema = GatewayQuotaSchema.pick({
  id: true,
  limitTokens: true,
  resetAt: true,
  status: true
});

export const GatewayRelayMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string()
});

export const GatewayRelayRequestSchema = z.object({
  model: z.string().min(1),
  providerId: z.string().min(1).optional(),
  messages: z.array(GatewayRelayMessageSchema).min(1),
  stream: z.boolean().default(false),
  metadata: z.record(z.string(), z.string()).optional()
});

export const GatewayRelayUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative()
});

export const GatewayRelayResponseSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  model: z.string(),
  content: z.string(),
  usage: GatewayRelayUsageSchema,
  logId: z.string()
});
```

- [x] **Step 4: Export inferred types**

Add to `packages/core/src/contracts/agent-gateway/agent-gateway.types.ts`:

```ts
export type GatewayUpdateConfigRequest = z.infer<typeof GatewayUpdateConfigRequestSchema>;
export type GatewayUpsertProviderRequest = z.infer<typeof GatewayUpsertProviderRequestSchema>;
export type GatewayDeleteProviderRequest = z.infer<typeof GatewayDeleteProviderRequestSchema>;
export type GatewayUpsertCredentialFileRequest = z.infer<typeof GatewayUpsertCredentialFileRequestSchema>;
export type GatewayDeleteCredentialFileRequest = z.infer<typeof GatewayDeleteCredentialFileRequestSchema>;
export type GatewayUpdateQuotaRequest = z.infer<typeof GatewayUpdateQuotaRequestSchema>;
export type GatewayRelayMessage = z.infer<typeof GatewayRelayMessageSchema>;
export type GatewayRelayRequest = z.infer<typeof GatewayRelayRequestSchema>;
export type GatewayRelayUsage = z.infer<typeof GatewayRelayUsageSchema>;
export type GatewayRelayResponse = z.infer<typeof GatewayRelayResponseSchema>;
```

Also update the import list in that file to include the new schemas.

- [x] **Step 5: Run contract test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway/agent-gateway-auth-observability.schemas.test.ts
```

Expected: PASS.

---

## Task 2: Backend Repository Boundary

**Files:**

- Create: `apps/backend/agent-server/src/domains/agent-gateway/repositories/agent-gateway.repository.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/repositories/memory-agent-gateway.repository.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/services/agent-gateway.service.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/agent-gateway.module.ts`
- Test: `apps/backend/agent-server/test/agent-gateway/agent-gateway.controller.spec.ts`

- [x] **Step 1: Add failing repository behavior test**

Extend `apps/backend/agent-server/test/agent-gateway/agent-gateway.controller.spec.ts` with a test that updates config and expects a later snapshot to reflect it:

```ts
it('persists gateway config updates through the repository boundary', async () => {
  await request(app.getHttpServer())
    .patch('/agent-gateway/config')
    .set('authorization', `Bearer ${accessToken}`)
    .send({ retryLimit: 4, auditEnabled: false })
    .expect(200);

  const response = await request(app.getHttpServer())
    .get('/agent-gateway/snapshot')
    .set('authorization', `Bearer ${accessToken}`)
    .expect(200);

  expect(response.body.config.retryLimit).toBe(4);
  expect(response.body.config.auditEnabled).toBe(false);
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway.controller.spec.ts
```

Expected: FAIL with missing `PATCH /agent-gateway/config`.

- [x] **Step 3: Define repository interface**

Create `apps/backend/agent-server/src/domains/agent-gateway/repositories/agent-gateway.repository.ts`:

```ts
import type {
  GatewayConfig,
  GatewayCredentialFile,
  GatewayLogEntry,
  GatewayProviderCredentialSet,
  GatewayQuota,
  GatewayUpdateConfigRequest,
  GatewayUsageRecord
} from '@agent/core';

export const AGENT_GATEWAY_REPOSITORY = Symbol('AGENT_GATEWAY_REPOSITORY');

export interface AgentGatewayRepository {
  getConfig(): Promise<GatewayConfig>;
  updateConfig(request: GatewayUpdateConfigRequest): Promise<GatewayConfig>;
  listProviders(): Promise<GatewayProviderCredentialSet[]>;
  upsertProvider(provider: GatewayProviderCredentialSet): Promise<GatewayProviderCredentialSet>;
  deleteProvider(providerId: string): Promise<void>;
  listCredentialFiles(): Promise<GatewayCredentialFile[]>;
  upsertCredentialFile(file: GatewayCredentialFile): Promise<GatewayCredentialFile>;
  deleteCredentialFile(fileId: string): Promise<void>;
  listQuotas(): Promise<GatewayQuota[]>;
  updateQuota(quota: GatewayQuota): Promise<GatewayQuota>;
  appendLog(entry: GatewayLogEntry): Promise<GatewayLogEntry>;
  listLogs(limit: number): Promise<GatewayLogEntry[]>;
  appendUsage(record: GatewayUsageRecord): Promise<GatewayUsageRecord>;
  listUsage(limit: number): Promise<GatewayUsageRecord[]>;
}
```

- [x] **Step 4: Implement memory repository**

Create `apps/backend/agent-server/src/domains/agent-gateway/repositories/memory-agent-gateway.repository.ts` by moving the current static arrays out of `AgentGatewayService`. Preserve the existing demo values so existing tests keep passing.

- [x] **Step 5: Update service and module wiring**

Modify `AgentGatewayService` to inject `AGENT_GATEWAY_REPOSITORY` and return repository data. Modify `AgentGatewayModule`:

```ts
{
  provide: AGENT_GATEWAY_REPOSITORY,
  useClass: MemoryAgentGatewayRepository
}
```

- [x] **Step 6: Add config endpoint**

Add to `AgentGatewayController`:

```ts
@Patch('config')
async updateConfig(@Body() body: unknown): Promise<GatewayConfig> {
  const parsed = GatewayUpdateConfigRequestSchema.safeParse(body);
  if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: '网关配置参数无效' });
  return this.service.updateConfig(parsed.data);
}
```

- [x] **Step 7: Run backend controller test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway.controller.spec.ts
```

Expected: PASS.

---

## Task 3: Provider Router and Relay Runtime

**Files:**

- Create: `apps/backend/agent-server/src/domains/agent-gateway/providers/agent-gateway-provider.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/providers/mock-agent-gateway-provider.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime/agent-gateway-router.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime/agent-gateway-relay.service.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/agent-gateway.module.ts`
- Modify: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway.controller.ts`
- Test: `apps/backend/agent-server/test/agent-gateway/agent-gateway-router.spec.ts`
- Test: `apps/backend/agent-server/test/agent-gateway/agent-gateway-relay.service.spec.ts`

- [x] **Step 1: Add failing router test**

Create `apps/backend/agent-server/test/agent-gateway/agent-gateway-router.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { selectGatewayProvider } from '../../src/domains/agent-gateway/runtime/agent-gateway-router';

describe('agent gateway router', () => {
  it('selects the healthy provider with the lowest priority number for the requested model', () => {
    const selected = selectGatewayProvider(
      [
        {
          id: 'backup',
          provider: 'Backup',
          modelFamilies: ['gpt-main'],
          status: 'healthy',
          priority: 2,
          baseUrl: 'mock://backup',
          timeoutMs: 1000
        },
        {
          id: 'primary',
          provider: 'Primary',
          modelFamilies: ['gpt-main'],
          status: 'healthy',
          priority: 1,
          baseUrl: 'mock://primary',
          timeoutMs: 1000
        },
        {
          id: 'disabled',
          provider: 'Disabled',
          modelFamilies: ['gpt-main'],
          status: 'disabled',
          priority: 0,
          baseUrl: 'mock://disabled',
          timeoutMs: 1000
        }
      ],
      'gpt-main'
    );

    expect(selected?.id).toBe('primary');
  });
});
```

- [x] **Step 2: Run router test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-router.spec.ts
```

Expected: FAIL because router file does not exist.

- [x] **Step 3: Implement router**

Create `apps/backend/agent-server/src/domains/agent-gateway/runtime/agent-gateway-router.ts`:

```ts
import type { GatewayProviderCredentialSet } from '@agent/core';

export function selectGatewayProvider(
  providers: GatewayProviderCredentialSet[],
  model: string,
  preferredProviderId?: string
): GatewayProviderCredentialSet | null {
  const candidates = providers.filter(provider => {
    const providerMatches = preferredProviderId ? provider.id === preferredProviderId : true;
    return providerMatches && provider.status === 'healthy' && provider.modelFamilies.includes(model);
  });

  return candidates.sort((a, b) => a.priority - b.priority)[0] ?? null;
}
```

- [x] **Step 4: Add failing relay test**

Create `apps/backend/agent-server/test/agent-gateway/agent-gateway-relay.service.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('agent gateway relay service', () => {
  it('routes a relay request, returns normalized content, and records usage/logs', async () => {
    // Instantiate MemoryAgentGatewayRepository, MockAgentGatewayProvider, and AgentGatewayRelayService.
    // Send { model: 'gpt-5.4', messages: [{ role: 'user', content: 'ping' }], stream: false }.
    // Expect response.content to be 'mock relay response: ping'.
    // Expect repository logs and usage lists to each contain one item.
  });
});
```

Replace the comments with direct construction once Task 2 class names are available.

- [x] **Step 5: Implement provider interface and mock provider**

Create `agent-gateway-provider.ts`:

```ts
import type { GatewayRelayRequest, GatewayRelayResponse } from '@agent/core';

export interface AgentGatewayProvider {
  readonly providerId: string;
  complete(request: GatewayRelayRequest): Promise<Omit<GatewayRelayResponse, 'id' | 'providerId' | 'logId'>>;
}
```

Create `mock-agent-gateway-provider.ts`:

```ts
import type { GatewayRelayRequest } from '@agent/core';
import type { AgentGatewayProvider } from './agent-gateway-provider';

export class MockAgentGatewayProvider implements AgentGatewayProvider {
  readonly providerId: string;

  constructor(providerId = 'openai-primary') {
    this.providerId = providerId;
  }

  async complete(request: GatewayRelayRequest) {
    const lastUserMessage = [...request.messages].reverse().find(message => message.role === 'user')?.content ?? '';
    const content = `mock relay response: ${lastUserMessage}`;
    return {
      model: request.model,
      content,
      usage: {
        inputTokens: Math.ceil(lastUserMessage.length / 4),
        outputTokens: Math.ceil(content.length / 4),
        totalTokens: Math.ceil(lastUserMessage.length / 4) + Math.ceil(content.length / 4)
      }
    };
  }
}
```

- [x] **Step 6: Implement relay service and endpoint**

Implement `AgentGatewayRelayService.relay(request)` to:

1. Load providers from repository.
2. Select provider with `selectGatewayProvider`.
3. Invoke provider adapter.
4. Append one `GatewayLogEntry`.
5. Append one `GatewayUsageRecord`.
6. Return `GatewayRelayResponse`.

Add controller endpoint:

```ts
@Post('relay')
async relay(@Body() body: unknown): Promise<GatewayRelayResponse> {
  const parsed = GatewayRelayRequestSchema.safeParse(body);
  if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: '中转请求参数无效' });
  return this.relayService.relay(parsed.data);
}
```

- [x] **Step 7: Run relay tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-router.spec.ts apps/backend/agent-server/test/agent-gateway/agent-gateway-relay.service.spec.ts
```

Expected: PASS.

---

## Task 4: Frontend Full Console Views

**Files:**

- Modify: `apps/frontend/agent-gateway/src/api/agent-gateway-api.ts`
- Create: `apps/frontend/agent-gateway/src/app/gateway-view-model.ts`
- Create: `apps/frontend/agent-gateway/src/app/components/GatewayMetric.tsx`
- Create: `apps/frontend/agent-gateway/src/app/components/GatewayTable.tsx`
- Create: `apps/frontend/agent-gateway/src/app/pages/OverviewPage.tsx`
- Create: `apps/frontend/agent-gateway/src/app/pages/ProvidersPage.tsx`
- Create: `apps/frontend/agent-gateway/src/app/pages/CredentialFilesPage.tsx`
- Create: `apps/frontend/agent-gateway/src/app/pages/QuotasPage.tsx`
- Create: `apps/frontend/agent-gateway/src/app/pages/PipelinePage.tsx`
- Create: `apps/frontend/agent-gateway/src/app/pages/LogsProbePage.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/App.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/App.css`
- Test: `apps/frontend/agent-gateway/test/agent-gateway-workspace.test.tsx`

- [x] **Step 1: Add failing render test for all console centers**

Create `apps/frontend/agent-gateway/test/agent-gateway-workspace.test.tsx`:

```ts
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GatewayWorkspace } from '../src/app/GatewayWorkspace';

describe('Agent Gateway workspace', () => {
  it('renders all operational centers from loaded gateway data', () => {
    const html = renderToStaticMarkup(
      <GatewayWorkspace
        activeView="overview"
        onActiveViewChange={() => undefined}
        onLogout={() => undefined}
        snapshot={{
          observedAt: '2026-05-08T00:00:00.000Z',
          runtime: { mode: 'proxy', status: 'healthy', activeProviderCount: 1, degradedProviderCount: 0, requestPerMinute: 2, p95LatencyMs: 120 },
          config: { inputTokenStrategy: 'preprocess', outputTokenStrategy: 'postprocess', retryLimit: 2, circuitBreakerEnabled: true, auditEnabled: true },
          providerCredentialSets: [{ id: 'openai-primary', provider: 'OpenAI', modelFamilies: ['gpt-main'], status: 'healthy', priority: 1, baseUrl: 'https://api.openai.com/v1', timeoutMs: 60000 }],
          credentialFiles: [{ id: 'env', provider: 'OpenAI', path: '.env', status: 'valid', lastCheckedAt: '2026-05-08T00:00:00.000Z' }],
          quotas: [{ id: 'daily', provider: 'OpenAI', scope: 'daily', usedTokens: 10, limitTokens: 100, resetAt: '2026-05-09T00:00:00.000Z', status: 'normal' }]
        }}
        logs={{ items: [] }}
        usage={{ items: [] }}
      />
    );

    expect(html).toContain('总览');
    expect(html).toContain('上游方');
    expect(html).toContain('认证文件');
    expect(html).toContain('配额');
    expect(html).toContain('调用管线');
    expect(html).toContain('日志与探测');
    expect(html).toContain('OpenAI');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-gateway/test/agent-gateway-workspace.test.tsx
```

Expected: FAIL because `GatewayWorkspace` does not exist.

- [x] **Step 3: Extract `GatewayWorkspace` from `App.tsx`**

Create `apps/frontend/agent-gateway/src/app/GatewayWorkspace.tsx` with props for `snapshot`, `logs`, `usage`, `activeView`, `onActiveViewChange`, and `onLogout`. Move the shell markup from `GatewayShell` into this component.

- [x] **Step 4: Add real pages**

Implement each page as a presentational component that receives stable contract data:

- `OverviewPage`: runtime health, active/degraded provider counts, RPM, p95 latency, token strategy.
- `ProvidersPage`: provider id, status, priority, base URL, timeout, model families.
- `CredentialFilesPage`: provider, path, status, last checked time.
- `QuotasPage`: provider, scope, used/limit tokens, status, reset time.
- `PipelinePage`: preprocess, route, relay, accounting stages with current config.
- `LogsProbePage`: logs table, usage table, and a probe form wired through props in a later step.

- [x] **Step 5: Add API client methods**

Extend `AgentGatewayApiClient` with:

```ts
providers(): Promise<GatewayProviderCredentialSet[]> {
  return this.get('/agent-gateway/providers', z.array(GatewayProviderCredentialSetSchema));
}

credentialFiles(): Promise<GatewayCredentialFile[]> {
  return this.get('/agent-gateway/credential-files', z.array(GatewayCredentialFileSchema));
}

quotas(): Promise<GatewayQuota[]> {
  return this.get('/agent-gateway/quotas', z.array(GatewayQuotaSchema));
}

relay(request: GatewayRelayRequest): Promise<GatewayRelayResponse> {
  return this.post('/agent-gateway/relay', request, GatewayRelayResponseSchema);
}

tokenCount(request: GatewayTokenCountRequest): Promise<GatewayTokenCountResponse> {
  return this.post('/agent-gateway/token-count', request, GatewayTokenCountResponseSchema);
}
```

Use static imports from `@agent/core`; do not use dynamic imports.

- [x] **Step 6: Update styling**

Revise `App.css` for dense operational layout:

- fixed left navigation width;
- responsive single-column content below 820px;
- table cells with stable min widths;
- no marketing hero, no decorative orb/gradient background.

- [x] **Step 7: Run frontend tests and typecheck**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-gateway/test
pnpm --dir apps/frontend/agent-gateway typecheck
```

Expected: PASS.

---

## Task 5: Write Operations and Secret Boundary

**Files:**

- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.schemas.ts`
- Modify: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway.controller.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/repositories/agent-gateway.repository.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/repositories/memory-agent-gateway.repository.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/secrets/agent-gateway-secret-vault.ts`
- Modify: `apps/frontend/agent-gateway/src/api/agent-gateway-api.ts`
- Modify: frontend provider and credential pages from Task 4.
- Test: backend controller tests and frontend API tests.

- [x] **Step 1: Add failing backend tests for provider and credential writes**

Add tests that:

- `PUT /agent-gateway/providers/openai-primary` creates or updates a provider and later `GET /agent-gateway/providers` returns it.
- `DELETE /agent-gateway/providers/openai-primary` removes it.
- `PUT /agent-gateway/credential-files/env` saves metadata and never returns raw `content`.

- [x] **Step 2: Implement secret vault interface**

Create `agent-gateway-secret-vault.ts`:

```ts
export const AGENT_GATEWAY_SECRET_VAULT = Symbol('AGENT_GATEWAY_SECRET_VAULT');

export interface AgentGatewaySecretVault {
  saveSecret(scope: string, plaintext: string): Promise<string>;
  readSecret(secretRef: string): Promise<string | null>;
}

export class MemoryAgentGatewaySecretVault implements AgentGatewaySecretVault {
  private readonly values = new Map<string, string>();

  async saveSecret(scope: string, plaintext: string): Promise<string> {
    const ref = `memory://agent-gateway/${scope}`;
    this.values.set(ref, plaintext);
    return ref;
  }

  async readSecret(secretRef: string): Promise<string | null> {
    return this.values.get(secretRef) ?? null;
  }
}
```

- [x] **Step 3: Add write endpoints**

Add endpoints:

- `PATCH /agent-gateway/config`
- `PUT /agent-gateway/providers/:providerId`
- `DELETE /agent-gateway/providers/:providerId`
- `PUT /agent-gateway/credential-files/:credentialFileId`
- `DELETE /agent-gateway/credential-files/:credentialFileId`
- `PATCH /agent-gateway/quotas/:quotaId`

Each endpoint must parse with `@agent/core` schemas and return only stable projections.

- [x] **Step 4: Add frontend command methods and forms**

Add API methods:

- `updateConfig`
- `upsertProvider`
- `deleteProvider`
- `upsertCredentialFile`
- `deleteCredentialFile`
- `updateQuota`

Add minimal forms in the relevant pages with explicit save/cancel states and visible error messages.

- [x] **Step 5: Run write-chain verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway apps/backend/agent-server/test/agent-gateway apps/frontend/agent-gateway/test
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/frontend/agent-gateway typecheck
```

Expected: PASS.

---

## Task 6: OAuth/Auth File Flow

**Files:**

- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.schemas.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/repositories/agent-gateway.repository.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/oauth/agent-gateway-oauth.service.ts`
- Modify: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway.controller.ts`
- Modify: `apps/frontend/agent-gateway/src/app/pages/CredentialFilesPage.tsx`
- Test: `apps/backend/agent-server/test/agent-gateway/agent-gateway-oauth.service.spec.ts`

- [x] **Step 1: Add OAuth contracts**

Add schemas:

- `GatewayStartOAuthRequestSchema`: `{ providerId, credentialFileId }`
- `GatewayStartOAuthResponseSchema`: `{ flowId, providerId, verificationUri, userCode, expiresAt }`
- `GatewayCompleteOAuthRequestSchema`: `{ flowId, code }`
- `GatewayCompleteOAuthResponseSchema`: `{ credentialFileId, status, lastCheckedAt }`

- [x] **Step 2: Add deterministic OAuth service test**

Test that starting a flow returns a stable `flowId` and completing it updates the credential file status to `valid`.

- [x] **Step 3: Implement OAuth service**

Keep vendor-specific OAuth out of the contract. The first implementation can be deterministic and local:

- start stores `{ flowId, providerId, credentialFileId, expiresAt }`;
- complete validates flow existence and code non-empty;
- repository updates credential file status.

- [x] **Step 4: Wire frontend auth-file actions**

Add buttons:

- `开始授权`
- `完成授权`
- `刷新状态`

Show `verificationUri`, `userCode`, and expiry in the credential files page.

- [x] **Step 5: Run OAuth tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-oauth.service.spec.ts apps/frontend/agent-gateway/test
```

Expected: PASS.

---

## Task 7: Integration Verification and Docs Cleanup

**Files:**

- Modify: `docs/contracts/api/agent-gateway.md`
- Modify: `docs/apps/frontend/agent-gateway/README.md`
- Modify: `docs/apps/backend/agent-server/agent-gateway.md`
- Modify if stale references are found: `docs/integration/README.md`, `docs/apps/frontend/README.md`, `docs/maps/apps-overview.md`

- [x] **Step 1: Run stale-doc scan**

Run:

```bash
rg -n '<stale Agent Gateway future-work phrases for this task>' docs AGENTS.md README.md
```

Expected: identify every doc statement that still describes implemented work as future work.

- [x] **Step 2: Update API docs**

Update `docs/contracts/api/agent-gateway.md` so it records:

- current endpoint list;
- request/response schemas;
- error semantics;
- secret redaction rule;
- relay lifecycle: preprocess -> route -> provider -> accounting -> log;
- compatibility rule: projections never expose raw vendor payload or plaintext secret.

- [x] **Step 3: Update frontend/backend docs**

Update:

- `docs/apps/frontend/agent-gateway/README.md`
- `docs/apps/backend/agent-server/agent-gateway.md`

Mention exact verification commands and current screen list.

- [x] **Step 4: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

- [x] **Step 5: Run affected verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway apps/backend/agent-server/test/agent-gateway apps/frontend/agent-gateway/test
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/frontend/agent-gateway typecheck
pnpm --dir apps/frontend/agent-gateway build
```

Expected: PASS.

---

## Execution Order

1. Task 1: Contract Gap Closure
2. Task 2: Backend Repository Boundary
3. Task 3: Provider Router and Relay Runtime
4. Task 4: Frontend Full Console Views
5. Task 5: Write Operations and Secret Boundary
6. Task 6: OAuth/Auth File Flow
7. Task 7: Integration Verification and Docs Cleanup

## Completion Definition

The Agent Gateway is complete when:

- Frontend has real screens for overview, providers, credential files, quotas, pipeline, logs, probe, token handling, and relay smoke.
- Backend state is behind repository interfaces, not static service fields.
- Provider routing and relay return normalized project-owned contracts.
- Logs and usage are recorded for relay calls.
- Write endpoints are schema-first and covered by tests.
- Secret plaintext never appears in query projections.
- OAuth/auth-file lifecycle has deterministic first implementation.
- API, frontend, and backend docs describe current behavior without stale “future work” wording.
- All affected checks listed in Task 7 pass.
