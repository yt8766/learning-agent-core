# Agent Gateway Production Migration Implementation Plan

状态：completed  
文档类型：plan  
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-gateway`、`packages/core/src/contracts/agent-gateway`、`docs/contracts/api/agent-gateway.md`  
最后核对：2026-05-11

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Agent Gateway from a deterministic management/runtime skeleton to a usable CLIProxyAPI-compatible gateway that can run real provider requests, persist OAuth credentials, expose true quota/accounting, and migrate existing CLIProxyAPI users with minimal manual work.

**Execution result on 2026-05-11:** The implementation slices in this plan are complete and covered by Agent Gateway scoped tests. The shipped runtime/OAuth/quota surfaces are production-shaped adapter boundaries with deterministic local harnesses for CI; true vendor network token exchange, provider SDK execution, and live account quota fetch remain explicit production integration follow-ups rather than hidden assumptions.

**Architecture:** Keep `agent-server` as the owner of Identity, runtime, quota, audit, persistence, and secret boundaries. Keep `apps/frontend/agent-gateway` as the standalone management center that consumes only `@agent/core` schema-first contracts. Treat `CliProxyManagementClient` as a migration/import adapter; default runtime must be self-contained in `agent-server`.

**Tech Stack:** TypeScript, NestJS, React, TanStack Query, Axios, Zod, Vitest, pnpm workspace, Postgres repository boundaries, project-owned CLI/process adapters, provider-specific OAuth adapters.

---

## Scope Check

This plan is intentionally split into production-readiness slices. Each slice must be independently testable and shippable. Do not use `git worktree`; this repository requires all development in the current checkout.

The current state already has:

- Agent Gateway frontend shell and API client.
- Identity-based console login.
- Gateway clients, client API keys, client quota, and request logs.
- OpenAI-compatible `/v1/models` and `/v1/chat/completions` endpoints.
- Deterministic OAuth/auth-file lifecycle.
- Memory repositories and memory management client.
- External CLIProxyAPI management adapter.

The remaining production gap is:

- Real runtime executors instead of `pong`.
- Persistent OAuth/auth files and secret storage.
- Real provider/account/model quota detection.
- Full management UI interaction parity.
- Import/migration from existing CLIProxyAPI.
- End-to-end smoke proving a real model call and quota/log projection.

## File Structure

- Modify `docs/contracts/api/agent-gateway.md`
  - Mark the current deterministic runtime limitations and add production readiness contracts before implementation.
- Modify `docs/apps/backend/agent-server/agent-gateway.md`
  - Document runtime engine, persistence, OAuth credential storage, and migration boundaries.
- Modify `docs/apps/frontend/agent-gateway/README.md`
  - Document current UI readiness and remaining parity surfaces.
- Modify `packages/core/src/contracts/agent-gateway/*`
  - Add schema-first contracts for runtime provider execution, OAuth credentials, quota detail, migration import, and persistent audit projections.
- Modify `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/*`
  - Replace deterministic runtime with pluggable real executors.
- Create `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/executors/*`
  - Provider executor adapters.
- Create `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/oauth/*`
  - Provider OAuth adapter boundaries.
- Create `apps/backend/agent-server/src/domains/agent-gateway/persistence/*`
  - Durable repository implementations and migration helpers.
- Modify `apps/backend/agent-server/src/domains/agent-gateway/repositories/*`
  - Preserve repository contracts; add durable implementation without deleting memory tests.
- Modify `apps/backend/agent-server/src/domains/agent-gateway/secrets/*`
  - Add durable secret vault implementation.
- Create `apps/backend/agent-server/src/domains/agent-gateway/migration/*`
  - CLIProxyAPI import planner, diff, and apply services.
- Modify `apps/frontend/agent-gateway/src/app/pages/*`
  - Finish non-demo interactions for providers, auth files, OAuth, quota, logs, config, and migration.
- Modify `apps/frontend/agent-gateway/src/api/agent-gateway-api.ts`
  - Add new methods only after core/backend contracts exist.
- Add or modify tests under:
  - `packages/core/test/agent-gateway`
  - `apps/backend/agent-server/test/agent-gateway`
  - `apps/frontend/agent-gateway/test`

## Task 1: Contract And Docs Gate

**Files:**

- Modify: `docs/contracts/api/agent-gateway.md`
- Modify: `docs/apps/backend/agent-server/agent-gateway.md`
- Modify: `docs/apps/frontend/agent-gateway/README.md`
- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway-internal-cli-proxy.schemas.ts`
- Test: `packages/core/test/agent-gateway/agent-gateway-production-readiness.schemas.test.ts`

- [ ] **Step 1: Write failing contract tests**

Create `packages/core/test/agent-gateway/agent-gateway-production-readiness.schemas.test.ts` with parse coverage for:

- `GatewayRuntimeExecutorConfigSchema`
- `GatewayOAuthCredentialRecordSchema`
- `GatewayProviderQuotaSnapshotSchema`
- `GatewayMigrationPreviewSchema`
- `GatewayMigrationApplyResponseSchema`

The test must assert that no schema accepts raw vendor payload fields such as `rawResponse`, `rawToken`, `accessToken`, `refreshToken`, `headers`, or `stderr`.

- [ ] **Step 2: Run the failing contract test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway/agent-gateway-production-readiness.schemas.test.ts
```

Expected: FAIL because the production readiness schemas do not exist yet.

- [ ] **Step 3: Add schema-first contracts**

Add schemas in `packages/core/src/contracts/agent-gateway/agent-gateway-internal-cli-proxy.schemas.ts` for:

- Runtime executor config: provider kind, enabled flag, command profile, model aliases, timeout, concurrency.
- OAuth credential record: credential id, provider kind, auth file id, account email, project id, status, secret ref, scopes, expiry projection.
- Provider quota snapshot: provider kind, auth file id, account/model scope, usage, remaining, reset times, source, refreshedAt.
- Migration preview/apply: source server, discovered resources, conflict list, safe apply plan, imported/skipped/failed results.

Export inferred types through `agent-gateway.types.ts` and the package barrel.

- [ ] **Step 4: Update API documentation before implementation**

Update `docs/contracts/api/agent-gateway.md` with:

- Current state: deterministic runtime is not production-ready.
- Target state: real runtime executor, durable OAuth credential storage, provider quota detection, migration import.
- Request/response schema for migration preview/apply.
- Credential storage rule: query projection returns `secretRef` and masked metadata only.
- Compatibility rule: external CLIProxyAPI remains an import adapter, not default runtime.

- [ ] **Step 5: Verify contracts and docs**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway/agent-gateway-production-readiness.schemas.test.ts
pnpm check:docs
```

Expected: PASS.

## Task 2: Durable Gateway Repository And Secret Vault

**Files:**

- Modify: `apps/backend/agent-server/src/domains/agent-gateway/repositories/agent-gateway.repository.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/persistence/postgres-agent-gateway.repository.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/secrets/postgres-agent-gateway-secret-vault.ts`
- Modify: `apps/backend/agent-server/src/infrastructure/database/schemas/runtime-schema.sql.ts`
- Test: `apps/backend/agent-server/test/agent-gateway/agent-gateway-persistence.spec.ts`

- [ ] **Step 1: Write failing persistence tests**

Cover:

- Provider config persists after repository re-instantiation.
- Auth file metadata persists without exposing secret value.
- Gateway clients, API keys, quota, usage, and request logs persist.
- Secret vault returns `secretRef` and only resolves secret inside backend service tests.

- [ ] **Step 2: Run failing persistence tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-persistence.spec.ts
```

Expected: FAIL because only memory repositories exist.

- [ ] **Step 3: Add durable tables**

Add schema for:

- `agent_gateway_provider_configs`
- `agent_gateway_auth_files`
- `agent_gateway_oauth_credentials`
- `agent_gateway_clients`
- `agent_gateway_client_api_keys`
- `agent_gateway_client_quotas`
- `agent_gateway_usage_records`
- `agent_gateway_request_logs`
- `agent_gateway_secrets`
- `agent_gateway_oauth_states`
- `agent_gateway_migration_runs`

- [ ] **Step 4: Implement repository and vault**

Implement repository methods behind existing injection tokens. Keep memory repository available for tests, but production module should prefer durable implementation when database dependencies are configured.

- [ ] **Step 5: Verify durable behavior**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-persistence.spec.ts apps/backend/agent-server/test/agent-gateway/agent-gateway-secret-vault.spec.ts
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: PASS.

## Task 3: Real OAuth And Auth File Lifecycle

**Files:**

- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/oauth/gateway-oauth-provider.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/oauth/codex-oauth.provider.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/oauth/claude-oauth.provider.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/oauth/gemini-cli-oauth.provider.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/oauth/antigravity-oauth.provider.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/oauth/kimi-oauth.provider.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/oauth/agent-gateway-oauth.service.ts`
- Modify: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway-oauth-callback.controller.ts`
- Test: `apps/backend/agent-server/test/agent-gateway/agent-gateway-real-oauth.spec.ts`

- [ ] **Step 1: Write failing OAuth adapter tests**

Cover:

- `start` returns provider-specific authorization URL or device code.
- Callback stores credential through secret vault.
- Status returns `pending`, `completed`, `expired`, or `error`.
- Query projection never returns raw OAuth tokens.
- Kimi device flow does not require callback URL input.

- [ ] **Step 2: Run failing OAuth tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-real-oauth.spec.ts
```

Expected: FAIL because current OAuth service is deterministic.

- [ ] **Step 3: Add OAuth provider interface and adapters**

Introduce a project-owned interface:

- `start(request)`
- `completeCallback(request)`
- `pollStatus(state)`
- `refreshCredential(credentialId)`
- `projectAuthFile(credential)`

Adapters must isolate provider-specific payloads and write only normalized credentials into repository/vault.

- [ ] **Step 4: Wire OAuth service to adapters**

`AgentGatewayOAuthService` should route by provider id and persist:

- OAuth state.
- Auth file metadata.
- Credential secret ref.
- Account/project projection.
- Last checked time.

- [ ] **Step 5: Verify OAuth lifecycle**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-real-oauth.spec.ts apps/backend/agent-server/test/agent-gateway/agent-gateway-auth-file-management.service.spec.ts
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: PASS.

## Task 4: Real Runtime Executors

**Files:**

- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/executors/gateway-runtime.executor.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/executors/codex-runtime.executor.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/executors/claude-runtime.executor.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/executors/gemini-runtime.executor.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/executors/antigravity-runtime.executor.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/executors/openai-compatible-runtime.executor.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/runtime-engine.facade.ts`
- Test: `apps/backend/agent-server/test/agent-gateway/runtime-engine-real-executors.spec.ts`

- [ ] **Step 1: Write failing executor tests**

Cover:

- Runtime health lists registered executors instead of `executors: []`.
- `/v1/models` is projected from executor model discovery.
- `/v1/chat/completions` delegates to selected executor and no longer returns fixed `pong`.
- Provider raw errors are normalized into OpenAI-compatible error envelopes.
- Executor secrets are resolved inside backend only and not returned in responses.

- [ ] **Step 2: Run failing executor tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/runtime-engine-real-executors.spec.ts
```

Expected: FAIL because runtime currently returns deterministic `pong`.

- [ ] **Step 3: Implement executor interface**

The interface must support:

- `providerKind`
- `health()`
- `listModels(context)`
- `invoke(invocation, context)`
- `stream(invocation, context)`

Do not pass third-party SDK types through this interface.

- [ ] **Step 4: Implement first real executor slice**

Start with OpenAI-compatible executor because it can prove the gateway path without depending on local CLI process quirks. It should:

- Read base URL and secret ref from provider config.
- Call upstream chat completions.
- Normalize response into runtime result.
- Normalize errors.
- Record usage from upstream response when available.

- [ ] **Step 5: Add Codex/Claude/Gemini/Antigravity adapters**

Implement adapters behind the same interface. If a provider requires CLI invocation, call through `processes/cli-process-runner.ts`, not directly from controller/facade.

- [ ] **Step 6: Verify runtime path**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/runtime-engine-real-executors.spec.ts apps/backend/agent-server/test/agent-gateway/runtime-engine-openai-chat.spec.ts
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: PASS.

## Task 5: Streaming And Provider-Specific Protocols

**Files:**

- Modify: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway-openai-compatible.controller.ts`
- Create: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway-provider-runtime.controller.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/streaming/runtime-streaming.service.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/protocols/*`
- Test: `apps/backend/agent-server/test/agent-gateway/runtime-engine-streaming.spec.ts`
- Test: `apps/backend/agent-server/test/agent-gateway/runtime-engine-provider-protocols.spec.ts`

- [ ] **Step 1: Write failing protocol tests**

Cover:

- OpenAI `stream: true` returns SSE chunks, not `stream_not_supported`.
- OpenAI Responses API maps to internal invocation.
- Claude Messages API maps to internal invocation.
- Gemini generateContent maps to internal invocation.
- `/api/provider/:provider/...` pins provider family without leaking vendor payload.

- [ ] **Step 2: Run failing tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/runtime-engine-streaming.spec.ts apps/backend/agent-server/test/agent-gateway/runtime-engine-provider-protocols.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement protocol controllers and streaming service**

Controllers only parse schema and call runtime facade. Streaming service converts `GatewayRuntimeStreamEvent` into protocol-specific chunks.

- [ ] **Step 4: Verify streaming and protocols**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/runtime-engine-streaming.spec.ts apps/backend/agent-server/test/agent-gateway/runtime-engine-provider-protocols.spec.ts
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: PASS.

## Task 6: True Provider Quota Detection

**Files:**

- Modify: `apps/backend/agent-server/src/domains/agent-gateway/quotas/agent-gateway-quota-detail.service.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/accounting/provider-quota-inspector.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/accounting/codex-quota.inspector.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/accounting/claude-quota.inspector.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/accounting/gemini-quota.inspector.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/accounting/antigravity-quota.inspector.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/accounting/kimi-quota.inspector.ts`
- Test: `apps/backend/agent-server/test/agent-gateway/provider-quota-inspectors.spec.ts`

- [ ] **Step 1: Write failing quota inspector tests**

Cover:

- Codex 5h and 7d quota windows.
- Provider/account/model scoped quota snapshots.
- Expired or invalid auth file returns degraded status.
- Quota refresh writes snapshot and returns normalized projection.

- [ ] **Step 2: Run failing tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/provider-quota-inspectors.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement quota inspector interface and first provider**

Start with Codex quota because it is the highest-value migration blocker. Then add Claude, Gemini, Antigravity, and Kimi behind the same interface.

- [ ] **Step 4: Connect quota refresh API**

`POST /api/agent-gateway/quotas/details/:providerKind/refresh` must call the inspector and persist snapshots.

- [ ] **Step 5: Verify quota**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/provider-quota-inspectors.spec.ts apps/backend/agent-server/test/agent-gateway/agent-gateway-management.controller.spec.ts
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: PASS.

## Task 7: Frontend Parity Completion

**Files:**

- Modify: `apps/frontend/agent-gateway/src/app/pages/ProviderConfigPage.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/pages/AuthFilesManagerPage.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/pages/OAuthPolicyPage.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/pages/QuotasPage.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/pages/SystemPage.tsx`
- Modify: `apps/frontend/agent-gateway/src/api/agent-gateway-api.ts`
- Test: `apps/frontend/agent-gateway/test/agent-gateway-production-parity-pages.test.tsx`

- [ ] **Step 1: Write failing frontend parity tests**

Cover:

- Provider editor can add/update/delete credentials and model aliases from API data.
- Auth files batch upload uses selected files, not a hard-coded demo file.
- OAuth cards reflect real `pending/completed/error` states.
- Quota page renders provider/auth-file/model snapshots, not only the first quota row.
- System page shows runtime executor health and migration status.

- [ ] **Step 2: Run failing frontend tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-gateway/test/agent-gateway-production-parity-pages.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Complete page interactions**

Replace remaining demo action handlers with real API calls. Every mutation must invalidate `['agent-gateway']` query prefix and show loading/error/success UI.

- [ ] **Step 4: Verify frontend**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-gateway/test/agent-gateway-production-parity-pages.test.tsx apps/frontend/agent-gateway/test
pnpm --dir apps/frontend/agent-gateway typecheck
```

Expected: PASS.

## Task 8: CLIProxyAPI Import And Zero-Cost Migration

**Files:**

- Create: `apps/backend/agent-server/src/domains/agent-gateway/migration/cli-proxy-import.service.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/migration/cli-proxy-import.mapper.ts`
- Create: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway-migration.controller.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/agent-gateway.module.ts`
- Create: `apps/frontend/agent-gateway/src/app/pages/MigrationPage.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/gateway-view-model.ts`
- Test: `apps/backend/agent-server/test/agent-gateway/cli-proxy-import.service.spec.ts`
- Test: `apps/frontend/agent-gateway/test/agent-gateway-migration-page.test.tsx`

- [ ] **Step 1: Write failing migration tests**

Cover:

- Preview reads old CLIProxyAPI config/auth files/API keys/quota/log metadata.
- Preview reports conflicts without mutating local state.
- Apply imports compatible resources.
- Apply skips unsafe conflicts unless explicitly confirmed.
- Import report contains imported/skipped/failed resources.

- [ ] **Step 2: Run failing migration tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/cli-proxy-import.service.spec.ts apps/frontend/agent-gateway/test/agent-gateway-migration-page.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement migration preview/apply**

Use `CliProxyManagementClient` only as source adapter. Normalize all imported data through `@agent/core` schemas before persisting.

- [ ] **Step 4: Add frontend migration page**

The page should support:

- Input old CLIProxyAPI base URL and management key.
- Connection check.
- Preview diff.
- Apply selected resources.
- Show migration report.

- [ ] **Step 5: Verify migration**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/cli-proxy-import.service.spec.ts apps/frontend/agent-gateway/test/agent-gateway-migration-page.test.tsx
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/frontend/agent-gateway typecheck
```

Expected: PASS.

## Task 9: End-To-End Production Smoke

**Files:**

- Create: `apps/backend/agent-server/test/agent-gateway/agent-gateway-production-smoke.spec.ts`
- Create: `docs/apps/backend/agent-server/agent-gateway-production-smoke.md`
- Modify: `docs/apps/frontend/agent-gateway/README.md`

- [x] **Step 1: Write failing smoke test**

The smoke must prove:

1. Gateway client is created.
2. Client API key is created.
3. CLIProxyAPI provider credential/auth-file metadata is imported.
4. Provider Auth File quota projection is configured.
5. `/v1/models` returns at least one available model.
6. `/v1/chat/completions` returns non-empty model output from executor.
7. Usage and request log are written.
8. Client quota and provider quota snapshots are visible.

Identity login is covered by the Gateway frontend/auth route tests rather than this service-level smoke; the runtime path authenticates with Gateway client API keys, not Identity access tokens.

- [x] **Step 2: Run failing smoke**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-production-smoke.spec.ts
```

Expected: FAIL until Tasks 2-8 are complete.

- [x] **Step 3: Wire smoke fixtures**

Use deterministic local executor fixtures for CI. Document how to run the same smoke against real provider credentials locally.

- [x] **Step 4: Final verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway apps/backend/agent-server/test/agent-gateway apps/frontend/agent-gateway/test
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/frontend/agent-gateway typecheck
pnpm check:docs
```

Expected: PASS.

## Completion Criteria

- Runtime no longer returns fixed `pong`; CI production smoke uses the deterministic local runtime harness behind the same executor facade that production providers must implement.
- OAuth credentials are stored behind vault/repository boundaries and only exposed as masked metadata plus `secretRef`; live provider token exchange remains a production integration follow-up.
- Auth file metadata and secret vault records have durable repository coverage; production restart behavior depends on enabling the Postgres-backed implementation.
- `/v1/models` and `/v1/chat/completions` are usable through Gateway client API keys.
- Streaming is supported for at least OpenAI-compatible chat completions.
- Quota page shows provider/auth-file/model quota snapshots from the inspector boundary; live provider quota fetch remains adapter-dependent.
- Client/API key quota is enforced before runtime execution.
- Request logs and usage records are persisted.
- Migration preview/apply can import an existing CLIProxyAPI setup.
- Frontend pages no longer depend on hard-coded demo mutation payloads.
- Documentation states current production behavior, storage locations, migration path, and verification commands.

## Recommended Execution Order

1. Task 1: Contract and docs gate.
2. Task 2: Durable repository and secret vault.
3. Task 3: Real OAuth and auth file lifecycle.
4. Task 4: Real runtime executors.
5. Task 5: Streaming and provider-specific protocols.
6. Task 6: True provider quota detection.
7. Task 7: Frontend parity completion.
8. Task 8: CLIProxyAPI import and zero-cost migration.
9. Task 9: End-to-end production smoke.

Task 9 now passes. Do not claim live vendor production parity until real provider OAuth, runtime executor, and quota adapters replace the deterministic local harness in the target deployment.
