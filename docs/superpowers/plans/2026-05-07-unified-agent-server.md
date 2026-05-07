# Unified Agent Server Implementation Plan

状态：draft
文档类型：plan
适用范围：`apps/backend/agent-server`、`apps/backend/auth-server`、`apps/backend/knowledge-server`、`docs/contracts/api/**`、`docs/integration/frontend-backend-integration.md`
最后核对：2026-05-07

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge `auth-server` and `knowledge-server` into `apps/backend/agent-server` as the only backend API Host, with unified Identity, explicit permissions, stable route aliases, safer persistence defaults, and hardened remote skill installation.

**Architecture:** `agent-server` becomes API Host + BFF + Composition Root. HTTP/SSE lives in `src/api`, business domains live in `src/domains`, admin BFF projections live in `src/platform`, and third-party/database/process concerns live in `src/infrastructure`.

**Tech Stack:** NestJS 11, TypeScript, zod, Vitest, pg, fs-extra, existing `@agent/*` workspace packages, existing `pnpm` verification scripts.

---

## File Structure Map

Create these top-level backend structure files first:

- `apps/backend/agent-server/src/app/app.module.ts`: new composition root that imports API, domain, platform, infrastructure modules.
- `apps/backend/agent-server/src/app/app.bootstrap.ts`: Nest app setup, global prefix, CORS, route logging, global filters and pipes.
- `apps/backend/agent-server/src/app/app.persistence.ts`: explicit persistence mode resolver and persistence module imports.
- `apps/backend/agent-server/src/app.module.ts`: short compatibility export for Nest CLI and existing imports.
- `apps/backend/agent-server/src/main.ts`: thin bootstrap entrypoint.

Create these shared infrastructure units:

- `apps/backend/agent-server/src/infrastructure/config/backend-env.schema.ts`: zod schema for unified backend env.
- `apps/backend/agent-server/src/infrastructure/config/backend-config.service.ts`: typed config facade.
- `apps/backend/agent-server/src/infrastructure/config/cors.ts`: moved CORS options.
- `apps/backend/agent-server/src/shared/pipes/zod-validation.pipe.ts`: body/query/param parse helper for controller decorators.
- `apps/backend/agent-server/src/shared/errors/http-error.filter.ts`: stable schema/auth/permission error mapping.

Move or create these domain units during migration:

- `apps/backend/agent-server/src/domains/identity/**`: migrated auth module, unified token/session/user/permission services, legacy auth alias support.
- `apps/backend/agent-server/src/domains/knowledge/**`: migrated knowledge API, repository, RAG, upload, storage, ingestion, settings and eval services.
- `apps/backend/agent-server/src/domains/runtime/**`: moved backend runtime host, centers, skills, connectors, schedules, workflow facades.
- `apps/backend/agent-server/src/domains/tools/**`: moved agent-tools, sandbox, auto-review execution domain.
- `apps/backend/agent-server/src/domains/governance/**`: approvals, audit and policy helpers.
- `apps/backend/agent-server/src/domains/workflow/**`: workflow runs, dispatchers and workflow BFF facades.

Create these API units:

- `apps/backend/agent-server/src/api/identity/identity.controller.ts`
- `apps/backend/agent-server/src/api/identity/legacy-auth.controller.ts`
- `apps/backend/agent-server/src/api/knowledge/knowledge.controller.ts`
- `apps/backend/agent-server/src/api/knowledge/legacy-knowledge.controller.ts`
- `apps/backend/agent-server/src/api/platform/*.controller.ts`
- `apps/backend/agent-server/src/api/tools/*.controller.ts`
- `apps/backend/agent-server/src/api/workflow/*.controller.ts`
- Existing `src/chat/*` controllers may move to `src/api/chat/*` only after route contract tests protect `/api/chat/*`.

Keep these package boundaries:

- `packages/runtime` remains the runtime main-chain host.
- `agents/*` remain graph/flow/prompt/schema hosts.
- `packages/core` remains stable schema-first contract home.
- `packages/knowledge` remains reusable SDK/runtime contract package.

## Commit and Verification Rhythm

Use short commits after each task. Do not use `git commit --no-verify`.

Expected recurring commands:

```bash
pnpm check:docs
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/backend/agent-server turbo:test:unit
```

When a task touches `package.json`, workspace packages, or package scripts, also run:

```bash
pnpm install
pnpm build:lib
```

## Task 1: Align the Existing Unified Backend Red Test With the Approved Architecture

**Files:**

- Modify: `apps/backend/agent-server/test/unified-backend/app-module-unified.spec.ts`
- Test: `apps/backend/agent-server/test/unified-backend/app-module-unified.spec.ts`

- [ ] **Step 1: Replace the stale package-boundary assertion with the approved directory-boundary assertion**

Use this test content:

```ts
import { existsSync, readFileSync } from 'node:fs';

describe('agent-server unified backend composition', () => {
  it('keeps agent-server as the single backend host with internal domain boundaries', () => {
    const appModule = readFileSync(new URL('../../src/app.module.ts', import.meta.url), 'utf8');

    expect(appModule).not.toContain("from '@agent/auth-server'");
    expect(appModule).not.toContain("from '@agent/knowledge-server'");
    expect(appModule).not.toContain('../auth-server/src');
    expect(appModule).not.toContain('../knowledge-server/src');
  });

  it('defines the target unified backend directories before migration work starts', () => {
    const root = new URL('../../src/', import.meta.url);

    expect(existsSync(new URL('app/', root))).toBe(true);
    expect(existsSync(new URL('api/', root))).toBe(true);
    expect(existsSync(new URL('domains/', root))).toBe(true);
    expect(existsSync(new URL('infrastructure/', root))).toBe(true);
    expect(existsSync(new URL('platform/', root))).toBe(true);
    expect(existsSync(new URL('shared/', root))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the directory assertion fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/unified-backend/app-module-unified.spec.ts
```

Expected: FAIL because `src/app`, `src/api`, `src/domains`, `src/infrastructure`, `src/shared` do not all exist yet.

- [ ] **Step 3: Create directory placeholders with README files**

Create:

```text
apps/backend/agent-server/src/app/README.md
apps/backend/agent-server/src/api/README.md
apps/backend/agent-server/src/domains/README.md
apps/backend/agent-server/src/infrastructure/README.md
apps/backend/agent-server/src/platform/README.md
apps/backend/agent-server/src/shared/README.md
```

Use this content for `src/app/README.md`:

```md
# app

Nest composition root for the unified backend. This directory owns module wiring, bootstrap setup, global filters, global pipes, and lifecycle configuration.
```

Use this content for `src/api/README.md`:

```md
# api

HTTP and SSE adapter layer for the unified backend. Controllers in this directory parse requests, apply zod schemas, enforce permissions, and delegate to domain or platform facades.
```

Use this content for `src/domains/README.md`:

```md
# domains

Backend-local business domains for identity, knowledge, chat, runtime, governance, tools, and workflow. Stable cross-package contracts still belong in `packages/core` or the owning package.
```

Use this content for `src/infrastructure/README.md`:

```md
# infrastructure

Adapters for database, config, auth guards, external processes, storage, workers, and logging. Domain services consume project-defined interfaces instead of vendor objects.
```

Use this content for `src/platform/README.md`:

```md
# platform

Agent Admin BFF projections and center-specific response assembly. This directory must not become a domain rule host.
```

Use this content for `src/shared/README.md`:

```md
# shared

Small backend-local helpers. Promote reusable contracts to a real `packages/*` owner instead of growing this directory into a shared package.
```

- [ ] **Step 4: Run the focused test and confirm it passes**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/unified-backend/app-module-unified.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add apps/backend/agent-server/test/unified-backend apps/backend/agent-server/src/app/README.md apps/backend/agent-server/src/api/README.md apps/backend/agent-server/src/domains/README.md apps/backend/agent-server/src/infrastructure/README.md apps/backend/agent-server/src/platform/README.md apps/backend/agent-server/src/shared/README.md
git commit -m "test: align unified backend architecture guard"
```

Expected: commit succeeds after hooks pass.

## Task 2: Introduce Unified Backend Config and Explicit Persistence Mode

**Files:**

- Create: `apps/backend/agent-server/src/infrastructure/config/backend-env.schema.ts`
- Create: `apps/backend/agent-server/src/infrastructure/config/backend-config.service.ts`
- Create: `apps/backend/agent-server/src/app/app.persistence.ts`
- Modify: `apps/backend/agent-server/src/app.persistence.ts`
- Modify: `apps/backend/agent-server/test/app-persistence.spec.ts`

- [ ] **Step 1: Write failing persistence tests**

Replace `apps/backend/agent-server/test/app-persistence.spec.ts` with:

```ts
import { describe, expect, it } from 'vitest';

import {
  createPersistenceImports,
  resolveBackendPersistenceMode,
  shouldEnablePersistence
} from '../src/app.persistence';

describe('agent-server persistence module wiring', () => {
  it('defaults local and test bootstraps to memory persistence', () => {
    expect(resolveBackendPersistenceMode({ NODE_ENV: 'development' })).toBe('memory');
    expect(resolveBackendPersistenceMode({ NODE_ENV: 'test' })).toBe('memory');
    expect(createPersistenceImports({ NODE_ENV: 'test' })).toEqual([]);
  });

  it('enables postgres only when explicitly requested', () => {
    expect(shouldEnablePersistence({ BACKEND_PERSISTENCE: 'postgres', DATABASE_URL: 'postgres://db' })).toBe(true);
    expect(createPersistenceImports({ BACKEND_PERSISTENCE: 'postgres', DATABASE_URL: 'postgres://db' })).toHaveLength(
      2
    );
  });

  it('fails fast when production requests postgres without DATABASE_URL', () => {
    expect(() => resolveBackendPersistenceMode({ NODE_ENV: 'production', BACKEND_PERSISTENCE: 'postgres' })).toThrow(
      /DATABASE_URL/
    );
  });

  it('keeps legacy database opt-in for existing tests during migration', () => {
    expect(
      createPersistenceImports({
        NODE_ENV: 'test',
        AGENT_SERVER_ENABLE_DATABASE_IN_TEST: 'true',
        DATABASE_URL: 'postgres://db'
      })
    ).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/app-persistence.spec.ts
```

Expected: FAIL because `resolveBackendPersistenceMode` does not exist.

- [ ] **Step 3: Add backend env schema**

Create `apps/backend/agent-server/src/infrastructure/config/backend-env.schema.ts`:

```ts
import { z } from 'zod';

export const BackendPersistenceModeSchema = z.enum(['memory', 'postgres']);

export const BackendEnvSchema = z.object({
  NODE_ENV: z.string().optional(),
  DATABASE_URL: z.string().min(1).optional(),
  BACKEND_PERSISTENCE: BackendPersistenceModeSchema.optional(),
  BACKEND_RUN_MIGRATIONS: z.enum(['true', 'false']).optional(),
  BACKEND_ENABLE_LEGACY_ROUTES: z.enum(['true', 'false']).optional(),
  BACKEND_REMOTE_SKILL_INSTALL_ENABLED: z.enum(['true', 'false']).optional(),
  BACKEND_BACKGROUND_ENABLED: z.enum(['true', 'false']).optional(),
  AGENT_SERVER_ENABLE_DATABASE_IN_TEST: z.enum(['true', 'false']).optional()
});

export type BackendEnv = z.infer<typeof BackendEnvSchema>;
export type BackendPersistenceMode = z.infer<typeof BackendPersistenceModeSchema>;

export function parseBackendEnv(env: NodeJS.ProcessEnv): BackendEnv {
  return BackendEnvSchema.parse(env);
}
```

- [ ] **Step 4: Add typed config facade**

Create `apps/backend/agent-server/src/infrastructure/config/backend-config.service.ts`:

```ts
import { Injectable } from '@nestjs/common';

import { parseBackendEnv, type BackendEnv, type BackendPersistenceMode } from './backend-env.schema';

@Injectable()
export class BackendConfigService {
  private readonly env: BackendEnv;

  constructor(source: NodeJS.ProcessEnv = process.env) {
    this.env = parseBackendEnv(source);
  }

  get persistenceMode(): BackendPersistenceMode {
    return this.env.BACKEND_PERSISTENCE ?? 'memory';
  }

  get databaseUrl(): string | undefined {
    return this.env.DATABASE_URL;
  }

  get legacyRoutesEnabled(): boolean {
    return this.env.BACKEND_ENABLE_LEGACY_ROUTES !== 'false';
  }

  get remoteSkillInstallEnabled(): boolean {
    return this.env.BACKEND_REMOTE_SKILL_INSTALL_ENABLED === 'true';
  }
}
```

- [ ] **Step 5: Update persistence resolver**

Modify `apps/backend/agent-server/src/app.persistence.ts` so it exports:

```ts
import type { DynamicModule, Type } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import type { BackendPersistenceMode } from './infrastructure/config/backend-env.schema';
import { WorkflowRun } from './workflow-runs/entities/workflow-run.entity';
import { WorkflowRunsModule } from './workflow-runs/workflow-runs.module';

export type PersistenceImport = DynamicModule | Type<unknown>;

export interface AppPersistenceEnv {
  BACKEND_PERSISTENCE?: string;
  DATABASE_URL?: string;
  DB_HOST?: string;
  DB_PORT?: string;
  DB_USER?: string;
  DB_PASS?: string;
  DB_NAME?: string;
  NODE_ENV?: string;
  AGENT_SERVER_ENABLE_DATABASE_IN_TEST?: string;
}

export function resolveBackendPersistenceMode(env: AppPersistenceEnv = process.env): BackendPersistenceMode {
  if (env.AGENT_SERVER_ENABLE_DATABASE_IN_TEST === 'true') {
    if (!env.DATABASE_URL && !env.DB_HOST) {
      throw new Error('DATABASE_URL or DB_HOST is required when AGENT_SERVER_ENABLE_DATABASE_IN_TEST=true');
    }
    return 'postgres';
  }

  const mode = env.BACKEND_PERSISTENCE ?? 'memory';
  if (mode !== 'memory' && mode !== 'postgres') {
    throw new Error(`Unsupported BACKEND_PERSISTENCE mode: ${mode}`);
  }

  if (mode === 'postgres' && !env.DATABASE_URL && !env.DB_HOST) {
    throw new Error('DATABASE_URL or DB_HOST is required when BACKEND_PERSISTENCE=postgres');
  }

  return mode;
}

export function shouldEnablePersistence(env: AppPersistenceEnv = process.env): boolean {
  return resolveBackendPersistenceMode(env) === 'postgres';
}

export function createPersistenceImports(env: AppPersistenceEnv = process.env): PersistenceImport[] {
  if (!shouldEnablePersistence(env)) {
    return [];
  }

  return [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: env.DATABASE_URL,
      host: env.DATABASE_URL ? undefined : (env.DB_HOST ?? 'localhost'),
      port: env.DATABASE_URL ? undefined : parseInt(env.DB_PORT ?? '5432', 10),
      username: env.DATABASE_URL ? undefined : (env.DB_USER ?? 'postgres'),
      password: env.DATABASE_URL ? undefined : (env.DB_PASS ?? 'postgres'),
      database: env.DATABASE_URL ? undefined : (env.DB_NAME ?? 'agent_db'),
      entities: [WorkflowRun],
      synchronize: false
    }),
    WorkflowRunsModule
  ];
}
```

- [ ] **Step 6: Run persistence test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/app-persistence.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

Run:

```bash
git add apps/backend/agent-server/src/app.persistence.ts apps/backend/agent-server/src/infrastructure/config apps/backend/agent-server/test/app-persistence.spec.ts
git commit -m "refactor: make backend persistence explicit"
```

Expected: commit succeeds after hooks pass.

## Task 3: Add Shared Zod Validation and Permission Guard Infrastructure

**Files:**

- Create: `apps/backend/agent-server/src/shared/pipes/zod-validation.pipe.ts`
- Create: `apps/backend/agent-server/src/infrastructure/auth/decorators/require-permission.decorator.ts`
- Create: `apps/backend/agent-server/src/infrastructure/auth/guards/permission.guard.ts`
- Create: `apps/backend/agent-server/src/infrastructure/auth/permission-evaluator.ts`
- Test: `apps/backend/agent-server/test/infrastructure/auth/permission.guard.spec.ts`

- [ ] **Step 1: Write permission guard tests**

Create `apps/backend/agent-server/test/infrastructure/auth/permission.guard.spec.ts`:

```ts
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

import { PermissionGuard } from '../../../src/infrastructure/auth/guards/permission.guard';
import { REQUIRE_PERMISSION_METADATA } from '../../../src/infrastructure/auth/decorators/require-permission.decorator';

function createContext(principal?: { permissions: string[] }) {
  const handler = () => undefined;
  Reflect.defineMetadata(REQUIRE_PERMISSION_METADATA, ['platform:write'], handler);

  return {
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => ({ principal })
    })
  } as never;
}

describe('PermissionGuard', () => {
  it('rejects missing principals', () => {
    const guard = new PermissionGuard(new Reflector());

    expect(() => guard.canActivate(createContext())).toThrow(UnauthorizedException);
  });

  it('rejects principals without the required permission', () => {
    const guard = new PermissionGuard(new Reflector());

    expect(() => guard.canActivate(createContext({ permissions: ['platform:read'] }))).toThrow(ForbiddenException);
  });

  it('allows principals with the required permission', () => {
    const guard = new PermissionGuard(new Reflector());

    expect(guard.canActivate(createContext({ permissions: ['platform:write'] }))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the failing permission test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/infrastructure/auth/permission.guard.spec.ts
```

Expected: FAIL because the guard and decorator do not exist.

- [ ] **Step 3: Add permission decorator**

Create `apps/backend/agent-server/src/infrastructure/auth/decorators/require-permission.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_METADATA = 'backend:required-permissions';

export function RequirePermission(...permissions: string[]) {
  return SetMetadata(REQUIRE_PERMISSION_METADATA, permissions);
}
```

- [ ] **Step 4: Add permission evaluator**

Create `apps/backend/agent-server/src/infrastructure/auth/permission-evaluator.ts`:

```ts
export interface BackendPrincipal {
  userId: string;
  roles: string[];
  permissions: string[];
  authSource: 'identity';
}

export function principalHasPermission(principal: BackendPrincipal, permission: string): boolean {
  if (principal.permissions.includes(permission)) {
    return true;
  }

  const [domain] = permission.split(':');
  return principal.permissions.includes(`${domain}:*`) || principal.permissions.includes('*:*');
}
```

- [ ] **Step 5: Add permission guard**

Create `apps/backend/agent-server/src/infrastructure/auth/guards/permission.guard.ts`:

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { REQUIRE_PERMISSION_METADATA } from '../decorators/require-permission.decorator';
import { principalHasPermission, type BackendPrincipal } from '../permission-evaluator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRE_PERMISSION_METADATA, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!required?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ principal?: BackendPrincipal }>();
    if (!request.principal) {
      throw new UnauthorizedException('identity access token is required');
    }

    const missing = required.filter(permission => !principalHasPermission(request.principal!, permission));
    if (missing.length > 0) {
      throw new ForbiddenException(`missing permissions: ${missing.join(', ')}`);
    }

    return true;
  }
}
```

- [ ] **Step 6: Add zod validation pipe**

Create `apps/backend/agent-server/src/shared/pipes/zod-validation.pipe.ts`:

```ts
import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

@Injectable()
export class ZodValidationPipe<TInput = unknown, TOutput = unknown> implements PipeTransform<TInput, TOutput> {
  constructor(private readonly schema: ZodType<TOutput, TInput>) {}

  transform(value: TInput): TOutput {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'schema_validation_failed',
        issues: parsed.error.issues
      });
    }

    return parsed.data;
  }
}
```

- [ ] **Step 7: Run permission guard tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/infrastructure/auth/permission.guard.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 3**

Run:

```bash
git add apps/backend/agent-server/src/infrastructure/auth apps/backend/agent-server/src/shared/pipes apps/backend/agent-server/test/infrastructure/auth/permission.guard.spec.ts
git commit -m "feat: add backend permission guard primitives"
```

Expected: commit succeeds after hooks pass.

## Task 4: Add Identity Domain Shell and Legacy Auth Aliases

**Files:**

- Create: `apps/backend/agent-server/src/domains/identity/identity.module.ts`
- Create: `apps/backend/agent-server/src/domains/identity/schemas/identity-auth.schemas.ts`
- Create: `apps/backend/agent-server/src/domains/identity/services/identity-auth.service.ts`
- Create: `apps/backend/agent-server/src/api/identity/identity.controller.ts`
- Create: `apps/backend/agent-server/src/api/identity/legacy-auth.controller.ts`
- Modify: `apps/backend/agent-server/src/app.module.ts`
- Test: `apps/backend/agent-server/test/identity/identity-alias.controller.spec.ts`

- [ ] **Step 1: Write identity alias controller tests**

Create `apps/backend/agent-server/test/identity/identity-alias.controller.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { IdentityController } from '../../src/api/identity/identity.controller';
import { LegacyAuthController } from '../../src/api/identity/legacy-auth.controller';

const authService = {
  login: async (body: unknown) => ({ route: 'login', body }),
  refresh: async (body: unknown) => ({ route: 'refresh', body }),
  logout: async (body: unknown) => ({ route: 'logout', body }),
  me: async (principal: unknown) => ({ route: 'me', principal })
};

describe('identity route aliases', () => {
  it('serves login through the canonical identity controller', async () => {
    const controller = new IdentityController(authService as never);

    await expect(controller.login({ username: 'admin', password: 'pw' })).resolves.toMatchObject({ route: 'login' });
  });

  it('serves login through the legacy auth controller without separate auth logic', async () => {
    const controller = new LegacyAuthController(authService as never);

    await expect(controller.login({ username: 'admin', password: 'pw' })).resolves.toMatchObject({ route: 'login' });
  });
});
```

- [ ] **Step 2: Run failing identity alias tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/identity/identity-alias.controller.spec.ts
```

Expected: FAIL because controllers do not exist.

- [ ] **Step 3: Add identity schemas**

Create `apps/backend/agent-server/src/domains/identity/schemas/identity-auth.schemas.ts`:

```ts
import { z } from 'zod';

export const IdentityLoginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export const IdentityRefreshRequestSchema = z.object({
  refreshToken: z.string().min(1)
});

export const IdentityLogoutRequestSchema = z.object({
  refreshToken: z.string().min(1).optional()
});

export type IdentityLoginRequest = z.infer<typeof IdentityLoginRequestSchema>;
export type IdentityRefreshRequest = z.infer<typeof IdentityRefreshRequestSchema>;
export type IdentityLogoutRequest = z.infer<typeof IdentityLogoutRequestSchema>;
```

- [ ] **Step 4: Add identity auth service shell**

Create `apps/backend/agent-server/src/domains/identity/services/identity-auth.service.ts`:

```ts
import { Injectable } from '@nestjs/common';

import {
  IdentityLoginRequestSchema,
  IdentityLogoutRequestSchema,
  IdentityRefreshRequestSchema
} from '../schemas/identity-auth.schemas';

@Injectable()
export class IdentityAuthService {
  async login(body: unknown) {
    const input = IdentityLoginRequestSchema.parse(body);
    return {
      tokenType: 'Bearer' as const,
      accessToken: `dev-access-${input.username}`,
      refreshToken: `dev-refresh-${input.username}`,
      expiresIn: 3600
    };
  }

  async refresh(body: unknown) {
    const input = IdentityRefreshRequestSchema.parse(body);
    return {
      tokenType: 'Bearer' as const,
      accessToken: `dev-access-refresh-${input.refreshToken.slice(0, 8)}`,
      refreshToken: input.refreshToken,
      expiresIn: 3600
    };
  }

  async logout(body: unknown) {
    IdentityLogoutRequestSchema.parse(body ?? {});
    return { ok: true };
  }

  async me(principal: unknown) {
    return { principal };
  }
}
```

This shell is replaced by migrated `auth-server` service logic in Task 5. It exists to wire routes and permissions without copying old controllers first.

- [ ] **Step 5: Add identity controllers**

Create `apps/backend/agent-server/src/api/identity/identity.controller.ts`:

```ts
import { Body, Controller, Get, Post, Req } from '@nestjs/common';

import { IdentityAuthService } from '../../domains/identity/services/identity-auth.service';

@Controller('identity')
export class IdentityController {
  constructor(private readonly identityAuthService: IdentityAuthService) {}

  @Post('login')
  login(@Body() body: unknown) {
    return this.identityAuthService.login(body);
  }

  @Post('refresh')
  refresh(@Body() body: unknown) {
    return this.identityAuthService.refresh(body);
  }

  @Post('logout')
  logout(@Body() body: unknown) {
    return this.identityAuthService.logout(body);
  }

  @Get('me')
  me(@Req() request: { principal?: unknown }) {
    return this.identityAuthService.me(request.principal);
  }
}
```

Create `apps/backend/agent-server/src/api/identity/legacy-auth.controller.ts`:

```ts
import { Body, Controller, Post } from '@nestjs/common';

import { IdentityAuthService } from '../../domains/identity/services/identity-auth.service';

@Controller('auth')
export class LegacyAuthController {
  constructor(private readonly identityAuthService: IdentityAuthService) {}

  @Post('login')
  login(@Body() body: unknown) {
    return this.identityAuthService.login(body);
  }

  @Post('refresh')
  refresh(@Body() body: unknown) {
    return this.identityAuthService.refresh(body);
  }

  @Post('logout')
  logout(@Body() body: unknown) {
    return this.identityAuthService.logout(body);
  }
}
```

- [ ] **Step 6: Add identity module**

Create `apps/backend/agent-server/src/domains/identity/identity.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { IdentityController } from '../../api/identity/identity.controller';
import { LegacyAuthController } from '../../api/identity/legacy-auth.controller';
import { IdentityAuthService } from './services/identity-auth.service';

@Module({
  controllers: [IdentityController, LegacyAuthController],
  providers: [IdentityAuthService],
  exports: [IdentityAuthService]
})
export class IdentityModule {}
```

- [ ] **Step 7: Import IdentityModule in AppModule**

Modify `apps/backend/agent-server/src/app.module.ts` to import and include:

```ts
import { IdentityModule } from './domains/identity/identity.module';
```

Place `IdentityModule` near `AdminAuthModule` in the `imports` array:

```ts
LoggerModule,
IdentityModule,
AdminAuthModule,
RuntimeModule,
```

- [ ] **Step 8: Run identity alias tests and backend typecheck**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/identity/identity-alias.controller.spec.ts
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: both PASS.

- [ ] **Step 9: Commit Task 4**

Run:

```bash
git add apps/backend/agent-server/src/api/identity apps/backend/agent-server/src/domains/identity apps/backend/agent-server/src/app.module.ts apps/backend/agent-server/test/identity/identity-alias.controller.spec.ts
git commit -m "feat: add unified identity route shell"
```

Expected: commit succeeds after hooks pass.

## Task 5: Migrate Auth Server Logic Into Identity Domain

**Files:**

- Move logic from: `apps/backend/auth-server/src/auth/**`
- Modify/Create: `apps/backend/agent-server/src/domains/identity/**`
- Modify: `apps/backend/agent-server/src/api/identity/identity.controller.ts`
- Modify: `apps/backend/agent-server/src/api/identity/legacy-auth.controller.ts`
- Test: migrate relevant tests from `apps/backend/auth-server/test/**` to `apps/backend/agent-server/test/identity/**`

- [ ] **Step 1: Copy auth service tests into identity tests**

Create `apps/backend/agent-server/test/identity/identity-auth.service.spec.ts` by adapting existing auth-server tests. The first minimum test should assert refresh rotation:

```ts
import { describe, expect, it } from 'vitest';

import { IdentityAuthService } from '../../src/domains/identity/services/identity-auth.service';
import { IdentityMemoryRepository } from '../../src/domains/identity/repositories/identity-memory.repository';
import { IdentityPasswordService } from '../../src/domains/identity/services/identity-password.service';
import { IdentityJwtProvider } from '../../src/domains/identity/services/identity-jwt.provider';

describe('IdentityAuthService', () => {
  it('rotates refresh tokens and rejects reused tokens', async () => {
    const repository = await IdentityMemoryRepository.withDefaultOwner(new IdentityPasswordService());
    const service = new IdentityAuthService(
      repository,
      new IdentityPasswordService(),
      new IdentityJwtProvider('test-secret')
    );

    const login = await service.login({ username: 'admin', password: 'admin' });
    const refreshed = await service.refresh({ refreshToken: login.refreshToken });

    expect(refreshed.refreshToken).not.toBe(login.refreshToken);
    await expect(service.refresh({ refreshToken: login.refreshToken })).rejects.toThrow(/invalid|revoked|expired/i);
  });
});
```

- [ ] **Step 2: Run the failing identity service test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/identity/identity-auth.service.spec.ts
```

Expected: FAIL because migrated repository/password/JWT classes do not exist yet.

- [ ] **Step 3: Migrate auth repository and providers**

Move or adapt these files into `src/domains/identity`:

```text
apps/backend/auth-server/src/auth/repositories/auth.repository.ts
apps/backend/auth-server/src/auth/repositories/auth-memory.repository.ts
apps/backend/auth-server/src/auth/repositories/auth-postgres.repository.ts
apps/backend/auth-server/src/auth/password-hasher.provider.ts
apps/backend/auth-server/src/auth/jwt.provider.ts
apps/backend/auth-server/src/auth/auth.errors.ts
apps/backend/auth-server/src/auth/auth-seed.service.ts
apps/backend/auth-server/src/auth/user-management.service.ts
```

Rename classes to the identity naming scheme:

```text
AuthRepository -> IdentityRepository
AuthMemoryRepository -> IdentityMemoryRepository
AuthPostgresRepository -> IdentityPostgresRepository
PasswordHasherProvider -> IdentityPasswordService
JwtProvider -> IdentityJwtProvider
AuthSeedService -> IdentitySeedService
UserManagementService -> IdentityUserService
```

- [ ] **Step 4: Replace shell IdentityAuthService with migrated logic**

Update `apps/backend/agent-server/src/domains/identity/services/identity-auth.service.ts` to use the migrated repository, password service and JWT provider. Preserve these public methods:

```ts
login(body: unknown): Promise<IdentityTokenResponse>
refresh(body: unknown): Promise<IdentityTokenResponse>
logout(body: unknown): Promise<{ ok: true }>
me(principal: BackendPrincipal | undefined): Promise<IdentityMeResponse>
```

- [ ] **Step 5: Wire IdentityModule providers**

Update `apps/backend/agent-server/src/domains/identity/identity.module.ts` to provide:

```ts
IdentityAuthService
IdentityUserService
IdentityPasswordService
IdentityJwtProvider
IdentitySeedService
{
  provide: IdentityRepository,
  useClass: IdentityMemoryRepository
}
```

Postgres identity provider wiring starts after Task 10 schema files exist and must be complete before Task 12 removes old backend apps.

- [ ] **Step 6: Run identity tests and typecheck**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/identity
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

Run:

```bash
git add apps/backend/agent-server/src/domains/identity apps/backend/agent-server/src/api/identity apps/backend/agent-server/test/identity
git commit -m "feat: migrate auth into identity domain"
```

Expected: commit succeeds after hooks pass.

## Task 6: Gate Platform Write Routes With Permissions

**Files:**

- Modify: `apps/backend/agent-server/src/platform/connectors-center.controller.ts`
- Modify: `apps/backend/agent-server/src/platform/skill-sources-center.controller.ts`
- Modify: `apps/backend/agent-server/src/platform/learning-center.controller.ts`
- Modify: `apps/backend/agent-server/src/platform/workspace-center.controller.ts`
- Test: `apps/backend/agent-server/test/platform/platform-permission-guards.spec.ts`

- [ ] **Step 1: Write controller metadata tests**

Create `apps/backend/agent-server/test/platform/platform-permission-guards.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { REQUIRE_PERMISSION_METADATA } from '../../src/infrastructure/auth/decorators/require-permission.decorator';
import { ConnectorsCenterController } from '../../src/platform/connectors-center.controller';
import { SkillSourcesCenterController } from '../../src/platform/skill-sources-center.controller';

function requiredPermissions(controller: Function, methodName: string): string[] | undefined {
  return Reflect.getMetadata(REQUIRE_PERMISSION_METADATA, controller.prototype[methodName]);
}

describe('platform write route permissions', () => {
  it('requires governance permissions for connector policy mutations', () => {
    expect(requiredPermissions(ConnectorsCenterController, 'enableConnector')).toEqual(['governance:write']);
    expect(requiredPermissions(ConnectorsCenterController, 'setConnectorPolicy')).toEqual(['governance:write']);
    expect(requiredPermissions(ConnectorsCenterController, 'configureConnector')).toEqual(['governance:write']);
  });

  it('requires governance permissions for skill install mutations', () => {
    expect(requiredPermissions(SkillSourcesCenterController, 'installSkill')).toEqual(['governance:write']);
    expect(requiredPermissions(SkillSourcesCenterController, 'installRemoteSkill')).toEqual(['governance:write']);
    expect(requiredPermissions(SkillSourcesCenterController, 'approveSkillInstall')).toEqual(['governance:write']);
  });
});
```

- [ ] **Step 2: Run failing metadata tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/platform/platform-permission-guards.spec.ts
```

Expected: FAIL because platform write methods do not have `@RequirePermission`.

- [ ] **Step 3: Add permission decorators to connector write methods**

Add this import to the connector controller:

```ts
import { RequirePermission } from '../infrastructure/auth/decorators/require-permission.decorator';
```

Apply this decorator to write methods:

```ts
@RequirePermission('governance:write')
```

Cover:

```text
enableConnector
disableConnector
setConnectorPolicy
clearConnectorPolicy
setCapabilityPolicy
clearCapabilityPolicy
closeConnectorSession
refreshConnectorDiscovery
configureConnector
```

- [ ] **Step 4: Add permission decorators to skill source write methods**

Add this import to the skill sources controller:

```ts
import { RequirePermission } from '../infrastructure/auth/decorators/require-permission.decorator';
```

Apply this decorator to write methods:

```ts
@RequirePermission('governance:write')
```

Cover:

```text
installSkill
installRemoteSkill
checkInstalledSkills
updateInstalledSkills
enableSkillSource
disableSkillSource
syncSkillSource
approveSkillInstall
rejectSkillInstall
```

- [ ] **Step 5: Register PermissionGuard globally or per module**

For this task, register it in the platform module so tests remain scoped:

```ts
import { APP_GUARD } from '@nestjs/core';
import { PermissionGuard } from '../infrastructure/auth/guards/permission.guard';

providers: [
  RuntimeKnowledgeGovernanceService,
  {
    provide: APP_GUARD,
    useClass: PermissionGuard
  }
];
```

Identity access token enforcement is completed by the Identity migration tasks; this task only adds method-level permission metadata and the guard that reads it.

- [ ] **Step 6: Run metadata tests and platform controller tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/platform/platform-permission-guards.spec.ts apps/backend/agent-server/test/platform
```

Expected: PASS.

- [ ] **Step 7: Commit Task 6**

Run:

```bash
git add apps/backend/agent-server/src/platform apps/backend/agent-server/test/platform apps/backend/agent-server/src/infrastructure/auth
git commit -m "fix: protect platform governance writes"
```

Expected: commit succeeds after hooks pass.

## Task 7: Migrate Knowledge Server Into Knowledge Domain Shell

**Files:**

- Create/Modify: `apps/backend/agent-server/src/domains/knowledge/**`
- Create: `apps/backend/agent-server/src/api/knowledge/knowledge.controller.ts`
- Create: `apps/backend/agent-server/src/api/knowledge/legacy-knowledge.controller.ts`
- Modify: `apps/backend/agent-server/src/app.module.ts`
- Test: `apps/backend/agent-server/test/knowledge-domain/knowledge-route-alias.spec.ts`

- [ ] **Step 1: Write knowledge route alias tests**

Create `apps/backend/agent-server/test/knowledge-domain/knowledge-route-alias.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { KnowledgeApiController } from '../../src/api/knowledge/knowledge.controller';
import { LegacyKnowledgeController } from '../../src/api/knowledge/legacy-knowledge.controller';

const service = {
  listBases: async () => [{ id: 'base_1', name: 'Default' }]
};

describe('knowledge route aliases', () => {
  it('serves knowledge bases through the canonical controller', async () => {
    const controller = new KnowledgeApiController(service as never);

    await expect(controller.listBases()).resolves.toEqual([{ id: 'base_1', name: 'Default' }]);
  });

  it('serves knowledge bases through the legacy controller', async () => {
    const controller = new LegacyKnowledgeController(service as never);

    await expect(controller.listBases()).resolves.toEqual([{ id: 'base_1', name: 'Default' }]);
  });
});
```

- [ ] **Step 2: Run failing knowledge route tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge-domain/knowledge-route-alias.spec.ts
```

Expected: FAIL because controllers do not exist.

- [ ] **Step 3: Create knowledge domain service shell**

Create `apps/backend/agent-server/src/domains/knowledge/services/knowledge-base.service.ts`:

```ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class KnowledgeBaseService {
  async listBases() {
    return [];
  }
}
```

- [ ] **Step 4: Create knowledge API controllers**

Create `apps/backend/agent-server/src/api/knowledge/knowledge.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';

import { KnowledgeBaseService } from '../../domains/knowledge/services/knowledge-base.service';

@Controller('knowledge')
export class KnowledgeApiController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @Get('bases')
  listBases() {
    return this.knowledgeBaseService.listBases();
  }
}
```

Create `apps/backend/agent-server/src/api/knowledge/legacy-knowledge.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';

import { KnowledgeBaseService } from '../../domains/knowledge/services/knowledge-base.service';

@Controller('knowledge/v1')
export class LegacyKnowledgeController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @Get('bases')
  listBases() {
    return this.knowledgeBaseService.listBases();
  }
}
```

- [ ] **Step 5: Create KnowledgeDomainModule**

Create `apps/backend/agent-server/src/domains/knowledge/knowledge-domain.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { KnowledgeApiController } from '../../api/knowledge/knowledge.controller';
import { LegacyKnowledgeController } from '../../api/knowledge/legacy-knowledge.controller';
import { KnowledgeBaseService } from './services/knowledge-base.service';

@Module({
  controllers: [KnowledgeApiController, LegacyKnowledgeController],
  providers: [KnowledgeBaseService],
  exports: [KnowledgeBaseService]
})
export class KnowledgeDomainModule {}
```

- [ ] **Step 6: Import KnowledgeDomainModule in AppModule**

Add:

```ts
import { KnowledgeDomainModule } from './domains/knowledge/knowledge-domain.module';
```

Place it after `IdentityModule`:

```ts
IdentityModule,
KnowledgeDomainModule,
AdminAuthModule,
```

- [ ] **Step 7: Run route tests and typecheck**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge-domain/knowledge-route-alias.spec.ts
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: PASS.

- [ ] **Step 8: Commit Task 7**

Run:

```bash
git add apps/backend/agent-server/src/api/knowledge apps/backend/agent-server/src/domains/knowledge apps/backend/agent-server/src/app.module.ts apps/backend/agent-server/test/knowledge-domain
git commit -m "feat: add knowledge domain route shell"
```

Expected: commit succeeds after hooks pass.

## Task 8: Move Knowledge Server Services and Tests Into the Knowledge Domain

**Files:**

- Move/adapt from: `apps/backend/knowledge-server/src/knowledge/**`
- Move/adapt from: `apps/backend/knowledge-server/src/auth/**`
- Create/Modify: `apps/backend/agent-server/src/domains/knowledge/**`
- Test: migrated knowledge-server tests under `apps/backend/agent-server/test/knowledge-domain/**`

- [x] **Step 1: Move repository contract tests first**

Create `apps/backend/agent-server/test/knowledge-domain/knowledge-repository.contract.spec.ts` by adapting knowledge-server repository tests so they import from:

```ts
import { KnowledgeMemoryRepository } from '../../src/domains/knowledge/repositories/knowledge-memory.repository';
```

The first minimum contract test:

```ts
import { describe, expect, it } from 'vitest';

import { KnowledgeMemoryRepository } from '../../src/domains/knowledge/repositories/knowledge-memory.repository';

describe('KnowledgeRepository contract', () => {
  it('creates and lists knowledge bases for an identity principal', async () => {
    const repository = new KnowledgeMemoryRepository();
    const principal = { userId: 'user_1', permissions: ['knowledge:*'] };

    const base = await repository.createBase({ name: 'Docs', ownerId: principal.userId });
    const bases = await repository.listBases({ userId: principal.userId });

    expect(bases).toContainEqual(base);
  });
});
```

- [x] **Step 2: Run the failing repository contract test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge-domain/knowledge-repository.contract.spec.ts
```

Expected: FAIL because the migrated repository does not exist.

- [x] **Step 3: Move knowledge repository files**

Move or adapt:

```text
apps/backend/knowledge-server/src/knowledge/repositories/knowledge.repository.ts
apps/backend/knowledge-server/src/knowledge/repositories/knowledge-memory.repository.ts
apps/backend/knowledge-server/src/knowledge/repositories/knowledge-postgres.repository.ts
apps/backend/knowledge-server/src/knowledge/repositories/knowledge-postgres.mappers.ts
```

Target:

```text
apps/backend/agent-server/src/domains/knowledge/repositories/
```

Preserve repository method names used by existing knowledge-server controllers. Add identity principal arguments only at controller/service boundaries so repository tests stay focused.

- [x] **Step 4: Move knowledge services in small groups**

Move/adapt in this order:

```text
knowledge.service.ts -> services/knowledge-base.service.ts
knowledge-document.service.ts -> services/knowledge-document.service.ts
knowledge-upload.service.ts -> services/knowledge-upload.service.ts
knowledge-frontend-settings.service.ts -> services/knowledge-settings.service.ts
knowledge-provider-health.service.ts -> services/knowledge-provider-health.service.ts
knowledge-rag.service.ts -> services/knowledge-rag.service.ts
knowledge-eval.service.ts -> services/knowledge-eval.service.ts
```

After each move, run the relevant focused tests from `apps/backend/agent-server/test/knowledge-domain`.

- [ ] **Step 5: Move RAG and storage adapters**

Progress note, 2026-05-07:

- `KnowledgeRepository` memory/postgres implementations have been migrated into `apps/backend/agent-server/src/domains/knowledge/repositories`.
- `createKnowledgeRepositoryProvider()` now binds `KNOWLEDGE_REPOSITORY` to memory by default or postgres when explicitly configured with `DATABASE_URL`.
- `KnowledgeBaseService`, `KnowledgeUploadService`, `KnowledgeDocumentService`, `KnowledgeIngestionWorker` and `KnowledgeRagService` now consume the repository token instead of the memory implementation class.
- HyDE, planner, rerank and hallucination detector pure RAG providers have been migrated under `src/domains/knowledge/rag`.
- `createKnowledgeSdkRuntimeProvider()` has been migrated under `src/domains/knowledge/runtime` and registered in `KnowledgeDomainModule`; it stays disabled unless SDK env is complete.
- `knowledge-rag-sdk.providers.ts` and `knowledge-server-search-service.adapter.ts` have been migrated under `src/domains/knowledge/rag`, with tests covering deterministic planning, answer provider failure capture, vector-first search and keyword fallback.
- `KnowledgeRagSdkFacade` has been migrated under `src/domains/knowledge/rag` and `KnowledgeRagService` now uses it when `KNOWLEDGE_SDK_RUNTIME` is enabled, while preserving local repository-backed RAG when SDK env is absent.
- `AliyunOssStorageProvider` and `createKnowledgeOssStorageProvider()` have been migrated under `src/domains/knowledge/storage`; upload/document/ingestion services now consume the `KNOWLEDGE_OSS_STORAGE` token, defaulting to memory and switching to Aliyun only when OSS env is complete.
- Public document/upload/chat/conversation/feedback HTTP endpoints now live in the unified `KnowledgeApiController`, mounted on both `/api/knowledge/*` and `/api/knowledge/v1/*` through one controller. Chat Lab `stream:true` SSE parity has been migrated into the unified controller/domain service path and emits `@agent/knowledge` `KnowledgeRagStreamEvent` frames.

Move/adapt:

```text
apps/backend/knowledge-server/src/knowledge/rag/**
apps/backend/knowledge-server/src/knowledge/storage/**
apps/backend/knowledge-server/src/knowledge/runtime/knowledge-sdk-runtime.provider.ts
```

Target:

```text
apps/backend/agent-server/src/domains/knowledge/rag/
apps/backend/agent-server/src/domains/knowledge/storage/
```

Keep vendor SDK objects inside `rag/` and `storage/` adapters.

- [ ] **Step 6: Run migrated knowledge tests and typecheck**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge-domain
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: PASS.

- [ ] **Step 7: Commit Task 8**

Run:

```bash
git add apps/backend/agent-server/src/domains/knowledge apps/backend/agent-server/src/api/knowledge apps/backend/agent-server/test/knowledge-domain
git commit -m "feat: migrate knowledge into agent server"
```

Expected: commit succeeds after hooks pass.

## Task 9: Harden Remote Skill Install Execution

**Files:**

- Create: `apps/backend/agent-server/src/infrastructure/external-process/command-runner.ts`
- Create: `apps/backend/agent-server/src/infrastructure/external-process/skills-cli-runner.ts`
- Modify: `apps/backend/agent-server/src/runtime/skills/runtime-skill-cli.ts`
- Modify: `apps/backend/agent-server/src/runtime/skills/runtime-skill-install.service.ts`
- Test: `apps/backend/agent-server/test/runtime/skills/runtime-skill-cli.test.ts`
- Test: `apps/backend/agent-server/test/runtime/skills/runtime-skill-install.service.test.ts`

Progress note, 2026-05-07:

- `runtime-skill-cli.ts` now exposes `buildSkills*CommandPlan()` builders and keeps the legacy string builders for receipt/UI compatibility.
- Default remote skill install/check/update now execute through `execSkillsCommand()` and `src/infrastructure/external-process/*`, which uses `execFile(command, args)` with a minimal env allowlist instead of `shell.exec(commandString)`.
- Focused tests cover command-plan construction and default install service delegation to the controlled runner.

- [ ] **Step 1: Add failing tests for execFile-style command execution**

Extend `runtime-skill-cli.test.ts` with:

```ts
import { buildSkillsAddArgs, buildSkillsAddCommandPlan } from '../../../src/runtime/skills/runtime-skill-cli';

it('builds an executable command plan without shell operators', () => {
  const plan = buildSkillsAddCommandPlan({ repo: 'vercel-labs/skills', skillName: 'find-skills' });

  expect(plan).toEqual({
    command: 'npx',
    args: ['skills', 'add', 'vercel-labs/skills@find-skills', '-g', '-y']
  });
});

it('keeps the legacy arg builder compatible', () => {
  expect(buildSkillsAddArgs({ repo: 'vercel-labs/skills', skillName: 'find-skills' })).toEqual([
    'skills',
    'add',
    'vercel-labs/skills@find-skills',
    '-g',
    '-y'
  ]);
});
```

- [ ] **Step 2: Run the failing runtime skill CLI tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/runtime/skills/runtime-skill-cli.test.ts
```

Expected: FAIL because `buildSkillsAddCommandPlan` does not exist.

- [ ] **Step 3: Add command runner abstraction**

Create `apps/backend/agent-server/src/infrastructure/external-process/command-runner.ts`:

```ts
import { execFile } from 'node:child_process';

export interface ExternalCommandPlan {
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

export interface ExternalCommandResult {
  stdout: string;
  stderr: string;
}

export function runExternalCommand(plan: ExternalCommandPlan): Promise<ExternalCommandResult> {
  return new Promise((resolve, reject) => {
    execFile(
      plan.command,
      plan.args,
      {
        env: plan.env,
        timeout: plan.timeoutMs ?? 60_000,
        maxBuffer: 1024 * 1024
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || stdout || error.message));
          return;
        }

        resolve({ stdout, stderr });
      }
    );
  });
}
```

- [ ] **Step 4: Add command plan builders**

Modify `runtime-skill-cli.ts` to export:

```ts
export interface SkillsCommandPlan {
  command: 'npx';
  args: string[];
}

export function buildSkillsAddCommandPlan(params: SkillsAddParams): SkillsCommandPlan {
  return {
    command: 'npx',
    args: buildSkillsAddArgs(params)
  };
}

export function buildSkillsCheckCommandPlan(): SkillsCommandPlan {
  return {
    command: 'npx',
    args: ['skills', 'check']
  };
}

export function buildSkillsUpdateCommandPlan(): SkillsCommandPlan {
  return {
    command: 'npx',
    args: ['skills', 'update']
  };
}
```

- [ ] **Step 5: Replace shell execution with command runner**

Modify `execShellCommand` or replace it with:

```ts
import { runExternalCommand } from '../../infrastructure/external-process/command-runner';

export function execSkillsCommand(plan: SkillsCommandPlan) {
  assertSafeSkillsArgs(plan.args);
  return runExternalCommand({
    command: plan.command,
    args: plan.args,
    env: resolveSkillsCommandEnv(process.env),
    timeoutMs: 60_000
  });
}
```

Add:

```ts
export function resolveSkillsCommandEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    PATH: env.PATH,
    HOME: env.HOME,
    USER: env.USER,
    npm_config_registry: env.npm_config_registry
  };
}
```

- [ ] **Step 6: Run runtime skill tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/runtime/skills/runtime-skill-cli.test.ts apps/backend/agent-server/test/runtime/skills/runtime-skill-install.service.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 9**

Run:

```bash
git add apps/backend/agent-server/src/infrastructure/external-process apps/backend/agent-server/src/runtime/skills apps/backend/agent-server/test/runtime/skills
git commit -m "fix: run skill cli through controlled exec file"
```

Expected: commit succeeds after hooks pass.

## Task 10: Move Database Schemas Into Unified Infrastructure

**Files:**

- Create: `apps/backend/agent-server/src/infrastructure/database/schemas/identity-schema.sql.ts`
- Create: `apps/backend/agent-server/src/infrastructure/database/schemas/knowledge-schema.sql.ts`
- Create: `apps/backend/agent-server/src/infrastructure/database/schemas/runtime-schema.sql.ts`
- Create: `apps/backend/agent-server/src/infrastructure/database/migrations/0001_identity.sql`
- Create: `apps/backend/agent-server/src/infrastructure/database/migrations/0002_knowledge.sql`
- Create: `apps/backend/agent-server/src/infrastructure/database/migrations/0003_runtime_workflows.sql`
- Test: `apps/backend/agent-server/test/infrastructure/database/unified-schema.spec.ts`

- [x] **Step 1: Write schema presence tests**

Create `apps/backend/agent-server/test/infrastructure/database/unified-schema.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { IDENTITY_SCHEMA_SQL } from '../../../src/infrastructure/database/schemas/identity-schema.sql';
import { KNOWLEDGE_SCHEMA_SQL } from '../../../src/infrastructure/database/schemas/knowledge-schema.sql';
import { RUNTIME_SCHEMA_SQL } from '../../../src/infrastructure/database/schemas/runtime-schema.sql';

describe('unified backend database schemas', () => {
  it('defines identity tables', () => {
    expect(IDENTITY_SCHEMA_SQL).toContain('identity_users');
    expect(IDENTITY_SCHEMA_SQL).toContain('identity_refresh_sessions');
  });

  it('defines knowledge tables', () => {
    expect(KNOWLEDGE_SCHEMA_SQL).toContain('knowledge_bases');
    expect(KNOWLEDGE_SCHEMA_SQL).toContain('knowledge_documents');
  });

  it('defines runtime workflow tables', () => {
    expect(RUNTIME_SCHEMA_SQL).toContain('workflow_runs');
  });
});
```

- [x] **Step 2: Run failing schema tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/infrastructure/database/unified-schema.spec.ts
```

Expected: FAIL because schema files do not exist.

- [x] **Step 3: Add identity schema SQL**

Create `identity-schema.sql.ts`:

```ts
export const IDENTITY_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS identity_users (
  id text PRIMARY KEY,
  username text NOT NULL UNIQUE,
  display_name text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS identity_password_credentials (
  user_id text PRIMARY KEY REFERENCES identity_users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS identity_refresh_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES identity_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;
```

- [x] **Step 4: Add knowledge schema SQL**

Create `knowledge-schema.sql.ts` by adapting `apps/backend/knowledge-server/src/knowledge/runtime/knowledge-schema.sql.ts`. Ensure it exports:

```ts
export const KNOWLEDGE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS knowledge_bases (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id text PRIMARY KEY,
  base_id text NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`;
```

Implemented with the current unified agent-server Knowledge Domain DDL, including uploads, chunks, chat, eval tables and vector helper functions, rather than leaving the two-table starter schema as the final artifact.

- [x] **Step 5: Add runtime schema SQL**

Create `runtime-schema.sql.ts`:

```ts
export const RUNTIME_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS workflow_runs (
  id varchar(64) PRIMARY KEY,
  "workflowId" varchar(128) NOT NULL,
  status varchar(32) NOT NULL,
  "startedAt" bigint NOT NULL,
  "completedAt" bigint,
  "inputData" jsonb,
  "traceData" jsonb
);
`;
```

- [x] **Step 6: Add migration files**

Each migration file imports no TypeScript. Copy SQL text into:

```text
0001_identity.sql
0002_knowledge.sql
0003_runtime_workflows.sql
```

- [x] **Step 7: Run schema tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/infrastructure/database/unified-schema.spec.ts
```

Expected: PASS.

- [x] **Step 8: Commit Task 10**

Run:

```bash
git add apps/backend/agent-server/src/infrastructure/database apps/backend/agent-server/test/infrastructure/database
git commit -m "feat: add unified backend database schemas"
```

Expected: commit succeeds after hooks pass.

## Task 11: Update API and Integration Documentation for Unified Backend

**Files:**

- Modify: `docs/apps/backend/agent-server/agent-server-overview.md`
- Modify: `docs/apps/backend/agent-server/README.md`
- Modify: `docs/integration/frontend-backend-integration.md`
- Modify: `docs/contracts/api/auth.md`
- Modify: `docs/contracts/api/admin-auth.md`
- Modify: `docs/contracts/api/knowledge.md`
- Modify: `docs/contracts/api/agent-admin.md`
- Modify: `docs/contracts/api/tool-execution.md`

- [ ] **Step 1: Scan stale backend service split language**

Run:

```bash
rg "auth-server|knowledge-server|canonical 服务|canonical knowledge|Auth / Knowledge Service Split" docs/apps docs/contracts docs/integration AGENTS.md
```

Expected: output includes the current split docs that must be updated during this task.

- [ ] **Step 2: Update frontend-backend integration doc**

In `docs/integration/frontend-backend-integration.md`, replace the `Auth / Knowledge Service Split` section with:

```md
## Unified Backend Service

`apps/backend/agent-server` is the single backend API host. Identity, Knowledge, Chat, Platform Centers, Tool execution, Sandbox, Auto Review and Workflow BFF routes are served under the same `/api` prefix.

Compatibility aliases remain during migration:

- `/api/auth/*` delegates to `/api/identity/*`.
- `/api/admin/auth/*` delegates to Identity admin compatibility handlers.
- `/api/knowledge/v1/*` delegates to `/api/knowledge/*`.

New frontend code must target the canonical unified paths. Alias removal requires the agent-admin, agent-chat and knowledge frontends to stop calling legacy paths.
```

- [ ] **Step 3: Update agent-server overview**

In `docs/apps/backend/agent-server/agent-server-overview.md`, add this responsibility list near the top:

```md
`agent-server` is now the single backend API Host. It owns:

- Identity and role/permission evaluation.
- Frontend-facing Knowledge API.
- Chat, Runtime and Platform Center BFF routes.
- Tool execution, Sandbox and Auto Review facades.
- Workflow BFF routes.
```

- [ ] **Step 4: Update API contract docs**

Update contract docs so they state:

```md
Canonical backend host: `apps/backend/agent-server`.
Legacy route aliases are migration compatibility only.
```

Apply this to:

```text
docs/contracts/api/auth.md
docs/contracts/api/admin-auth.md
docs/contracts/api/knowledge.md
docs/contracts/api/agent-admin.md
docs/contracts/api/tool-execution.md
```

- [ ] **Step 5: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

- [ ] **Step 6: Commit Task 11**

Run:

```bash
git add docs/apps/backend/agent-server docs/integration/frontend-backend-integration.md docs/contracts/api
git commit -m "docs: document unified backend service"
```

Expected: commit succeeds after hooks pass.

## Task 12: Remove Old Backend Apps After Route and Test Parity

**Files:**

- Delete: `apps/backend/auth-server/**`
- Delete: `apps/backend/knowledge-server/**`
- Modify: `pnpm-workspace.yaml`
- Modify: root `package.json`
- Modify: `turbo.json`
- Modify: docs indexes that still require old backend app directories
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Confirm no production imports rely on old backend apps**

Run:

```bash
rg "@agent/auth-server|@agent/knowledge-server|apps/backend/auth-server|apps/backend/knowledge-server" --glob '!docs/**'
```

Expected: no production references. Test references must either be removed or migrated.

- [ ] **Step 2: Remove old apps from workspace manifests**

Edit:

```text
pnpm-workspace.yaml
turbo.json
package.json
```

Remove scripts that start or build `auth-server` and `knowledge-server`. Keep only `agent-server` backend scripts.

- [ ] **Step 3: Delete old app directories**

Run:

```bash
git rm -r apps/backend/auth-server apps/backend/knowledge-server
```

Expected: files are staged for deletion.

- [ ] **Step 4: Update docs indexes**

Update `scripts/check-docs.js` by removing these entries from `REQUIRED_INDEX_DIRS` after the matching docs are moved to archive:

```text
docs/apps/backend/auth-server/README.md
docs/apps/backend/knowledge-server/README.md
```

Move historical material to `docs/archive/backend-service-split/` and add `docs/archive/backend-service-split/README.md` before removing the old required index entries.

- [ ] **Step 5: Refresh lockfile**

Run:

```bash
pnpm install
```

Expected: `pnpm-lock.yaml` removes importers for `apps/backend/auth-server` and `apps/backend/knowledge-server`.

- [ ] **Step 6: Run final backend and docs verification**

Run:

```bash
pnpm build:lib
pnpm --dir apps/backend/agent-server build
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/backend/agent-server test
pnpm check:docs
```

Expected: all PASS.

- [ ] **Step 7: Commit Task 12**

Run:

```bash
git add .
git commit -m "chore: remove split backend apps"
```

Expected: commit succeeds after hooks pass.

## Final Review Checklist

- [ ] `apps/backend/agent-server` is the only backend app.
- [ ] `/api/identity/*` works and `/api/auth/*` is a thin alias.
- [ ] `/api/knowledge/*` works and `/api/knowledge/v1/*` is a thin alias.
- [ ] Platform write routes require permissions.
- [ ] `BACKEND_PERSISTENCE=memory` is default for local/test.
- [ ] Postgres requires explicit config and `synchronize` is disabled.
- [ ] Remote skill install is disabled by default and uses controlled `execFile` execution.
- [ ] Runtime graph/flow/prompt ownership remains in `packages/runtime` and `agents/*`.
- [ ] Docs no longer describe `auth-server` or `knowledge-server` as canonical current services.
- [ ] `pnpm-lock.yaml` no longer has importers for removed backend apps after Task 12.
