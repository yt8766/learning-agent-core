# Unified Backend Hard Cut Implementation Plan

状态：draft
文档类型：plan
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-admin`、`apps/frontend/knowledge`、`docs/contracts/api/**`、`docs/integration/frontend-backend-integration.md`
最后核对：2026-05-08

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete `auth-server` and `knowledge-server`, make `agent-server` the only backend API host, and migrate every caller to `/api/identity/*` and `/api/knowledge/*`.

**Architecture:** The implementation keeps `apps/backend/agent-server/src/api/*` as the HTTP shell and `src/domains/*` as the business host. Identity and Knowledge become the only backend chains for auth and knowledge; old standalone packages and the legacy `agent-server/src/knowledge` module are removed after their production features are covered by the new domains.

**Tech Stack:** NestJS, TypeScript, Vite React frontends, Vitest, pnpm workspaces, Turbo, zod contracts from `@agent/core` and `@agent/knowledge`.

**Source Spec:** [Unified Backend Hard Cut Design](../specs/2026-05-08-unified-backend-hard-cut-design.md)

---

## File Structure Map

- Modify: `package.json` — root dev backend scripts.
- Modify: `pnpm-lock.yaml` — remove deleted backend workspace importers after `pnpm install`.
- Modify: `test/smoke/workspace/dev-backends-launcher.smoke.ts` — root launcher smoke for single backend.
- Modify: `packages/runtime/test/turbo-typecheck-manifests.test.ts` — workspace manifest list and removed backend tsconfig assertions.
- Modify: `scripts/check-docs.js` — remove current-doc allowlist entries for standalone backend docs.
- Modify: `apps/backend/agent-server/src/app.module.ts` — keep `IdentityModule` and `KnowledgeDomainModule`, remove old app feature module if it only imports old knowledge.
- Modify: `apps/backend/agent-server/src/app/app.module.ts` — remove `KnowledgeModule` import from `src/knowledge`.
- Modify: `apps/backend/agent-server/src/api/identity/identity.controller.ts` — canonical identity login/refresh/logout/me.
- Delete: `apps/backend/agent-server/src/api/identity/legacy-auth.controller.ts` — old `/auth/*` alias.
- Modify: `apps/backend/agent-server/src/domains/identity/identity.module.ts` — remove legacy controller, add user controller.
- Create: `apps/backend/agent-server/src/api/identity/identity-users.controller.ts` — `/api/identity/users*` endpoints.
- Modify: `apps/backend/agent-server/src/api/knowledge/knowledge.controller.ts` — canonical `/knowledge/*` only, add missing observability/eval/provider-health endpoints.
- Modify: `apps/backend/agent-server/src/api/knowledge/knowledge-settings.controller.ts` — keep canonical `/knowledge/settings/*`.
- Modify: `apps/backend/agent-server/src/domains/knowledge/knowledge-domain.module.ts` — wire missing services needed by new endpoints.
- Modify: `apps/backend/agent-server/src/domains/knowledge/services/knowledge-eval.service.ts` — expose list/compare operations used by controller.
- Modify: `apps/backend/agent-server/src/domains/knowledge/services/knowledge-trace.service.ts` — expose metrics/traces/detail operations.
- Modify: `apps/backend/agent-server/src/domains/knowledge/services/knowledge-provider-health.service.ts` — expose provider health response.
- Delete: `apps/backend/agent-server/src/knowledge/**` — old fixture-backed KnowledgeModule.
- Delete: `apps/backend/auth-server/**` — old standalone auth backend package.
- Delete: `apps/backend/knowledge-server/**` — old standalone knowledge backend package.
- Modify: `apps/frontend/knowledge/src/api/auth-client.ts` — use `/identity/*` and identity error codes.
- Modify: `apps/frontend/knowledge/src/main.tsx` — default both backend base URLs to `http://127.0.0.1:3000/api`.
- Modify: `apps/frontend/knowledge/src/pages/auth/auth-provider.tsx` — default auth client base URL to `/api`.
- Modify: `apps/frontend/knowledge/test/auth-client.test.ts` — identity path assertions.
- Modify: `apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts` — `agent-server` `3000/api` path assertions.
- Modify: `apps/frontend/knowledge/test/knowledge-api-client.test.ts` — remove `/knowledge/v1` default expectations.
- Modify: `apps/frontend/agent-admin/src/pages/auth/api/admin-auth.api.ts` — use `/identity/*`.
- Modify: `apps/frontend/agent-admin/src/pages/identity/api/auth-service-client.ts` — use `/identity/users`.
- Add or modify: `apps/frontend/agent-admin/src/**/auth*.test.ts` and `apps/frontend/agent-admin/src/**/identity*.test.ts` — lock new paths.
- Modify: `docs/contracts/api/auth.md`, `docs/contracts/api/knowledge.md`, `docs/contracts/api/README.md`.
- Modify: `docs/integration/frontend-backend-integration.md`.
- Modify: `docs/apps/backend/agent-server/identity.md`, `docs/apps/backend/agent-server/knowledge.md`, `docs/apps/backend/agent-server/agent-server-overview.md`.
- Modify: `docs/packages/evals/verification-system-guidelines.md`.
- Delete: `docs/apps/backend/auth-server/**`, `docs/apps/backend/knowledge-server/**`.
- Modify: historical specs that currently call old services canonical; add a replacement notice that points to `docs/superpowers/specs/2026-05-08-unified-backend-hard-cut-design.md`.

## Implementation Tasks

### Task 1: Root Workspace Hard-Cut Tests

**Files:**

- Modify: `test/smoke/workspace/dev-backends-launcher.smoke.ts`
- Modify: `packages/runtime/test/turbo-typecheck-manifests.test.ts`
- Test: `test/smoke/workspace/dev-backends-launcher.smoke.ts`
- Test: `packages/runtime/test/turbo-typecheck-manifests.test.ts`

- [ ] **Step 1: Update the failing root launcher smoke**

Replace the old multi-backend expectations in `test/smoke/workspace/dev-backends-launcher.smoke.ts` with:

```ts
import { describe, expect, it } from 'vitest';

import packageJson from '../../../package.json';
import turboJson from '../../../turbo.json';
import agentServerPackageJson from '../../../apps/backend/agent-server/package.json';

describe('dev backend launcher', () => {
  it('starts only the unified agent-server backend from the root scripts', () => {
    expect(packageJson.scripts['start:dev']).toBe('pnpm build:lib && turbo run dev:backend --filter=server');
    expect(packageJson.scripts['start:dev:backends']).toBe(packageJson.scripts['start:dev']);

    expect(turboJson.tasks['dev:backend']).toEqual({
      persistent: true,
      cache: false
    });

    expect(agentServerPackageJson.scripts['dev:backend']).toBe('nest start --watch');
  });
});
```

- [ ] **Step 2: Update the failing manifest boundary test**

In `packages/runtime/test/turbo-typecheck-manifests.test.ts`, remove `apps/backend/auth-server/package.json` and `apps/backend/knowledge-server/package.json` from any manifest list. Replace the standalone backend tsconfig test with:

```ts
it('does not keep standalone backend server typecheck manifests after the unified hard cut', async () => {
  await expect(access(path.join(repoRoot, 'apps/backend/auth-server/tsconfig.json'))).rejects.toMatchObject({
    code: 'ENOENT'
  });
  await expect(access(path.join(repoRoot, 'apps/backend/knowledge-server/tsconfig.json'))).rejects.toMatchObject({
    code: 'ENOENT'
  });
});
```

- [ ] **Step 3: Run the new red tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js test/smoke/workspace/dev-backends-launcher.smoke.ts packages/runtime/test/turbo-typecheck-manifests.test.ts
```

Expected: FAIL because `package.json` still starts three backends and the old backend tsconfigs still exist.

- [ ] **Step 4: Commit the red tests**

```bash
git add test/smoke/workspace/dev-backends-launcher.smoke.ts packages/runtime/test/turbo-typecheck-manifests.test.ts
git commit -m "test: lock unified backend workspace wiring"
```

### Task 2: Root Scripts and Workspace Graph

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Delete later in this task only after tests are red: `apps/backend/auth-server/**`, `apps/backend/knowledge-server/**`

- [ ] **Step 1: Update root backend scripts**

In `package.json`, set:

```json
{
  "scripts": {
    "start:dev": "pnpm build:lib && turbo run dev:backend --filter=server",
    "start:dev:backends": "pnpm build:lib && turbo run dev:backend --filter=server"
  }
}
```

Keep the rest of `scripts` unchanged.

- [ ] **Step 2: Delete standalone backend directories**

Run:

```bash
rm -rf apps/backend/auth-server apps/backend/knowledge-server
```

Expected: both directories are absent.

- [ ] **Step 3: Refresh the lockfile**

Run:

```bash
pnpm install --lockfile-only
```

Expected: `pnpm-lock.yaml` no longer contains importers for `apps/backend/auth-server` or `apps/backend/knowledge-server`.

- [ ] **Step 4: Run workspace wiring tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js test/smoke/workspace/dev-backends-launcher.smoke.ts packages/runtime/test/turbo-typecheck-manifests.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit workspace graph changes**

```bash
git add package.json pnpm-lock.yaml test/smoke/workspace/dev-backends-launcher.smoke.ts packages/runtime/test/turbo-typecheck-manifests.test.ts apps/backend/auth-server apps/backend/knowledge-server
git commit -m "chore: remove standalone backend packages"
```

### Task 3: Identity API Hard Cut

**Files:**

- Modify: `apps/backend/agent-server/test/identity/identity-alias.controller.spec.ts`
- Create: `apps/backend/agent-server/test/identity/identity-users.controller.spec.ts`
- Modify: `apps/backend/agent-server/src/api/identity/identity.controller.ts`
- Create: `apps/backend/agent-server/src/api/identity/identity-users.controller.ts`
- Delete: `apps/backend/agent-server/src/api/identity/legacy-auth.controller.ts`
- Modify: `apps/backend/agent-server/src/domains/identity/identity.module.ts`

- [ ] **Step 1: Replace alias test with canonical-only test**

In `apps/backend/agent-server/test/identity/identity-alias.controller.spec.ts`, remove imports of `LegacyAuthController` and make the file:

```ts
import { describe, expect, it, vi } from 'vitest';
import { PATH_METADATA } from '@nestjs/common/constants';

import { IdentityController } from '../../src/api/identity/identity.controller';

describe('identity canonical routes', () => {
  const createAuthService = () => ({
    login: vi.fn(async (body: unknown) => ({ route: 'login', body })),
    refresh: vi.fn(async (body: unknown) => ({ route: 'refresh', body })),
    logout: vi.fn(async (body: unknown) => ({ route: 'logout', body })),
    me: vi.fn(async (principal: unknown) => ({ route: 'me', principal }))
  });

  it('mounts only the canonical identity route prefix', () => {
    expect(Reflect.getMetadata(PATH_METADATA, IdentityController)).toBe('identity');
  });

  it('serves login refresh logout and me through the identity service shell', async () => {
    const authService = createAuthService();
    const controller = new IdentityController(authService as never);
    const loginBody = { username: 'admin', password: 'pw' };
    const refreshBody = { refreshToken: 'refresh-token' };
    const logoutBody = { refreshToken: 'refresh-token' };
    const principal = { sub: 'user-1' };

    await expect(controller.login(loginBody)).resolves.toMatchObject({ route: 'login' });
    await expect(controller.refresh(refreshBody)).resolves.toMatchObject({ route: 'refresh' });
    await expect(controller.logout(logoutBody)).resolves.toMatchObject({ route: 'logout' });
    await expect(controller.me({ principal })).resolves.toMatchObject({ route: 'me' });

    expect(authService.login).toHaveBeenCalledWith(loginBody);
    expect(authService.refresh).toHaveBeenCalledWith(refreshBody);
    expect(authService.logout).toHaveBeenCalledWith(logoutBody);
    expect(authService.me).toHaveBeenCalledWith(principal);
  });
});
```

- [ ] **Step 2: Add a failing users controller test**

Create `apps/backend/agent-server/test/identity/identity-users.controller.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { PATH_METADATA } from '@nestjs/common/constants';

import { IdentityUsersController } from '../../src/api/identity/identity-users.controller';

describe('identity users controller', () => {
  const service = {
    listUsers: vi.fn(async () => ({ users: [{ id: 'user_1', username: 'admin' }] })),
    createUser: vi.fn(async (body: unknown) => ({ id: 'user_2', ...(body as object) })),
    disableUser: vi.fn(async (userId: string) => ({ id: userId, status: 'disabled' })),
    enableUser: vi.fn(async (userId: string) => ({ id: userId, status: 'enabled' }))
  };

  it('mounts under the canonical identity users prefix', () => {
    expect(Reflect.getMetadata(PATH_METADATA, IdentityUsersController)).toBe('identity/users');
  });

  it('delegates user management to the identity user service', async () => {
    const controller = new IdentityUsersController(service as never);

    await expect(controller.listUsers()).resolves.toEqual({ users: [{ id: 'user_1', username: 'admin' }] });
    await expect(
      controller.createUser({ username: 'new-user', displayName: 'New User', password: 'secret', roles: ['developer'] })
    ).resolves.toMatchObject({ id: 'user_2', username: 'new-user' });
    await expect(controller.disableUser('user_2')).resolves.toMatchObject({ id: 'user_2', status: 'disabled' });
    await expect(controller.enableUser('user_2')).resolves.toMatchObject({ id: 'user_2', status: 'enabled' });
  });
});
```

- [ ] **Step 3: Run identity red tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/identity/identity-alias.controller.spec.ts apps/backend/agent-server/test/identity/identity-users.controller.spec.ts
```

Expected: FAIL because `IdentityUsersController` does not exist and `LegacyAuthController` is still wired.

- [ ] **Step 4: Implement canonical users controller**

Create `apps/backend/agent-server/src/api/identity/identity-users.controller.ts`:

```ts
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import type { AuthUserCreateRequest } from '@agent/core';

import { IdentityUserService } from '../../domains/identity/services/identity-user.service';

@Controller('identity/users')
export class IdentityUsersController {
  constructor(private readonly users: IdentityUserService) {}

  @Get()
  listUsers() {
    return this.users.listUsers();
  }

  @Post()
  createUser(@Body() body: AuthUserCreateRequest) {
    return this.users.createUser(body);
  }

  @Patch(':userId/disable')
  disableUser(@Param('userId') userId: string) {
    return this.users.disableUser(userId);
  }

  @Patch(':userId/enable')
  enableUser(@Param('userId') userId: string) {
    return this.users.enableUser(userId);
  }
}
```

- [ ] **Step 5: Remove legacy auth controller from the module**

In `apps/backend/agent-server/src/domains/identity/identity.module.ts`, replace the controller imports and module metadata with:

```ts
import { IdentityController } from '../../api/identity/identity.controller';
import { IdentityUsersController } from '../../api/identity/identity-users.controller';
```

and:

```ts
@Module({
  controllers: [IdentityController, IdentityUsersController],
  providers: [
    { provide: IDENTITY_REPOSITORY, useClass: IdentityMemoryRepository },
    IdentityAuthService,
    IdentityUserService,
    IdentityPasswordService,
    IdentityJwtProvider,
    IdentitySeedService,
    {
      provide: IDENTITY_JWT_OPTIONS,
      useFactory: () => ({
        secret: process.env.IDENTITY_JWT_SECRET ?? process.env.AUTH_JWT_SECRET ?? 'dev-identity-secret',
        issuer: process.env.IDENTITY_JWT_ISSUER ?? 'agent-server-identity'
      })
    },
    {
      provide: IDENTITY_SEED_OPTIONS,
      useFactory: () => ({
        adminUsername: process.env.IDENTITY_ADMIN_USERNAME ?? process.env.AUTH_ADMIN_USERNAME ?? '',
        adminPassword: process.env.IDENTITY_ADMIN_PASSWORD ?? process.env.AUTH_ADMIN_PASSWORD ?? '',
        adminDisplayName: process.env.IDENTITY_ADMIN_DISPLAY_NAME ?? process.env.AUTH_ADMIN_DISPLAY_NAME ?? ''
      })
    }
  ],
  exports: [IdentityAuthService, IdentityUserService]
})
export class IdentityModule {}
```

- [ ] **Step 6: Delete legacy auth controller**

Run:

```bash
rm apps/backend/agent-server/src/api/identity/legacy-auth.controller.ts
```

- [ ] **Step 7: Run identity tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/identity
```

Expected: PASS.

- [ ] **Step 8: Commit identity hard cut**

```bash
git add apps/backend/agent-server/src/api/identity apps/backend/agent-server/src/domains/identity apps/backend/agent-server/test/identity
git commit -m "feat: hard cut identity api routes"
```

### Task 4: Knowledge API Canonical Coverage

**Files:**

- Modify: `apps/backend/agent-server/test/knowledge-domain/knowledge-route-alias.spec.ts`
- Create: `apps/backend/agent-server/test/knowledge-domain/knowledge-observability-controller.spec.ts`
- Create: `apps/backend/agent-server/test/knowledge-domain/knowledge-eval-controller.spec.ts`
- Create: `apps/backend/agent-server/test/knowledge-domain/knowledge-provider-health-controller.spec.ts`
- Modify: `apps/backend/agent-server/src/api/knowledge/knowledge.controller.ts`
- Modify: `apps/backend/agent-server/src/domains/knowledge/services/knowledge-eval.service.ts`
- Modify: `apps/backend/agent-server/src/domains/knowledge/services/knowledge-trace.service.ts`
- Modify: `apps/backend/agent-server/src/domains/knowledge/services/knowledge-provider-health.service.ts`

- [ ] **Step 1: Change route prefix test to canonical-only**

In `apps/backend/agent-server/test/knowledge-domain/knowledge-route-alias.spec.ts`, change the route metadata assertion to:

```ts
it('mounts only the canonical knowledge route prefix', () => {
  expect(Reflect.getMetadata(PATH_METADATA, KnowledgeApiController)).toBe('knowledge');
});
```

- [ ] **Step 2: Add observability controller test**

Create `apps/backend/agent-server/test/knowledge-domain/knowledge-observability-controller.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { KnowledgeApiController } from '../../src/api/knowledge/knowledge.controller';

describe('knowledge observability endpoints', () => {
  it('delegates metrics traces and trace detail to the trace service', async () => {
    const traces = {
      getMetrics: async () => ({ totalQueries: 1, averageLatencyMs: 25 }),
      listTraces: async () => ({ items: [{ id: 'trace_1' }], total: 1, page: 1, pageSize: 20 }),
      getTrace: async (traceId: string) => ({ id: traceId, steps: [] })
    };
    const controller = new KnowledgeApiController(
      baseService() as never,
      uploads() as never,
      documents() as never,
      rag() as never,
      modelProfiles() as never,
      undefined,
      traces as never
    );

    await expect(controller.getObservabilityMetrics()).resolves.toEqual({ totalQueries: 1, averageLatencyMs: 25 });
    await expect(controller.listTraces({})).resolves.toMatchObject({ items: [{ id: 'trace_1' }] });
    await expect(controller.getTrace('trace_1')).resolves.toEqual({ id: 'trace_1', steps: [] });
  });
});

function baseService() {
  return { listBases: async () => [] };
}
function uploads() {
  return {};
}
function documents() {
  return { listEmbeddingModels: () => ({ items: [] }) };
}
function rag() {
  return {};
}
function modelProfiles() {
  return { listSummaries: () => [], resolveEnabled: () => ({ id: 'default' }) };
}
```

- [ ] **Step 3: Add eval controller test**

Create `apps/backend/agent-server/test/knowledge-domain/knowledge-eval-controller.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { KnowledgeApiController } from '../../src/api/knowledge/knowledge.controller';

describe('knowledge eval endpoints', () => {
  it('delegates datasets runs results and comparison to the eval service', async () => {
    const evals = {
      listDatasets: async () => ({ items: [{ id: 'dataset_1' }], total: 1, page: 1, pageSize: 20 }),
      listRuns: async () => ({ items: [{ id: 'run_1' }], total: 1, page: 1, pageSize: 20 }),
      listRunResults: async (runId: string) => ({ items: [{ runId }], total: 1, page: 1, pageSize: 20 }),
      compareRuns: async (input: { baselineRunId: string; candidateRunId: string }) => ({
        baselineRunId: input.baselineRunId,
        candidateRunId: input.candidateRunId,
        deltas: []
      })
    };
    const controller = new KnowledgeApiController(
      baseService() as never,
      uploads() as never,
      documents() as never,
      rag() as never,
      modelProfiles() as never,
      undefined,
      undefined,
      evals as never
    );

    await expect(controller.listEvalDatasets()).resolves.toMatchObject({ items: [{ id: 'dataset_1' }] });
    await expect(controller.listEvalRuns()).resolves.toMatchObject({ items: [{ id: 'run_1' }] });
    await expect(controller.listEvalRunResults('run_1')).resolves.toMatchObject({ items: [{ runId: 'run_1' }] });
    await expect(
      controller.compareEvalRuns({ baselineRunId: 'run_a', candidateRunId: 'run_b' })
    ).resolves.toMatchObject({ baselineRunId: 'run_a', candidateRunId: 'run_b' });
  });
});

function baseService() {
  return { listBases: async () => [] };
}
function uploads() {
  return {};
}
function documents() {
  return { listEmbeddingModels: () => ({ items: [] }) };
}
function rag() {
  return {};
}
function modelProfiles() {
  return { listSummaries: () => [], resolveEnabled: () => ({ id: 'default' }) };
}
```

- [ ] **Step 4: Add provider health controller test**

Create `apps/backend/agent-server/test/knowledge-domain/knowledge-provider-health-controller.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { KnowledgeApiController } from '../../src/api/knowledge/knowledge.controller';

describe('knowledge provider health endpoint', () => {
  it('delegates provider health to the provider health service', async () => {
    const providerHealth = {
      getHealth: async () => ({
        status: 'available',
        providers: [{ id: 'knowledge-chat', status: 'available' }]
      })
    };
    const controller = new KnowledgeApiController(
      baseService() as never,
      uploads() as never,
      documents() as never,
      rag() as never,
      modelProfiles() as never,
      undefined,
      undefined,
      undefined,
      providerHealth as never
    );

    await expect(controller.getProviderHealth()).resolves.toMatchObject({
      status: 'available',
      providers: [{ id: 'knowledge-chat', status: 'available' }]
    });
  });
});

function baseService() {
  return { listBases: async () => [] };
}
function uploads() {
  return {};
}
function documents() {
  return { listEmbeddingModels: () => ({ items: [] }) };
}
function rag() {
  return {};
}
function modelProfiles() {
  return { listSummaries: () => [], resolveEnabled: () => ({ id: 'default' }) };
}
```

- [ ] **Step 5: Run knowledge red tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge-domain/knowledge-route-alias.spec.ts apps/backend/agent-server/test/knowledge-domain/knowledge-observability-controller.spec.ts apps/backend/agent-server/test/knowledge-domain/knowledge-eval-controller.spec.ts apps/backend/agent-server/test/knowledge-domain/knowledge-provider-health-controller.spec.ts
```

Expected: FAIL because `KnowledgeApiController` still mounts `knowledge/v1` and lacks the new methods/injections.

- [ ] **Step 6: Make knowledge controller canonical-only**

In `apps/backend/agent-server/src/api/knowledge/knowledge.controller.ts`, change:

```ts
@Controller(['knowledge', 'knowledge/v1'])
```

to:

```ts
@Controller('knowledge')
```

- [ ] **Step 7: Add new service injections and methods**

Extend the constructor in `KnowledgeApiController` with optional services:

```ts
    @Optional() private readonly identityAuth?: IdentityAuthService,
    @Optional() private readonly traces?: KnowledgeTraceService,
    @Optional() private readonly evals?: KnowledgeEvalService,
    @Optional() private readonly providerHealth?: KnowledgeProviderHealthService
```

Add imports for `KnowledgeTraceService`, `KnowledgeEvalService`, and `KnowledgeProviderHealthService` from `src/domains/knowledge/services/*`.

Add controller methods:

```ts
  @Get('observability/metrics')
  getObservabilityMetrics() {
    return this.requireTraceService().getMetrics();
  }

  @Get('observability/traces')
  listTraces(@Query() query: PageQuery) {
    return this.requireTraceService().listTraces(query);
  }

  @Get('observability/traces/:traceId')
  getTrace(@Param('traceId') traceId: string) {
    return this.requireTraceService().getTrace(traceId);
  }

  @Get('eval/datasets')
  listEvalDatasets() {
    return this.requireEvalService().listDatasets();
  }

  @Get('eval/runs')
  listEvalRuns(@Query() query: PageQuery = {}) {
    return this.requireEvalService().listRuns(query);
  }

  @Get('eval/runs/:runId/results')
  listEvalRunResults(@Param('runId') runId: string) {
    return this.requireEvalService().listRunResults(runId);
  }

  @Post('eval/runs/compare')
  compareEvalRuns(@Body() body: { baselineRunId: string; candidateRunId: string }) {
    return this.requireEvalService().compareRuns(body);
  }

  @Get('provider-health')
  getProviderHealth() {
    return this.requireProviderHealthService().getHealth();
  }
```

Add private guards:

```ts
  private requireTraceService(): KnowledgeTraceService {
    if (!this.traces) {
      throw new KnowledgeServiceError('knowledge_trace_unavailable', 'Knowledge trace service is unavailable.');
    }
    return this.traces;
  }

  private requireEvalService(): KnowledgeEvalService {
    if (!this.evals) {
      throw new KnowledgeServiceError('knowledge_eval_unavailable', 'Knowledge eval service is unavailable.');
    }
    return this.evals;
  }

  private requireProviderHealthService(): KnowledgeProviderHealthService {
    if (!this.providerHealth) {
      throw new KnowledgeServiceError(
        'knowledge_provider_health_unavailable',
        'Knowledge provider health service is unavailable.'
      );
    }
    return this.providerHealth;
  }
```

- [ ] **Step 8: Implement minimal service methods**

Add methods with deterministic empty projections if the services do not already expose them:

```ts
// KnowledgeTraceService
getMetrics() {
  return { totalQueries: 0, averageLatencyMs: 0 };
}

listTraces(query: { page?: number; pageSize?: number } = {}) {
  return { items: [], total: 0, page: query.page ?? 1, pageSize: query.pageSize ?? 20 };
}

getTrace(traceId: string) {
  return { id: traceId, steps: [] };
}
```

```ts
// KnowledgeEvalService
listDatasets() {
  return { items: [], total: 0, page: 1, pageSize: 20 };
}

listRuns(query: { page?: number; pageSize?: number } = {}) {
  return { items: [], total: 0, page: query.page ?? 1, pageSize: query.pageSize ?? 20 };
}

listRunResults(runId: string) {
  return { items: [], total: 0, page: 1, pageSize: 20, runId };
}

compareRuns(input: { baselineRunId: string; candidateRunId: string }) {
  return { baselineRunId: input.baselineRunId, candidateRunId: input.candidateRunId, deltas: [] };
}
```

```ts
// KnowledgeProviderHealthService
getHealth() {
  return { status: 'available', providers: [] };
}
```

- [ ] **Step 9: Wire services in `KnowledgeDomainModule`**

Ensure the `KnowledgeApiController` dependencies are satisfied by existing providers in `KnowledgeDomainModule`. Keep providers in `apps/backend/agent-server/src/domains/knowledge/knowledge-domain.module.ts` and do not import old `src/knowledge`.

- [ ] **Step 10: Run knowledge tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge-domain
```

Expected: PASS.

- [ ] **Step 11: Commit knowledge canonical coverage**

```bash
git add apps/backend/agent-server/src/api/knowledge apps/backend/agent-server/src/domains/knowledge apps/backend/agent-server/test/knowledge-domain
git commit -m "feat: hard cut knowledge api routes"
```

### Task 5: Remove Old Agent-Server Knowledge Module

**Files:**

- Modify: `apps/backend/agent-server/src/app/app.module.ts`
- Modify: `apps/backend/agent-server/src/app.module.ts`
- Modify: `apps/backend/agent-server/test/unified-backend/app-module-unified.spec.ts`
- Delete: `apps/backend/agent-server/src/knowledge/**`
- Delete or migrate: `apps/backend/agent-server/test/knowledge/**`

- [ ] **Step 1: Strengthen structure test**

Add this test to `apps/backend/agent-server/test/unified-backend/app-module-unified.spec.ts`:

```ts
it('does not keep the old fixture-backed knowledge module after the hard cut', () => {
  const root = new URL('../../src/', import.meta.url);
  const appModule = readFileSync(new URL('../../src/app.module.ts', import.meta.url), 'utf8');
  const nestedAppModule = readFileSync(new URL('../../src/app/app.module.ts', import.meta.url), 'utf8');

  expect(existsSync(new URL('knowledge/', root))).toBe(false);
  expect(appModule).not.toContain("from './knowledge/");
  expect(nestedAppModule).not.toContain("from '../knowledge/");
});
```

- [ ] **Step 2: Run red structure test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/unified-backend/app-module-unified.spec.ts
```

Expected: FAIL because `src/knowledge` still exists and `src/app/app.module.ts` imports `KnowledgeModule`.

- [ ] **Step 3: Remove nested old app import**

In `apps/backend/agent-server/src/app/app.module.ts`, remove:

```ts
import { KnowledgeModule } from '../knowledge/knowledge.module';
```

and change the module imports to remove `KnowledgeModule`:

```ts
@Module({
  imports: [RuntimeModule],
  controllers: [AppController]
})
export class AppFeatureModule {}
```

Keep the exact controller/provider metadata already present in the file; only remove `KnowledgeModule`.

- [ ] **Step 4: Delete old knowledge implementation and obsolete tests**

Run:

```bash
rm -rf apps/backend/agent-server/src/knowledge apps/backend/agent-server/test/knowledge
```

- [ ] **Step 5: Search for old module imports**

Run:

```bash
rg -n "src/knowledge|\\.\\/knowledge|\\.\\.\\/knowledge|KnowledgeModule|knowledge/v1|knowledge-bases|evals/" apps/backend/agent-server
```

Expected: no current implementation imports or tests for the old module. Mentions in deleted-file diffs do not count.

- [ ] **Step 6: Run backend structural tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/unified-backend/app-module-unified.spec.ts test/smoke/backend/backend-module.smoke.ts
```

Expected: PASS.

- [ ] **Step 7: Commit old module removal**

```bash
git add apps/backend/agent-server/src/app apps/backend/agent-server/src/knowledge apps/backend/agent-server/test/knowledge apps/backend/agent-server/test/unified-backend
git commit -m "chore: remove legacy agent-server knowledge module"
```

### Task 6: Knowledge Frontend Path Migration

**Files:**

- Modify: `apps/frontend/knowledge/src/api/auth-client.ts`
- Modify: `apps/frontend/knowledge/src/main.tsx`
- Modify: `apps/frontend/knowledge/src/pages/auth/auth-provider.tsx`
- Modify: `apps/frontend/knowledge/test/auth-client.test.ts`
- Modify: `apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts`
- Modify: `apps/frontend/knowledge/test/knowledge-api-client.test.ts`

- [ ] **Step 1: Update auth-client tests to identity paths**

In `apps/frontend/knowledge/test/auth-client.test.ts`, replace base URL examples with `/api` and path assertions with `/identity/*`. The retry test must use:

```ts
if (String(url).endsWith('/identity/me') && authorization === 'Bearer old') {
  return new Response(JSON.stringify({ code: 'identity_token_expired', message: 'expired' }), { status: 401 });
}
if (String(url).endsWith('/identity/refresh')) {
  return new Response(
    JSON.stringify({
      tokens: {
        accessToken: 'new',
        refreshToken: 'new_refresh',
        tokenType: 'Bearer',
        expiresIn: 7200,
        refreshExpiresIn: 1209600
      }
    }),
    { status: 200 }
  );
}
```

The default browser fetch assertion must become:

```ts
expect(fetcher).toHaveBeenCalledWith('/api/identity/login', expect.objectContaining({ method: 'POST' }));
```

- [ ] **Step 2: Update knowledge real API path tests**

In `apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts`, replace `http://127.0.0.1:3020/api` with `http://127.0.0.1:3000/api`, replace test descriptions that say `knowledge-server` with `agent-server`, and keep request paths under `/knowledge/*`.

Example assertion:

```ts
expect(fetcher).toHaveBeenCalledWith(
  'http://127.0.0.1:3000/api/knowledge/bases',
  expect.objectContaining({
    headers: expect.any(Headers)
  })
);
```

- [ ] **Step 3: Update knowledge API client unit tests**

In `apps/frontend/knowledge/test/knowledge-api-client.test.ts`, replace client setup like:

```ts
const authClient = new AuthClient({ baseUrl: '/api/knowledge/v1', fetcher });
const apiClient = new KnowledgeApiClient({ baseUrl: '/api/knowledge/v1', authClient, fetcher });
```

with:

```ts
const authClient = new AuthClient({ baseUrl: '/api', fetcher });
const apiClient = new KnowledgeApiClient({ baseUrl: '/api', authClient, fetcher });
```

Expected URLs must use `/api/knowledge/*`, for example:

```ts
expect(fetcher).toHaveBeenCalledWith('/api/knowledge/rag/model-profiles', expect.any(Object));
```

- [ ] **Step 4: Run frontend red tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/knowledge/test/auth-client.test.ts apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts apps/frontend/knowledge/test/knowledge-api-client.test.ts
```

Expected: FAIL because implementation still calls `/auth/*` and some defaults still use `/api/knowledge/v1`.

- [ ] **Step 5: Change `AuthClient` implementation**

In `apps/frontend/knowledge/src/api/auth-client.ts`, replace:

```ts
`${this.baseUrl}/auth/login``${this.baseUrl}/auth/refresh`;
this.requestWithAccessToken('/auth/me', parseMeResponse);
```

with:

```ts
`${this.baseUrl}/identity/login``${this.baseUrl}/identity/refresh`;
this.requestWithAccessToken('/identity/me', parseMeResponse);
```

Update `isAuthTokenExpired` to accept only identity codes:

```ts
function isAuthTokenExpired(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  const code = 'code' in body ? (body as { code?: unknown }).code : undefined;
  const errorCode =
    'error' in body && typeof (body as { error?: { code?: unknown } }).error?.code === 'string'
      ? (body as { error: { code: string } }).error.code
      : undefined;
  return code === 'identity_token_expired' || errorCode === 'identity_token_expired';
}
```

- [ ] **Step 6: Change knowledge frontend defaults**

In `apps/frontend/knowledge/src/main.tsx`, keep:

```ts
const authServiceBaseUrl = import.meta.env.VITE_AUTH_SERVICE_BASE_URL ?? 'http://127.0.0.1:3000/api';
const knowledgeServiceBaseUrl = import.meta.env.VITE_KNOWLEDGE_SERVICE_BASE_URL ?? 'http://127.0.0.1:3000/api';
```

In `apps/frontend/knowledge/src/pages/auth/auth-provider.tsx`, change:

```ts
const client = useMemo(() => authClient ?? new AuthClient({ baseUrl: '/api' }), [authClient]);
```

- [ ] **Step 7: Run knowledge frontend tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/knowledge/test/auth-client.test.ts apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts apps/frontend/knowledge/test/knowledge-api-client.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit knowledge frontend migration**

```bash
git add apps/frontend/knowledge/src apps/frontend/knowledge/test
git commit -m "feat: route knowledge frontend through unified backend"
```

### Task 7: Agent Admin Identity Path Migration

**Files:**

- Modify: `apps/frontend/agent-admin/src/pages/auth/api/admin-auth.api.ts`
- Modify: `apps/frontend/agent-admin/src/pages/identity/api/auth-service-client.ts`
- Create or modify: `apps/frontend/agent-admin/src/pages/auth/api/admin-auth.api.test.ts`
- Create or modify: `apps/frontend/agent-admin/src/pages/identity/api/auth-service-client.test.ts`

- [ ] **Step 1: Add admin auth path tests**

Create `apps/frontend/agent-admin/src/pages/auth/api/admin-auth.api.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAdminMe, loginAdminAuth, logoutAdminAuth, refreshAdminAuth } from './admin-auth.api';

describe('admin auth api unified identity paths', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('calls identity login refresh logout and me endpoints', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          account: { id: 'user_1', username: 'admin', displayName: 'Admin', roles: ['super_admin'], status: 'enabled' },
          session: { id: 'sess_1', expiresAt: '2026-05-09T00:00:00.000Z' },
          tokens: { accessToken: 'access', refreshToken: 'refresh', tokenType: 'Bearer' }
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal('fetch', fetcher);
    localStorage.setItem('agent-admin:auth', JSON.stringify({ tokens: { accessToken: 'access' } }));

    await loginAdminAuth({ username: 'admin', password: 'secret' });
    await refreshAdminAuth('refresh');
    await logoutAdminAuth({ refreshToken: 'refresh' });
    await getAdminMe();

    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      'http://127.0.0.1:3000/api/identity/login',
      'http://127.0.0.1:3000/api/identity/refresh',
      'http://127.0.0.1:3000/api/identity/logout',
      'http://127.0.0.1:3000/api/identity/me'
    ]);
  });
});
```

- [ ] **Step 2: Add identity users path test**

Create `apps/frontend/agent-admin/src/pages/identity/api/auth-service-client.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import { createAuthServiceClient } from './auth-service-client';

describe('auth service client identity users path', () => {
  it('lists users through the unified identity users endpoint', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ users: [] }), { status: 200 }));
    const client = createAuthServiceClient({
      baseUrl: 'http://127.0.0.1:3000/api',
      getAccessToken: () => 'access',
      fetchImpl: fetcher
    });

    await client.listUsers();

    expect(fetcher).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/api/identity/users',
      expect.objectContaining({
        headers: { authorization: 'Bearer access' }
      })
    );
  });
});
```

- [ ] **Step 3: Run admin red tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-admin/src/pages/auth/api/admin-auth.api.test.ts apps/frontend/agent-admin/src/pages/identity/api/auth-service-client.test.ts
```

Expected: FAIL because admin still calls `/auth/*` and `/auth/users`.

- [ ] **Step 4: Update admin auth API paths**

In `apps/frontend/agent-admin/src/pages/auth/api/admin-auth.api.ts`, replace:

```ts
'/auth/login';
'/auth/refresh';
'/auth/logout';
'/auth/me';
```

with:

```ts
'/identity/login';
'/identity/refresh';
'/identity/logout';
'/identity/me';
```

- [ ] **Step 5: Update identity users client**

In `apps/frontend/agent-admin/src/pages/identity/api/auth-service-client.ts`, replace:

```ts
`${baseUrl}/auth/users`;
```

with:

```ts
`${baseUrl}/identity/users`;
```

- [ ] **Step 6: Run admin tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-admin/src/pages/auth/api/admin-auth.api.test.ts apps/frontend/agent-admin/src/pages/identity/api/auth-service-client.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit agent-admin migration**

```bash
git add apps/frontend/agent-admin/src/pages/auth/api apps/frontend/agent-admin/src/pages/identity/api
git commit -m "feat: route agent-admin auth through identity api"
```

### Task 8: Documentation and Contract Cleanup

**Files:**

- Modify: `scripts/check-docs.js`
- Modify: `docs/contracts/api/auth.md`
- Modify: `docs/contracts/api/knowledge.md`
- Modify: `docs/contracts/api/README.md`
- Modify: `docs/integration/frontend-backend-integration.md`
- Modify: `docs/apps/backend/agent-server/identity.md`
- Modify: `docs/apps/backend/agent-server/knowledge.md`
- Modify: `docs/apps/backend/agent-server/agent-server-overview.md`
- Modify: `docs/packages/evals/verification-system-guidelines.md`
- Delete: `docs/apps/backend/auth-server/**`
- Delete: `docs/apps/backend/knowledge-server/**`
- Modify: historical specs under `docs/superpowers/specs/*` that describe old services as canonical.

- [ ] **Step 1: Remove old backend docs from docs check allowlist**

In `scripts/check-docs.js`, remove these entries from the current docs allowlist:

```js
'docs/apps/backend/auth-server',
'docs/apps/backend/knowledge-server',
```

- [ ] **Step 2: Delete standalone backend docs**

Run:

```bash
rm -rf docs/apps/backend/auth-server docs/apps/backend/knowledge-server
```

- [ ] **Step 3: Update auth contract**

In `docs/contracts/api/auth.md`, make the canonical route block:

```text
POST /api/identity/login
POST /api/identity/refresh
POST /api/identity/logout
GET  /api/identity/me
GET  /api/identity/users
POST /api/identity/users
PATCH /api/identity/users/:userId/disable
PATCH /api/identity/users/:userId/enable
```

Remove any wording that says `/api/auth/*` is still supported.

- [ ] **Step 4: Update knowledge contract**

In `docs/contracts/api/knowledge.md`, set the canonical host wording to:

```md
Knowledge API canonical endpoints are served by `apps/backend/agent-server`.
The frontend calls `VITE_KNOWLEDGE_SERVICE_BASE_URL`, defaulting to `http://127.0.0.1:3000/api`.
All production paths use `/api/knowledge/*`; `/api/knowledge/v1/*` is not supported after the hard cut.
```

Remove `knowledge-server` as a current host and remove `/api/knowledge/v1` from current API examples.

- [ ] **Step 5: Update integration docs**

In `docs/integration/frontend-backend-integration.md`, replace the old service map with:

```text
agent-server identity  http://127.0.0.1:3000/api/identity
agent-server knowledge http://127.0.0.1:3000/api/knowledge
agent-server chat      http://127.0.0.1:3000/api/chat
```

State that `auth-server` and `knowledge-server` were removed by the unified backend hard cut.

- [ ] **Step 6: Mark historical specs superseded**

For historical specs that still call `auth-server` or `knowledge-server` canonical, add this notice below the title:

```md
> 历史说明：本文描述的是硬切前的独立服务设计。当前实现以 `docs/superpowers/specs/2026-05-08-unified-backend-hard-cut-design.md` 和 `apps/backend/agent-server` 为准。
```

Apply it at least to:

```text
docs/superpowers/specs/2026-05-02-auth-and-knowledge-service-split-design.md
docs/superpowers/specs/2026-05-03-mature-rag-production-design.md
docs/superpowers/specs/2026-05-03-knowledge-rag-sdk-runtime-architecture-design.md
docs/superpowers/specs/2026-05-02-knowledge-supabase-rag-chat-lab-design.md
docs/superpowers/specs/2026-05-02-knowledge-frontend-core-ops-design.md
docs/superpowers/specs/2026-05-07-unified-agent-server-design.md
```

- [ ] **Step 7: Run documentation scan**

Run:

```bash
rg -n "auth-server|knowledge-server|3010|3020|/knowledge/v1|/api/auth" docs scripts
```

Expected: only historical notices, deletion notes, or explicit forbidden-path statements remain. Current contract and integration docs must not describe old services as active.

- [ ] **Step 8: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

- [ ] **Step 9: Commit documentation cleanup**

```bash
git add scripts/check-docs.js docs
git commit -m "docs: document unified backend hard cut"
```

### Task 9: Global Cleanup Scan

**Files:**

- Modify any remaining file found by the scan that still treats old paths or packages as current.

- [ ] **Step 1: Run full current-state scan**

Run:

```bash
rg -n "auth-server|knowledge-server|@agent/auth-server|@agent/knowledge-server|3010|3020|/knowledge/v1|/api/auth|/auth/" apps packages agents scripts test docs package.json pnpm-lock.yaml
```

Expected: no current-state references. Acceptable matches are only historical docs that explicitly say the old services were superseded by `2026-05-08-unified-backend-hard-cut-design.md`.

- [ ] **Step 2: Fix every current-state match**

For each current-state match, either delete the obsolete file, update the path to `/identity/*` or `/knowledge/*`, or add a historical notice if it is a historical spec. Do not leave old paths in tests, source code, root scripts, package manifests, or current docs.

- [ ] **Step 3: Run source artifact and architecture checks**

Run:

```bash
pnpm check:source-artifacts
pnpm check:architecture
```

Expected: PASS.

- [ ] **Step 4: Commit cleanup scan fixes**

```bash
git add .
git commit -m "chore: clean removed backend references"
```

### Task 10: Verification and Final Commit Gate

**Files:**

- No new files by default.
- Modify only files exposed by verification failures.

- [ ] **Step 1: Run backend typecheck**

Run:

```bash
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: PASS.

- [ ] **Step 2: Run backend tests**

Run:

```bash
pnpm --dir apps/backend/agent-server test
```

Expected: PASS.

- [ ] **Step 3: Run frontend typechecks**

Run:

```bash
pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit
pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit
```

Expected: PASS.

- [ ] **Step 4: Run focused frontend tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/knowledge/test apps/frontend/agent-admin/src/pages/auth apps/frontend/agent-admin/src/pages/identity
```

Expected: PASS.

- [ ] **Step 5: Run governance checks**

Run:

```bash
pnpm check:docs
pnpm check:architecture
```

Expected: PASS.

- [ ] **Step 6: Run workspace smoke**

Run:

```bash
pnpm test:workspace:smoke
```

Expected: PASS.

- [ ] **Step 7: Confirm no old importers remain**

Run:

```bash
rg -n "apps/backend/auth-server|apps/backend/knowledge-server|@agent/auth-server|@agent/knowledge-server" pnpm-lock.yaml package.json pnpm-workspace.yaml
```

Expected: no matches.

- [ ] **Step 8: Confirm hard-cut completion scan**

Run:

```bash
rg -n "auth-server|knowledge-server|3010|3020|/knowledge/v1|/api/auth" apps packages test scripts docs
```

Expected: only historical notices and explicit forbidden-path statements remain.

- [ ] **Step 9: Commit verification fixes**

If verification required fixes, commit them:

```bash
git add .
git commit -m "fix: complete unified backend verification"
```

If no files changed, do not create an empty commit.

## Self-Review

- Spec coverage: Tasks 1-2 cover workspace scripts, old packages, and lockfile. Tasks 3-5 cover identity, knowledge, and old `agent-server/src/knowledge`. Tasks 6-7 cover both frontends. Task 8 covers docs/contracts. Tasks 9-10 cover cleanup and verification.
- Placeholder scan: The plan contains no `TBD`, `TODO`, or "implement later" instructions. Conditional language is limited to verification outcomes and historical-doc classification.
- Type consistency: Controller and service names match existing code: `IdentityController`, `IdentityUserService`, `KnowledgeApiController`, `KnowledgeTraceService`, `KnowledgeEvalService`, `KnowledgeProviderHealthService`.
