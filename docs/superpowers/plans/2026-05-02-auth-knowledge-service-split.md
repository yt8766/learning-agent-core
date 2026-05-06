# Auth Knowledge Service Split Implementation Plan

状态：snapshot
文档类型：plan
适用范围：`apps/backend/auth-server`、`apps/backend/knowledge-server`、`apps/frontend/agent-admin`、`apps/frontend/knowledge`、`packages/core`
最后核对：2026-05-02

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build independent NestJS `auth-server` and `knowledge-server` apps so `agent-admin` and `knowledge` can share direct login while knowledge keeps its own permission model.

**Architecture:** Define schema-first contracts first, then add two PostgreSQL-backed NestJS apps with focused modules and repository boundaries. `auth-server` owns identity, sessions, users, and tokens; `knowledge-server` trusts auth JWT identity claims and owns knowledge base membership permissions. Frontends call the new services directly while existing `agent-server` routes remain as short-term compatibility until cleanup.

**Tech Stack:** TypeScript, NestJS, Zod, PostgreSQL `pg`, Vitest, React/Vite, pnpm workspace.

---

## Source Spec

- Design spec: `docs/superpowers/specs/2026-05-02-auth-and-knowledge-service-split-design.md`
- Repository rule: do not use `git worktree`; execute in the current checkout only.

## Scope Check

The spec spans two backend apps, two frontends, and shared contracts. This plan keeps the first implementation horizontal: authentication, user management, knowledge base membership, and frontend wiring. Full RAG, upload parsing, vector retrieval, OIDC, and `agent-chat` login are outside this implementation plan.

## File Structure

Create:

- `packages/core/src/contracts/auth-service/auth-service.schemas.ts`  
  Stable Zod schemas for login, refresh, user management, token responses, and auth errors.
- `packages/core/src/contracts/auth-service/auth-service.types.ts`  
  Types inferred from auth service schemas.
- `packages/core/src/contracts/auth-service/index.ts`  
  Auth service contract barrel.
- `packages/core/src/contracts/knowledge-service/knowledge-service.schemas.ts`  
  Stable Zod schemas for knowledge service identity projection, base, member, and errors.
- `packages/core/src/contracts/knowledge-service/knowledge-service.types.ts`  
  Types inferred from knowledge service schemas.
- `packages/core/src/contracts/knowledge-service/index.ts`  
  Knowledge service contract barrel.
- `apps/backend/auth-server/package.json`  
  Workspace manifest and scripts for the new NestJS auth app.
- `apps/backend/auth-server/tsconfig.json`  
  TypeScript project config.
- `apps/backend/auth-server/tsconfig.build.json`  
  Build config.
- `apps/backend/auth-server/nest-cli.json`  
  Nest CLI config.
- `apps/backend/auth-server/src/main.ts`  
  Bootstrap with global `/api` prefix and CORS.
- `apps/backend/auth-server/src/app.module.ts`  
  Root module.
- `apps/backend/auth-server/src/auth/auth.controller.ts`  
  Login, refresh, logout, and `/me` controller.
- `apps/backend/auth-server/src/auth/auth.service.ts`  
  Auth flow orchestration and token/session lifecycle.
- `apps/backend/auth-server/src/auth/user-management.controller.ts`  
  Admin user-management controller.
- `apps/backend/auth-server/src/auth/user-management.service.ts`  
  User list/create/update/enable/disable/reset-password service.
- `apps/backend/auth-server/src/auth/auth.errors.ts`  
  Stable HTTP error mapping.
- `apps/backend/auth-server/src/auth/auth.module.ts`  
  Auth feature module.
- `apps/backend/auth-server/src/auth/auth.guard.ts`  
  Bearer token guard for management endpoints.
- `apps/backend/auth-server/src/auth/jwt.provider.ts`  
  Minimal project-owned JWT provider facade.
- `apps/backend/auth-server/src/auth/password-hasher.provider.ts`  
  Password hash/verify provider.
- `apps/backend/auth-server/src/auth/repositories/auth.repository.ts`  
  Repository interface.
- `apps/backend/auth-server/src/auth/repositories/auth-memory.repository.ts`  
  In-memory repository for unit tests and local no-DB fallback.
- `apps/backend/auth-server/src/auth/repositories/auth-postgres.repository.ts`  
  PostgreSQL repository.
- `apps/backend/auth-server/test/auth/auth-contract.spec.ts`  
  Contract parse regression tests.
- `apps/backend/auth-server/test/auth/auth-service.spec.ts`  
  Auth service unit tests.
- `apps/backend/auth-server/test/auth/user-management.spec.ts`  
  User management unit tests.
- `apps/backend/knowledge-server/package.json`  
  Workspace manifest and scripts for the new NestJS knowledge app.
- `apps/backend/knowledge-server/tsconfig.json`  
  TypeScript project config.
- `apps/backend/knowledge-server/tsconfig.build.json`  
  Build config.
- `apps/backend/knowledge-server/nest-cli.json`  
  Nest CLI config.
- `apps/backend/knowledge-server/src/main.ts`  
  Bootstrap with global `/api` prefix and CORS.
- `apps/backend/knowledge-server/src/app.module.ts`  
  Root module.
- `apps/backend/knowledge-server/src/auth/auth-token-verifier.ts`  
  Auth JWT verification facade for knowledge service.
- `apps/backend/knowledge-server/src/auth/auth-user.decorator.ts`  
  Current auth user decorator.
- `apps/backend/knowledge-server/src/auth/auth.guard.ts`  
  Knowledge bearer token guard.
- `apps/backend/knowledge-server/src/knowledge/knowledge.controller.ts`  
  Knowledge base and member API.
- `apps/backend/knowledge-server/src/knowledge/knowledge.service.ts`  
  Knowledge permissions and API orchestration.
- `apps/backend/knowledge-server/src/knowledge/knowledge.errors.ts`  
  Stable error mapping.
- `apps/backend/knowledge-server/src/knowledge/knowledge.module.ts`  
  Knowledge feature module.
- `apps/backend/knowledge-server/src/knowledge/repositories/knowledge.repository.ts`  
  Repository interface.
- `apps/backend/knowledge-server/src/knowledge/repositories/knowledge-memory.repository.ts`  
  In-memory repository for unit tests.
- `apps/backend/knowledge-server/src/knowledge/repositories/knowledge-postgres.repository.ts`  
  PostgreSQL repository.
- `apps/backend/knowledge-server/test/knowledge/knowledge-contract.spec.ts`  
  Contract parse regression tests.
- `apps/backend/knowledge-server/test/knowledge/knowledge-permissions.spec.ts`  
  Knowledge membership permission tests.
- `apps/backend/knowledge-server/test/knowledge/knowledge-http.spec.ts`  
  Minimal HTTP behavior tests.
- `apps/frontend/agent-admin/src/features/identity/api/auth-service-client.ts`  
  Client for auth service user-management APIs.
- `apps/frontend/agent-admin/src/features/identity/pages/users-page.tsx`  
  User management page.
- `apps/frontend/agent-admin/test/features/identity/users-page.test.tsx`  
  User management UI test.
- `docs/contracts/api/auth.md`  
  New auth service API reference.
- `docs/apps/backend/auth-server/README.md`  
  Auth service index.
- `docs/apps/backend/auth-server/auth-server.md`  
  Auth server architecture and local operation notes.
- `docs/apps/backend/knowledge-server/README.md`  
  Knowledge service index.
- `docs/apps/backend/knowledge-server/knowledge-server.md`  
  Knowledge server architecture and permission notes.

Modify:

- `packages/core/src/contracts/index.ts`  
  Export auth and knowledge service contracts.
- `packages/core/src/index.ts`  
  Re-export new contract modules if current public entrypoint requires explicit export.
- `package.json`  
  Add workspace scripts for new service checks if the root already centralizes app scripts.
- `pnpm-lock.yaml`  
  Update immediately after adding workspace manifests or dependencies.
- `apps/frontend/agent-admin/src/features/auth/api/admin-auth.api.ts`  
  Point admin login at `auth-server`.
- `apps/frontend/agent-admin/src/features/auth/store/admin-auth-store.ts`  
  Consume unified auth response shape.
- `apps/frontend/agent-admin/src/app/admin-routes.tsx` or `apps/frontend/agent-admin/src/app/app.tsx`  
  Add user management route.
- `apps/frontend/knowledge/src/api/auth-client.ts`  
  Point knowledge login at `auth-server`.
- `apps/frontend/knowledge/src/api/knowledge-api-client.ts`  
  Point knowledge business API at `knowledge-server`.
- `docs/contracts/api/knowledge.md`  
  Mark `knowledge-server` as canonical for knowledge business APIs.
- `docs/integration/frontend-backend-integration.md`  
  Document direct frontend-to-service calls.
- `docs/apps/frontend/agent-admin/admin-auth.md`  
  Document unified login and user management.
- `docs/apps/frontend/knowledge/knowledge-frontend.md`  
  Document auth-server + knowledge-server wiring.

## Task 1: Add Stable Auth And Knowledge Service Contracts

**Files:**

- Create: `packages/core/src/contracts/auth-service/auth-service.schemas.ts`
- Create: `packages/core/src/contracts/auth-service/auth-service.types.ts`
- Create: `packages/core/src/contracts/auth-service/index.ts`
- Create: `packages/core/src/contracts/knowledge-service/knowledge-service.schemas.ts`
- Create: `packages/core/src/contracts/knowledge-service/knowledge-service.types.ts`
- Create: `packages/core/src/contracts/knowledge-service/index.ts`
- Modify: `packages/core/src/contracts/index.ts`
- Test: `packages/core/test/auth-knowledge-service-contracts.test.ts`

- [ ] **Step 1: Write the failing contract test**

Create `packages/core/test/auth-knowledge-service-contracts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  AuthLoginResponseSchema,
  AuthUserCreateRequestSchema,
  KnowledgeBaseMemberSchema,
  KnowledgeBaseSchema
} from '../src/contracts';

describe('auth and knowledge service contracts', () => {
  it('parses auth login responses without business-domain permissions', () => {
    const parsed = AuthLoginResponseSchema.parse({
      account: {
        id: 'user_123',
        username: 'alice',
        displayName: 'Alice',
        roles: ['admin'],
        status: 'enabled'
      },
      session: {
        id: 'sess_123',
        expiresAt: '2026-05-30T12:00:00.000Z'
      },
      tokens: {
        tokenType: 'Bearer',
        accessToken: 'access.jwt.value',
        accessTokenExpiresAt: '2026-05-02T12:15:00.000Z',
        refreshToken: 'refresh-token',
        refreshTokenExpiresAt: '2026-05-30T12:00:00.000Z'
      }
    });

    expect(parsed.account.roles).toEqual(['admin']);
  });

  it('parses user creation requests for admin-managed identity', () => {
    expect(
      AuthUserCreateRequestSchema.parse({
        username: 'bob',
        displayName: 'Bob',
        password: 'local-password',
        roles: ['knowledge_user']
      })
    ).toMatchObject({ username: 'bob' });
  });

  it('parses knowledge bases and membership roles separately from auth roles', () => {
    expect(
      KnowledgeBaseSchema.parse({
        id: 'kb_123',
        name: 'Engineering KB',
        description: 'Internal engineering notes',
        createdByUserId: 'user_123',
        status: 'active',
        createdAt: '2026-05-02T12:00:00.000Z',
        updatedAt: '2026-05-02T12:00:00.000Z'
      })
    ).toMatchObject({ id: 'kb_123' });

    expect(
      KnowledgeBaseMemberSchema.parse({
        knowledgeBaseId: 'kb_123',
        userId: 'user_456',
        role: 'viewer',
        createdAt: '2026-05-02T12:00:00.000Z',
        updatedAt: '2026-05-02T12:00:00.000Z'
      })
    ).toMatchObject({ role: 'viewer' });
  });
});
```

- [ ] **Step 2: Run the contract test and verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/auth-knowledge-service-contracts.test.ts
```

Expected: FAIL because `AuthLoginResponseSchema`, `AuthUserCreateRequestSchema`, `KnowledgeBaseSchema`, or `KnowledgeBaseMemberSchema` is not exported.

- [ ] **Step 3: Add auth service schemas**

Create `packages/core/src/contracts/auth-service/auth-service.schemas.ts`:

```ts
import { z } from 'zod';

export const AuthGlobalRoleSchema = z.enum(['super_admin', 'admin', 'developer', 'knowledge_user']);
export const AuthUserStatusSchema = z.enum(['enabled', 'disabled']);

export const AuthAccountSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  displayName: z.string().min(1),
  roles: z.array(AuthGlobalRoleSchema),
  status: AuthUserStatusSchema
});

export const AuthSessionSchema = z.object({
  id: z.string().min(1),
  expiresAt: z.string().datetime()
});

export const AuthTokenPairSchema = z.object({
  tokenType: z.literal('Bearer'),
  accessToken: z.string().min(1),
  accessTokenExpiresAt: z.string().datetime(),
  refreshToken: z.string().min(1),
  refreshTokenExpiresAt: z.string().datetime()
});

export const AuthLoginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  remember: z.boolean().optional().default(false)
});

export const AuthLoginResponseSchema = z.object({
  account: AuthAccountSchema,
  session: AuthSessionSchema,
  tokens: AuthTokenPairSchema
});

export const AuthRefreshRequestSchema = z.object({
  refreshToken: z.string().min(1)
});

export const AuthRefreshResponseSchema = z.object({
  tokens: AuthTokenPairSchema
});

export const AuthLogoutRequestSchema = z.object({
  refreshToken: z.string().min(1)
});

export const AuthMeResponseSchema = z.object({
  account: AuthAccountSchema
});

export const AuthUserCreateRequestSchema = z.object({
  username: z.string().min(1),
  displayName: z.string().min(1),
  password: z.string().min(8),
  roles: z.array(AuthGlobalRoleSchema).min(1)
});

export const AuthUserUpdateRequestSchema = z.object({
  displayName: z.string().min(1).optional(),
  roles: z.array(AuthGlobalRoleSchema).min(1).optional()
});

export const AuthResetPasswordRequestSchema = z.object({
  password: z.string().min(8),
  mustChangePassword: z.boolean().optional().default(true)
});

export const AuthUsersListResponseSchema = z.object({
  users: z.array(AuthAccountSchema)
});

export const AuthErrorCodeSchema = z.enum([
  'invalid_request',
  'invalid_credentials',
  'account_disabled',
  'access_token_missing',
  'access_token_expired',
  'access_token_invalid',
  'refresh_token_missing',
  'refresh_token_expired',
  'refresh_token_invalid',
  'refresh_token_reused',
  'session_revoked',
  'insufficient_role',
  'internal_error'
]);

export const AuthErrorResponseSchema = z.object({
  error: z.object({
    code: AuthErrorCodeSchema,
    message: z.string().min(1),
    requestId: z.string().min(1)
  })
});
```

- [ ] **Step 4: Add auth service types and barrel**

Create `packages/core/src/contracts/auth-service/auth-service.types.ts`:

```ts
import type { z } from 'zod';
import type {
  AuthAccountSchema,
  AuthErrorResponseSchema,
  AuthGlobalRoleSchema,
  AuthLoginRequestSchema,
  AuthLoginResponseSchema,
  AuthLogoutRequestSchema,
  AuthMeResponseSchema,
  AuthRefreshRequestSchema,
  AuthRefreshResponseSchema,
  AuthResetPasswordRequestSchema,
  AuthSessionSchema,
  AuthTokenPairSchema,
  AuthUserCreateRequestSchema,
  AuthUsersListResponseSchema,
  AuthUserStatusSchema,
  AuthUserUpdateRequestSchema
} from './auth-service.schemas';

export type AuthGlobalRole = z.infer<typeof AuthGlobalRoleSchema>;
export type AuthUserStatus = z.infer<typeof AuthUserStatusSchema>;
export type AuthAccount = z.infer<typeof AuthAccountSchema>;
export type AuthSession = z.infer<typeof AuthSessionSchema>;
export type AuthTokenPair = z.infer<typeof AuthTokenPairSchema>;
export type AuthLoginRequest = z.infer<typeof AuthLoginRequestSchema>;
export type AuthLoginResponse = z.infer<typeof AuthLoginResponseSchema>;
export type AuthRefreshRequest = z.infer<typeof AuthRefreshRequestSchema>;
export type AuthRefreshResponse = z.infer<typeof AuthRefreshResponseSchema>;
export type AuthLogoutRequest = z.infer<typeof AuthLogoutRequestSchema>;
export type AuthMeResponse = z.infer<typeof AuthMeResponseSchema>;
export type AuthUserCreateRequest = z.infer<typeof AuthUserCreateRequestSchema>;
export type AuthUserUpdateRequest = z.infer<typeof AuthUserUpdateRequestSchema>;
export type AuthResetPasswordRequest = z.infer<typeof AuthResetPasswordRequestSchema>;
export type AuthUsersListResponse = z.infer<typeof AuthUsersListResponseSchema>;
export type AuthErrorResponse = z.infer<typeof AuthErrorResponseSchema>;
```

Create `packages/core/src/contracts/auth-service/index.ts`:

```ts
export * from './auth-service.schemas';
export * from './auth-service.types';
```

- [ ] **Step 5: Add knowledge service schemas**

Create `packages/core/src/contracts/knowledge-service/knowledge-service.schemas.ts`:

```ts
import { z } from 'zod';

export const KnowledgeBaseStatusSchema = z.enum(['active', 'archived']);
export const KnowledgeBaseMemberRoleSchema = z.enum(['owner', 'editor', 'viewer']);

export const KnowledgeServiceUserSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  displayName: z.string().min(1)
});

export const KnowledgeBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  createdByUserId: z.string().min(1),
  status: KnowledgeBaseStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const KnowledgeBaseCreateRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default('')
});

export const KnowledgeBaseMemberSchema = z.object({
  knowledgeBaseId: z.string().min(1),
  userId: z.string().min(1),
  role: KnowledgeBaseMemberRoleSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const KnowledgeBaseMemberCreateRequestSchema = z.object({
  userId: z.string().min(1),
  role: KnowledgeBaseMemberRoleSchema
});

export const KnowledgeBaseMemberUpdateRequestSchema = z.object({
  role: KnowledgeBaseMemberRoleSchema
});

export const KnowledgeMeResponseSchema = z.object({
  user: KnowledgeServiceUserSchema
});

export const KnowledgeBasesListResponseSchema = z.object({
  bases: z.array(KnowledgeBaseSchema)
});

export const KnowledgeBaseResponseSchema = z.object({
  base: KnowledgeBaseSchema
});

export const KnowledgeBaseMembersResponseSchema = z.object({
  members: z.array(KnowledgeBaseMemberSchema)
});

export const KnowledgeServiceErrorCodeSchema = z.enum([
  'auth_required',
  'knowledge_base_not_found',
  'knowledge_permission_denied',
  'member_not_found',
  'invalid_member_role',
  'internal_error'
]);

export const KnowledgeServiceErrorResponseSchema = z.object({
  error: z.object({
    code: KnowledgeServiceErrorCodeSchema,
    message: z.string().min(1),
    requestId: z.string().min(1)
  })
});
```

- [ ] **Step 6: Add knowledge service types and exports**

Create `packages/core/src/contracts/knowledge-service/knowledge-service.types.ts`:

```ts
import type { z } from 'zod';
import type {
  KnowledgeBaseCreateRequestSchema,
  KnowledgeBaseMemberCreateRequestSchema,
  KnowledgeBaseMemberRoleSchema,
  KnowledgeBaseMemberSchema,
  KnowledgeBaseMembersResponseSchema,
  KnowledgeBaseMemberUpdateRequestSchema,
  KnowledgeBaseResponseSchema,
  KnowledgeBasesListResponseSchema,
  KnowledgeBaseSchema,
  KnowledgeBaseStatusSchema,
  KnowledgeMeResponseSchema,
  KnowledgeServiceErrorResponseSchema,
  KnowledgeServiceUserSchema
} from './knowledge-service.schemas';

export type KnowledgeBaseStatus = z.infer<typeof KnowledgeBaseStatusSchema>;
export type KnowledgeBaseMemberRole = z.infer<typeof KnowledgeBaseMemberRoleSchema>;
export type KnowledgeServiceUser = z.infer<typeof KnowledgeServiceUserSchema>;
export type KnowledgeBase = z.infer<typeof KnowledgeBaseSchema>;
export type KnowledgeBaseCreateRequest = z.infer<typeof KnowledgeBaseCreateRequestSchema>;
export type KnowledgeBaseMember = z.infer<typeof KnowledgeBaseMemberSchema>;
export type KnowledgeBaseMemberCreateRequest = z.infer<typeof KnowledgeBaseMemberCreateRequestSchema>;
export type KnowledgeBaseMemberUpdateRequest = z.infer<typeof KnowledgeBaseMemberUpdateRequestSchema>;
export type KnowledgeMeResponse = z.infer<typeof KnowledgeMeResponseSchema>;
export type KnowledgeBasesListResponse = z.infer<typeof KnowledgeBasesListResponseSchema>;
export type KnowledgeBaseResponse = z.infer<typeof KnowledgeBaseResponseSchema>;
export type KnowledgeBaseMembersResponse = z.infer<typeof KnowledgeBaseMembersResponseSchema>;
export type KnowledgeServiceErrorResponse = z.infer<typeof KnowledgeServiceErrorResponseSchema>;
```

Create `packages/core/src/contracts/knowledge-service/index.ts`:

```ts
export * from './knowledge-service.schemas';
export * from './knowledge-service.types';
```

Modify `packages/core/src/contracts/index.ts`:

```ts
export * from './auth-service';
export * from './knowledge-service';
```

Keep existing exports in the file; append these two lines rather than replacing the file.

- [ ] **Step 7: Run the contract test and typecheck**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/auth-knowledge-service-contracts.test.ts
pnpm exec tsc -p packages/core/tsconfig.json --noEmit
```

Expected: both commands pass.

- [ ] **Step 8: Commit contracts**

Run:

```bash
git add packages/core/src/contracts packages/core/test/auth-knowledge-service-contracts.test.ts
git commit -m "feat: add auth and knowledge service contracts"
```

## Task 2: Scaffold Independent NestJS Backend Apps

**Files:**

- Create: `apps/backend/auth-server/package.json`
- Create: `apps/backend/auth-server/tsconfig.json`
- Create: `apps/backend/auth-server/tsconfig.build.json`
- Create: `apps/backend/auth-server/nest-cli.json`
- Create: `apps/backend/auth-server/src/main.ts`
- Create: `apps/backend/auth-server/src/app.module.ts`
- Create: `apps/backend/auth-server/src/app.controller.ts`
- Create: `apps/backend/knowledge-server/package.json`
- Create: `apps/backend/knowledge-server/tsconfig.json`
- Create: `apps/backend/knowledge-server/tsconfig.build.json`
- Create: `apps/backend/knowledge-server/nest-cli.json`
- Create: `apps/backend/knowledge-server/src/main.ts`
- Create: `apps/backend/knowledge-server/src/app.module.ts`
- Create: `apps/backend/knowledge-server/src/app.controller.ts`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Create minimal health tests that fail**

Create `apps/backend/auth-server/test/app-health.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { AppController } from '../src/app.controller';
import { AppModule } from '../src/app.module';

describe('auth-server app health', () => {
  it('returns service identity', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const controller = moduleRef.get(AppController);

    expect(controller.health()).toEqual({ service: 'auth-server', status: 'ok' });
  });
});
```

Create `apps/backend/knowledge-server/test/app-health.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { AppController } from '../src/app.controller';
import { AppModule } from '../src/app.module';

describe('knowledge-server app health', () => {
  it('returns service identity', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const controller = moduleRef.get(AppController);

    expect(controller.health()).toEqual({ service: 'knowledge-server', status: 'ok' });
  });
});
```

- [ ] **Step 2: Run health tests and verify they fail**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/auth-server/test/app-health.spec.ts apps/backend/knowledge-server/test/app-health.spec.ts
```

Expected: FAIL because app modules and controllers do not exist.

- [ ] **Step 3: Add `auth-server` package files**

Create `apps/backend/auth-server/package.json`:

```json
{
  "name": "@agent/auth-server",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main.js",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "pnpm --dir ../../.. exec vitest run --config vitest.config.js apps/backend/auth-server/test"
  },
  "dependencies": {
    "@agent/core": "workspace:*",
    "@nestjs/common": "^11.0.1",
    "@nestjs/core": "^11.0.1",
    "@nestjs/platform-express": "^11.0.1",
    "pg": "^8.13.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/testing": "^11.0.1",
    "@types/node": "^22.10.7",
    "ts-loader": "^9.5.2",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0"
  }
}
```

Create `apps/backend/auth-server/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

Create `apps/backend/auth-server/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*.spec.ts"]
}
```

Create `apps/backend/auth-server/nest-cli.json`:

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src"
}
```

- [ ] **Step 4: Add `knowledge-server` package files**

Create `apps/backend/knowledge-server/package.json`:

```json
{
  "name": "@agent/knowledge-server",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main.js",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "pnpm --dir ../../.. exec vitest run --config vitest.config.js apps/backend/knowledge-server/test"
  },
  "dependencies": {
    "@agent/core": "workspace:*",
    "@nestjs/common": "^11.0.1",
    "@nestjs/core": "^11.0.1",
    "@nestjs/platform-express": "^11.0.1",
    "pg": "^8.13.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/testing": "^11.0.1",
    "@types/node": "^22.10.7",
    "ts-loader": "^9.5.2",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0"
  }
}
```

Create `apps/backend/knowledge-server/tsconfig.json` and `apps/backend/knowledge-server/tsconfig.build.json` with the same contents as the auth-server tsconfig files, changing no paths.

Create `apps/backend/knowledge-server/nest-cli.json`:

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src"
}
```

- [ ] **Step 5: Add minimal app modules and controllers**

Create `apps/backend/auth-server/src/app.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class AppController {
  @Get()
  health(): { service: 'auth-server'; status: 'ok' } {
    return { service: 'auth-server', status: 'ok' };
  }
}
```

Create `apps/backend/auth-server/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';

@Module({
  controllers: [AppController]
})
export class AppModule {}
```

Create `apps/backend/knowledge-server/src/app.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class AppController {
  @Get()
  health(): { service: 'knowledge-server'; status: 'ok' } {
    return { service: 'knowledge-server', status: 'ok' };
  }
}
```

Create `apps/backend/knowledge-server/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';

@Module({
  controllers: [AppController]
})
export class AppModule {}
```

- [ ] **Step 6: Add bootstrap files**

Create `apps/backend/auth-server/src/main.ts`:

```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const port = Number(process.env.PORT ?? 3010);
  const host = process.env.HOST ?? '127.0.0.1';
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.AUTH_SERVER_CORS_ORIGIN?.split(',') ?? true,
    credentials: false,
    allowedHeaders: ['content-type', 'authorization'],
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS']
  });

  await app.listen(port, host);
}

void bootstrap();
```

Create `apps/backend/knowledge-server/src/main.ts`:

```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const port = Number(process.env.PORT ?? 3020);
  const host = process.env.HOST ?? '127.0.0.1';
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.KNOWLEDGE_SERVER_CORS_ORIGIN?.split(',') ?? true,
    credentials: false,
    allowedHeaders: ['content-type', 'authorization'],
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS']
  });

  await app.listen(port, host);
}

void bootstrap();
```

- [ ] **Step 7: Update lockfile**

Run:

```bash
pnpm install
```

Expected: `pnpm-lock.yaml` contains importers for `apps/backend/auth-server` and `apps/backend/knowledge-server`.

- [ ] **Step 8: Verify app scaffolds**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/auth-server/test/app-health.spec.ts apps/backend/knowledge-server/test/app-health.spec.ts
pnpm exec tsc -p apps/backend/auth-server/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/knowledge-server/tsconfig.json --noEmit
```

Expected: all commands pass.

- [ ] **Step 9: Commit service scaffolds**

Run:

```bash
git add apps/backend/auth-server apps/backend/knowledge-server pnpm-lock.yaml
git commit -m "feat: scaffold auth and knowledge backend services"
```

## Task 3: Implement Auth Service Core And User Management

**Files:**

- Create: `apps/backend/auth-server/src/auth/auth.errors.ts`
- Create: `apps/backend/auth-server/src/auth/auth.module.ts`
- Create: `apps/backend/auth-server/src/auth/auth.controller.ts`
- Create: `apps/backend/auth-server/src/auth/auth.service.ts`
- Create: `apps/backend/auth-server/src/auth/user-management.controller.ts`
- Create: `apps/backend/auth-server/src/auth/user-management.service.ts`
- Create: `apps/backend/auth-server/src/auth/auth.guard.ts`
- Create: `apps/backend/auth-server/src/auth/jwt.provider.ts`
- Create: `apps/backend/auth-server/src/auth/password-hasher.provider.ts`
- Create: `apps/backend/auth-server/src/auth/repositories/auth.repository.ts`
- Create: `apps/backend/auth-server/src/auth/repositories/auth-memory.repository.ts`
- Modify: `apps/backend/auth-server/src/app.module.ts`
- Test: `apps/backend/auth-server/test/auth/auth-service.spec.ts`
- Test: `apps/backend/auth-server/test/auth/user-management.spec.ts`

- [ ] **Step 1: Write failing auth service tests**

Create `apps/backend/auth-server/test/auth/auth-service.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AuthService } from '../../src/auth/auth.service';
import { InMemoryAuthRepository } from '../../src/auth/repositories/auth-memory.repository';
import { JwtProvider } from '../../src/auth/jwt.provider';
import { PasswordHasherProvider } from '../../src/auth/password-hasher.provider';

describe('AuthService', () => {
  async function createService() {
    const repository = new InMemoryAuthRepository();
    const hasher = new PasswordHasherProvider();
    const jwt = new JwtProvider({ secret: 'test-secret', issuer: 'auth-server' });
    const service = new AuthService(repository, hasher, jwt);

    await repository.createUser({
      id: 'user_admin',
      username: 'admin',
      displayName: 'Admin',
      roles: ['admin'],
      status: 'enabled',
      passwordHash: await hasher.hash('admin-password')
    });

    return { service, repository };
  }

  it('logs in with username and password', async () => {
    const { service } = await createService();

    const response = await service.login({ username: 'admin', password: 'admin-password', remember: false });

    expect(response.account.username).toBe('admin');
    expect(response.tokens.tokenType).toBe('Bearer');
    expect(response.tokens.accessToken).toContain('.');
    expect(response.tokens.refreshToken).toHaveLength(64);
  });

  it('rejects disabled users', async () => {
    const { service, repository } = await createService();
    await repository.updateUserStatus('user_admin', 'disabled');

    await expect(
      service.login({ username: 'admin', password: 'admin-password', remember: false })
    ).rejects.toMatchObject({
      code: 'account_disabled'
    });
  });

  it('rotates refresh tokens and revokes the session on token replay', async () => {
    const { service } = await createService();
    const login = await service.login({ username: 'admin', password: 'admin-password', remember: false });
    const refresh = await service.refresh({ refreshToken: login.tokens.refreshToken });

    expect(refresh.tokens.refreshToken).not.toBe(login.tokens.refreshToken);
    await expect(service.refresh({ refreshToken: login.tokens.refreshToken })).rejects.toMatchObject({
      code: 'refresh_token_reused'
    });
    await expect(service.refresh({ refreshToken: refresh.tokens.refreshToken })).rejects.toMatchObject({
      code: 'session_revoked'
    });
  });
});
```

- [ ] **Step 2: Write failing user management tests**

Create `apps/backend/auth-server/test/auth/user-management.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { UserManagementService } from '../../src/auth/user-management.service';
import { InMemoryAuthRepository } from '../../src/auth/repositories/auth-memory.repository';
import { PasswordHasherProvider } from '../../src/auth/password-hasher.provider';

describe('UserManagementService', () => {
  async function createService() {
    const repository = new InMemoryAuthRepository();
    const hasher = new PasswordHasherProvider();
    const service = new UserManagementService(repository, hasher);

    await repository.createUser({
      id: 'user_admin',
      username: 'admin',
      displayName: 'Admin',
      roles: ['admin'],
      status: 'enabled',
      passwordHash: await hasher.hash('admin-password')
    });

    return { service };
  }

  it('creates and lists users', async () => {
    const { service } = await createService();

    const created = await service.createUser({
      username: 'knowledge',
      displayName: 'Knowledge User',
      password: 'knowledge-password',
      roles: ['knowledge_user']
    });

    expect(created.username).toBe('knowledge');
    await expect(service.listUsers()).resolves.toMatchObject({
      users: expect.arrayContaining([expect.objectContaining({ username: 'knowledge' })])
    });
  });

  it('disables and enables users', async () => {
    const { service } = await createService();

    await service.disableUser('user_admin');
    await expect(service.listUsers()).resolves.toMatchObject({
      users: [expect.objectContaining({ status: 'disabled' })]
    });

    await service.enableUser('user_admin');
    await expect(service.listUsers()).resolves.toMatchObject({
      users: [expect.objectContaining({ status: 'enabled' })]
    });
  });
});
```

- [ ] **Step 3: Run auth tests and verify they fail**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/auth-server/test/auth/auth-service.spec.ts apps/backend/auth-server/test/auth/user-management.spec.ts
```

Expected: FAIL because auth service files do not exist.

- [ ] **Step 4: Add auth repository interface and in-memory implementation**

Create `apps/backend/auth-server/src/auth/repositories/auth.repository.ts`:

```ts
import type { AuthAccount, AuthGlobalRole, AuthUserStatus } from '@agent/core';

export interface AuthUserRecord extends AuthAccount {
  passwordHash: string;
}

export interface AuthSessionRecord {
  id: string;
  userId: string;
  status: 'active' | 'revoked' | 'expired';
  expiresAt: string;
}

export interface AuthRefreshTokenRecord {
  id: string;
  sessionId: string;
  tokenHash: string;
  status: 'active' | 'used' | 'revoked' | 'expired';
  expiresAt: string;
  replacedByTokenId?: string;
}

export interface CreateAuthUserInput {
  id: string;
  username: string;
  displayName: string;
  roles: AuthGlobalRole[];
  status: AuthUserStatus;
  passwordHash: string;
}

export interface AuthRepository {
  createUser(input: CreateAuthUserInput): Promise<AuthUserRecord>;
  findUserByUsername(username: string): Promise<AuthUserRecord | undefined>;
  findUserById(userId: string): Promise<AuthUserRecord | undefined>;
  listUsers(): Promise<AuthUserRecord[]>;
  updateUserStatus(userId: string, status: AuthUserStatus): Promise<AuthUserRecord>;
  updateUserPassword(userId: string, passwordHash: string): Promise<void>;
  createSession(input: AuthSessionRecord): Promise<AuthSessionRecord>;
  findSession(sessionId: string): Promise<AuthSessionRecord | undefined>;
  revokeSession(sessionId: string, reason: string): Promise<void>;
  createRefreshToken(input: AuthRefreshTokenRecord): Promise<AuthRefreshTokenRecord>;
  findRefreshTokenByHash(tokenHash: string): Promise<AuthRefreshTokenRecord | undefined>;
  markRefreshTokenUsed(tokenId: string, replacedByTokenId: string): Promise<void>;
}
```

Create `apps/backend/auth-server/src/auth/repositories/auth-memory.repository.ts`:

```ts
import type { AuthUserStatus } from '@agent/core';
import type {
  AuthRefreshTokenRecord,
  AuthRepository,
  AuthSessionRecord,
  AuthUserRecord,
  CreateAuthUserInput
} from './auth.repository';

export class InMemoryAuthRepository implements AuthRepository {
  private readonly users = new Map<string, AuthUserRecord>();
  private readonly sessions = new Map<string, AuthSessionRecord>();
  private readonly refreshTokens = new Map<string, AuthRefreshTokenRecord>();

  async createUser(input: CreateAuthUserInput): Promise<AuthUserRecord> {
    const record: AuthUserRecord = { ...input };
    this.users.set(record.id, record);
    return record;
  }

  async findUserByUsername(username: string): Promise<AuthUserRecord | undefined> {
    return [...this.users.values()].find(user => user.username === username);
  }

  async findUserById(userId: string): Promise<AuthUserRecord | undefined> {
    return this.users.get(userId);
  }

  async listUsers(): Promise<AuthUserRecord[]> {
    return [...this.users.values()];
  }

  async updateUserStatus(userId: string, status: AuthUserStatus): Promise<AuthUserRecord> {
    const existing = this.users.get(userId);
    if (!existing) throw new Error(`User not found: ${userId}`);
    const updated = { ...existing, status };
    this.users.set(userId, updated);
    return updated;
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    const existing = this.users.get(userId);
    if (!existing) throw new Error(`User not found: ${userId}`);
    this.users.set(userId, { ...existing, passwordHash });
  }

  async createSession(input: AuthSessionRecord): Promise<AuthSessionRecord> {
    this.sessions.set(input.id, input);
    return input;
  }

  async findSession(sessionId: string): Promise<AuthSessionRecord | undefined> {
    return this.sessions.get(sessionId);
  }

  async revokeSession(sessionId: string): Promise<void> {
    const existing = this.sessions.get(sessionId);
    if (existing) this.sessions.set(sessionId, { ...existing, status: 'revoked' });
  }

  async createRefreshToken(input: AuthRefreshTokenRecord): Promise<AuthRefreshTokenRecord> {
    this.refreshTokens.set(input.tokenHash, input);
    return input;
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<AuthRefreshTokenRecord | undefined> {
    return this.refreshTokens.get(tokenHash);
  }

  async markRefreshTokenUsed(tokenId: string, replacedByTokenId: string): Promise<void> {
    for (const [hash, token] of this.refreshTokens.entries()) {
      if (token.id === tokenId) {
        this.refreshTokens.set(hash, { ...token, status: 'used', replacedByTokenId });
        return;
      }
    }
  }
}
```

- [ ] **Step 5: Add providers and errors**

Create `apps/backend/auth-server/src/auth/auth.errors.ts`:

```ts
import type { z } from 'zod';
import type { AuthErrorCodeSchema } from '@agent/core';

export class AuthServiceError extends Error {
  constructor(
    readonly code: z.infer<typeof AuthErrorCodeSchema>,
    message: string
  ) {
    super(message);
  }
}
```

Create `apps/backend/auth-server/src/auth/password-hasher.provider.ts`:

```ts
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export class PasswordHasherProvider {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const digest = createHash('sha256').update(`${salt}:${password}`).digest('hex');
    return `${salt}:${digest}`;
  }

  async verify(password: string, passwordHash: string): Promise<boolean> {
    const [salt, digest] = passwordHash.split(':');
    if (!salt || !digest) return false;
    const candidate = createHash('sha256').update(`${salt}:${password}`).digest('hex');
    return timingSafeEqual(Buffer.from(candidate), Buffer.from(digest));
  }
}
```

Create `apps/backend/auth-server/src/auth/jwt.provider.ts`:

```ts
import { createHmac } from 'node:crypto';

export interface JwtProviderOptions {
  secret: string;
  issuer: string;
}

export interface AuthJwtPayload {
  sub: string;
  username: string;
  roles: string[];
  status: string;
  iss: string;
  aud: string[];
  exp: number;
}

export class JwtProvider {
  constructor(private readonly options: JwtProviderOptions) {}

  sign(payload: Omit<AuthJwtPayload, 'iss'>): string {
    const fullPayload: AuthJwtPayload = { ...payload, iss: this.options.issuer };
    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const body = encode(fullPayload);
    const signature = this.signSegment(`${header}.${body}`);
    return `${header}.${body}.${signature}`;
  }

  verify(token: string): AuthJwtPayload {
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) throw new Error('Invalid token');
    const expected = this.signSegment(`${header}.${body}`);
    if (signature !== expected) throw new Error('Invalid token signature');
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AuthJwtPayload;
    if (payload.exp <= Math.floor(Date.now() / 1000)) throw new Error('Token expired');
    return payload;
  }

  private signSegment(value: string): string {
    return createHmac('sha256', this.options.secret).update(value).digest('base64url');
  }
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
```

- [ ] **Step 6: Add auth and user management services**

Create `apps/backend/auth-server/src/auth/auth.service.ts` with the implementation that uses repository, hasher, and JWT provider:

```ts
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AuthLoginRequest, AuthLoginResponse, AuthRefreshRequest, AuthRefreshResponse } from '@agent/core';
import { AuthServiceError } from './auth.errors';
import { JwtProvider } from './jwt.provider';
import { PasswordHasherProvider } from './password-hasher.provider';
import type { AuthRepository, AuthUserRecord } from './repositories/auth.repository';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const REMEMBER_REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly hasher: PasswordHasherProvider,
    private readonly jwt: JwtProvider
  ) {}

  async login(input: AuthLoginRequest): Promise<AuthLoginResponse> {
    const user = await this.repository.findUserByUsername(input.username);
    if (!user || !(await this.hasher.verify(input.password, user.passwordHash))) {
      throw new AuthServiceError('invalid_credentials', '账号或密码错误');
    }
    if (user.status === 'disabled') {
      throw new AuthServiceError('account_disabled', '账号已禁用');
    }

    const now = Date.now();
    const refreshExpiresAt = new Date(now + (input.remember ? REMEMBER_REFRESH_TOKEN_TTL_MS : REFRESH_TOKEN_TTL_MS));
    const session = await this.repository.createSession({
      id: `sess_${randomUUID()}`,
      userId: user.id,
      status: 'active',
      expiresAt: refreshExpiresAt.toISOString()
    });
    const tokens = await this.issueTokens(user, session.id, refreshExpiresAt);

    return {
      account: toAccount(user),
      session: { id: session.id, expiresAt: session.expiresAt },
      tokens
    };
  }

  async refresh(input: AuthRefreshRequest): Promise<AuthRefreshResponse> {
    const tokenHash = hashToken(input.refreshToken);
    const existingToken = await this.repository.findRefreshTokenByHash(tokenHash);
    if (!existingToken) throw new AuthServiceError('refresh_token_invalid', 'Refresh Token 无效');

    const session = await this.repository.findSession(existingToken.sessionId);
    if (!session || session.status !== 'active') throw new AuthServiceError('session_revoked', 'Session 已失效');

    if (existingToken.status === 'used') {
      await this.repository.revokeSession(existingToken.sessionId, 'refresh-token-reuse');
      throw new AuthServiceError('refresh_token_reused', 'Refresh Token 被重复使用');
    }
    if (existingToken.status !== 'active') throw new AuthServiceError('refresh_token_invalid', 'Refresh Token 无效');

    const user = await this.repository.findUserById(session.userId);
    if (!user) throw new AuthServiceError('session_revoked', 'Session 已失效');

    const refreshExpiresAt = new Date(existingToken.expiresAt);
    const tokens = await this.issueTokens(user, session.id, refreshExpiresAt);
    const replacement = await this.repository.findRefreshTokenByHash(hashToken(tokens.refreshToken));
    if (replacement) await this.repository.markRefreshTokenUsed(existingToken.id, replacement.id);

    return { tokens };
  }

  private async issueTokens(
    user: AuthUserRecord,
    sessionId: string,
    refreshExpiresAt: Date
  ): Promise<AuthLoginResponse['tokens']> {
    const accessTokenExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000);
    const refreshToken = randomBytes(32).toString('hex');
    const refreshTokenRecord = {
      id: `rt_${randomUUID()}`,
      sessionId,
      tokenHash: hashToken(refreshToken),
      status: 'active' as const,
      expiresAt: refreshExpiresAt.toISOString()
    };
    await this.repository.createRefreshToken(refreshTokenRecord);

    return {
      tokenType: 'Bearer',
      accessToken: this.jwt.sign({
        sub: user.id,
        username: user.username,
        roles: user.roles,
        status: user.status,
        aud: ['agent-admin', 'knowledge'],
        exp: Math.floor(accessTokenExpiresAt.getTime() / 1000)
      }),
      accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
      refreshToken,
      refreshTokenExpiresAt: refreshExpiresAt.toISOString()
    };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toAccount(user: AuthUserRecord): AuthLoginResponse['account'] {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    roles: user.roles,
    status: user.status
  };
}
```

Create `apps/backend/auth-server/src/auth/user-management.service.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type { AuthAccount, AuthUserCreateRequest, AuthUsersListResponse } from '@agent/core';
import { PasswordHasherProvider } from './password-hasher.provider';
import type { AuthRepository, AuthUserRecord } from './repositories/auth.repository';

export class UserManagementService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly hasher: PasswordHasherProvider
  ) {}

  async listUsers(): Promise<AuthUsersListResponse> {
    const users = await this.repository.listUsers();
    return { users: users.map(toAccount) };
  }

  async createUser(input: AuthUserCreateRequest): Promise<AuthAccount> {
    const user = await this.repository.createUser({
      id: `user_${randomUUID()}`,
      username: input.username,
      displayName: input.displayName,
      roles: input.roles,
      status: 'enabled',
      passwordHash: await this.hasher.hash(input.password)
    });
    return toAccount(user);
  }

  async disableUser(userId: string): Promise<AuthAccount> {
    return toAccount(await this.repository.updateUserStatus(userId, 'disabled'));
  }

  async enableUser(userId: string): Promise<AuthAccount> {
    return toAccount(await this.repository.updateUserStatus(userId, 'enabled'));
  }
}

function toAccount(user: AuthUserRecord): AuthAccount {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    roles: user.roles,
    status: user.status
  };
}
```

- [ ] **Step 7: Wire Nest module and controllers**

Create `apps/backend/auth-server/src/auth/auth.controller.ts`:

```ts
import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  AuthLoginRequestSchema,
  AuthLogoutRequestSchema,
  AuthRefreshRequestSchema,
  type AuthLoginResponse,
  type AuthMeResponse,
  type AuthRefreshResponse
} from '@agent/core';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: unknown): Promise<AuthLoginResponse> {
    return this.authService.login(AuthLoginRequestSchema.parse(body));
  }

  @Post('refresh')
  refresh(@Body() body: unknown): Promise<AuthRefreshResponse> {
    return this.authService.refresh(AuthRefreshRequestSchema.parse(body));
  }

  @Post('logout')
  logout(@Body() body: unknown): { success: true } {
    AuthLogoutRequestSchema.parse(body);
    return { success: true };
  }

  @Get('me')
  me(): AuthMeResponse {
    return {
      account: {
        id: 'user_demo',
        username: 'demo',
        displayName: 'Demo User',
        roles: ['developer'],
        status: 'enabled'
      }
    };
  }
}
```

Create `apps/backend/auth-server/src/auth/user-management.controller.ts`:

```ts
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthUserCreateRequestSchema, type AuthAccount, type AuthUsersListResponse } from '@agent/core';
import { UserManagementService } from './user-management.service';

@Controller('auth/users')
export class UserManagementController {
  constructor(private readonly users: UserManagementService) {}

  @Get()
  listUsers(): Promise<AuthUsersListResponse> {
    return this.users.listUsers();
  }

  @Post()
  createUser(@Body() body: unknown): Promise<AuthAccount> {
    return this.users.createUser(AuthUserCreateRequestSchema.parse(body));
  }

  @Post(':userId/disable')
  disableUser(@Param('userId') userId: string): Promise<AuthAccount> {
    return this.users.disableUser(userId);
  }

  @Post(':userId/enable')
  enableUser(@Param('userId') userId: string): Promise<AuthAccount> {
    return this.users.enableUser(userId);
  }
}
```

Create `apps/backend/auth-server/src/auth/auth.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtProvider } from './jwt.provider';
import { PasswordHasherProvider } from './password-hasher.provider';
import { InMemoryAuthRepository } from './repositories/auth-memory.repository';
import type { AuthRepository } from './repositories/auth.repository';
import { UserManagementController } from './user-management.controller';
import { UserManagementService } from './user-management.service';

export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

@Module({
  controllers: [AuthController, UserManagementController],
  providers: [
    PasswordHasherProvider,
    {
      provide: JwtProvider,
      useFactory: () =>
        new JwtProvider({
          secret: process.env.AUTH_SERVER_JWT_SECRET ?? 'local-dev-auth-secret',
          issuer: 'auth-server'
        })
    },
    {
      provide: AUTH_REPOSITORY,
      useClass: InMemoryAuthRepository
    },
    {
      provide: AuthService,
      useFactory: (repository: AuthRepository, hasher: PasswordHasherProvider, jwt: JwtProvider) =>
        new AuthService(repository, hasher, jwt),
      inject: [AUTH_REPOSITORY, PasswordHasherProvider, JwtProvider]
    },
    {
      provide: UserManagementService,
      useFactory: (repository: AuthRepository, hasher: PasswordHasherProvider) =>
        new UserManagementService(repository, hasher),
      inject: [AUTH_REPOSITORY, PasswordHasherProvider]
    }
  ]
})
export class AuthModule {}
```

Modify `apps/backend/auth-server/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AppController]
})
export class AppModule {}
```

- [ ] **Step 8: Run auth tests and typecheck**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/auth-server/test/auth/auth-service.spec.ts apps/backend/auth-server/test/auth/user-management.spec.ts
pnpm exec tsc -p apps/backend/auth-server/tsconfig.json --noEmit
```

Expected: both commands pass.

- [ ] **Step 9: Commit auth core**

Run:

```bash
git add apps/backend/auth-server/src/auth apps/backend/auth-server/src/app.module.ts apps/backend/auth-server/test/auth
git commit -m "feat: implement auth service core"
```

## Task 4: Add Auth PostgreSQL Repository

**Files:**

- Create: `apps/backend/auth-server/src/auth/repositories/auth-postgres.repository.ts`
- Test: `apps/backend/auth-server/test/auth/auth-postgres.repository.spec.ts`
- Modify: `apps/backend/auth-server/src/auth/auth.module.ts`
- Docs: `docs/apps/backend/auth-server/auth-server.md`

- [ ] **Step 1: Write repository mapping test with fake pg client**

Create `apps/backend/auth-server/test/auth/auth-postgres.repository.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PostgresAuthRepository } from '../../src/auth/repositories/auth-postgres.repository';

describe('PostgresAuthRepository', () => {
  it('maps auth users from database rows', async () => {
    const repository = new PostgresAuthRepository({
      query: async () => ({
        rows: [
          {
            id: 'user_1',
            username: 'admin',
            display_name: 'Admin',
            global_roles: ['admin'],
            status: 'enabled',
            password_hash: 'salt:hash'
          }
        ]
      })
    });

    await expect(repository.findUserByUsername('admin')).resolves.toMatchObject({
      id: 'user_1',
      displayName: 'Admin',
      roles: ['admin']
    });
  });
});
```

- [ ] **Step 2: Run repository test and verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/auth-server/test/auth/auth-postgres.repository.spec.ts
```

Expected: FAIL because `PostgresAuthRepository` does not exist.

- [ ] **Step 3: Implement PostgreSQL repository**

Create `apps/backend/auth-server/src/auth/repositories/auth-postgres.repository.ts`:

```ts
import type { AuthGlobalRole, AuthUserStatus } from '@agent/core';
import type {
  AuthRefreshTokenRecord,
  AuthRepository,
  AuthSessionRecord,
  AuthUserRecord,
  CreateAuthUserInput
} from './auth.repository';

interface PgClientLike {
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

export class PostgresAuthRepository implements AuthRepository {
  constructor(private readonly client: PgClientLike) {}

  async createUser(input: CreateAuthUserInput): Promise<AuthUserRecord> {
    const result = await this.client.query(
      `insert into auth_users (id, username, display_name, global_roles, status, password_hash)
       values ($1, $2, $3, $4, $5, $6)
       returning id, username, display_name, global_roles, status, password_hash`,
      [input.id, input.username, input.displayName, input.roles, input.status, input.passwordHash]
    );
    return mapUser(result.rows[0]);
  }

  async findUserByUsername(username: string): Promise<AuthUserRecord | undefined> {
    const result = await this.client.query(
      `select id, username, display_name, global_roles, status, password_hash
       from auth_users where username = $1 limit 1`,
      [username]
    );
    return result.rows[0] ? mapUser(result.rows[0]) : undefined;
  }

  async findUserById(userId: string): Promise<AuthUserRecord | undefined> {
    const result = await this.client.query(
      `select id, username, display_name, global_roles, status, password_hash
       from auth_users where id = $1 limit 1`,
      [userId]
    );
    return result.rows[0] ? mapUser(result.rows[0]) : undefined;
  }

  async listUsers(): Promise<AuthUserRecord[]> {
    const result = await this.client.query(
      `select id, username, display_name, global_roles, status, password_hash from auth_users order by username`
    );
    return result.rows.map(mapUser);
  }

  async updateUserStatus(userId: string, status: AuthUserStatus): Promise<AuthUserRecord> {
    const result = await this.client.query(
      `update auth_users set status = $2 where id = $1
       returning id, username, display_name, global_roles, status, password_hash`,
      [userId, status]
    );
    return mapUser(result.rows[0]);
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    await this.client.query(`update auth_users set password_hash = $2 where id = $1`, [userId, passwordHash]);
  }

  async createSession(input: AuthSessionRecord): Promise<AuthSessionRecord> {
    await this.client.query(`insert into auth_sessions (id, user_id, status, expires_at) values ($1, $2, $3, $4)`, [
      input.id,
      input.userId,
      input.status,
      input.expiresAt
    ]);
    return input;
  }

  async findSession(sessionId: string): Promise<AuthSessionRecord | undefined> {
    const result = await this.client.query(
      `select id, user_id, status, expires_at from auth_sessions where id = $1 limit 1`,
      [sessionId]
    );
    return result.rows[0] ? mapSession(result.rows[0]) : undefined;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.client.query(`update auth_sessions set status = 'revoked' where id = $1`, [sessionId]);
  }

  async createRefreshToken(input: AuthRefreshTokenRecord): Promise<AuthRefreshTokenRecord> {
    await this.client.query(
      `insert into auth_refresh_tokens (id, session_id, token_hash, status, expires_at)
       values ($1, $2, $3, $4, $5)`,
      [input.id, input.sessionId, input.tokenHash, input.status, input.expiresAt]
    );
    return input;
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<AuthRefreshTokenRecord | undefined> {
    const result = await this.client.query(
      `select id, session_id, token_hash, status, expires_at, replaced_by_token_id
       from auth_refresh_tokens where token_hash = $1 limit 1`,
      [tokenHash]
    );
    return result.rows[0] ? mapRefreshToken(result.rows[0]) : undefined;
  }

  async markRefreshTokenUsed(tokenId: string, replacedByTokenId: string): Promise<void> {
    await this.client.query(`update auth_refresh_tokens set status = 'used', replaced_by_token_id = $2 where id = $1`, [
      tokenId,
      replacedByTokenId
    ]);
  }
}

function mapUser(row: Record<string, unknown>): AuthUserRecord {
  return {
    id: String(row.id),
    username: String(row.username),
    displayName: String(row.display_name),
    roles: row.global_roles as AuthGlobalRole[],
    status: row.status as AuthUserStatus,
    passwordHash: String(row.password_hash)
  };
}

function mapSession(row: Record<string, unknown>): AuthSessionRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    status: row.status as AuthSessionRecord['status'],
    expiresAt: new Date(String(row.expires_at)).toISOString()
  };
}

function mapRefreshToken(row: Record<string, unknown>): AuthRefreshTokenRecord {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    tokenHash: String(row.token_hash),
    status: row.status as AuthRefreshTokenRecord['status'],
    expiresAt: new Date(String(row.expires_at)).toISOString(),
    replacedByTokenId: row.replaced_by_token_id ? String(row.replaced_by_token_id) : undefined
  };
}
```

- [ ] **Step 4: Document auth schema SQL**

Create or update `docs/apps/backend/auth-server/auth-server.md` with the canonical table shape:

````md
# Auth Server

状态：current
文档类型：reference
适用范围：`apps/backend/auth-server`
最后核对：2026-05-02

## 本主题主文档：

本文只覆盖：auth-server 身份服务边界、PostgreSQL 表、启动环境和验证入口。

## PostgreSQL Tables

```sql
create table if not exists auth_users (
  id text primary key,
  username text not null unique,
  display_name text not null,
  global_roles text[] not null,
  status text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists auth_sessions (
  id text primary key,
  user_id text not null references auth_users(id),
  status text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revocation_reason text
);

create table if not exists auth_refresh_tokens (
  id text primary key,
  session_id text not null references auth_sessions(id),
  token_hash text not null unique,
  status text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  replaced_by_token_id text
);
```
````

````

- [ ] **Step 5: Run repository test, auth tests, docs check, and typecheck**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/auth-server/test/auth
pnpm exec tsc -p apps/backend/auth-server/tsconfig.json --noEmit
pnpm check:docs
````

Expected: all commands pass.

- [ ] **Step 6: Commit auth PostgreSQL repository**

Run:

```bash
git add apps/backend/auth-server/src/auth/repositories/auth-postgres.repository.ts apps/backend/auth-server/test/auth/auth-postgres.repository.spec.ts docs/apps/backend/auth-server
git commit -m "feat: add auth postgres repository"
```

## Task 5: Implement Knowledge Service Membership Core

**Files:**

- Create: `apps/backend/knowledge-server/src/knowledge/knowledge.errors.ts`
- Create: `apps/backend/knowledge-server/src/knowledge/knowledge.module.ts`
- Create: `apps/backend/knowledge-server/src/knowledge/knowledge.controller.ts`
- Create: `apps/backend/knowledge-server/src/knowledge/knowledge.service.ts`
- Create: `apps/backend/knowledge-server/src/knowledge/repositories/knowledge.repository.ts`
- Create: `apps/backend/knowledge-server/src/knowledge/repositories/knowledge-memory.repository.ts`
- Modify: `apps/backend/knowledge-server/src/app.module.ts`
- Test: `apps/backend/knowledge-server/test/knowledge/knowledge-permissions.spec.ts`

- [ ] **Step 1: Write failing permission tests**

Create `apps/backend/knowledge-server/test/knowledge/knowledge-permissions.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { KnowledgeService } from '../../src/knowledge/knowledge.service';
import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';

describe('KnowledgeService permissions', () => {
  async function createService() {
    const repository = new InMemoryKnowledgeRepository();
    const service = new KnowledgeService(repository);
    const base = await service.createBase({ userId: 'owner_1' }, { name: 'Engineering KB', description: 'Notes' });
    return { service, base };
  }

  it('creates a base and makes the creator owner', async () => {
    const { service } = await createService();

    await expect(service.listBases({ userId: 'owner_1' })).resolves.toMatchObject({
      bases: [expect.objectContaining({ name: 'Engineering KB' })]
    });
  });

  it('allows owners to add viewers', async () => {
    const { service, base } = await createService();

    await service.addMember({ userId: 'owner_1' }, base.id, { userId: 'viewer_1', role: 'viewer' });

    await expect(service.listMembers({ userId: 'owner_1' }, base.id)).resolves.toMatchObject({
      members: [expect.objectContaining({ userId: 'viewer_1', role: 'viewer' })]
    });
  });

  it('rejects viewers when adding members', async () => {
    const { service, base } = await createService();
    await service.addMember({ userId: 'owner_1' }, base.id, { userId: 'viewer_1', role: 'viewer' });

    await expect(
      service.addMember({ userId: 'viewer_1' }, base.id, { userId: 'other_1', role: 'viewer' })
    ).rejects.toMatchObject({ code: 'knowledge_permission_denied' });
  });
});
```

- [ ] **Step 2: Run permission tests and verify they fail**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-permissions.spec.ts
```

Expected: FAIL because knowledge service files do not exist.

- [ ] **Step 3: Add repository interface and in-memory repository**

Create `apps/backend/knowledge-server/src/knowledge/repositories/knowledge.repository.ts`:

```ts
import type {
  KnowledgeBase,
  KnowledgeBaseCreateRequest,
  KnowledgeBaseMember,
  KnowledgeBaseMemberCreateRequest
} from '@agent/core';

export interface KnowledgeRepository {
  createBase(input: KnowledgeBaseCreateRequest & { id: string; createdByUserId: string }): Promise<KnowledgeBase>;
  listBasesForUser(userId: string): Promise<KnowledgeBase[]>;
  findBase(baseId: string): Promise<KnowledgeBase | undefined>;
  addMember(input: KnowledgeBaseMemberCreateRequest & { knowledgeBaseId: string }): Promise<KnowledgeBaseMember>;
  findMember(baseId: string, userId: string): Promise<KnowledgeBaseMember | undefined>;
  listMembers(baseId: string): Promise<KnowledgeBaseMember[]>;
}
```

Create `apps/backend/knowledge-server/src/knowledge/repositories/knowledge-memory.repository.ts`:

```ts
import type {
  KnowledgeBase,
  KnowledgeBaseCreateRequest,
  KnowledgeBaseMember,
  KnowledgeBaseMemberCreateRequest
} from '@agent/core';
import type { KnowledgeRepository } from './knowledge.repository';

export class InMemoryKnowledgeRepository implements KnowledgeRepository {
  private readonly bases = new Map<string, KnowledgeBase>();
  private readonly members = new Map<string, KnowledgeBaseMember>();

  async createBase(
    input: KnowledgeBaseCreateRequest & { id: string; createdByUserId: string }
  ): Promise<KnowledgeBase> {
    const now = new Date().toISOString();
    const base: KnowledgeBase = {
      id: input.id,
      name: input.name,
      description: input.description ?? '',
      createdByUserId: input.createdByUserId,
      status: 'active',
      createdAt: now,
      updatedAt: now
    };
    this.bases.set(base.id, base);
    await this.addMember({ knowledgeBaseId: base.id, userId: input.createdByUserId, role: 'owner' });
    return base;
  }

  async listBasesForUser(userId: string): Promise<KnowledgeBase[]> {
    const baseIds = [...this.members.values()]
      .filter(member => member.userId === userId)
      .map(member => member.knowledgeBaseId);
    return baseIds.map(baseId => this.bases.get(baseId)).filter((base): base is KnowledgeBase => Boolean(base));
  }

  async findBase(baseId: string): Promise<KnowledgeBase | undefined> {
    return this.bases.get(baseId);
  }

  async addMember(input: KnowledgeBaseMemberCreateRequest & { knowledgeBaseId: string }): Promise<KnowledgeBaseMember> {
    const now = new Date().toISOString();
    const member: KnowledgeBaseMember = {
      knowledgeBaseId: input.knowledgeBaseId,
      userId: input.userId,
      role: input.role,
      createdAt: now,
      updatedAt: now
    };
    this.members.set(`${member.knowledgeBaseId}:${member.userId}`, member);
    return member;
  }

  async findMember(baseId: string, userId: string): Promise<KnowledgeBaseMember | undefined> {
    return this.members.get(`${baseId}:${userId}`);
  }

  async listMembers(baseId: string): Promise<KnowledgeBaseMember[]> {
    return [...this.members.values()].filter(member => member.knowledgeBaseId === baseId);
  }
}
```

- [ ] **Step 4: Add knowledge errors and service**

Create `apps/backend/knowledge-server/src/knowledge/knowledge.errors.ts`:

```ts
import type { z } from 'zod';
import type { KnowledgeServiceErrorCodeSchema } from '@agent/core';

export class KnowledgeServiceError extends Error {
  constructor(
    readonly code: z.infer<typeof KnowledgeServiceErrorCodeSchema>,
    message: string
  ) {
    super(message);
  }
}
```

Create `apps/backend/knowledge-server/src/knowledge/knowledge.service.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type {
  KnowledgeBaseCreateRequest,
  KnowledgeBaseMemberCreateRequest,
  KnowledgeBaseMembersResponse,
  KnowledgeBaseResponse,
  KnowledgeBasesListResponse
} from '@agent/core';
import { KnowledgeServiceError } from './knowledge.errors';
import type { KnowledgeRepository } from './repositories/knowledge.repository';

export interface KnowledgeActor {
  userId: string;
}

export class KnowledgeService {
  constructor(private readonly repository: KnowledgeRepository) {}

  async createBase(actor: KnowledgeActor, input: KnowledgeBaseCreateRequest): Promise<KnowledgeBaseResponse['base']> {
    return this.repository.createBase({
      id: `kb_${randomUUID()}`,
      name: input.name,
      description: input.description ?? '',
      createdByUserId: actor.userId
    });
  }

  async listBases(actor: KnowledgeActor): Promise<KnowledgeBasesListResponse> {
    return { bases: await this.repository.listBasesForUser(actor.userId) };
  }

  async addMember(
    actor: KnowledgeActor,
    baseId: string,
    input: KnowledgeBaseMemberCreateRequest
  ): Promise<KnowledgeBaseMembersResponse['members'][number]> {
    await this.assertCanManageMembers(actor.userId, baseId);
    return this.repository.addMember({ knowledgeBaseId: baseId, userId: input.userId, role: input.role });
  }

  async listMembers(actor: KnowledgeActor, baseId: string): Promise<KnowledgeBaseMembersResponse> {
    await this.assertCanView(actor.userId, baseId);
    return { members: await this.repository.listMembers(baseId) };
  }

  private async assertCanView(userId: string, baseId: string): Promise<void> {
    const member = await this.repository.findMember(baseId, userId);
    if (!member) throw new KnowledgeServiceError('knowledge_permission_denied', '无权访问该知识库');
  }

  private async assertCanManageMembers(userId: string, baseId: string): Promise<void> {
    const member = await this.repository.findMember(baseId, userId);
    if (!member || member.role !== 'owner') {
      throw new KnowledgeServiceError('knowledge_permission_denied', '无权管理知识库成员');
    }
  }
}
```

- [ ] **Step 5: Wire controller and module**

Create `apps/backend/knowledge-server/src/knowledge/knowledge.controller.ts`:

```ts
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  KnowledgeBaseCreateRequestSchema,
  KnowledgeBaseMemberCreateRequestSchema,
  type KnowledgeBase,
  type KnowledgeBaseMembersResponse,
  type KnowledgeBasesListResponse
} from '@agent/core';
import { KnowledgeService } from './knowledge.service';

const LOCAL_ACTOR = { userId: 'local-user' };

@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get('bases')
  listBases(): Promise<KnowledgeBasesListResponse> {
    return this.knowledge.listBases(LOCAL_ACTOR);
  }

  @Post('bases')
  createBase(@Body() body: unknown): Promise<KnowledgeBase> {
    return this.knowledge.createBase(LOCAL_ACTOR, KnowledgeBaseCreateRequestSchema.parse(body));
  }

  @Get('bases/:baseId/members')
  listMembers(@Param('baseId') baseId: string): Promise<KnowledgeBaseMembersResponse> {
    return this.knowledge.listMembers(LOCAL_ACTOR, baseId);
  }

  @Post('bases/:baseId/members')
  addMember(
    @Param('baseId') baseId: string,
    @Body() body: unknown
  ): Promise<KnowledgeBaseMembersResponse['members'][number]> {
    return this.knowledge.addMember(LOCAL_ACTOR, baseId, KnowledgeBaseMemberCreateRequestSchema.parse(body));
  }
}
```

Create `apps/backend/knowledge-server/src/knowledge/knowledge.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { InMemoryKnowledgeRepository } from './repositories/knowledge-memory.repository';
import type { KnowledgeRepository } from './repositories/knowledge.repository';

export const KNOWLEDGE_REPOSITORY = Symbol('KNOWLEDGE_REPOSITORY');

@Module({
  controllers: [KnowledgeController],
  providers: [
    { provide: KNOWLEDGE_REPOSITORY, useClass: InMemoryKnowledgeRepository },
    {
      provide: KnowledgeService,
      useFactory: (repository: KnowledgeRepository) => new KnowledgeService(repository),
      inject: [KNOWLEDGE_REPOSITORY]
    }
  ]
})
export class KnowledgeModule {}
```

Modify `apps/backend/knowledge-server/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { KnowledgeModule } from './knowledge/knowledge.module';

@Module({
  imports: [KnowledgeModule],
  controllers: [AppController]
})
export class AppModule {}
```

- [ ] **Step 6: Run knowledge tests and typecheck**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-permissions.spec.ts
pnpm exec tsc -p apps/backend/knowledge-server/tsconfig.json --noEmit
```

Expected: both commands pass.

- [ ] **Step 7: Commit knowledge core**

Run:

```bash
git add apps/backend/knowledge-server/src/knowledge apps/backend/knowledge-server/src/app.module.ts apps/backend/knowledge-server/test/knowledge/knowledge-permissions.spec.ts
git commit -m "feat: implement knowledge service permissions"
```

## Task 6: Add Knowledge Auth Guard And PostgreSQL Repository

**Files:**

- Create: `apps/backend/knowledge-server/src/auth/auth-token-verifier.ts`
- Create: `apps/backend/knowledge-server/src/auth/auth.guard.ts`
- Create: `apps/backend/knowledge-server/src/auth/auth-user.decorator.ts`
- Create: `apps/backend/knowledge-server/src/knowledge/repositories/knowledge-postgres.repository.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge.controller.ts`
- Test: `apps/backend/knowledge-server/test/knowledge/knowledge-auth.guard.spec.ts`
- Test: `apps/backend/knowledge-server/test/knowledge/knowledge-postgres.repository.spec.ts`

- [ ] **Step 1: Write auth guard test**

Create `apps/backend/knowledge-server/test/knowledge/knowledge-auth.guard.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AuthTokenVerifier } from '../../src/auth/auth-token-verifier';

describe('AuthTokenVerifier', () => {
  it('verifies auth-server JWT payloads', () => {
    const verifier = new AuthTokenVerifier({ secret: 'test-secret', issuer: 'auth-server', audience: 'knowledge' });
    const token = verifier.signForTest({
      sub: 'user_1',
      username: 'alice',
      roles: ['knowledge_user'],
      status: 'enabled',
      aud: ['knowledge'],
      exp: Math.floor(Date.now() / 1000) + 60
    });

    expect(verifier.verify(token)).toMatchObject({ userId: 'user_1', username: 'alice' });
  });
});
```

- [ ] **Step 2: Write PostgreSQL repository mapping test**

Create `apps/backend/knowledge-server/test/knowledge/knowledge-postgres.repository.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PostgresKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-postgres.repository';

describe('PostgresKnowledgeRepository', () => {
  it('maps knowledge base rows', async () => {
    const repository = new PostgresKnowledgeRepository({
      query: async () => ({
        rows: [
          {
            id: 'kb_1',
            name: 'Engineering KB',
            description: 'Notes',
            created_by_user_id: 'user_1',
            status: 'active',
            created_at: '2026-05-02T12:00:00.000Z',
            updated_at: '2026-05-02T12:00:00.000Z'
          }
        ]
      })
    });

    await expect(repository.listBasesForUser('user_1')).resolves.toMatchObject([
      { id: 'kb_1', name: 'Engineering KB' }
    ]);
  });
});
```

- [ ] **Step 3: Run new tests and verify they fail**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-auth.guard.spec.ts apps/backend/knowledge-server/test/knowledge/knowledge-postgres.repository.spec.ts
```

Expected: FAIL because verifier and repository do not exist.

- [ ] **Step 4: Add auth token verifier**

Create `apps/backend/knowledge-server/src/auth/auth-token-verifier.ts`:

```ts
import { createHmac } from 'node:crypto';

export interface AuthTokenVerifierOptions {
  secret: string;
  issuer: string;
  audience: string;
}

interface AuthJwtPayload {
  sub: string;
  username: string;
  roles: string[];
  status: string;
  iss: string;
  aud: string[];
  exp: number;
}

export interface KnowledgeAuthUser {
  userId: string;
  username: string;
  roles: string[];
}

export class AuthTokenVerifier {
  constructor(private readonly options: AuthTokenVerifierOptions) {}

  verify(token: string): KnowledgeAuthUser {
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) throw new Error('Invalid token');
    if (signature !== this.signSegment(`${header}.${body}`)) throw new Error('Invalid signature');
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AuthJwtPayload;
    if (payload.iss !== this.options.issuer) throw new Error('Invalid issuer');
    if (!payload.aud.includes(this.options.audience)) throw new Error('Invalid audience');
    if (payload.status !== 'enabled') throw new Error('Account disabled');
    if (payload.exp <= Math.floor(Date.now() / 1000)) throw new Error('Token expired');
    return { userId: payload.sub, username: payload.username, roles: payload.roles };
  }

  signForTest(payload: Omit<AuthJwtPayload, 'iss'>): string {
    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const body = encode({ ...payload, iss: this.options.issuer });
    return `${header}.${body}.${this.signSegment(`${header}.${body}`)}`;
  }

  private signSegment(value: string): string {
    return createHmac('sha256', this.options.secret).update(value).digest('base64url');
  }
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
```

- [ ] **Step 5: Add PostgreSQL repository**

Create `apps/backend/knowledge-server/src/knowledge/repositories/knowledge-postgres.repository.ts`:

```ts
import type {
  KnowledgeBase,
  KnowledgeBaseCreateRequest,
  KnowledgeBaseMember,
  KnowledgeBaseMemberCreateRequest,
  KnowledgeBaseMemberRole
} from '@agent/core';
import type { KnowledgeRepository } from './knowledge.repository';

interface PgClientLike {
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

export class PostgresKnowledgeRepository implements KnowledgeRepository {
  constructor(private readonly client: PgClientLike) {}

  async createBase(
    input: KnowledgeBaseCreateRequest & { id: string; createdByUserId: string }
  ): Promise<KnowledgeBase> {
    const result = await this.client.query(
      `insert into knowledge_bases (id, name, description, created_by_user_id, status)
       values ($1, $2, $3, $4, 'active')
       returning id, name, description, created_by_user_id, status, created_at, updated_at`,
      [input.id, input.name, input.description ?? '', input.createdByUserId]
    );
    return mapBase(result.rows[0]);
  }

  async listBasesForUser(userId: string): Promise<KnowledgeBase[]> {
    const result = await this.client.query(
      `select b.id, b.name, b.description, b.created_by_user_id, b.status, b.created_at, b.updated_at
       from knowledge_bases b
       join knowledge_base_members m on m.knowledge_base_id = b.id
       where m.user_id = $1
       order by b.updated_at desc`,
      [userId]
    );
    return result.rows.map(mapBase);
  }

  async findBase(baseId: string): Promise<KnowledgeBase | undefined> {
    const result = await this.client.query(
      `select id, name, description, created_by_user_id, status, created_at, updated_at
       from knowledge_bases where id = $1 limit 1`,
      [baseId]
    );
    return result.rows[0] ? mapBase(result.rows[0]) : undefined;
  }

  async addMember(input: KnowledgeBaseMemberCreateRequest & { knowledgeBaseId: string }): Promise<KnowledgeBaseMember> {
    const result = await this.client.query(
      `insert into knowledge_base_members (knowledge_base_id, user_id, role)
       values ($1, $2, $3)
       on conflict (knowledge_base_id, user_id) do update set role = excluded.role, updated_at = now()
       returning knowledge_base_id, user_id, role, created_at, updated_at`,
      [input.knowledgeBaseId, input.userId, input.role]
    );
    return mapMember(result.rows[0]);
  }

  async findMember(baseId: string, userId: string): Promise<KnowledgeBaseMember | undefined> {
    const result = await this.client.query(
      `select knowledge_base_id, user_id, role, created_at, updated_at
       from knowledge_base_members where knowledge_base_id = $1 and user_id = $2 limit 1`,
      [baseId, userId]
    );
    return result.rows[0] ? mapMember(result.rows[0]) : undefined;
  }

  async listMembers(baseId: string): Promise<KnowledgeBaseMember[]> {
    const result = await this.client.query(
      `select knowledge_base_id, user_id, role, created_at, updated_at
       from knowledge_base_members where knowledge_base_id = $1 order by user_id`,
      [baseId]
    );
    return result.rows.map(mapMember);
  }
}

function mapBase(row: Record<string, unknown>): KnowledgeBase {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? ''),
    createdByUserId: String(row.created_by_user_id),
    status: row.status as KnowledgeBase['status'],
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString()
  };
}

function mapMember(row: Record<string, unknown>): KnowledgeBaseMember {
  return {
    knowledgeBaseId: String(row.knowledge_base_id),
    userId: String(row.user_id),
    role: row.role as KnowledgeBaseMemberRole,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString()
  };
}
```

- [ ] **Step 6: Run tests and typecheck**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge
pnpm exec tsc -p apps/backend/knowledge-server/tsconfig.json --noEmit
```

Expected: both commands pass.

- [ ] **Step 7: Commit knowledge auth and repository**

Run:

```bash
git add apps/backend/knowledge-server/src/auth apps/backend/knowledge-server/src/knowledge/repositories/knowledge-postgres.repository.ts apps/backend/knowledge-server/test/knowledge
git commit -m "feat: add knowledge auth and postgres repository"
```

## Task 7: Wire Frontends To Auth And Knowledge Services

**Files:**

- Modify: `apps/frontend/agent-admin/src/features/auth/api/admin-auth.api.ts`
- Create: `apps/frontend/agent-admin/src/features/identity/api/auth-service-client.ts`
- Create: `apps/frontend/agent-admin/src/features/identity/pages/users-page.tsx`
- Modify: `apps/frontend/agent-admin/src/app/admin-routes.tsx` or `apps/frontend/agent-admin/src/app/app.tsx`
- Test: `apps/frontend/agent-admin/test/features/identity/users-page.test.tsx`
- Modify: `apps/frontend/knowledge/src/api/auth-client.ts`
- Modify: `apps/frontend/knowledge/src/api/knowledge-api-client.ts`
- Test: `apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts`

- [ ] **Step 1: Write frontend client path tests**

Create or update `apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createKnowledgeApiClient } from '../src/api/knowledge-api-client';

describe('knowledge real API paths', () => {
  it('calls the knowledge-server base URL for knowledge bases', async () => {
    const calls: string[] = [];
    const client = createKnowledgeApiClient({
      baseUrl: 'http://127.0.0.1:3020/api',
      getAccessToken: () => 'access-token',
      fetchImpl: async input => {
        calls.push(String(input));
        return new Response(JSON.stringify({ bases: [] }), { status: 200 });
      }
    });

    await client.listKnowledgeBases();

    expect(calls[0]).toBe('http://127.0.0.1:3020/api/knowledge/bases');
  });
});
```

Create `apps/frontend/agent-admin/test/features/identity/users-page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UsersPage } from '../../../src/features/identity/pages/users-page';

describe('UsersPage', () => {
  it('renders auth-server users', async () => {
    render(
      <UsersPage
        client={{
          listUsers: async () => ({
            users: [
              {
                id: 'user_1',
                username: 'admin',
                displayName: 'Admin',
                roles: ['admin'],
                status: 'enabled'
              }
            ]
          })
        }}
      />
    );

    expect(await screen.findByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run frontend tests and verify they fail**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts apps/frontend/agent-admin/test/features/identity/users-page.test.tsx
```

Expected: FAIL because client factory or users page injection does not yet match.

- [ ] **Step 3: Add admin auth-service client**

Create `apps/frontend/agent-admin/src/features/identity/api/auth-service-client.ts`:

```ts
import { AuthUsersListResponseSchema, type AuthUsersListResponse } from '@agent/core';

export interface AuthServiceClientOptions {
  baseUrl: string;
  getAccessToken: () => string | undefined;
  fetchImpl?: typeof fetch;
}

export interface AuthServiceClient {
  listUsers(): Promise<AuthUsersListResponse>;
}

export function createAuthServiceClient(options: AuthServiceClientOptions): AuthServiceClient {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async listUsers() {
      const response = await fetchImpl(`${options.baseUrl.replace(/\/$/, '')}/auth/users`, {
        headers: {
          authorization: `Bearer ${options.getAccessToken() ?? ''}`
        }
      });
      const body = await response.json();
      return AuthUsersListResponseSchema.parse(body);
    }
  };
}
```

- [ ] **Step 4: Add admin users page**

Create `apps/frontend/agent-admin/src/features/identity/pages/users-page.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { AuthAccount, AuthUsersListResponse } from '@agent/core';

export interface UsersPageClient {
  listUsers(): Promise<AuthUsersListResponse>;
}

export function UsersPage({ client }: { client: UsersPageClient }) {
  const [users, setUsers] = useState<AuthAccount[]>([]);

  useEffect(() => {
    void client.listUsers().then(result => setUsers(result.users));
  }, [client]);

  return (
    <section>
      <h1>用户管理</h1>
      <table>
        <thead>
          <tr>
            <th>显示名</th>
            <th>账号</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id}>
              <td>{user.displayName}</td>
              <td>{user.username}</td>
              <td>{user.status === 'enabled' ? '启用' : '禁用'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

- [ ] **Step 5: Update knowledge API client factory**

Modify `apps/frontend/knowledge/src/api/knowledge-api-client.ts` so the real client accepts service URL and token getter:

```ts
export interface KnowledgeApiClientOptions {
  baseUrl: string;
  getAccessToken: () => string | undefined;
  fetchImpl?: typeof fetch;
}

export function createKnowledgeApiClient(options: KnowledgeApiClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/$/, '');

  return {
    async listKnowledgeBases() {
      const response = await fetchImpl(`${baseUrl}/knowledge/bases`, {
        headers: {
          authorization: `Bearer ${options.getAccessToken() ?? ''}`
        }
      });
      if (!response.ok) throw new Error(`Knowledge API failed: ${response.status}`);
      return response.json();
    }
  };
}
```

Preserve existing exported methods by adapting them to call the new `baseUrl` helper rather than deleting unrelated frontend behavior.

- [ ] **Step 6: Update frontend environment defaults**

Use these env names in the relevant frontend client setup:

```ts
const AUTH_SERVICE_BASE_URL = import.meta.env.VITE_AUTH_SERVICE_BASE_URL ?? 'http://127.0.0.1:3010/api';
const KNOWLEDGE_SERVICE_BASE_URL = import.meta.env.VITE_KNOWLEDGE_SERVICE_BASE_URL ?? 'http://127.0.0.1:3020/api';
```

Admin auth login should call `${AUTH_SERVICE_BASE_URL}/auth/login`. Knowledge login should call the same auth endpoint. Knowledge business calls should use `KNOWLEDGE_SERVICE_BASE_URL`.

- [ ] **Step 7: Run frontend tests and typechecks**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts apps/frontend/agent-admin/test/features/identity/users-page.test.tsx
pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit
pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit
```

Expected: all commands pass.

- [ ] **Step 8: Commit frontend wiring**

Run:

```bash
git add apps/frontend/agent-admin apps/frontend/knowledge
git commit -m "feat: wire frontends to auth and knowledge services"
```

## Task 8: Document Canonical Service Split And Mark Old Paths

**Files:**

- Create: `docs/contracts/api/auth.md`
- Modify: `docs/contracts/api/knowledge.md`
- Create: `docs/apps/backend/auth-server/README.md`
- Create: `docs/apps/backend/knowledge-server/README.md`
- Create: `docs/apps/backend/knowledge-server/knowledge-server.md`
- Modify: `docs/apps/frontend/agent-admin/admin-auth.md`
- Modify: `docs/apps/frontend/knowledge/knowledge-frontend.md`
- Modify: `docs/integration/frontend-backend-integration.md`

- [ ] **Step 1: Add auth API contract doc**

Create `docs/contracts/api/auth.md`:

````md
# Auth Service API

状态：current
文档类型：reference
适用范围：`apps/backend/auth-server`、`apps/frontend/agent-admin`、`apps/frontend/knowledge`
最后核对：2026-05-02

统一登录服务采用账号密码登录和 JWT Access Token + Refresh Token 轮换机制。第一版直接由前端调用，不实现 OIDC。

## 1. Canonical Entry

`auth-server` 是 admin 和 knowledge 的 canonical 登录入口。

```text
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
GET  /api/auth/users
POST /api/auth/users
POST /api/auth/users/:userId/disable
POST /api/auth/users/:userId/enable
```
````

## 2. Permission Boundary

`auth-server` 只负责身份、用户状态和全局角色。Knowledge base membership、chat 工具权限和 admin 中心细粒度权限不写入登录服务。

````

- [ ] **Step 2: Add backend service README docs**

Create `docs/apps/backend/auth-server/README.md`:

```md
# auth-server docs

状态：current
文档类型：index
适用范围：`apps/backend/auth-server`
最后核对：2026-05-02

当前文档：

- docs/apps/backend/auth-server/auth-server.md
````

Create `docs/apps/backend/knowledge-server/README.md`:

```md
# knowledge-server docs

状态：current
文档类型：index
适用范围：`apps/backend/knowledge-server`
最后核对：2026-05-02

当前文档：

- docs/apps/backend/knowledge-server/knowledge-server.md
```

Create `docs/apps/backend/knowledge-server/knowledge-server.md`:

```md
# Knowledge Server

状态：current
文档类型：reference
适用范围：`apps/backend/knowledge-server`
最后核对：2026-05-02

## 本主题主文档：

本文只覆盖：knowledge-server 服务边界、知识库成员权限和 auth-server token 消费方式。

`knowledge-server` 是 knowledge 前端的 canonical 业务 API 宿主。它不处理账号密码登录，只校验 `auth-server` 签发的 Access Token，并通过 `knowledge_base_members` 判断 `owner | editor | viewer` 权限。
```

- [ ] **Step 3: Mark knowledge contract canonical service**

Modify `docs/contracts/api/knowledge.md` near the top:

```md
> 当前 canonical 业务入口：`apps/backend/knowledge-server`。`apps/backend/agent-server` 中仍存在的 knowledge 入口仅作为迁移期间兼容路径，不再承接新增 knowledge 主业务。
```

- [ ] **Step 4: Update frontend integration doc**

Modify `docs/integration/frontend-backend-integration.md` with this service split:

````md
## Auth / Knowledge Service Split

`agent-admin` 和 `apps/frontend/knowledge` 第一阶段直接调用 `auth-server` 完成登录。`apps/frontend/knowledge` 的知识库业务请求直接调用 `knowledge-server`，并携带 `auth-server` 签发的 Access Token。

```text
agent-admin login -> auth-server /api/auth/login
agent-admin users -> auth-server /api/auth/users
knowledge login -> auth-server /api/auth/login
knowledge bases -> knowledge-server /api/knowledge/bases
```
````

````

- [ ] **Step 5: Run docs check**

Run:

```bash
pnpm check:docs
````

Expected: docs check passes.

- [ ] **Step 6: Commit docs**

Run:

```bash
git add docs/contracts/api/auth.md docs/contracts/api/knowledge.md docs/apps/backend/auth-server docs/apps/backend/knowledge-server docs/apps/frontend/agent-admin/admin-auth.md docs/apps/frontend/knowledge/knowledge-frontend.md docs/integration/frontend-backend-integration.md
git commit -m "docs: document auth and knowledge service split"
```

## Task 9: Final Verification And Cleanup

**Files:**

- Modify only files needed to fix verification failures.
- Do not remove old `agent-server` auth or knowledge code until frontend calls are verified against new services.

- [ ] **Step 1: Run affected contract and service tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/auth-knowledge-service-contracts.test.ts apps/backend/auth-server/test apps/backend/knowledge-server/test
```

Expected: all tests pass.

- [ ] **Step 2: Run affected type checks**

Run:

```bash
pnpm exec tsc -p packages/core/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/auth-server/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/knowledge-server/tsconfig.json --noEmit
pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit
pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit
```

Expected: all type checks pass.

- [ ] **Step 3: Run docs and workspace checks**

Run:

```bash
pnpm check:docs
pnpm build:lib
```

Expected: both commands pass.

- [ ] **Step 4: Inspect old path usage**

Run:

```bash
rg -n "/api/admin/auth|/api/knowledge|knowledge-auth|admin-auth" apps/frontend docs/contracts docs/apps
```

Expected: any remaining old path references are either intentional compatibility documentation or tests explicitly covering migration behavior.

- [ ] **Step 5: Commit final cleanup if needed**

If Step 4 required cleanup, run:

```bash
git add <files-cleaned-by-step-4>
git commit -m "chore: clean service split migration references"
```

If no cleanup is needed, do not create an empty commit.

## Self-Review

- Spec coverage:
  - Independent NestJS `auth-server`: Tasks 2, 3, 4.
  - Independent NestJS `knowledge-server`: Tasks 2, 5, 6.
  - PostgreSQL persistence: Tasks 4 and 6.
  - Admin login and user management: Task 7.
  - Knowledge login and direct knowledge API: Task 7.
  - Auth only owns identity and knowledge owns permissions: Tasks 1, 3, 5, 8.
  - Documentation and old-path marking: Task 8.
  - Verification: Task 9.
- Placeholder scan: no incomplete placeholder sections are intentionally left in the plan.
- Type consistency: schema names, service names, and role names match the design spec and are reused consistently across backend and frontend tasks.
