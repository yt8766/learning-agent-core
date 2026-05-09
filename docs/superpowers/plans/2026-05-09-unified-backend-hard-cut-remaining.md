# Unified Backend Hard Cut Remaining Implementation Plan

状态：draft
文档类型：plan
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-admin`、`apps/frontend/knowledge`、`docs/contracts/api/**`、`docs/integration/frontend-backend-integration.md`
最后核对：2026-05-09

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining hard cut so the repository has no current callers, docs, tests, scripts, or backend code paths that treat `auth-server` or `knowledge-server` as active services.

**Architecture:** `apps/backend/agent-server` remains the only backend API host. Identity lives under `/api/identity/*` with domain logic in `src/domains/identity`; Knowledge lives under `/api/knowledge/*` with domain logic in `src/domains/knowledge`; old standalone packages and the legacy `agent-server/src/knowledge` module are removed or rewritten as historical documentation only.

**Tech Stack:** NestJS, TypeScript, Vite React frontends, Vitest, pnpm workspaces, Turbo, zod contracts from `@agent/core` and `@agent/knowledge`.

---

## Current State

Already completed and committed:

- `d708717c docs: add unified backend hard cut spec`
- `8901c694 docs: add unified backend hard cut plan`
- `a1c6f1f4 docs: fix hard cut plan red test flow`
- `2526bf6a chore: remove standalone backend packages`
- `698584cf docs: update knowledge rag rollout for unified backend`

Currently staged but not committed:

- `apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts`
- `docs/integration/frontend-backend-integration.md`
- `docs/packages/knowledge/README.md`
- `docs/sdk/README.md`
- `docs/packages/knowledge/sdk.md -> docs/sdk/knowledge.md`

Current blocker:

- The working tree contains unrelated changes outside this hard-cut scope, including `agent-gateway`, `llm-gateway`, `worker`, docs, scripts, and config changes. Do not revert them without explicit user permission. Keep hard-cut commits scoped to the files listed in each task.

## File Structure Map

- Modify: `apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts` — staged canonical `3000/api` knowledge path test.
- Modify: `docs/integration/frontend-backend-integration.md` — staged unified backend integration wording.
- Modify: `docs/packages/knowledge/README.md` — staged pointer from package docs to SDK docs.
- Create: `docs/sdk/README.md` — staged SDK docs index.
- Move: `docs/packages/knowledge/sdk.md` to `docs/sdk/knowledge.md` — staged SDK guide relocation and unified backend wording.
- Modify: `apps/backend/agent-server/test/identity/identity-alias.controller.spec.ts` — canonical identity route assertions.
- Create: `apps/backend/agent-server/test/identity/identity-users.controller.spec.ts` — user-management route coverage under `/api/identity/users`.
- Modify: `apps/backend/agent-server/src/api/identity/identity.controller.ts` — canonical login, refresh, logout, and me shell.
- Create: `apps/backend/agent-server/src/api/identity/identity-users.controller.ts` — user-management shell.
- Delete: `apps/backend/agent-server/src/api/identity/legacy-auth.controller.ts` — old `/auth/*` alias.
- Modify: `apps/backend/agent-server/src/domains/identity/identity.module.ts` — remove legacy controller and register canonical user controller.
- Modify: `apps/backend/agent-server/src/api/knowledge/knowledge.controller.ts` — ensure canonical `/knowledge/*` covers all frontend business operations.
- Modify: `apps/backend/agent-server/src/api/knowledge/knowledge-settings.controller.ts` — keep settings under `/knowledge/settings/*`.
- Modify: `apps/backend/agent-server/src/domains/knowledge/knowledge-domain.module.ts` — wire only domain services and repositories.
- Modify or delete: `apps/backend/agent-server/src/app/app.module.ts` — remove imports from `src/knowledge` if still present.
- Delete: `apps/backend/agent-server/src/knowledge/**` — remove legacy fixture-backed knowledge module after canonical tests pass.
- Modify: `apps/frontend/knowledge/src/api/auth-client.ts` — use `/identity/*`.
- Modify: `apps/frontend/knowledge/src/main.tsx` — default auth and knowledge base URLs to `http://127.0.0.1:3000/api`.
- Modify: `apps/frontend/knowledge/src/pages/auth/auth-provider.tsx` — default auth client base URL to `/api`.
- Modify: `apps/frontend/knowledge/test/auth-client.test.ts` — canonical identity path assertions.
- Modify: `apps/frontend/knowledge/test/knowledge-api-client.test.ts` — remove `/knowledge/v1` and `3020` assumptions.
- Modify: `apps/frontend/agent-admin/src/pages/auth/api/admin-auth.api.ts` — use `/identity/*`.
- Modify: `apps/frontend/agent-admin/src/pages/identity/api/auth-service-client.ts` — use `/identity/users`.
- Create or modify: `apps/frontend/agent-admin/src/pages/auth/api/admin-auth.api.test.ts` — admin login path coverage.
- Create or modify: `apps/frontend/agent-admin/src/pages/identity/api/auth-service-client.test.ts` — admin user-management path coverage.
- Modify: `docs/contracts/api/auth.md` — identity contract is canonical.
- Modify: `docs/contracts/api/knowledge.md` — knowledge contract is canonical under agent-server.
- Modify: `docs/contracts/api/README.md` — remove active standalone backend descriptions.
- Modify: `docs/apps/backend/agent-server/identity.md` — identity endpoint and boundary documentation.
- Modify: `docs/apps/backend/agent-server/knowledge.md` — knowledge endpoint and boundary documentation.
- Modify: `docs/apps/backend/agent-server/agent-server-overview.md` — unified backend overview.
- Modify: `docs/conventions/local-development-guide.md` — local backend port list.
- Modify: `docs/packages/evals/verification-system-guidelines.md` — root backend launcher description.
- Modify historical specs/plans under `docs/superpowers/**` only when they describe old backends as current rather than historical.

## Implementation Tasks

### Task 0: Commit the Already-Staged Current Reference Cleanup

**Files:**

- Modify: `apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts`
- Modify: `docs/integration/frontend-backend-integration.md`
- Modify: `docs/packages/knowledge/README.md`
- Create: `docs/sdk/README.md`
- Move: `docs/packages/knowledge/sdk.md` to `docs/sdk/knowledge.md`

- [ ] **Step 1: Inspect the staged hard-cut file list**

Run:

```bash
git diff --cached --name-status
```

Expected: output includes exactly these hard-cut files, plus no unrelated `agent-gateway`, `llm-gateway`, or `worker` files:

```text
M	apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts
M	docs/integration/frontend-backend-integration.md
M	docs/packages/knowledge/README.md
A	docs/sdk/README.md
R088	docs/packages/knowledge/sdk.md	docs/sdk/knowledge.md
```

- [ ] **Step 2: Run the focused staged tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts
pnpm check:docs
```

Expected: both commands PASS.

- [ ] **Step 3: If hook failures mention unrelated files, stop and isolate**

Run:

```bash
git status --short
```

Expected: unrelated worktree changes may exist. Do not stage them. If a commit hook formats or fails on unrelated files, record the filenames in the task handoff and ask the user whether to preserve, commit separately, or restore those unrelated changes.

- [ ] **Step 4: Commit only the staged hard-cut docs and test cleanup**

Run:

```bash
git commit -m "docs: finish unified backend reference cleanup"
```

Expected: commit succeeds without adding unrelated files.

### Task 1: Identity API Canonical Hard Cut

**Files:**

- Modify: `apps/backend/agent-server/test/identity/identity-alias.controller.spec.ts`
- Create: `apps/backend/agent-server/test/identity/identity-users.controller.spec.ts`
- Modify: `apps/backend/agent-server/src/api/identity/identity.controller.ts`
- Create: `apps/backend/agent-server/src/api/identity/identity-users.controller.ts`
- Delete: `apps/backend/agent-server/src/api/identity/legacy-auth.controller.ts`
- Modify: `apps/backend/agent-server/src/domains/identity/identity.module.ts`

- [ ] **Step 1: Replace the alias test with a canonical identity route test**

Replace `apps/backend/agent-server/test/identity/identity-alias.controller.spec.ts` with:

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

  it('delegates login refresh logout and me to the identity auth service', async () => {
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
  const createService = () => ({
    listUsers: vi.fn(async () => ({ users: [{ id: 'user_1', username: 'admin' }] })),
    createUser: vi.fn(async (body: unknown) => ({ id: 'user_2', ...(body as object) })),
    disableUser: vi.fn(async (userId: string) => ({ id: userId, status: 'disabled' })),
    enableUser: vi.fn(async (userId: string) => ({ id: userId, status: 'enabled' }))
  });

  it('mounts under the canonical identity users prefix', () => {
    expect(Reflect.getMetadata(PATH_METADATA, IdentityUsersController)).toBe('identity/users');
  });

  it('delegates user management operations to the identity user service', async () => {
    const service = createService();
    const controller = new IdentityUsersController(service as never);

    await expect(controller.listUsers()).resolves.toMatchObject({ users: [{ id: 'user_1' }] });
    await expect(controller.createUser({ username: 'editor' })).resolves.toMatchObject({ id: 'user_2' });
    await expect(controller.disableUser('user_1')).resolves.toMatchObject({ status: 'disabled' });
    await expect(controller.enableUser('user_1')).resolves.toMatchObject({ status: 'enabled' });

    expect(service.listUsers).toHaveBeenCalledTimes(1);
    expect(service.createUser).toHaveBeenCalledWith({ username: 'editor' });
    expect(service.disableUser).toHaveBeenCalledWith('user_1');
    expect(service.enableUser).toHaveBeenCalledWith('user_1');
  });
});
```

- [ ] **Step 3: Run the identity red tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/identity/identity-alias.controller.spec.ts apps/backend/agent-server/test/identity/identity-users.controller.spec.ts
```

Expected: FAIL because `IdentityUsersController` does not exist yet and legacy auth may still be registered.

- [ ] **Step 4: Create the canonical users controller**

Create `apps/backend/agent-server/src/api/identity/identity-users.controller.ts`:

```ts
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import { IdentityUserService } from '../../domains/identity/services/identity-user.service';

@Controller('identity/users')
export class IdentityUsersController {
  constructor(private readonly identityUserService: IdentityUserService) {}

  @Get()
  listUsers() {
    return this.identityUserService.listUsers();
  }

  @Post()
  createUser(@Body() body: unknown) {
    return this.identityUserService.createUser(body as never);
  }

  @Patch(':userId/disable')
  disableUser(@Param('userId') userId: string) {
    return this.identityUserService.disableUser(userId);
  }

  @Patch(':userId/enable')
  enableUser(@Param('userId') userId: string) {
    return this.identityUserService.enableUser(userId);
  }
}
```

If `IdentityUserService` exposes different method names, adapt the controller to the existing service and update the test method names in the same task. Do not add a parallel service.

- [ ] **Step 5: Remove the legacy auth controller from the module**

In `apps/backend/agent-server/src/domains/identity/identity.module.ts`, ensure the controllers list imports and registers only canonical controllers:

```ts
import { IdentityController } from '../../api/identity/identity.controller';
import { IdentityUsersController } from '../../api/identity/identity-users.controller';

@Module({
  controllers: [IdentityController, IdentityUsersController]
})
export class IdentityModule {}
```

Preserve all existing providers and exports in the file.

- [ ] **Step 6: Delete the legacy controller file**

Run:

```bash
rm apps/backend/agent-server/src/api/identity/legacy-auth.controller.ts
```

Expected: the file is absent and no source file imports it.

- [ ] **Step 7: Verify identity hard cut**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/identity
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
rg -n "legacy-auth|/api/auth|@Controller\\('auth'\\)|@Controller\\(\"auth\"\\)" apps/backend/agent-server/src apps/backend/agent-server/test
```

Expected: tests and typecheck PASS. The `rg` command returns no current source hits.

- [ ] **Step 8: Commit identity hard cut**

Run:

```bash
git add apps/backend/agent-server/test/identity apps/backend/agent-server/src/api/identity apps/backend/agent-server/src/domains/identity/identity.module.ts
git commit -m "refactor: hard cut identity api aliases"
```

### Task 2: Knowledge API Canonical Coverage

**Files:**

- Modify: `apps/backend/agent-server/src/api/knowledge/knowledge.controller.ts`
- Modify: `apps/backend/agent-server/src/api/knowledge/knowledge-settings.controller.ts`
- Modify: `apps/backend/agent-server/src/domains/knowledge/knowledge-domain.module.ts`
- Modify existing tests under `apps/backend/agent-server/test/knowledge/**` or create `apps/backend/agent-server/test/knowledge/knowledge-canonical-routes.spec.ts`

- [ ] **Step 1: Add canonical route metadata coverage**

Create `apps/backend/agent-server/test/knowledge/knowledge-canonical-routes.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PATH_METADATA } from '@nestjs/common/constants';

import { KnowledgeController } from '../../src/api/knowledge/knowledge.controller';
import { KnowledgeSettingsController } from '../../src/api/knowledge/knowledge-settings.controller';

describe('knowledge canonical routes', () => {
  it('mounts the main knowledge controller under knowledge', () => {
    expect(Reflect.getMetadata(PATH_METADATA, KnowledgeController)).toBe('knowledge');
  });

  it('mounts settings under knowledge settings', () => {
    expect(Reflect.getMetadata(PATH_METADATA, KnowledgeSettingsController)).toBe('knowledge/settings');
  });
});
```

- [ ] **Step 2: Add a no legacy v1 route assertion**

Append to the same test file:

```ts
it('does not expose the removed knowledge v1 controller path from canonical controllers', () => {
  const routes = [
    Reflect.getMetadata(PATH_METADATA, KnowledgeController),
    Reflect.getMetadata(PATH_METADATA, KnowledgeSettingsController)
  ];

  expect(routes).not.toContain('knowledge/v1');
});
```

- [ ] **Step 3: Run the knowledge red test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-canonical-routes.spec.ts
```

Expected: FAIL only if current controllers still mount a legacy route or file imports are wrong.

- [ ] **Step 4: Fix controller route prefixes only where needed**

In `apps/backend/agent-server/src/api/knowledge/knowledge.controller.ts`, the class decorator must be:

```ts
@Controller('knowledge')
export class KnowledgeController {}
```

In `apps/backend/agent-server/src/api/knowledge/knowledge-settings.controller.ts`, the class decorator must be:

```ts
@Controller('knowledge/settings')
export class KnowledgeSettingsController {}
```

Preserve existing methods and service delegation.

- [ ] **Step 5: Verify knowledge canonical coverage**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
rg -n "knowledge/v1|apps/backend/knowledge-server|@agent/knowledge-server|localhost:3020" apps/backend/agent-server/src apps/backend/agent-server/test
```

Expected: tests and typecheck PASS. The `rg` command returns no current backend hits.

- [ ] **Step 6: Commit knowledge canonical coverage**

Run:

```bash
git add apps/backend/agent-server/src/api/knowledge apps/backend/agent-server/src/domains/knowledge apps/backend/agent-server/test/knowledge
git commit -m "refactor: lock knowledge api to canonical routes"
```

### Task 3: Remove Legacy `agent-server/src/knowledge`

**Files:**

- Modify or delete: `apps/backend/agent-server/src/app/app.module.ts`
- Delete: `apps/backend/agent-server/src/knowledge/**`
- Modify tests that import `apps/backend/agent-server/src/knowledge/**`

- [ ] **Step 1: Find live imports of the legacy module**

Run:

```bash
rg -n "src/knowledge|\\.\\./knowledge|\\.\\./\\.\\./src/knowledge|KnowledgeModule|KnowledgeProviderModule" apps/backend/agent-server/src apps/backend/agent-server/test
```

Expected before the task: hits may exist in app wiring and old tests. Each current source hit must be migrated to `src/api/knowledge` or `src/domains/knowledge`.

- [ ] **Step 2: Add a deletion boundary test**

Create `apps/backend/agent-server/test/knowledge/legacy-knowledge-module-removed.spec.ts`:

```ts
import { access } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../../../..');

describe('legacy agent-server knowledge module removal', () => {
  it('does not keep the old fixture-backed src/knowledge module', async () => {
    await expect(access(path.join(repoRoot, 'apps/backend/agent-server/src/knowledge'))).rejects.toMatchObject({
      code: 'ENOENT'
    });
  });
});
```

- [ ] **Step 3: Run the red deletion test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/legacy-knowledge-module-removed.spec.ts
```

Expected: FAIL because `apps/backend/agent-server/src/knowledge` still exists.

- [ ] **Step 4: Remove app wiring to the old module**

If `apps/backend/agent-server/src/app/app.module.ts` imports `KnowledgeModule` from `../knowledge/knowledge.module`, remove that import and remove `KnowledgeModule` from the module imports array. Keep `KnowledgeDomainModule` and API modules wired through the existing canonical app module.

- [ ] **Step 5: Delete the legacy directory**

Run:

```bash
rm -rf apps/backend/agent-server/src/knowledge
```

Expected: the directory is absent.

- [ ] **Step 6: Verify no live imports remain**

Run:

```bash
rg -n "src/knowledge|\\.\\./knowledge|\\.\\./\\.\\./src/knowledge|KnowledgeModule|KnowledgeProviderModule" apps/backend/agent-server/src apps/backend/agent-server/test
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: `rg` has no hits for the removed module names, tests PASS, typecheck PASS.

- [ ] **Step 7: Commit legacy module removal**

Run:

```bash
git add apps/backend/agent-server/src/app apps/backend/agent-server/src/knowledge apps/backend/agent-server/test/knowledge
git commit -m "refactor: remove legacy agent-server knowledge module"
```

### Task 4: Frontend Caller Migration

**Files:**

- Modify: `apps/frontend/knowledge/src/api/auth-client.ts`
- Modify: `apps/frontend/knowledge/src/main.tsx`
- Modify: `apps/frontend/knowledge/src/pages/auth/auth-provider.tsx`
- Modify: `apps/frontend/knowledge/test/auth-client.test.ts`
- Modify: `apps/frontend/knowledge/test/knowledge-api-client.test.ts`
- Modify: `apps/frontend/agent-admin/src/pages/auth/api/admin-auth.api.ts`
- Modify: `apps/frontend/agent-admin/src/pages/identity/api/auth-service-client.ts`
- Create or modify: `apps/frontend/agent-admin/src/pages/auth/api/admin-auth.api.test.ts`
- Create or modify: `apps/frontend/agent-admin/src/pages/identity/api/auth-service-client.test.ts`

- [ ] **Step 1: Add frontend path assertions for knowledge auth**

In `apps/frontend/knowledge/test/auth-client.test.ts`, make sure login expects:

```ts
expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3000/api/identity/login');
```

Make sure refresh, logout, and me expect:

```ts
expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
  'http://127.0.0.1:3000/api/identity/refresh',
  'http://127.0.0.1:3000/api/identity/logout',
  'http://127.0.0.1:3000/api/identity/me'
]);
```

- [ ] **Step 2: Add frontend path assertions for agent-admin auth**

If no equivalent tests exist, create `apps/frontend/agent-admin/src/pages/auth/api/admin-auth.api.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import { createAdminAuthApi } from './admin-auth.api';

describe('admin auth api paths', () => {
  it('uses unified identity endpoints', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ accessToken: 'a', refreshToken: 'r', user: { id: 'u1' } }), { status: 200 })
      );
    const api = createAdminAuthApi({
      baseUrl: 'http://127.0.0.1:3000/api',
      fetchImpl: fetcher
    });

    await api.login({ username: 'admin', password: 'pw' });

    expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3000/api/identity/login');
  });
});
```

If `createAdminAuthApi` has a different factory signature, use the existing exported factory from `admin-auth.api.ts` and keep the same expected URL.

- [ ] **Step 3: Add frontend path assertions for agent-admin user management**

If no equivalent tests exist, create `apps/frontend/agent-admin/src/pages/identity/api/auth-service-client.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import { createAuthServiceClient } from './auth-service-client';

describe('auth service client paths', () => {
  it('uses unified identity users endpoints', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ users: [] }), { status: 200 }));
    const client = createAuthServiceClient({
      baseUrl: 'http://127.0.0.1:3000/api',
      getAccessToken: () => 'access-token',
      fetchImpl: fetcher
    });

    await client.listUsers();

    expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3000/api/identity/users');
  });
});
```

If the existing client uses a class constructor rather than a factory, instantiate the existing export and keep the same expected URL.

- [ ] **Step 4: Run frontend red tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/knowledge/test/auth-client.test.ts apps/frontend/knowledge/test/knowledge-api-client.test.ts apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts apps/frontend/agent-admin/src/pages/auth/api/admin-auth.api.test.ts apps/frontend/agent-admin/src/pages/identity/api/auth-service-client.test.ts
```

Expected: FAIL where old `/auth`, `/api/auth`, `/knowledge/v1`, `3010`, or `3020` paths are still used.

- [ ] **Step 5: Update knowledge frontend defaults**

In `apps/frontend/knowledge/src/main.tsx`, ensure the default API base values resolve to:

```ts
const defaultApiBaseUrl = 'http://127.0.0.1:3000/api';
```

Use that default for both auth and knowledge API clients unless an existing environment variable explicitly overrides it.

In `apps/frontend/knowledge/src/pages/auth/auth-provider.tsx`, ensure the local fallback is:

```ts
const authBaseUrl = import.meta.env.VITE_AUTH_API_BASE_URL ?? '/api';
```

- [ ] **Step 6: Update frontend clients**

In `apps/frontend/knowledge/src/api/auth-client.ts`, make endpoint construction use:

```ts
const identityPath = (path: string) => joinUrl(baseUrl, `identity/${path}`);
```

Then call `identityPath('login')`, `identityPath('refresh')`, `identityPath('logout')`, and `identityPath('me')`.

In `apps/frontend/agent-admin/src/pages/auth/api/admin-auth.api.ts`, use `/identity/login`, `/identity/refresh`, `/identity/logout`, and `/identity/me`.

In `apps/frontend/agent-admin/src/pages/identity/api/auth-service-client.ts`, use `/identity/users` and `/identity/users/:userId/disable` or `/identity/users/:userId/enable`.

- [ ] **Step 7: Verify frontend caller migration**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/knowledge/test/auth-client.test.ts apps/frontend/knowledge/test/knowledge-api-client.test.ts apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts apps/frontend/agent-admin/src/pages/auth/api/admin-auth.api.test.ts apps/frontend/agent-admin/src/pages/identity/api/auth-service-client.test.ts
pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit
pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit
rg -n "localhost:3010|localhost:3020|/api/auth|/auth/login|/knowledge/v1|auth-server|knowledge-server" apps/frontend/knowledge apps/frontend/agent-admin
```

Expected: tests and typechecks PASS. The `rg` command returns no current frontend hits except historical comments that explicitly say the old services were removed.

- [ ] **Step 8: Commit frontend migration**

Run:

```bash
git add apps/frontend/knowledge/src apps/frontend/knowledge/test apps/frontend/agent-admin/src/pages/auth apps/frontend/agent-admin/src/pages/identity
git commit -m "refactor: migrate frontends to unified backend paths"
```

### Task 5: Contracts and Documentation Cleanup

**Files:**

- Modify: `docs/contracts/api/auth.md`
- Modify: `docs/contracts/api/knowledge.md`
- Modify: `docs/contracts/api/README.md`
- Modify: `docs/apps/backend/agent-server/identity.md`
- Modify: `docs/apps/backend/agent-server/knowledge.md`
- Modify: `docs/apps/backend/agent-server/agent-server-overview.md`
- Modify: `docs/conventions/local-development-guide.md`
- Modify: `docs/packages/evals/verification-system-guidelines.md`
- Modify historical specs/plans under `docs/superpowers/**` only when needed

- [ ] **Step 1: Add a docs regression scan**

Run:

```bash
rg -n "auth-server|knowledge-server|localhost:3010|localhost:3020|@agent/auth-server|@agent/knowledge-server|apps/backend/auth-server|apps/backend/knowledge-server|/knowledge/v1|/api/auth" docs AGENTS.md README.md package.json pnpm-lock.yaml scripts test apps packages agents
```

Expected: hits remain in historical specs, archive docs, negative tests, or still-current docs that must be edited in this task.

- [ ] **Step 2: Rewrite contract index entries**

In `docs/contracts/api/README.md`, rewrite the auth and knowledge bullets to:

```md
- `auth.md`：unified `agent-server` `/api/identity/*` 的登录、刷新、退出、当前用户与用户管理契约。
- `knowledge.md`：unified `agent-server` `/api/knowledge/*` 的 Knowledge App API 契约。
```

- [ ] **Step 3: Rewrite auth contract header**

In `docs/contracts/api/auth.md`, set the current host statement to:

```md
当前 canonical 身份入口：`apps/backend/agent-server` 的 `/api/identity/*`。standalone `apps/backend/auth-server` 已删除；不要新增 `/api/auth/*` 调用方。
```

- [ ] **Step 4: Rewrite knowledge contract header**

In `docs/contracts/api/knowledge.md`, set the current host statement to:

```md
当前 canonical Knowledge API 入口：`apps/backend/agent-server` 的 `/api/knowledge/*`。standalone `apps/backend/knowledge-server` 与旧 `apps/backend/agent-server/src/knowledge` 已删除；不要新增 `/api/knowledge/v1` 调用方。
```

- [ ] **Step 5: Rewrite local development backend ports**

In `docs/conventions/local-development-guide.md`, replace the old backend port list with:

```md
- `agent-server`：`http://127.0.0.1:3000/api`
```

Add this sentence directly below it:

```md
`auth-server` 与 `knowledge-server` standalone 后端已经删除；本地联调不要再配置 `3010` 或 `3020`。
```

- [ ] **Step 6: Rewrite verification guide launcher description**

In `docs/packages/evals/verification-system-guidelines.md`, replace the root launcher paragraph with:

```md
- 根级 `start:dev` 入口先执行一次 `build:lib`，再通过 `turbo run dev:backend --filter=server` 启动 unified `agent-server`。standalone `auth-server` 与 `knowledge-server` 已删除，不再作为验证或开发启动目标。
```

- [ ] **Step 7: Mark old specs and plans as historical when they still describe deleted services as current**

For old specs/plans that intentionally record past work, add this notice near the top:

```md
> 历史说明：本文记录 standalone `auth-server` / `knowledge-server` 方案形成时的设计背景。当前实现已 hard cut 到 unified `apps/backend/agent-server`；正确入口见 `docs/superpowers/specs/2026-05-08-unified-backend-hard-cut-design.md`。
```

Do this for old docs that otherwise say `knowledge-server 是 canonical backend` or `auth-server 是 canonical backend`.

- [ ] **Step 8: Verify docs cleanup**

Run:

```bash
pnpm check:docs
rg -n "当前 canonical.*auth-server|当前 canonical.*knowledge-server|knowledge-server 是.*canonical|auth-server 是.*canonical|localhost:3010|localhost:3020|/knowledge/v1|/api/auth" docs AGENTS.md README.md
```

Expected: `pnpm check:docs` PASS. Remaining `rg` hits are archive/history notes or explicit removed-service warnings, not current instructions.

- [ ] **Step 9: Commit docs cleanup**

Run:

```bash
git add docs AGENTS.md README.md
git commit -m "docs: document unified backend as canonical"
```

### Task 6: Global Cleanup Scan

**Files:**

- Modify or delete any current source, test, script, or docs file found by the scan.

- [ ] **Step 1: Run the global hard-cut scan**

Run:

```bash
rg -n "@agent/auth-server|@agent/knowledge-server|apps/backend/auth-server|apps/backend/knowledge-server|localhost:3010|localhost:3020|/api/auth|/knowledge/v1|auth-server|knowledge-server" apps packages agents scripts test docs README.md AGENTS.md package.json pnpm-lock.yaml pnpm-workspace.yaml
```

Expected: only three categories remain:

```text
1. archive or historical docs explicitly marked as historical
2. negative tests asserting deleted paths do not exist
3. migration specs or plans that explicitly point to the unified backend as the current entry
```

- [ ] **Step 2: Fix any current source hit**

For current source, tests, scripts, or active docs, apply this mapping:

```text
/api/auth/*              -> /api/identity/*
http://127.0.0.1:3010/api -> http://127.0.0.1:3000/api
http://127.0.0.1:3020/api -> http://127.0.0.1:3000/api
/api/knowledge/v1/*      -> /api/knowledge/*
@agent/auth-server       -> no replacement package
@agent/knowledge-server  -> no replacement package
```

- [ ] **Step 3: Verify no deleted package importers or package names remain**

Run:

```bash
rg -n "@agent/auth-server|@agent/knowledge-server|apps/backend/auth-server:|apps/backend/knowledge-server:" package.json pnpm-lock.yaml pnpm-workspace.yaml
```

Expected: no hits.

- [ ] **Step 4: Commit global cleanup**

Run:

```bash
git add apps packages agents scripts test docs README.md AGENTS.md package.json pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "chore: remove stale standalone backend references"
```

### Task 7: Final Verification and Delivery

**Files:**

- No planned code files. This task verifies all touched areas.

- [ ] **Step 1: Run focused backend verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/identity apps/backend/agent-server/test/knowledge
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: PASS.

- [ ] **Step 2: Run focused frontend verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/knowledge/test/auth-client.test.ts apps/frontend/knowledge/test/knowledge-api-client.test.ts apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts
pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit
pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit
```

Expected: PASS.

- [ ] **Step 3: Run package and backend builds required for backend/package changes**

Run:

```bash
pnpm build:lib
pnpm --dir apps/backend/agent-server build
```

Expected: PASS.

- [ ] **Step 4: Run docs and governance checks**

Run:

```bash
pnpm check:docs
pnpm check:barrel-layout
```

Expected: PASS.

- [ ] **Step 5: Run the final deleted-service scan**

Run:

```bash
rg -n "@agent/auth-server|@agent/knowledge-server|apps/backend/auth-server|apps/backend/knowledge-server|localhost:3010|localhost:3020|/api/auth|/knowledge/v1|auth-server|knowledge-server" apps packages agents scripts test docs README.md AGENTS.md package.json pnpm-lock.yaml pnpm-workspace.yaml
```

Expected: no current active-service references remain. Any remaining docs hit must explicitly say the content is historical or that the service was deleted.

- [ ] **Step 6: Review git status for unrelated worktree changes**

Run:

```bash
git status --short
```

Expected: hard-cut files are committed. Unrelated user changes may remain unstaged or staged by their owner; do not modify them.

- [ ] **Step 7: Produce final handoff**

Report:

```text
计划已完成。
已删除 standalone backend package 和 legacy agent-server knowledge module。
当前 canonical backend：apps/backend/agent-server。
Identity API：/api/identity/*。
Knowledge API：/api/knowledge/*。
验证命令：列出本任务实际执行且通过的命令。
剩余风险：只列 unrelated 工作区变更或外部环境 blocker。
```

## Self-Review

- Spec coverage: This remaining plan covers staged reference cleanup, Identity hard cut, Knowledge canonical coverage, deletion of `agent-server/src/knowledge`, frontend caller migration, docs/contracts cleanup, global stale-reference scan, and final verification.
- Placeholder scan: The plan avoids `TBD`, `TODO`, and open-ended implementation placeholders. Where existing function signatures may differ, the plan requires adapting to existing exports while preserving exact expected URLs and route semantics.
- Type consistency: Identity paths use `/identity/*`; Knowledge paths use `/knowledge/*`; frontend base URL is `http://127.0.0.1:3000/api`; deleted services have no replacement packages.
