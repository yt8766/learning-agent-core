# Agent Gateway Full CLIProxyAPI Parity Implementation Plan

状态：draft  
文档类型：plan  
适用范围：`apps/frontend/agent-gateway`、`apps/backend/agent-server/src/domains/agent-gateway`、`packages/core/src/contracts/agent-gateway`、`docs/contracts/api/agent-gateway.md`  
最后核对：2026-05-11

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `apps/frontend/agent-gateway` and `agent-server` into a CLIProxyAPI-compatible Agent Gateway by completing UI parity, schema-first contracts, management services, runtime executor adapters, and ops observability.

**Architecture:** Keep `apps/frontend/agent-gateway` as the standalone Agent Gateway Management Center. Keep all stable JSON interfaces in `packages/core/src/contracts/agent-gateway`, and keep runtime ownership inside `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine`. Provider calls must pass through replaceable executor adapters so the first production-shaped slice can use deterministic, HTTP, or process adapters without leaking raw vendor payloads.

**Tech Stack:** TypeScript, React 19, Vite, TanStack Query, Axios, NestJS, Zod, Vitest, pnpm workspace.

---

## Scope Check

The approved design spans several subsystems. This plan is intentionally split into five sequential task packages. Each task is independently testable and should leave the repository in a coherent state. Do not use `git worktree`; this repository requires all implementation in the current checkout.

## File Structure

- Modify `docs/contracts/api/agent-gateway.md`
  - Source of truth for public management and runtime API behavior.
- Modify `docs/apps/frontend/agent-gateway/README.md`
  - Frontend readiness, route map, and CPAMC parity notes.
- Modify `docs/apps/frontend/agent-gateway/cli-proxy-parity.md`
  - Track parity status and remaining gaps.
- Create or modify `docs/apps/backend/agent-server/agent-gateway.md`
  - Backend runtime, adapter, secret, persistence, and verification boundary.
- Modify `packages/core/src/contracts/agent-gateway/agent-gateway-cli-proxy-parity.schemas.ts`
  - CPAMC management parity contracts.
- Modify `packages/core/src/contracts/agent-gateway/agent-gateway-internal-cli-proxy.schemas.ts`
  - Internal runtime, executor, OAuth credential, quota, and migration contracts.
- Modify `packages/core/src/contracts/agent-gateway/agent-gateway.types.ts`
  - Inferred public types from zod schemas.
- Modify `packages/core/src/contracts/agent-gateway/index.ts`
  - Barrel exports.
- Modify tests in `packages/core/test/agent-gateway/`
  - Schema parse and raw secret rejection coverage.
- Modify `apps/frontend/agent-gateway/src/api/agent-gateway-api.ts`
  - API client methods only after core/backend contracts exist.
- Split or modify `apps/frontend/agent-gateway/src/app/GatewayWorkspacePages.tsx`
  - Keep route wiring thin; move domain-specific wiring into focused files if it grows.
- Modify pages under `apps/frontend/agent-gateway/src/app/pages/`
  - CPAMC feature parity with Agent Gateway semantics.
- Modify tests in `apps/frontend/agent-gateway/test/`
  - React callback smoke and page readiness checks.
- Modify `apps/backend/agent-server/src/api/agent-gateway/*.controller.ts`
  - Controller endpoints and schema parse boundaries.
- Modify `apps/backend/agent-server/src/domains/agent-gateway/**`
  - Management, migration, OAuth, quota, logs, runtime, repositories, and secret boundaries.
- Modify tests in `apps/backend/agent-server/test/agent-gateway/`
  - Service, controller, HTTP smoke, runtime, streaming, and adapter coverage.

## Task 1: Contract And Documentation Gate

**Files:**

- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway-cli-proxy-parity.schemas.ts`
- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway-internal-cli-proxy.schemas.ts`
- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.types.ts`
- Modify: `packages/core/src/contracts/agent-gateway/index.ts`
- Modify: `packages/core/test/agent-gateway/agent-gateway-cli-proxy-parity.schemas.test.ts`
- Modify: `packages/core/test/agent-gateway/agent-gateway-internal-cli-proxy.schemas.test.ts`
- Modify: `packages/core/test/agent-gateway/agent-gateway-production-readiness.schemas.test.ts`
- Modify: `docs/contracts/api/agent-gateway.md`
- Modify: `docs/apps/frontend/agent-gateway/cli-proxy-parity.md`
- Modify: `docs/apps/frontend/agent-gateway/README.md`

- [ ] **Step 1: Write failing schema coverage for the full parity matrix**

  Extend `packages/core/test/agent-gateway/agent-gateway-cli-proxy-parity.schemas.test.ts` with a test named `parses the full management parity matrix without exposing raw secrets`.

  Use this shape as the exact test intent:

  ```ts
  import { describe, expect, it } from 'vitest';
  import {
    GatewayProviderSpecificConfigListResponseSchema,
    GatewayRawConfigResponseSchema,
    GatewayRequestLogListResponseSchema,
    GatewaySystemModelsResponseSchema
  } from '../../src/contracts/agent-gateway';

  describe('Agent Gateway CLI Proxy parity contracts', () => {
    it('parses the full management parity matrix without exposing raw secrets', () => {
      expect(
        GatewayRawConfigResponseSchema.parse({
          content: 'providers: []\n',
          version: 'cfg_001',
          updatedAt: '2026-05-11T00:00:00.000Z'
        }).content
      ).toContain('providers');

      expect(
        GatewayProviderSpecificConfigListResponseSchema.parse({
          items: [
            {
              id: 'provider_openai',
              providerKind: 'openaiCompatible',
              displayName: 'OpenAI Compatible',
              enabled: true,
              maskedSecret: 'sk-...abcd',
              modelCount: 2,
              updatedAt: '2026-05-11T00:00:00.000Z'
            }
          ]
        }).items[0]
      ).not.toHaveProperty('apiKey');

      expect(
        GatewayRequestLogListResponseSchema.parse({
          items: [],
          nextCursor: null
        })
      ).toEqual({ items: [], nextCursor: null });

      expect(
        GatewaySystemModelsResponseSchema.parse({
          groups: [
            {
              providerKind: 'openaiCompatible',
              label: 'OpenAI Compatible',
              models: [{ id: 'gpt-4.1', label: 'gpt-4.1' }]
            }
          ]
        }).groups[0].models[0].id
      ).toBe('gpt-4.1');
    });
  });
  ```

- [ ] **Step 2: Write failing runtime contract coverage**

  Extend `packages/core/test/agent-gateway/agent-gateway-internal-cli-proxy.schemas.test.ts` with a test named `rejects raw provider payloads at runtime boundaries`.

  Use this assertion pattern:

  ```ts
  import {
    GatewayRuntimeExecutorConfigSchema,
    GatewayOAuthCredentialRecordSchema,
    GatewayProviderQuotaSnapshotSchema
  } from '../../src/contracts/agent-gateway';

  it('rejects raw provider payloads at runtime boundaries', () => {
    expect(() =>
      GatewayRuntimeExecutorConfigSchema.parse({
        providerKind: 'codex',
        enabled: true,
        adapterKind: 'process',
        commandProfile: 'codex',
        rawResponse: { token: 'secret' }
      })
    ).toThrow();

    expect(() =>
      GatewayOAuthCredentialRecordSchema.parse({
        id: 'cred_1',
        providerKind: 'codex',
        status: 'valid',
        secretRef: 'secret:cred_1',
        accessToken: 'not-allowed'
      })
    ).toThrow();

    expect(() =>
      GatewayProviderQuotaSnapshotSchema.parse({
        id: 'quota_1',
        providerKind: 'codex',
        scope: { authFileId: 'auth_1', model: 'gpt-5' },
        source: 'provider',
        refreshedAt: '2026-05-11T00:00:00.000Z',
        headers: { authorization: 'Bearer secret' }
      })
    ).toThrow();
  });
  ```

- [ ] **Step 3: Run the failing core tests**

  Run:

  ```bash
  pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway/agent-gateway-cli-proxy-parity.schemas.test.ts packages/core/test/agent-gateway/agent-gateway-internal-cli-proxy.schemas.test.ts packages/core/test/agent-gateway/agent-gateway-production-readiness.schemas.test.ts
  ```

  Expected: FAIL because at least one field, strict object rule, or export is not yet aligned with full parity.

- [ ] **Step 4: Add or tighten schema-first contracts**

  Update `packages/core/src/contracts/agent-gateway/agent-gateway-cli-proxy-parity.schemas.ts` and `packages/core/src/contracts/agent-gateway/agent-gateway-internal-cli-proxy.schemas.ts`.

  The implementation must use strict zod objects for stable public boundaries. The exact pattern is:

  ```ts
  import { z } from 'zod';

  export const GatewayRuntimeExecutorConfigSchema = z
    .object({
      providerKind: GatewayProviderKindSchema,
      enabled: z.boolean(),
      adapterKind: z.enum(['deterministic', 'http', 'process', 'native-ts']),
      commandProfile: z.string().min(1).optional(),
      baseUrl: z.string().url().optional(),
      secretRef: z.string().min(1).optional(),
      timeoutMs: z.number().int().positive().optional(),
      concurrencyLimit: z.number().int().positive().optional(),
      modelAliases: z.record(z.string(), z.string()).default({})
    })
    .strict();
  ```

  Apply the same `.strict()` rule to OAuth credential, quota snapshot, migration preview/apply, runtime invocation, runtime response, and normalized error contracts.

- [ ] **Step 5: Export inferred types**

  Update `packages/core/src/contracts/agent-gateway/agent-gateway.types.ts`:

  ```ts
  import type { z } from 'zod';
  import type {
    GatewayRuntimeExecutorConfigSchema,
    GatewayOAuthCredentialRecordSchema,
    GatewayProviderQuotaSnapshotSchema
  } from './agent-gateway-internal-cli-proxy.schemas';

  export type GatewayRuntimeExecutorConfig = z.infer<typeof GatewayRuntimeExecutorConfigSchema>;
  export type GatewayOAuthCredentialRecord = z.infer<typeof GatewayOAuthCredentialRecordSchema>;
  export type GatewayProviderQuotaSnapshot = z.infer<typeof GatewayProviderQuotaSnapshotSchema>;
  ```

  Then export the schema modules through `packages/core/src/contracts/agent-gateway/index.ts`.

- [ ] **Step 6: Update contract docs**

  Update `docs/contracts/api/agent-gateway.md` with:
  - CPAMC management parity matrix.
  - Runtime executor adapter kinds.
  - Runtime auth split: Identity for `/api/*`, Gateway client API key for `/v1/*`.
  - Secret projection rule.
  - Migration adapter rule: external CLIProxyAPI is import source, not default runtime.

- [ ] **Step 7: Verify Task 1**

  Run:

  ```bash
  pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway
  pnpm exec tsc -p packages/core/tsconfig.json --noEmit
  pnpm check:docs
  ```

  Expected: PASS.

- [ ] **Step 8: Commit Task 1**

  Read `docs/conventions/github-flow.md`, then commit only Task 1 files:

  ```bash
  git add packages/core/src/contracts/agent-gateway packages/core/test/agent-gateway docs/contracts/api/agent-gateway.md docs/apps/frontend/agent-gateway/README.md docs/apps/frontend/agent-gateway/cli-proxy-parity.md
  git commit -m "feat: define agent gateway cli proxy parity contracts"
  ```

## Task 2: Frontend CPAMC Parity With Agent Gateway Semantics

**Files:**

- Modify: `apps/frontend/agent-gateway/src/app/GatewayWorkspacePages.tsx`
- Create: `apps/frontend/agent-gateway/src/app/routes/gateway-page-wiring.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/gateway-view-model.ts`
- Modify: `apps/frontend/agent-gateway/src/api/agent-gateway-api.ts`
- Modify: `apps/frontend/agent-gateway/src/app/pages/ConfigEditorPage.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/pages/ProviderConfigPage.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/pages/AuthFilesManagerPage.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/pages/OAuthPolicyPage.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/pages/QuotasPage.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/pages/LogsManagerPage.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/pages/SystemPage.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/styles/pages.scss`
- Modify: `apps/frontend/agent-gateway/test/agent-gateway-production-parity-pages.test.tsx`
- Modify: `apps/frontend/agent-gateway/test/agent-gateway-real-operation-smoke.test.tsx`
- Modify: `docs/apps/frontend/agent-gateway/README.md`

- [ ] **Step 1: Write failing route/wiring smoke**

  Extend `apps/frontend/agent-gateway/test/agent-gateway-production-parity-pages.test.tsx` with a test named `renders full CPAMC parity navigation under Agent Gateway semantics`.

  Use this intent:

  ```tsx
  import { describe, expect, it } from 'vitest';
  import { GATEWAY_VIEWS } from '../src/app/gateway-view-model';

  describe('Agent Gateway production parity pages', () => {
    it('renders full CPAMC parity navigation under Agent Gateway semantics', () => {
      expect(GATEWAY_VIEWS.map(view => view.id)).toEqual([
        'dashboard',
        'runtime',
        'clients',
        'usageStats',
        'config',
        'aiProviders',
        'authFiles',
        'oauth',
        'migration',
        'quota',
        'logs',
        'system'
      ]);
    });
  });
  ```

- [ ] **Step 2: Write failing real-operation smoke for high-risk actions**

  Extend `apps/frontend/agent-gateway/test/agent-gateway-real-operation-smoke.test.tsx`.

  The test must assert that config save, provider save, auth file upload, OAuth start, quota refresh, log clear, migration preview/apply, and system model refresh call `AgentGatewayApiClient` methods and then call `onGatewayDataChanged`.

  Use this pattern:

  ```tsx
  const api = {
    saveRawConfig: vi.fn().mockResolvedValue({ version: 'cfg_2' }),
    saveProviderConfig: vi.fn().mockResolvedValue({ id: 'provider_openai' }),
    batchUploadAuthFiles: vi.fn().mockResolvedValue({ imported: 1, skipped: 0 }),
    startProviderOAuth: vi.fn().mockResolvedValue({ state: 'oauth_1', authorizationUrl: 'https://example.test/auth' }),
    refreshQuotaDetails: vi.fn().mockResolvedValue({ items: [] }),
    clearLogs: vi.fn().mockResolvedValue({ cleared: 1 }),
    previewMigration: vi
      .fn()
      .mockResolvedValue({ resources: [], summary: { create: 0, update: 0, skip: 0, conflict: 0 } }),
    applyMigration: vi.fn().mockResolvedValue({ imported: [], skipped: [], failed: [] }),
    discoverModels: vi.fn().mockResolvedValue({ groups: [] })
  };
  ```

- [ ] **Step 3: Run failing frontend tests**

  Run:

  ```bash
  pnpm exec vitest run --config vitest.config.js apps/frontend/agent-gateway/test/agent-gateway-production-parity-pages.test.tsx apps/frontend/agent-gateway/test/agent-gateway-real-operation-smoke.test.tsx
  ```

  Expected: FAIL because route IDs, page callbacks, or API client methods are not fully aligned.

- [ ] **Step 4: Split page wiring**

  Create `apps/frontend/agent-gateway/src/app/routes/gateway-page-wiring.tsx` and move the page-specific `renderActivePage` logic out of `GatewayWorkspacePages.tsx`.

  The new function shape must be:

  ```tsx
  import type { GatewayViewId } from '../gateway-view-model';
  import type { GatewayPageData } from '../GatewayWorkspacePages';

  export function renderGatewayPage(activeView: GatewayViewId, pageData: GatewayPageData) {
    // Switch by view id and return focused page components.
  }
  ```

  Keep `GatewayWorkspacePages.tsx` as a thin compatibility wrapper:

  ```tsx
  export { renderGatewayPage as renderActivePage } from './routes/gateway-page-wiring';
  export type { GatewayPageData } from './routes/gateway-page-types';
  ```

  If this creates a barrel-only directory, put the real implementation in the same `routes/` directory so the barrel layout check remains meaningful.

- [ ] **Step 5: Complete `gateway-view-model.ts` route model**

  Ensure the view IDs and labels match the management center:

  ```ts
  export type GatewayViewId =
    | 'dashboard'
    | 'runtime'
    | 'clients'
    | 'usageStats'
    | 'config'
    | 'aiProviders'
    | 'authFiles'
    | 'oauth'
    | 'migration'
    | 'quota'
    | 'logs'
    | 'system';
  ```

  Add the `/logs` route and keep existing routes stable.

- [ ] **Step 6: Add missing API client methods**

  In `apps/frontend/agent-gateway/src/api/agent-gateway-api.ts`, add methods only for backend endpoints defined by Task 1 contracts.

  Use the existing axios pattern. Example:

  ```ts
  async clearLogs(): Promise<GatewayClearLogsResponse> {
    const response = await this.client.delete('/logs');
    return GatewayClearLogsResponseSchema.parse(response.data);
  }
  ```

  Do not introduce browser `fetch`.

- [ ] **Step 7: Replace CPAMC raw client assumptions in pages**

  For each page changed in this task:
  - Accept schema-first props.
  - Accept callback props for mutations.
  - Show loading state while callback promise is pending.
  - Show success state after callback resolves.
  - Show visible error state after callback rejects.
  - Do not import from `/Users/dev/Desktop/Cli-Proxy-API-Management-Center`.

  The minimum UI state pattern is:

  ```tsx
  const [operation, setOperation] = useState<{ status: 'idle' | 'running' | 'success' | 'error'; message: string }>({
    status: 'idle',
    message: ''
  });
  ```

- [ ] **Step 8: Update frontend docs**

  Update `docs/apps/frontend/agent-gateway/README.md` and `docs/apps/frontend/agent-gateway/cli-proxy-parity.md`:
  - List the 12 route IDs.
  - Explain CPAMC feature absorption vs Agent Gateway semantic rename.
  - Document mutation feedback requirements.
  - Document that raw CPAMC API clients are not used.

- [ ] **Step 9: Verify Task 2**

  Run:

  ```bash
  pnpm exec vitest run --config vitest.config.js apps/frontend/agent-gateway/test
  pnpm --dir apps/frontend/agent-gateway typecheck
  pnpm check:docs
  ```

  Expected: PASS.

- [ ] **Step 10: Commit Task 2**

  ```bash
  git add apps/frontend/agent-gateway docs/apps/frontend/agent-gateway/README.md docs/apps/frontend/agent-gateway/cli-proxy-parity.md
  git commit -m "feat: complete agent gateway management center parity"
  ```

## Task 3: Backend Management Parity Services

**Files:**

- Modify: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway-management.controller.ts`
- Modify: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway-migration.controller.ts`
- Modify: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway-oauth-callback.controller.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/config/agent-gateway-config-file.service.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/providers/agent-gateway-provider-config.service.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/auth-files/agent-gateway-auth-file-management.service.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/oauth/agent-gateway-oauth.service.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/quotas/agent-gateway-quota-detail.service.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/logs/agent-gateway-log.service.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/system/agent-gateway-system.service.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/migration/cli-proxy-import.service.ts`
- Modify: `apps/backend/agent-server/test/agent-gateway/agent-gateway-management.controller.spec.ts`
- Modify: `apps/backend/agent-server/test/agent-gateway/agent-gateway-http.smoke.spec.ts`
- Modify: `docs/apps/backend/agent-server/agent-gateway.md`

- [ ] **Step 1: Write failing management HTTP smoke**

  Extend `apps/backend/agent-server/test/agent-gateway/agent-gateway-http.smoke.spec.ts` with a test named `serves the full management parity surface through schema projections`.

  Cover these endpoints:

  ```ts
  const endpoints = [
    ['GET', '/api/agent-gateway/config/raw'],
    ['GET', '/api/agent-gateway/provider-configs'],
    ['GET', '/api/agent-gateway/auth-files'],
    ['GET', '/api/agent-gateway/quotas/details'],
    ['GET', '/api/agent-gateway/logs/tail'],
    ['GET', '/api/agent-gateway/system/models']
  ] as const;
  ```

  Assert `200` and schema parse for each response.

- [ ] **Step 2: Write failing mutation smoke**

  In the same smoke file, add a test named `persists management mutations and returns masked projections`.

  Cover:
  - `PUT /api/agent-gateway/config/raw`
  - `PUT /api/agent-gateway/provider-configs/:id`
  - `POST /api/agent-gateway/auth-files`
  - `POST /api/agent-gateway/oauth/:providerId/start`
  - `POST /api/agent-gateway/quotas/details/:providerKind/refresh`
  - `DELETE /api/agent-gateway/logs`

  Assert response bodies do not include `accessToken`, `refreshToken`, `authorization`, or `apiKey`.

- [ ] **Step 3: Run failing backend smoke**

  Run:

  ```bash
  pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-http.smoke.spec.ts
  ```

  Expected: FAIL for any missing endpoint, missing schema projection, or raw secret leak.

- [ ] **Step 4: Implement missing service methods behind existing domain boundaries**

  Add methods to the relevant services with these names so controller code remains thin:

  ```ts
  saveRawConfig(request: GatewaySaveRawConfigRequest): Promise<GatewayRawConfigResponse>
  saveProviderConfig(providerId: string, request: GatewaySaveProviderConfigRequest): Promise<GatewayProviderSpecificConfig>
  uploadAuthFiles(request: GatewayUploadAuthFilesRequest): Promise<GatewayAuthFileUploadResponse>
  startProviderOAuth(providerId: string): Promise<GatewayOAuthStartResponse>
  refreshProviderQuota(providerKind: GatewayProviderKind): Promise<GatewayQuotaDetailListResponse>
  clearLogs(): Promise<GatewayClearLogsResponse>
  ```

  Each method must parse outgoing projection through the matching `@agent/core` schema before returning.

- [ ] **Step 5: Keep controllers thin**

  Update controllers so each route follows this shape:

  ```ts
  @Put('provider-configs/:providerId')
  async saveProviderConfig(@Param('providerId') providerId: string, @Body() body: unknown) {
    const request = GatewaySaveProviderConfigRequestSchema.parse(body);
    return GatewayProviderSpecificConfigSchema.parse(
      await this.providerConfigService.saveProviderConfig(providerId, request)
    );
  }
  ```

  Do not parse provider raw payloads in controller methods.

- [ ] **Step 6: Document backend management parity**

  Create or update `docs/apps/backend/agent-server/agent-gateway.md` with:
  - Endpoint ownership.
  - Service boundaries.
  - Secret projection rule.
  - Management adapter vs runtime distinction.
  - Verification commands.

- [ ] **Step 7: Verify Task 3**

  Run:

  ```bash
  pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-management.controller.spec.ts apps/backend/agent-server/test/agent-gateway/agent-gateway-http.smoke.spec.ts
  pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
  pnpm check:docs
  ```

  Expected: PASS.

- [ ] **Step 8: Commit Task 3**

  ```bash
  git add apps/backend/agent-server/src/api/agent-gateway apps/backend/agent-server/src/domains/agent-gateway apps/backend/agent-server/test/agent-gateway docs/apps/backend/agent-server/agent-gateway.md
  git commit -m "feat: complete agent gateway management parity services"
  ```

## Task 4: Runtime Protocol And Executor Adapter Parity

**Files:**

- Modify: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/protocols/openai-chat.protocol.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/protocols/openai-responses.protocol.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/protocols/claude-messages.protocol.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/protocols/gemini-generate-content.protocol.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/protocols/provider-pinned-runtime-invocation.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/executors/provider-runtime.executor.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/executors/deterministic-openai-compatible.executor.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/executors/process-provider-runtime.executor.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/streaming/runtime-streaming.service.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/runtime-engine.facade.ts`
- Modify: `apps/backend/agent-server/test/agent-gateway/runtime-engine-provider-protocols.spec.ts`
- Modify: `apps/backend/agent-server/test/agent-gateway/runtime-engine-streaming.spec.ts`
- Modify: `apps/backend/agent-server/test/agent-gateway/runtime-engine-real-executors.spec.ts`
- Modify: `docs/contracts/api/agent-gateway.md`

- [ ] **Step 1: Write failing protocol tests**

  Extend `apps/backend/agent-server/test/agent-gateway/runtime-engine-provider-protocols.spec.ts`.

  Add tests for:
  - OpenAI Chat Completions to internal invocation.
  - OpenAI Responses to internal invocation.
  - Claude Messages to internal invocation.
  - Gemini generateContent to internal invocation.
  - Provider-pinned route to internal invocation.

  Minimum assertion pattern:

  ```ts
  expect(invocation).toMatchObject({
    protocol: 'openai-chat',
    model: 'gpt-5',
    stream: false
  });
  expect(invocation).not.toHaveProperty('rawBody');
  ```

- [ ] **Step 2: Write failing streaming tests**

  Extend `apps/backend/agent-server/test/agent-gateway/runtime-engine-streaming.spec.ts`.

  Assert:
  - Stream events emit OpenAI SSE `data:` chunks.
  - Final marker is `data: [DONE]`.
  - Runtime disconnect cancellation calls executor abort.
  - Raw provider chunk objects are not serialized.

- [ ] **Step 3: Write failing process executor tests**

  Create coverage in `apps/backend/agent-server/test/agent-gateway/runtime-engine-real-executors.spec.ts` for `ProcessProviderRuntimeExecutor`.

  Use a deterministic command profile test double:

  ```ts
  const executor = new ProcessProviderRuntimeExecutor({
    providerKind: 'codex',
    command: 'node',
    args: ['fixtures/mock-provider-cli.mjs'],
    timeoutMs: 1000
  });
  ```

  Expected behaviors:
  - Parses stdout JSON into `GatewayRuntimeResult`.
  - Converts stderr into sanitized diagnostic messages.
  - Converts non-zero exit to `GatewayRuntimeExecutorError`.
  - Does not expose raw stderr in public response.

- [ ] **Step 4: Run failing runtime tests**

  Run:

  ```bash
  pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/runtime-engine-provider-protocols.spec.ts apps/backend/agent-server/test/agent-gateway/runtime-engine-streaming.spec.ts apps/backend/agent-server/test/agent-gateway/runtime-engine-real-executors.spec.ts
  ```

  Expected: FAIL until protocols, streaming, and process executor are aligned.

- [ ] **Step 5: Normalize all provider protocols**

  Implement or tighten parser functions so each protocol returns `GatewayRuntimeInvocation`.

  The parser shape must be:

  ```ts
  export function parseOpenAIChatInvocation(body: unknown): GatewayRuntimeInvocation {
    const request = OpenAIChatCompletionRequestSchema.parse(body);
    return GatewayRuntimeInvocationSchema.parse({
      protocol: 'openai-chat',
      model: request.model,
      stream: request.stream ?? false,
      messages: request.messages,
      tools: request.tools ?? [],
      metadata: {}
    });
  }
  ```

  Do not preserve `body` as `rawBody`.

- [ ] **Step 6: Add process executor adapter**

  Create `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/executors/process-provider-runtime.executor.ts`.

  The class must implement `ProviderRuntimeExecutor` and use project-owned result types:

  ```ts
  export class ProcessProviderRuntimeExecutor implements ProviderRuntimeExecutor {
    readonly providerKind: GatewayProviderKind;

    async invoke(invocation: GatewayRuntimeInvocation, context: GatewayExecutorContext) {
      const result = await this.runner.run({ invocation, context });
      return GatewayRuntimeResultSchema.parse(result);
    }

    stream(invocation: GatewayRuntimeInvocation, context: GatewayExecutorContext) {
      return this.runner.stream({ invocation, context });
    }
  }
  ```

  Keep Node child process details inside this adapter. Do not return `ChildProcess`, stderr buffers, exit code objects, or vendor raw objects to callers.

- [ ] **Step 7: Update runtime facade**

  Ensure `runtime-engine.facade.ts` follows this order:

  ```ts
  const invocation = this.protocols.parse(request);
  const auth = await this.runtimeAuth.authenticate(headers);
  const quota = await this.runtimeQuota.precheck(auth, invocation);
  const route = await this.router.route(invocation, auth, quota);
  const result = await route.executor.invoke(invocation, route.context);
  await this.accounting.recordSuccess({ auth, invocation, route, result });
  return this.protocols.format(result, invocation.protocol);
  ```

  Streaming must use the same route/quota/accounting path and record completion or cancellation.

- [ ] **Step 8: Update runtime docs**

  Update `docs/contracts/api/agent-gateway.md` with:
  - Supported runtime surfaces.
  - Adapter kinds.
  - Streaming semantics.
  - Error code mapping.
  - Deterministic harness vs real adapter boundary.

- [ ] **Step 9: Verify Task 4**

  Run:

  ```bash
  pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/runtime-engine-provider-protocols.spec.ts apps/backend/agent-server/test/agent-gateway/runtime-engine-streaming.spec.ts apps/backend/agent-server/test/agent-gateway/runtime-engine-real-executors.spec.ts apps/backend/agent-server/test/agent-gateway/agent-gateway-client-runtime.spec.ts
  pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
  pnpm check:docs
  ```

  Expected: PASS.

- [ ] **Step 10: Commit Task 4**

  ```bash
  git add apps/backend/agent-server/src/domains/agent-gateway/runtime-engine apps/backend/agent-server/test/agent-gateway docs/contracts/api/agent-gateway.md
  git commit -m "feat: add cli proxy compatible runtime adapters"
  ```

## Task 5: Ops, Migration, Verification, And Cleanup

**Files:**

- Modify: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/accounting/runtime-quota.service.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/accounting/runtime-usage-queue.service.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/dashboard/agent-gateway-dashboard.service.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/migration/cli-proxy-import.service.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/system/agent-gateway-system.service.ts`
- Modify: `apps/frontend/agent-gateway/src/app/pages/RuntimeEnginePage.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/pages/MigrationPage.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/pages/SystemPage.tsx`
- Modify: `apps/backend/agent-server/test/agent-gateway/agent-gateway-production-smoke.spec.ts`
- Modify: `apps/frontend/agent-gateway/test/agent-gateway-runtime-engine-page.test.tsx`
- Modify: `apps/frontend/agent-gateway/test/agent-gateway-migration-page.test.tsx`
- Modify: `docs/apps/frontend/agent-gateway/README.md`
- Modify: `docs/apps/backend/agent-server/agent-gateway.md`
- Modify: `docs/contracts/api/agent-gateway.md`

- [ ] **Step 1: Write failing production smoke**

  Extend `apps/backend/agent-server/test/agent-gateway/agent-gateway-production-smoke.spec.ts`.

  Cover a deterministic end-to-end flow:

  ```ts
  it('runs a deterministic gateway request through quota accounting logs and health projection', async () => {
    const client = await gatewayClients.createClient({ name: 'smoke client' });
    const key = await gatewayKeys.createClientApiKey(client.id, {
      name: 'smoke key',
      scopes: ['models.read', 'chat.completions']
    });

    const response = await runtime.chatCompletions({
      apiKey: key.secret,
      body: {
        model: 'gpt-5-smoke',
        messages: [{ role: 'user', content: 'ping' }],
        stream: false
      }
    });

    expect(response.status).toBe(200);
    expect(await usageQueue.pendingCount()).toBe(0);
    expect(await logs.countForClient(client.id)).toBeGreaterThan(0);
    expect(await quota.remainingForClient(client.id)).toBeGreaterThanOrEqual(0);
  });
  ```

- [ ] **Step 2: Write failing migration UI/backend smoke**

  Extend:
  - `apps/backend/agent-server/test/agent-gateway/cli-proxy-import.service.spec.ts`
  - `apps/frontend/agent-gateway/test/agent-gateway-migration-page.test.tsx`

  Assert:
  - Preview classifies resources as create/update/skip/conflict.
  - Apply imports only safe resources unless unsafe conflicts are confirmed.
  - UI displays conflict reasons and apply report.

- [ ] **Step 3: Run failing ops tests**

  Run:

  ```bash
  pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-production-smoke.spec.ts apps/backend/agent-server/test/agent-gateway/cli-proxy-import.service.spec.ts apps/frontend/agent-gateway/test/agent-gateway-runtime-engine-page.test.tsx apps/frontend/agent-gateway/test/agent-gateway-migration-page.test.tsx
  ```

  Expected: FAIL until ops projections and migration report are fully wired.

- [ ] **Step 4: Complete runtime health projection**

  Ensure runtime health includes:

  ```ts
  {
    status: 'ready',
    checkedAt: '2026-05-11T00:00:00.000Z',
    executors: [],
    activeRequests: 0,
    activeStreams: 0,
    usageQueue: { pending: 0, failed: 0 },
    cooldowns: []
  }
  ```

  Parse the outgoing response with the matching core schema before returning.

- [ ] **Step 5: Complete migration report projection**

  Ensure `CliProxyImportService` returns:

  ```ts
  {
    imported: [{ sourceId: 'provider_openai', targetId: 'provider_openai', kind: 'providerConfig' }],
    skipped: [{ sourceId: 'log_old', kind: 'requestLog', reason: 'outside-retention-window' }],
    failed: [],
    warnings: []
  }
  ```

  Never include source management key, raw auth file content, or raw upstream config secrets in the report.

- [ ] **Step 6: Remove dead parity code and stale docs**

  Run:

  ```bash
  rg -n "demo migration|placeholder|not wired|external CLIProxyAPI.*default|raw upstream|static sample" apps/frontend/agent-gateway apps/backend/agent-server/src/domains/agent-gateway docs
  ```

  For each true stale hit:
  - Delete dead code if unused.
  - Replace placeholder with real callback or visible error state.
  - Update old docs to point to the current Agent Gateway implementation.
  - Keep historical archive content only if it is clearly marked as historical.

- [ ] **Step 7: Run broad Agent Gateway verification**

  Run:

  ```bash
  pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway apps/backend/agent-server/test/agent-gateway apps/frontend/agent-gateway/test
  pnpm exec tsc -p packages/core/tsconfig.json --noEmit
  pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
  pnpm --dir apps/frontend/agent-gateway typecheck
  pnpm check:docs
  ```

  Expected: PASS.

- [ ] **Step 8: Update final documentation**

  Update:
  - `docs/contracts/api/agent-gateway.md`
  - `docs/apps/frontend/agent-gateway/README.md`
  - `docs/apps/frontend/agent-gateway/cli-proxy-parity.md`
  - `docs/apps/backend/agent-server/agent-gateway.md`

  Each document must state:
  - Current implementation status.
  - Remaining true provider integration limits.
  - Verification commands.
  - Correct entry points for future agents.

- [ ] **Step 9: Commit Task 5**

  ```bash
  git add apps/backend/agent-server/src/domains/agent-gateway apps/backend/agent-server/test/agent-gateway apps/frontend/agent-gateway docs/contracts/api/agent-gateway.md docs/apps/frontend/agent-gateway docs/apps/backend/agent-server/agent-gateway.md
  git commit -m "feat: finish agent gateway cli proxy parity smoke"
  ```

## Final Verification

- [ ] **Step 1: Run scoped verification**

  ```bash
  pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway apps/backend/agent-server/test/agent-gateway apps/frontend/agent-gateway/test
  pnpm exec tsc -p packages/core/tsconfig.json --noEmit
  pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
  pnpm --dir apps/frontend/agent-gateway typecheck
  pnpm check:docs
  ```

- [ ] **Step 2: Run package builds if package or backend boundaries changed**

  ```bash
  pnpm build:lib
  pnpm --dir apps/backend/agent-server build
  pnpm --dir apps/frontend/agent-gateway build
  ```

- [ ] **Step 3: Prepare delivery summary**

  Include:
  - Contract files changed.
  - Frontend pages completed.
  - Backend management/runtime surfaces completed.
  - Docs updated and stale docs cleaned.
  - Commands run and results.
  - Any remaining live-provider credential limitations.
