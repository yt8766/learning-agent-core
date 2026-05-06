# Auth and Knowledge Service Completion Implementation Plan

状态：snapshot
文档类型：plan
适用范围：`apps/backend/auth-server`、`apps/backend/knowledge-server`、`apps/backend/agent-server`、`apps/frontend/agent-admin`、`apps/frontend/knowledge`、`docs/integration`
最后核对：2026-05-02

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining service-split work after the auth-server and knowledge-server MVP commits: isolate and commit the frontend service wiring, switch both NestJS services from in-memory repositories to PostgreSQL when configured, harden auth HTTP behavior, close the old knowledge path handoff, update docs, and verify the affected surfaces.

**Architecture:** Keep auth as a standalone NestJS service that owns login, refresh, logout, user management, sessions, and token issuance. Keep knowledge as a standalone NestJS service that owns knowledge base permissions and knowledge API endpoints. Frontends call these services directly through explicit service clients. Shared request/response contracts stay schema-first in `packages/core`; service runtime details stay inside each NestJS backend app.

**Tech Stack:** NestJS, TypeScript, Zod contracts in `@agent/core`, Vitest, PostgreSQL via repository adapters, React frontends for `agent-admin` and `knowledge`, pnpm workspace scripts.

---

## Current Baseline

Completed and already committed:

- Core auth and knowledge service contracts in `packages/core`.
- `apps/backend/auth-server` and `apps/backend/knowledge-server` NestJS app skeletons.
- Auth core logic, password hashing, JWT provider, sessions, refresh tokens, and in-memory tests.
- Auth PostgreSQL repository implementation and repository tests.
- Knowledge permission model and controller/service tests.
- Knowledge auth guard, token verifier, PostgreSQL repository implementation, and repository tests.
- Service split docs and outdated docs cleanup.

Remaining work:

- Frontend service wiring exists in the working tree but must be reviewed, isolated from pre-existing dirty changes, verified, staged, and committed.
- `AuthModule` still binds `InMemoryAuthRepository`; it must switch to PostgreSQL when `DATABASE_URL` is configured.
- `KnowledgeModule` still binds `InMemoryKnowledgeRepository`; it must switch to PostgreSQL when `DATABASE_URL` is configured.
- Auth HTTP behavior needs `/auth/me`, `/auth/logout`, guarded user-management endpoints, and stable error mapping.
- Knowledge service needs a clear legacy handoff from old `agent-server` knowledge paths to the new standalone service.
- Docs and verification need final affected-surface closure.

## File Structure

Files to create or modify:

```text
apps/backend/auth-server/
├─ src/auth/
│  ├─ auth.controller.ts
│  ├─ auth.guard.ts
│  ├─ auth.module.ts
│  ├─ auth.service.ts
│  ├─ decorators/auth-user.decorator.ts
│  ├─ filters/auth-exception.filter.ts
│  ├─ guards/auth-admin.guard.ts
│  ├─ jwt.provider.ts
│  ├─ repositories/auth-postgres.repository.ts
│  └─ runtime/
│     ├─ auth-database.provider.ts
│     ├─ auth-repository.provider.ts
│     └─ auth-schema.sql.ts
└─ test/auth/
   ├─ auth-http-behavior.test.ts
   └─ auth-repository-provider.test.ts

apps/backend/knowledge-server/
├─ src/knowledge/
│  ├─ knowledge.module.ts
│  ├─ repositories/knowledge-postgres.repository.ts
│  └─ runtime/
│     ├─ knowledge-database.provider.ts
│     ├─ knowledge-repository.provider.ts
│     └─ knowledge-schema.sql.ts
└─ test/knowledge/
   └─ knowledge-repository-provider.test.ts

apps/frontend/agent-admin/
├─ src/features/auth/
├─ src/features/identity/
└─ test/features/

apps/frontend/knowledge/
├─ src/api/
├─ src/features/auth/
└─ test/

docs/apps/backend/auth-server/
docs/apps/backend/knowledge-server/
docs/integration/
```

---

## Task 1: Isolate and Commit Frontend Service Wiring

**Purpose:** The frontend code for calling standalone auth and knowledge services was implemented in a dirty working tree. Review it carefully, keep only the intended service wiring, verify it, and commit it separately.

**Files:**

- `apps/frontend/agent-admin/src/features/auth/api/admin-auth.api.ts`
- `apps/frontend/agent-admin/src/features/auth/stores/admin-auth-store.ts`
- `apps/frontend/agent-admin/src/features/identity/api/auth-service-client.ts`
- `apps/frontend/agent-admin/src/features/identity/pages/users-page.tsx`
- `apps/frontend/agent-admin/src/app/admin-routes.tsx`
- `apps/frontend/agent-admin/test/features/auth/admin-auth-store.test.ts`
- `apps/frontend/agent-admin/test/features/identity/users-page.test.tsx`
- `apps/frontend/knowledge/src/api/auth-client.ts`
- `apps/frontend/knowledge/src/api/knowledge-api-client.ts`
- `apps/frontend/knowledge/src/api/knowledge-api-provider.tsx`
- `apps/frontend/knowledge/src/api/token-storage.ts`
- `apps/frontend/knowledge/src/features/auth/auth-provider.tsx`
- `apps/frontend/knowledge/src/main.tsx`
- `apps/frontend/knowledge/src/types/api.ts`
- `apps/frontend/knowledge/test/auth-client.test.ts`
- `apps/frontend/knowledge/test/knowledge-api-client.test.ts`
- `apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts`

### Steps

- [ ] Inspect the dirty tree before staging.

```bash
git status --short
git diff -- apps/frontend/agent-admin apps/frontend/knowledge
```

- [ ] Confirm `agent-admin` login calls the standalone auth service base URL, not the old admin backend path. The client should preserve this shape:

```ts
const AUTH_SERVICE_BASE_URL = import.meta.env.VITE_AUTH_SERVICE_URL ?? 'http://127.0.0.1:3010';

export async function loginToAuthService(input: { email: string; password: string; project: 'admin' }) {
  const response = await fetch(`${AUTH_SERVICE_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(`auth_login_failed:${response.status}`);
  }

  return AuthLoginResponseSchema.parse(await response.json());
}
```

- [ ] Confirm `knowledge` frontend calls the standalone knowledge service base URL:

```ts
const KNOWLEDGE_SERVICE_BASE_URL = import.meta.env.VITE_KNOWLEDGE_SERVICE_URL ?? 'http://127.0.0.1:3020';

export function createKnowledgeApiClient(tokenStorage: TokenStorage) {
  return {
    async listBases() {
      const response = await fetch(`${KNOWLEDGE_SERVICE_BASE_URL}/api/knowledge/bases`, {
        headers: {
          authorization: `Bearer ${tokenStorage.getAccessToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`knowledge_list_bases_failed:${response.status}`);
      }

      return KnowledgeBaseListResponseSchema.parse(await response.json());
    }
  };
}
```

- [ ] Run focused frontend tests.

```bash
pnpm exec vitest run --config vitest.config.js \
  apps/frontend/agent-admin/test/features/auth/admin-auth-store.test.ts \
  apps/frontend/agent-admin/test/features/identity/users-page.test.tsx \
  apps/frontend/knowledge/test/auth-client.test.ts \
  apps/frontend/knowledge/test/knowledge-api-client.test.ts \
  apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts
```

Expected output:

```text
Test Files  5 passed
Tests       all passed
```

- [ ] Run affected frontend type checks.

```bash
pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit
pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit
```

Expected output:

```text
# no TypeScript errors
```

- [ ] Stage only reviewed frontend service-wiring files.

```bash
git add \
  apps/frontend/agent-admin/src/features/auth \
  apps/frontend/agent-admin/src/features/identity \
  apps/frontend/agent-admin/src/app/admin-routes.tsx \
  apps/frontend/agent-admin/test/features/auth \
  apps/frontend/agent-admin/test/features/identity \
  apps/frontend/knowledge/src/api \
  apps/frontend/knowledge/src/features/auth \
  apps/frontend/knowledge/src/main.tsx \
  apps/frontend/knowledge/src/types/api.ts \
  apps/frontend/knowledge/test/auth-client.test.ts \
  apps/frontend/knowledge/test/knowledge-api-client.test.ts \
  apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts
```

- [ ] Review the staged diff before committing.

```bash
git diff --cached
```

- [ ] Commit after the review is clean.

```bash
git commit -m "feat: wire frontends to auth and knowledge services"
```

---

## Task 2: Switch Auth Server to PostgreSQL When Configured

**Purpose:** `auth-server` has both in-memory and PostgreSQL repositories, but `AuthModule` always uses memory. Add an explicit runtime provider that chooses PostgreSQL when `DATABASE_URL` exists and memory otherwise.

**Files:**

- `apps/backend/auth-server/src/auth/auth.module.ts`
- `apps/backend/auth-server/src/auth/runtime/auth-database.provider.ts`
- `apps/backend/auth-server/src/auth/runtime/auth-repository.provider.ts`
- `apps/backend/auth-server/src/auth/runtime/auth-schema.sql.ts`
- `apps/backend/auth-server/test/auth/auth-repository-provider.test.ts`
- `apps/backend/auth-server/package.json`
- `pnpm-lock.yaml`

### Steps

- [ ] Add the missing PostgreSQL type dependency if the package does not already have it.

```bash
pnpm add -D --dir apps/backend/auth-server @types/pg
```

- [ ] Add the provider test first.

```ts
import { describe, expect, it } from 'vitest';

import { createAuthRepositoryProvider } from '../../src/auth/runtime/auth-repository.provider';
import { InMemoryAuthRepository } from '../../src/auth/repositories/auth-memory.repository';
import { PostgresAuthRepository } from '../../src/auth/repositories/auth-postgres.repository';

describe('createAuthRepositoryProvider', () => {
  it('uses memory when DATABASE_URL is absent', async () => {
    const provider = createAuthRepositoryProvider({ databaseUrl: undefined });
    const repository = await provider.useFactory();

    expect(repository).toBeInstanceOf(InMemoryAuthRepository);
  });

  it('uses postgres when DATABASE_URL is configured', async () => {
    const provider = createAuthRepositoryProvider({
      databaseUrl: 'postgres://user:pass@localhost:5432/auth',
      createPool: () => ({ query: async () => ({ rows: [] }) })
    });
    const repository = await provider.useFactory();

    expect(repository).toBeInstanceOf(PostgresAuthRepository);
  });
});
```

- [ ] Add the SQL bootstrap string.

```ts
export const AUTH_SCHEMA_SQL = `
create table if not exists auth_users (
  id text primary key,
  email text not null unique,
  display_name text not null,
  password_hash text not null,
  status text not null,
  roles jsonb not null default '[]'::jsonb,
  projects jsonb not null default '[]'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists auth_sessions (
  id text primary key,
  user_id text not null references auth_users(id) on delete cascade,
  project text not null,
  refresh_token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
`;
```

- [ ] Add the database provider.

```ts
import pg from 'pg';

export interface AuthDatabaseProviderOptions {
  databaseUrl: string;
}

export function createAuthDatabasePool(options: AuthDatabaseProviderOptions) {
  return new pg.Pool({
    connectionString: options.databaseUrl
  });
}
```

- [ ] Add the repository provider.

```ts
import type { Provider } from '@nestjs/common';

import { AUTH_REPOSITORY } from '../auth.module';
import { InMemoryAuthRepository } from '../repositories/auth-memory.repository';
import { PostgresAuthRepository } from '../repositories/auth-postgres.repository';
import { createAuthDatabasePool } from './auth-database.provider';

export interface AuthRepositoryProviderOptions {
  databaseUrl?: string;
  createPool?: () => ConstructorParameters<typeof PostgresAuthRepository>[0];
}

export function createAuthRepositoryProvider(options: AuthRepositoryProviderOptions): Provider {
  return {
    provide: AUTH_REPOSITORY,
    useFactory: () => {
      if (!options.databaseUrl) {
        return new InMemoryAuthRepository();
      }

      const pool = options.createPool?.() ?? createAuthDatabasePool({ databaseUrl: options.databaseUrl });
      return new PostgresAuthRepository(pool);
    }
  };
}
```

- [ ] Update `AuthModule` to use the provider.

```ts
providers: [
  PasswordHasherProvider,
  {
    provide: JwtProvider,
    useFactory: () =>
      new JwtProvider({
        secret: process.env.AUTH_SERVER_JWT_SECRET ?? "local-dev-auth-secret",
        issuer: "auth-server"
      })
  },
  createAuthRepositoryProvider({ databaseUrl: process.env.DATABASE_URL }),
  ...
]
```

- [ ] Run tests and type checks.

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/auth-server/test/auth/auth-repository-provider.test.ts
pnpm exec tsc -p apps/backend/auth-server/tsconfig.json --noEmit
```

Expected output:

```text
Test Files  1 passed
# no TypeScript errors
```

---

## Task 3: Harden Auth HTTP Behavior

**Purpose:** Make auth-server HTTP behavior match a real service boundary: `/auth/me` returns the current user, `/auth/logout` revokes refresh sessions, user management is guarded, and service errors map to stable response payloads.

**Files:**

- `apps/backend/auth-server/src/auth/auth.controller.ts`
- `apps/backend/auth-server/src/auth/auth.guard.ts`
- `apps/backend/auth-server/src/auth/auth.service.ts`
- `apps/backend/auth-server/src/auth/decorators/auth-user.decorator.ts`
- `apps/backend/auth-server/src/auth/filters/auth-exception.filter.ts`
- `apps/backend/auth-server/src/auth/guards/auth-admin.guard.ts`
- `apps/backend/auth-server/src/auth/jwt.provider.ts`
- `apps/backend/auth-server/src/auth/user-management.controller.ts`
- `apps/backend/auth-server/test/auth/auth-http-behavior.test.ts`

### Steps

- [ ] Add behavior tests first.

```ts
import { describe, expect, it } from 'vitest';

import { AuthService } from '../../src/auth/auth.service';
import { JwtProvider } from '../../src/auth/jwt.provider';
import { PasswordHasherProvider } from '../../src/auth/password-hasher.provider';
import { InMemoryAuthRepository } from '../../src/auth/repositories/auth-memory.repository';
import { UserManagementService } from '../../src/auth/user-management.service';

describe('auth HTTP behavior backing service', () => {
  it('returns current user from an issued access token', async () => {
    const repository = new InMemoryAuthRepository();
    const hasher = new PasswordHasherProvider();
    const jwt = new JwtProvider({ secret: 'test-secret', issuer: 'auth-server' });
    const users = new UserManagementService(repository, hasher);
    const auth = new AuthService(repository, hasher, jwt);

    await users.createUser({
      email: 'admin@example.com',
      displayName: 'Admin',
      password: 'secret-123',
      roles: ['admin'],
      projects: ['admin', 'knowledge']
    });

    const login = await auth.login({
      email: 'admin@example.com',
      password: 'secret-123',
      project: 'admin'
    });

    const me = await auth.getCurrentUser(login.accessToken);

    expect(me.user.email).toBe('admin@example.com');
    expect(me.user.projects).toContain('admin');
  });

  it('revokes refresh token sessions on logout', async () => {
    const repository = new InMemoryAuthRepository();
    const hasher = new PasswordHasherProvider();
    const jwt = new JwtProvider({ secret: 'test-secret', issuer: 'auth-server' });
    const users = new UserManagementService(repository, hasher);
    const auth = new AuthService(repository, hasher, jwt);

    await users.createUser({
      email: 'admin@example.com',
      displayName: 'Admin',
      password: 'secret-123',
      roles: ['admin'],
      projects: ['admin']
    });

    const login = await auth.login({
      email: 'admin@example.com',
      password: 'secret-123',
      project: 'admin'
    });

    await auth.logout({ refreshToken: login.refreshToken });

    await expect(auth.refresh({ refreshToken: login.refreshToken })).rejects.toMatchObject({
      code: 'refresh_token_invalid'
    });
  });
});
```

- [ ] Extend access token payloads with a stable session id.

```ts
export interface AuthJwtPayload {
  sub: string;
  sid: string;
  project: string;
  roles: string[];
  aud: string;
  iss: string;
}
```

- [ ] Add current-user and logout methods to `AuthService`.

```ts
async getCurrentUser(accessToken: string) {
  const payload = await this.jwt.verifyAccessToken(accessToken);
  const user = await this.repository.findUserById(payload.sub);
  const session = await this.repository.findSessionById(payload.sid);

  if (!user || !session || session.revokedAt || session.userId !== user.id) {
    throw new AuthServiceError("access_token_invalid", "Access token is no longer valid.");
  }

  return {
    user: this.toUserDto(user),
    project: payload.project,
    sessionId: session.id
  };
}

async logout(input: { refreshToken: string }) {
  const session = await this.repository.findSessionByRefreshTokenHash(
    await this.hasher.hashToken(input.refreshToken)
  );

  if (session) {
    await this.repository.revokeSession(session.id, new Date());
  }

  return { ok: true };
}
```

- [ ] Add an `@AuthUser()` decorator for guarded controllers.

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const AuthUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<{ authUser?: unknown }>();
  return request.authUser;
});
```

- [ ] Update `AuthGuard` to attach verified payload to the request.

```ts
const payload = await this.jwt.verifyAccessToken(token);
request.authUser = payload;
return true;
```

- [ ] Guard current-user and user-management endpoints.

```ts
@UseGuards(AuthGuard)
@Get("me")
me(@AuthUser() user: AuthJwtPayload) {
  return this.authService.getCurrentUserFromPayload(user);
}

@UseGuards(AuthGuard, AuthAdminGuard)
@Controller("auth/users")
export class UserManagementController {}
```

- [ ] Add stable error mapping.

```ts
export function toAuthHttpError(error: AuthServiceError) {
  const statusByCode: Record<string, number> = {
    invalid_credentials: 401,
    access_token_invalid: 401,
    refresh_token_invalid: 401,
    insufficient_role: 403,
    user_already_exists: 409
  };

  return {
    status: statusByCode[error.code] ?? 400,
    body: {
      error: {
        code: error.code,
        message: error.message
      }
    }
  };
}
```

- [ ] Run focused auth tests and type checks.

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/auth-server/test/auth
pnpm exec tsc -p apps/backend/auth-server/tsconfig.json --noEmit
```

Expected output:

```text
Test Files  all passed
# no TypeScript errors
```

---

## Task 4: Switch Knowledge Server to PostgreSQL When Configured

**Purpose:** `knowledge-server` has a PostgreSQL repository but still always uses memory. Add an explicit provider and SQL bootstrap string that mirrors the auth-server runtime pattern.

**Files:**

- `apps/backend/knowledge-server/src/knowledge/knowledge.module.ts`
- `apps/backend/knowledge-server/src/knowledge/runtime/knowledge-database.provider.ts`
- `apps/backend/knowledge-server/src/knowledge/runtime/knowledge-repository.provider.ts`
- `apps/backend/knowledge-server/src/knowledge/runtime/knowledge-schema.sql.ts`
- `apps/backend/knowledge-server/test/knowledge/knowledge-repository-provider.test.ts`
- `apps/backend/knowledge-server/package.json`
- `pnpm-lock.yaml`

### Steps

- [ ] Add the missing PostgreSQL type dependency if the package does not already have it.

```bash
pnpm add -D --dir apps/backend/knowledge-server @types/pg
```

- [ ] Add the provider test first.

```ts
import { describe, expect, it } from 'vitest';

import { createKnowledgeRepositoryProvider } from '../../src/knowledge/runtime/knowledge-repository.provider';
import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';
import { PostgresKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-postgres.repository';

describe('createKnowledgeRepositoryProvider', () => {
  it('uses memory when DATABASE_URL is absent', async () => {
    const provider = createKnowledgeRepositoryProvider({ databaseUrl: undefined });
    const repository = await provider.useFactory();

    expect(repository).toBeInstanceOf(InMemoryKnowledgeRepository);
  });

  it('uses postgres when DATABASE_URL is configured', async () => {
    const provider = createKnowledgeRepositoryProvider({
      databaseUrl: 'postgres://user:pass@localhost:5432/knowledge',
      createPool: () => ({ query: async () => ({ rows: [] }) })
    });
    const repository = await provider.useFactory();

    expect(repository).toBeInstanceOf(PostgresKnowledgeRepository);
  });
});
```

- [ ] Add the SQL bootstrap string.

```ts
export const KNOWLEDGE_SCHEMA_SQL = `
create table if not exists knowledge_bases (
  id text primary key,
  title text not null,
  description text not null,
  visibility text not null,
  owner_user_id text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists knowledge_base_members (
  base_id text not null references knowledge_bases(id) on delete cascade,
  user_id text not null,
  role text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (base_id, user_id)
);
`;
```

- [ ] Add runtime providers.

```ts
import pg from 'pg';

export function createKnowledgeDatabasePool(options: { databaseUrl: string }) {
  return new pg.Pool({
    connectionString: options.databaseUrl
  });
}
```

```ts
import type { Provider } from '@nestjs/common';

import { KNOWLEDGE_REPOSITORY } from '../knowledge.module';
import { InMemoryKnowledgeRepository } from '../repositories/knowledge-memory.repository';
import { PostgresKnowledgeRepository } from '../repositories/knowledge-postgres.repository';
import { createKnowledgeDatabasePool } from './knowledge-database.provider';

export function createKnowledgeRepositoryProvider(options: {
  databaseUrl?: string;
  createPool?: () => ConstructorParameters<typeof PostgresKnowledgeRepository>[0];
}): Provider {
  return {
    provide: KNOWLEDGE_REPOSITORY,
    useFactory: () => {
      if (!options.databaseUrl) {
        return new InMemoryKnowledgeRepository();
      }

      const pool = options.createPool?.() ?? createKnowledgeDatabasePool({ databaseUrl: options.databaseUrl });
      return new PostgresKnowledgeRepository(pool);
    }
  };
}
```

- [ ] Update `KnowledgeModule`.

```ts
providers: [
  createKnowledgeRepositoryProvider({ databaseUrl: process.env.DATABASE_URL }),
  {
    provide: KnowledgeService,
    useFactory: (repository: KnowledgeRepository) => new KnowledgeService(repository),
    inject: [KNOWLEDGE_REPOSITORY]
  },
  ...
]
```

- [ ] Run focused knowledge tests and type checks.

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge
pnpm exec tsc -p apps/backend/knowledge-server/tsconfig.json --noEmit
```

Expected output:

```text
Test Files  all passed
# no TypeScript errors
```

---

## Task 5: Close the Legacy Knowledge Path Handoff

**Purpose:** The standalone knowledge-server is the new frontend-facing service. The old `agent-server` knowledge paths should either be explicitly marked as legacy/internal or removed from frontend defaults so future work does not reconnect to the wrong service.

**Files:**

- `apps/backend/agent-server/src/knowledge/*`
- `docs/apps/backend/agent-server/*`
- `docs/apps/backend/knowledge-server/knowledge-server.md`
- `docs/integration/frontend-backend-integration.md`

### Steps

- [ ] Search for old frontend-facing knowledge URLs.

```bash
rg "agent-server|/api/knowledge|knowledge-server|VITE_KNOWLEDGE" apps/frontend apps/backend docs
```

- [ ] Ensure frontend defaults point to the standalone service.

```ts
const KNOWLEDGE_SERVICE_BASE_URL = import.meta.env.VITE_KNOWLEDGE_SERVICE_URL ?? 'http://127.0.0.1:3020';
```

- [ ] Mark old `agent-server` knowledge endpoints as internal legacy if they still serve runtime-owned behavior.

```md
> Status: legacy internal path.
> New frontend-facing knowledge API calls must use `apps/backend/knowledge-server`.
> Do not add new UI integration to `apps/backend/agent-server/src/knowledge`.
```

- [ ] If an old route has no caller and duplicates the standalone service, delete the route and its dead tests in the same task.

```bash
rg "KnowledgeController|knowledge.controller|KnowledgeService" apps/backend/agent-server apps/frontend docs
```

- [ ] Add or update a doc section that defines the split.

```md
## Knowledge Service Boundary

- `apps/backend/knowledge-server` owns frontend-facing knowledge base APIs.
- `apps/backend/agent-server` may keep runtime-internal knowledge retrieval only when it is called by agent execution.
- Frontends must not call `agent-server` for knowledge base CRUD.
```

- [ ] Run affected checks.

```bash
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm check:docs
```

Expected output:

```text
# no TypeScript errors
docs ok
```

---

## Task 6: Final Docs, Cleanup, and Verification

**Purpose:** Close the plan with accurate docs, stale-doc cleanup, and affected verification evidence.

**Files:**

- `docs/apps/backend/auth-server/auth-server.md`
- `docs/apps/backend/knowledge-server/knowledge-server.md`
- `docs/integration/frontend-backend-integration.md`
- `docs/superpowers/plans/2026-05-02-auth-knowledge-service-completion.md`

### Steps

- [ ] Update auth-server docs with runtime selection.

```md
## Runtime Repository Selection

- Without `DATABASE_URL`, auth-server uses `InMemoryAuthRepository` for local MVP runs.
- With `DATABASE_URL`, auth-server uses `PostgresAuthRepository`.
- `AUTH_SERVER_JWT_SECRET` must match the knowledge-server verifier secret when knowledge accepts auth-server tokens.
```

- [ ] Update knowledge-server docs with runtime selection.

```md
## Runtime Repository Selection

- Without `DATABASE_URL`, knowledge-server uses `InMemoryKnowledgeRepository`.
- With `DATABASE_URL`, knowledge-server uses `PostgresKnowledgeRepository`.
- Knowledge requests require auth-server access tokens whose audience includes `knowledge`.
```

- [ ] Update integration docs with local ports.

```md
## Local Service Ports

- auth-server: `http://127.0.0.1:3010`
- knowledge-server: `http://127.0.0.1:3020`
- agent-admin calls auth-server for login and user management.
- knowledge frontend calls auth-server for login and knowledge-server for knowledge APIs.
```

- [ ] Run the full affected verification set.

```bash
pnpm exec vitest run --config vitest.config.js \
  packages/core/test/auth-knowledge-service-contracts.test.ts \
  apps/backend/auth-server/test \
  apps/backend/knowledge-server/test \
  apps/frontend/agent-admin/test/features/auth/admin-auth-store.test.ts \
  apps/frontend/agent-admin/test/features/identity/users-page.test.tsx \
  apps/frontend/knowledge/test/auth-client.test.ts \
  apps/frontend/knowledge/test/knowledge-api-client.test.ts \
  apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts
```

Expected output:

```text
Test Files  all passed
Tests       all passed
```

- [ ] Run affected type checks.

```bash
pnpm exec tsc -p packages/core/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/auth-server/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/knowledge-server/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit
pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit
```

Expected output:

```text
# no TypeScript errors
```

- [ ] Run package and docs checks required by the touched scope.

```bash
pnpm build:lib
pnpm --dir apps/backend/agent-server build
pnpm check:docs
```

Expected output:

```text
build completed
docs ok
```

- [ ] Review the final diff.

```bash
git status --short
git diff
```

- [ ] Commit the backend runtime, docs, and cleanup work after review.

```bash
git add \
  apps/backend/auth-server \
  apps/backend/knowledge-server \
  apps/backend/agent-server \
  docs/apps/backend \
  docs/integration \
  pnpm-lock.yaml

git diff --cached
git commit -m "feat: complete auth and knowledge service split"
```

---

## Completion Criteria

- `agent-admin` login and user management call `auth-server`.
- `knowledge` frontend login calls `auth-server` and knowledge APIs call `knowledge-server`.
- `auth-server` uses PostgreSQL when `DATABASE_URL` is configured and memory otherwise.
- `knowledge-server` uses PostgreSQL when `DATABASE_URL` is configured and memory otherwise.
- `/auth/me` returns the current authenticated user.
- `/auth/logout` revokes refresh-token sessions.
- `/auth/users` endpoints are guarded for admin use.
- Old `agent-server` knowledge frontend paths are removed or explicitly marked as legacy/internal.
- Docs describe the actual service boundaries, ports, auth expectations, and repository selection.
- Focused tests, affected TypeScript checks, `pnpm build:lib`, `pnpm --dir apps/backend/agent-server build`, and `pnpm check:docs` pass or record a blocker unrelated to this work.
