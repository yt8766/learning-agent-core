# LLM Gateway E2E Implementation Plan

状态：snapshot
文档类型：note
适用范围：`apps/llm-gateway`
最后核对：2026-04-25

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add containerized E2E coverage for `apps/llm-gateway` that starts an isolated Docker Compose stack, seeds test data, validates backend HTTP contracts, and tears the stack down automatically.

**Architecture:** Add a dedicated E2E compose stack with Postgres, the llm-gateway app, and a runner service. The app uses a Postgres-backed gateway runtime when `LLM_GATEWAY_RUNTIME=postgres`, while default local bootstrap behavior remains unchanged. E2E specs live under `apps/llm-gateway/test/e2e/` and are excluded from ordinary Vitest integration.

**Tech Stack:** TypeScript, Next.js route handlers, Vitest, Docker Compose, PostgreSQL 16, `pg`, `zod`, Node `fetch`.

---

## Scope Check

This plan covers one subsystem: `apps/llm-gateway` backend E2E. It intentionally excludes UI E2E, real provider smoke tests, root `pnpm verify` integration, and public API key management screens.

The accepted design is [LLM Gateway E2E Test Design](/docs/superpowers/specs/2026-04-25-llm-gateway-e2e-design.md).

## File Map

- Create `apps/llm-gateway/docker-compose.e2e.yml`: isolated Postgres/app/runner test stack.
- Create `apps/llm-gateway/Dockerfile.e2e`: deterministic app and runner image for E2E.
- Create `apps/llm-gateway/scripts/run-e2e.mjs`: lifecycle wrapper for container and host runners.
- Modify `apps/llm-gateway/package.json`: add `test:e2e`, `test:e2e:local`, `test:e2e:up`, `test:e2e:down`.
- Create `apps/llm-gateway/src/repositories/postgres-gateway.ts`: Postgres implementation for gateway API keys, models, usage, and request logs.
- Modify `apps/llm-gateway/src/gateway/route-runtime.ts`: support `LLM_GATEWAY_RUNTIME=postgres` while preserving bootstrap memory runtime.
- Create `apps/llm-gateway/test/postgres-gateway-repository.test.ts`: fake-client unit coverage for schema, key verification, model listing, usage, and logs.
- Create `apps/llm-gateway/test/e2e/fixtures.ts`: stable keys, env constants, request helpers, schema assertions.
- Create `apps/llm-gateway/test/e2e/seed.ts`: seed admin owner, virtual keys, models, and usage data into E2E Postgres.
- Create `apps/llm-gateway/test/e2e/wait-for-gateway.ts`: wait until the app responds before specs run.
- Create `apps/llm-gateway/test/e2e/llm-gateway-http.e2e-spec.ts`: backend HTTP E2E coverage.
- Create `docs/integration/llm-gateway-e2e.md`: operational E2E documentation.
- Modify `docs/integration/README.md`: add the E2E documentation entry.
- Modify `apps/llm-gateway/test/env-docs.test.ts`: assert E2E docs/scripts/compose remain discoverable.

## Task 1: Lock E2E Scaffolding Contracts

**Files:**

- Modify: `apps/llm-gateway/test/env-docs.test.ts`
- Later create: `apps/llm-gateway/docker-compose.e2e.yml`
- Later create: `apps/llm-gateway/Dockerfile.e2e`
- Later create: `apps/llm-gateway/scripts/run-e2e.mjs`
- Later modify: `apps/llm-gateway/package.json`

- [ ] **Step 1: Add failing documentation/config assertions**

Append these assertions to the existing `describe` block in `apps/llm-gateway/test/env-docs.test.ts`:

```ts
it('documents and exposes the isolated E2E compose stack', () => {
  const packageJson = JSON.parse(readRepoFile('apps/llm-gateway/package.json')) as {
    scripts?: Record<string, string>;
  };

  expect(packageJson.scripts?.['test:e2e']).toBe('node scripts/run-e2e.mjs --runner=container');
  expect(packageJson.scripts?.['test:e2e:local']).toBe('node scripts/run-e2e.mjs --runner=host');
  expect(packageJson.scripts?.['test:e2e:up']).toBe(
    'docker compose -f docker-compose.e2e.yml up -d llm-gateway-e2e-postgres llm-gateway-e2e-app'
  );
  expect(packageJson.scripts?.['test:e2e:down']).toBe(
    'docker compose -f docker-compose.e2e.yml down -v --remove-orphans'
  );

  const compose = readRepoFile('apps/llm-gateway/docker-compose.e2e.yml');
  expect(compose).toContain('llm-gateway-e2e-postgres:');
  expect(compose).toContain('llm-gateway-e2e-app:');
  expect(compose).toContain('llm-gateway-e2e-runner:');
  expect(compose).toContain('LLM_GATEWAY_RUNTIME: postgres');
  expect(compose).toContain('LLM_GATEWAY_PROVIDER_MODE: mock');
  expect(compose).not.toContain('container_name: learning-agent-llm-gateway-postgres');
  expect(compose).not.toContain('./.db/postgres');

  const e2eDocs = readRepoFile('docs/integration/llm-gateway-e2e.md');
  expect(e2eDocs).toContain('pnpm --dir apps/llm-gateway test:e2e');
  expect(e2eDocs).toContain('docker-compose.e2e.yml');
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/llm-gateway/test/env-docs.test.ts
```

Expected: FAIL because `test:e2e`, `docker-compose.e2e.yml`, and `docs/integration/llm-gateway-e2e.md` do not exist yet.

- [ ] **Step 3: Do not implement in this task**

Leave the test red. The next tasks add the missing files and make this contract pass.

## Task 2: Add Postgres Gateway Repository

**Files:**

- Create: `apps/llm-gateway/src/repositories/postgres-gateway.ts`
- Create: `apps/llm-gateway/test/postgres-gateway-repository.test.ts`

- [ ] **Step 1: Write the failing repository test**

Create `apps/llm-gateway/test/postgres-gateway-repository.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { createPostgresGatewayRepositoryForClient } from '../src/repositories/postgres-gateway.js';

type QueryCall = { text: string; values?: unknown[] };

class FakePgClient {
  readonly calls: QueryCall[] = [];
  readonly apiKeys = new Map<string, Record<string, unknown>>();
  readonly models = new Map<string, Record<string, unknown>>();
  readonly usageRows: Record<string, { used_tokens_today: number; used_cost_today: number }> = {};
  readonly logs: unknown[] = [];
  readonly usageRecords: unknown[] = [];

  async query(text: string, values?: unknown[]) {
    this.calls.push({ text, values });

    if (text.includes('select * from gateway_api_keys where key_prefix = $1')) {
      const row = this.apiKeys.get(String(values?.[0]));
      return { rows: row ? [row] : [] };
    }

    if (text.includes('select coalesce(sum(total_tokens)')) {
      return { rows: [this.usageRows[String(values?.[0])] ?? { used_tokens_today: 0, used_cost_today: 0 }] };
    }

    if (text.includes('select * from gateway_models where alias = $1')) {
      const row = this.models.get(String(values?.[0]));
      return { rows: row ? [row] : [] };
    }

    if (text.includes('select * from gateway_models order by alias asc')) {
      return { rows: [...this.models.values()] };
    }

    if (text.includes('insert into gateway_api_keys')) {
      this.apiKeys.set(String(values?.[2]), {
        id: values?.[0],
        name: values?.[1],
        key_prefix: values?.[2],
        key_hash: values?.[3],
        status: values?.[4],
        models: values?.[5],
        rpm_limit: values?.[6],
        tpm_limit: values?.[7],
        daily_token_limit: values?.[8],
        daily_cost_limit: values?.[9],
        expires_at: values?.[10]
      });
      return { rows: [] };
    }

    if (text.includes('insert into gateway_models')) {
      this.models.set(String(values?.[0]), {
        alias: values?.[0],
        provider: values?.[1],
        provider_model: values?.[2],
        enabled: values?.[3],
        context_window: values?.[4],
        input_price_per_1m_tokens: values?.[5],
        output_price_per_1m_tokens: values?.[6],
        fallback_aliases: values?.[7],
        admin_only: values?.[8]
      });
      return { rows: [] };
    }

    if (text.includes('insert into gateway_usage')) {
      this.usageRecords.push(values);
      return { rows: [] };
    }

    if (text.includes('insert into gateway_request_logs')) {
      this.logs.push(values);
      return { rows: [] };
    }

    return { rows: [] };
  }
}

const secret = 'e2e-test-secret';
const plaintext = 'sk-llmgw_test_valid_000000000000';
const prefix = plaintext.slice(0, 16);

describe('postgres gateway repository', () => {
  it('maps key, model, usage, and log records through the gateway repository contract', async () => {
    const client = new FakePgClient();
    const repository = createPostgresGatewayRepositoryForClient(client, { apiKeySecret: secret });

    await repository.saveSeedApiKey({
      id: 'key-valid',
      name: 'E2E valid key',
      plaintext,
      status: 'active',
      models: ['gpt-main'],
      rpmLimit: 10,
      tpmLimit: 1000,
      dailyTokenLimit: 10000,
      dailyCostLimit: 1,
      expiresAt: null
    });

    client.models.set('gpt-main', {
      alias: 'gpt-main',
      provider: 'mock',
      provider_model: 'mock-gpt-main',
      enabled: true,
      context_window: 128000,
      input_price_per_1m_tokens: 0,
      output_price_per_1m_tokens: 0,
      fallback_aliases: [],
      admin_only: false
    });
    client.usageRows['key-valid'] = { used_tokens_today: 12, used_cost_today: 0.001 };

    await expect(repository.verifyApiKey(plaintext)).resolves.toMatchObject({
      id: 'key-valid',
      status: 'active',
      models: ['gpt-main'],
      usedTokensToday: 0
    });
    await expect(repository.getUsageForToday('key-valid')).resolves.toEqual({
      usedTokensToday: 12,
      usedCostToday: 0.001
    });
    await expect(repository.findModelByAlias('gpt-main')).resolves.toMatchObject({
      alias: 'gpt-main',
      provider: 'mock',
      providerModel: 'mock-gpt-main',
      enabled: true
    });

    await repository.recordUsage({
      keyId: 'key-valid',
      model: 'gpt-main',
      promptTokens: 5,
      completionTokens: 7,
      totalTokens: 12,
      estimatedCost: 0.001
    });
    await repository.writeRequestLog({ keyId: 'key-valid', model: 'gpt-main', status: 'success' });

    expect(client.calls.some(call => call.text.includes('create table if not exists gateway_api_keys'))).toBe(true);
    expect(client.calls.some(call => call.text.includes('create table if not exists gateway_models'))).toBe(true);
    expect(client.usageRecords).toHaveLength(1);
    expect(client.logs).toHaveLength(1);
    expect(client.apiKeys.get(prefix)?.key_hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
```

- [ ] **Step 2: Run the repository test and verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/llm-gateway/test/postgres-gateway-repository.test.ts
```

Expected: FAIL with an import error for `../src/repositories/postgres-gateway.js`.

- [ ] **Step 3: Implement the repository**

Create `apps/llm-gateway/src/repositories/postgres-gateway.ts`:

```ts
import pg from 'pg';

import type { KeyStatus } from '../contracts';
import type { GatewayKeyRecord, GatewayModelRecord, GatewayRepository } from '../gateway/gateway-service';
import { createVirtualApiKeyForPlaintext, verifyVirtualApiKey } from '../keys/api-key';

type PgQueryable = {
  query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
};

const { Pool } = pg;

export interface PostgresGatewayRepositoryOptions {
  apiKeySecret: string;
}

export interface SeedApiKeyInput {
  id: string;
  name: string;
  plaintext: string;
  status: KeyStatus;
  models: string[];
  rpmLimit: number | null;
  tpmLimit: number | null;
  dailyTokenLimit: number | null;
  dailyCostLimit: number | null;
  expiresAt: string | null;
}

export type PostgresGatewayRepository = GatewayRepository & {
  listModels(): Promise<GatewayModelRecord[]>;
  findModelByAlias(alias: string): Promise<GatewayModelRecord | undefined>;
  saveModel(model: GatewayModelRecord): Promise<void>;
  saveSeedApiKey(input: SeedApiKeyInput): Promise<void>;
};

export function createPostgresGatewayRepository(
  connectionString: string,
  options: PostgresGatewayRepositoryOptions
): PostgresGatewayRepository {
  return createPostgresGatewayRepositoryForClient(new Pool({ connectionString }), options);
}

export function createPostgresGatewayRepositoryForClient(
  client: PgQueryable,
  options: PostgresGatewayRepositoryOptions
): PostgresGatewayRepository {
  let schemaReady: Promise<void> | null = null;

  async function ensureSchema(): Promise<void> {
    schemaReady ??= createSchema(client);
    await schemaReady;
  }

  return {
    async verifyApiKey(plaintext) {
      await ensureSchema();
      const prefix = plaintext.slice(0, 16);
      const result = await client.query('select * from gateway_api_keys where key_prefix = $1 limit 1', [prefix]);
      const row = result.rows[0];

      if (!row) {
        return null;
      }

      const valid = await verifyVirtualApiKey(plaintext, String(row.key_hash), options.apiKeySecret);
      return valid ? mapKeyRow(row) : null;
    },
    async getUsageForToday(keyId) {
      await ensureSchema();
      const result = await client.query(
        `select
          coalesce(sum(total_tokens), 0)::int as used_tokens_today,
          coalesce(sum(estimated_cost), 0)::float as used_cost_today
        from gateway_usage
        where key_id = $1 and created_at >= date_trunc('day', now())`,
        [keyId]
      );
      const row = result.rows[0] ?? {};
      return {
        usedTokensToday: Number(row.used_tokens_today ?? 0),
        usedCostToday: Number(row.used_cost_today ?? 0)
      };
    },
    async recordUsage(usage) {
      await ensureSchema();
      const value = usage as Record<string, unknown>;
      await client.query(
        `insert into gateway_usage (
          id, key_id, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost, created_at
        ) values ($1, $2, $3, $4, $5, $6, $7, now())`,
        [
          `usage_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          value.keyId,
          value.model,
          value.promptTokens,
          value.completionTokens,
          value.totalTokens,
          value.estimatedCost
        ]
      );
    },
    async writeRequestLog(log) {
      await ensureSchema();
      await client.query(`insert into gateway_request_logs (id, payload, created_at) values ($1, $2, now())`, [
        `log_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        JSON.stringify(log)
      ]);
    },
    async listModels() {
      await ensureSchema();
      const result = await client.query('select * from gateway_models order by alias asc');
      return result.rows.map(mapModelRow);
    },
    async findModelByAlias(alias) {
      await ensureSchema();
      const result = await client.query('select * from gateway_models where alias = $1 limit 1', [alias]);
      return result.rows[0] ? mapModelRow(result.rows[0]) : undefined;
    },
    async saveModel(model) {
      await ensureSchema();
      await client.query(
        `insert into gateway_models (
          alias, provider, provider_model, enabled, context_window,
          input_price_per_1m_tokens, output_price_per_1m_tokens, fallback_aliases, admin_only
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        on conflict (alias) do update set
          provider = excluded.provider,
          provider_model = excluded.provider_model,
          enabled = excluded.enabled,
          context_window = excluded.context_window,
          input_price_per_1m_tokens = excluded.input_price_per_1m_tokens,
          output_price_per_1m_tokens = excluded.output_price_per_1m_tokens,
          fallback_aliases = excluded.fallback_aliases,
          admin_only = excluded.admin_only`,
        [
          model.alias,
          model.provider,
          model.providerModel,
          model.enabled,
          model.contextWindow ?? null,
          model.inputPricePer1mTokens ?? null,
          model.outputPricePer1mTokens ?? null,
          model.fallbackAliases ?? [],
          model.adminOnly ?? false
        ]
      );
    },
    async saveSeedApiKey(input) {
      await ensureSchema();
      const created = createVirtualApiKeyForPlaintext(input.plaintext, options.apiKeySecret);
      await client.query(
        `insert into gateway_api_keys (
          id, name, key_prefix, key_hash, status, models, rpm_limit, tpm_limit,
          daily_token_limit, daily_cost_limit, expires_at, created_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
        on conflict (id) do update set
          name = excluded.name,
          key_prefix = excluded.key_prefix,
          key_hash = excluded.key_hash,
          status = excluded.status,
          models = excluded.models,
          rpm_limit = excluded.rpm_limit,
          tpm_limit = excluded.tpm_limit,
          daily_token_limit = excluded.daily_token_limit,
          daily_cost_limit = excluded.daily_cost_limit,
          expires_at = excluded.expires_at`,
        [
          input.id,
          input.name,
          created.prefix,
          created.hash,
          input.status,
          input.models,
          input.rpmLimit,
          input.tpmLimit,
          input.dailyTokenLimit,
          input.dailyCostLimit,
          input.expiresAt
        ]
      );
    }
  };
}

async function createSchema(client: PgQueryable): Promise<void> {
  await client.query(`
    create table if not exists gateway_api_keys (
      id text primary key,
      name text not null,
      key_prefix text not null unique,
      key_hash text not null,
      status text not null check (status in ('active', 'disabled', 'revoked')),
      models text[] not null,
      rpm_limit integer null,
      tpm_limit integer null,
      daily_token_limit integer null,
      daily_cost_limit double precision null,
      expires_at timestamptz null,
      created_at timestamptz not null,
      revoked_at timestamptz null
    )
  `);
  await client.query(`
    create table if not exists gateway_models (
      alias text primary key,
      provider text not null,
      provider_model text not null,
      enabled boolean not null,
      context_window integer null,
      input_price_per_1m_tokens double precision null,
      output_price_per_1m_tokens double precision null,
      fallback_aliases text[] not null default '{}',
      admin_only boolean not null default false
    )
  `);
  await client.query(`
    create table if not exists gateway_usage (
      id text primary key,
      key_id text not null,
      model text not null,
      prompt_tokens integer not null,
      completion_tokens integer not null,
      total_tokens integer not null,
      estimated_cost double precision not null,
      created_at timestamptz not null
    )
  `);
  await client.query(`
    create table if not exists gateway_request_logs (
      id text primary key,
      payload jsonb not null,
      created_at timestamptz not null
    )
  `);
}

function mapKeyRow(row: Record<string, unknown>): GatewayKeyRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    status: row.status === 'disabled' ? 'disabled' : row.status === 'revoked' ? 'revoked' : 'active',
    models: Array.isArray(row.models) ? row.models.map(String) : [],
    rpmLimit: nullableNumber(row.rpm_limit),
    tpmLimit: nullableNumber(row.tpm_limit),
    dailyTokenLimit: nullableNumber(row.daily_token_limit),
    dailyCostLimit: nullableNumber(row.daily_cost_limit),
    usedTokensToday: 0,
    usedCostToday: 0,
    expiresAt: row.expires_at ? toIsoString(row.expires_at) : null
  };
}

function mapModelRow(row: Record<string, unknown>): GatewayModelRecord {
  return {
    alias: String(row.alias),
    provider: String(row.provider),
    providerModel: String(row.provider_model),
    enabled: row.enabled === true,
    contextWindow: nullableNumber(row.context_window) ?? undefined,
    inputPricePer1mTokens: nullableNumber(row.input_price_per_1m_tokens),
    outputPricePer1mTokens: nullableNumber(row.output_price_per_1m_tokens),
    fallbackAliases: Array.isArray(row.fallback_aliases) ? row.fallback_aliases.map(String) : [],
    adminOnly: row.admin_only === true
  };
}

function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function toIsoString(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}
```

- [ ] **Step 4: Add deterministic key hash helper**

Modify `apps/llm-gateway/src/keys/api-key.ts` by exporting a deterministic helper instead of creating a test-only file:

```ts
export function createVirtualApiKeyForPlaintext(plaintext: string, secret: string): CreatedVirtualApiKey {
  return {
    plaintext,
    prefix: plaintext.slice(0, STORED_PREFIX_LENGTH),
    hash: hashVirtualApiKey(plaintext, secret)
  };
}
```

Place it after `createVirtualApiKey`. This helper is production-safe because it only hashes caller-provided plaintext; it does not weaken verification.

- [ ] **Step 5: Run the repository test and verify it passes**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/llm-gateway/test/postgres-gateway-repository.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/llm-gateway/src/keys/api-key.ts apps/llm-gateway/src/repositories/postgres-gateway.ts apps/llm-gateway/test/postgres-gateway-repository.test.ts
git commit -m "feat(llm-gateway): add postgres gateway repository"
```

## Task 3: Wire Postgres Runtime Into Route Runtime

**Files:**

- Modify: `apps/llm-gateway/src/gateway/route-runtime.ts`
- Modify: `apps/llm-gateway/src/gateway/gateway-service.ts`
- Create: `apps/llm-gateway/test/gateway-route-runtime-postgres.test.ts`

- [ ] **Step 1: Write the failing route-runtime test**

Create `apps/llm-gateway/test/gateway-route-runtime-postgres.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getGatewayServiceForRoutes, setGatewayServiceForRoutes } from '../src/gateway/route-runtime.js';

const originalEnv = { ...process.env };

vi.mock('../src/repositories/postgres-gateway.js', () => ({
  createPostgresGatewayRepository: vi.fn(() => ({
    async verifyApiKey() {
      return {
        id: 'key-e2e',
        name: 'E2E key',
        status: 'active',
        models: ['gpt-main'],
        rpmLimit: 60,
        tpmLimit: 100000,
        dailyTokenLimit: 500000,
        dailyCostLimit: 10,
        usedTokensToday: 0,
        usedCostToday: 0,
        expiresAt: null
      };
    },
    async getUsageForToday() {
      return { usedTokensToday: 0, usedCostToday: 0 };
    },
    async listModels() {
      return [
        {
          alias: 'gpt-main',
          provider: 'mock',
          providerModel: 'mock-gpt-main',
          enabled: true,
          contextWindow: 128000,
          inputPricePer1mTokens: 0,
          outputPricePer1mTokens: 0,
          fallbackAliases: [],
          adminOnly: false
        }
      ];
    }
  }))
}));

describe('gateway route runtime postgres mode', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    setGatewayServiceForRoutes(null);
  });

  it('creates a postgres-backed mock-provider gateway service when configured for e2e', async () => {
    process.env.LLM_GATEWAY_RUNTIME = 'postgres';
    process.env.DATABASE_URL = 'postgresql://llm_gateway:password@localhost:5432/llm_gateway';
    process.env.LLM_GATEWAY_API_KEY_SECRET = 'route-runtime-secret';
    process.env.LLM_GATEWAY_PROVIDER_MODE = 'mock';

    const service = getGatewayServiceForRoutes();
    const models = await service.listModels({ authorization: 'Bearer sk-llmgw_test_valid_000000' });

    expect(models).toEqual({
      object: 'list',
      data: [{ id: 'gpt-main', object: 'model', owned_by: 'llm-gateway' }]
    });
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/llm-gateway/test/gateway-route-runtime-postgres.test.ts
```

Expected: FAIL because `route-runtime.ts` does not yet support `LLM_GATEWAY_RUNTIME=postgres`.

- [ ] **Step 3: Implement postgres runtime selection**

First make `GatewayModelRegistry` async in `apps/llm-gateway/src/gateway/gateway-service.ts`:

```ts
export interface GatewayModelRegistry {
  resolve(alias: string): GatewayModelRecord | undefined | Promise<GatewayModelRecord | undefined>;
  list(): GatewayModelRecord[] | Promise<GatewayModelRecord[]>;
}
```

Update `prepare`:

```ts
const model = await options.modelRegistry.resolve(parsedBody.model);
```

Update `listModels`:

```ts
const models = (await options.modelRegistry.list())
  .filter(model => model.enabled && isModelAllowed(key.models, model.alias))
  .map(model => ({
    id: model.alias,
    object: 'model' as const,
    owned_by: 'llm-gateway' as const
  }));
```

Modify `apps/llm-gateway/src/gateway/route-runtime.ts`:

```ts
import { createPostgresGatewayRepository } from '../repositories/postgres-gateway';
```

Then update `getGatewayServiceForRoutes`:

```ts
export function getGatewayServiceForRoutes(): GatewayService {
  if (!gatewayService) {
    gatewayService =
      process.env.LLM_GATEWAY_RUNTIME === 'postgres' ? createPostgresGatewayService() : createBootstrapGatewayService();
  }

  return gatewayService;
}
```

Add this function before `createBootstrapGatewayService`:

```ts
function createPostgresGatewayService(): GatewayService {
  const databaseUrl = process.env.DATABASE_URL;
  const apiKeySecret = process.env.LLM_GATEWAY_API_KEY_SECRET;

  if (!databaseUrl || !apiKeySecret) {
    throw new GatewayError(
      'UPSTREAM_UNAVAILABLE',
      'Gateway postgres runtime is not configured. Set DATABASE_URL and LLM_GATEWAY_API_KEY_SECRET.',
      503
    );
  }

  const repository = createPostgresGatewayRepository(databaseUrl, { apiKeySecret });
  const providerMode = process.env.LLM_GATEWAY_PROVIDER_MODE ?? 'mock';

  if (providerMode !== 'mock') {
    throw new GatewayError(
      'UPSTREAM_UNAVAILABLE',
      'Only mock provider mode is enabled for the current postgres runtime.',
      503
    );
  }

  return createGatewayService({
    repository,
    modelRegistry: {
      async resolve(alias) {
        return repository.findModelByAlias(alias);
      },
      async list() {
        return repository.listModels();
      }
    },
    providers: {
      mock: createMockProviderAdapter({ content: 'llm-gateway e2e response' })
    },
    rpmLimiter: createMemoryRateLimiter(),
    tpmLimiter: createMemoryRateLimiter()
  });
}
```

- [ ] **Step 4: Run route runtime and existing gateway tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/llm-gateway/test/gateway-route-runtime-postgres.test.ts apps/llm-gateway/test/gateway-service.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/llm-gateway/src/gateway/gateway-service.ts apps/llm-gateway/src/gateway/route-runtime.ts apps/llm-gateway/test/gateway-route-runtime-postgres.test.ts
git commit -m "feat(llm-gateway): wire postgres route runtime"
```

## Task 4: Add E2E Seed and HTTP Test Helpers

**Files:**

- Create: `apps/llm-gateway/test/e2e/fixtures.ts`
- Create: `apps/llm-gateway/test/e2e/seed.ts`
- Create: `apps/llm-gateway/test/e2e/wait-for-gateway.ts`

- [ ] **Step 1: Create fixtures**

Create `apps/llm-gateway/test/e2e/fixtures.ts`:

```ts
import {
  ChatCompletionResponseSchema,
  ChatCompletionStreamChunkSchema,
  KeyStatusResponseSchema,
  ModelListResponseSchema
} from '../../src/contracts';

export const E2E_API_KEY_SECRET = 'llm-gateway-e2e-api-key-secret';
export const E2E_OWNER_PASSWORD = 'correct-e2e-owner-password';
export const E2E_ADMIN_JWT_SECRET = 'llm-gateway-e2e-admin-jwt-secret';

export const E2E_KEYS = {
  validFull: 'sk-llmgw_e2e_valid_full_000000000000',
  modelLimited: 'sk-llmgw_e2e_model_limited_000000',
  budgetLow: 'sk-llmgw_e2e_budget_low_0000000000',
  disabled: 'sk-llmgw_e2e_disabled_000000000000'
} as const;

export function gatewayBaseUrl(): string {
  return process.env.LLM_GATEWAY_E2E_BASE_URL ?? 'http://localhost:3100';
}

export function authHeaders(key: string): HeadersInit {
  return { authorization: `Bearer ${key}` };
}

export async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

export function parseModels(body: unknown) {
  return ModelListResponseSchema.parse(body);
}

export function parseKeyStatus(body: unknown) {
  return KeyStatusResponseSchema.parse(body);
}

export function parseChatCompletion(body: unknown) {
  return ChatCompletionResponseSchema.parse(body);
}

export function parseSseChunks(text: string) {
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('data: '));

  return lines.map(line => line.slice('data: '.length));
}

export function parseStreamChunk(payload: string) {
  return ChatCompletionStreamChunkSchema.parse(JSON.parse(payload));
}
```

- [ ] **Step 2: Create seed script**

Create `apps/llm-gateway/test/e2e/seed.ts`:

```ts
import { createAdminAuthService } from '../../src/auth/admin-auth';
import { createPostgresAdminAuthRepository } from '../../src/repositories/postgres-admin-auth';
import { createPostgresGatewayRepository } from '../../src/repositories/postgres-gateway';
import { E2E_API_KEY_SECRET, E2E_KEYS, E2E_OWNER_PASSWORD } from './fixtures';

export async function seedLlmGatewayE2e(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for llm-gateway E2E seed');
  }

  const admin = createAdminAuthService({
    repository: createPostgresAdminAuthRepository(databaseUrl),
    jwtSecret: process.env.LLM_GATEWAY_ADMIN_JWT_SECRET ?? 'llm-gateway-e2e-admin-jwt-secret',
    now: () => new Date('2026-04-25T00:00:00.000Z')
  });

  await admin.ensureOwnerPassword({ password: E2E_OWNER_PASSWORD, displayName: 'E2E Owner' });

  const gateway = createPostgresGatewayRepository(databaseUrl, { apiKeySecret: E2E_API_KEY_SECRET });

  await gateway.saveModel({
    alias: 'gpt-main',
    provider: 'mock',
    providerModel: 'mock-gpt-main',
    enabled: true,
    contextWindow: 128000,
    inputPricePer1mTokens: 0,
    outputPricePer1mTokens: 0,
    fallbackAliases: [],
    adminOnly: false
  });

  await gateway.saveModel({
    alias: 'minimax-main',
    provider: 'mock',
    providerModel: 'mock-minimax-main',
    enabled: true,
    contextWindow: 64000,
    inputPricePer1mTokens: 0,
    outputPricePer1mTokens: 0,
    fallbackAliases: [],
    adminOnly: false
  });

  await gateway.saveSeedApiKey({
    id: 'key-e2e-valid-full',
    name: 'E2E valid full',
    plaintext: E2E_KEYS.validFull,
    status: 'active',
    models: ['gpt-main', 'minimax-main'],
    rpmLimit: 60,
    tpmLimit: 100000,
    dailyTokenLimit: 500000,
    dailyCostLimit: 10,
    expiresAt: null
  });

  await gateway.saveSeedApiKey({
    id: 'key-e2e-model-limited',
    name: 'E2E model limited',
    plaintext: E2E_KEYS.modelLimited,
    status: 'active',
    models: ['minimax-main'],
    rpmLimit: 60,
    tpmLimit: 100000,
    dailyTokenLimit: 500000,
    dailyCostLimit: 10,
    expiresAt: null
  });

  await gateway.saveSeedApiKey({
    id: 'key-e2e-budget-low',
    name: 'E2E budget low',
    plaintext: E2E_KEYS.budgetLow,
    status: 'active',
    models: ['gpt-main'],
    rpmLimit: 60,
    tpmLimit: 100000,
    dailyTokenLimit: 1,
    dailyCostLimit: 10,
    expiresAt: null
  });

  await gateway.saveSeedApiKey({
    id: 'key-e2e-disabled',
    name: 'E2E disabled',
    plaintext: E2E_KEYS.disabled,
    status: 'disabled',
    models: ['gpt-main'],
    rpmLimit: 60,
    tpmLimit: 100000,
    dailyTokenLimit: 500000,
    dailyCostLimit: 10,
    expiresAt: null
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await seedLlmGatewayE2e();
}
```

- [ ] **Step 3: Create wait helper**

Create `apps/llm-gateway/test/e2e/wait-for-gateway.ts`:

```ts
import { gatewayBaseUrl } from './fixtures';

export async function waitForGateway(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${gatewayBaseUrl()}/api/v1/models`);
      if (response.status === 401) {
        return;
      }
      lastError = new Error(`Unexpected readiness status ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw lastError instanceof Error ? lastError : new Error('llm-gateway E2E app did not become ready');
}
```

- [ ] **Step 4: Run typecheck for the new helpers**

Run:

```bash
pnpm exec tsc -p apps/llm-gateway/tsconfig.json --noEmit
```

Expected: PASS after Task 2 repository exports exist.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/llm-gateway/test/e2e/fixtures.ts apps/llm-gateway/test/e2e/seed.ts apps/llm-gateway/test/e2e/wait-for-gateway.ts
git commit -m "test(llm-gateway): add e2e seed helpers"
```

## Task 5: Add HTTP E2E Specs

**Files:**

- Create: `apps/llm-gateway/test/e2e/llm-gateway-http.e2e-spec.ts`

- [ ] **Step 1: Write E2E specs**

Create `apps/llm-gateway/test/e2e/llm-gateway-http.e2e-spec.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest';

import {
  E2E_KEYS,
  authHeaders,
  gatewayBaseUrl,
  parseChatCompletion,
  parseKeyStatus,
  parseModels,
  parseSseChunks,
  parseStreamChunk,
  readJson
} from './fixtures';
import { waitForGateway } from './wait-for-gateway';

describe('llm-gateway HTTP E2E', () => {
  beforeAll(async () => {
    await waitForGateway();
  }, 35_000);

  it('lists only models allowed for the API key', async () => {
    const response = await fetch(`${gatewayBaseUrl()}/api/v1/models`, {
      headers: authHeaders(E2E_KEYS.modelLimited)
    });
    const body = parseModels(await readJson(response));

    expect(response.status).toBe(200);
    expect(body.data.map(model => model.id)).toEqual(['minimax-main']);
  });

  it('returns key status, limits, and today usage', async () => {
    const response = await fetch(`${gatewayBaseUrl()}/api/v1/key`, {
      headers: authHeaders(E2E_KEYS.validFull)
    });
    const body = parseKeyStatus(await readJson(response));

    expect(response.status).toBe(200);
    expect(body.id).toBe('key-e2e-valid-full');
    expect(body.status).toBe('active');
    expect(body.models).toEqual(['gpt-main', 'minimax-main']);
    expect(body.used_tokens_today).toBeGreaterThanOrEqual(0);
  });

  it('returns OpenAI-compatible non-streaming chat completions and records usage', async () => {
    const response = await fetch(`${gatewayBaseUrl()}/api/v1/chat/completions`, {
      method: 'POST',
      headers: {
        ...authHeaders(E2E_KEYS.validFull),
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-main',
        messages: [{ role: 'user', content: 'hello from e2e' }],
        stream: false,
        max_tokens: 32
      })
    });
    const body = parseChatCompletion(await readJson(response));

    expect(response.status).toBe(200);
    expect(body.object).toBe('chat.completion');
    expect(body.model).toBe('gpt-main');
    expect(body.choices[0]?.message.content).toContain('llm-gateway e2e response');
    expect(body.usage.total_tokens).toBeGreaterThan(0);
  });

  it('returns OpenAI-compatible SSE chat completions', async () => {
    const response = await fetch(`${gatewayBaseUrl()}/api/v1/chat/completions`, {
      method: 'POST',
      headers: {
        ...authHeaders(E2E_KEYS.validFull),
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-main',
        messages: [{ role: 'user', content: 'stream from e2e' }],
        stream: true,
        max_tokens: 32
      })
    });
    const text = await response.text();
    const payloads = parseSseChunks(text);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(payloads.at(-1)).toBe('[DONE]');
    expect(parseStreamChunk(payloads[0] ?? '').object).toBe('chat.completion.chunk');
  });

  it('maps auth and model permission errors to stable gateway errors', async () => {
    const missing = await fetch(`${gatewayBaseUrl()}/api/v1/models`);
    expect(missing.status).toBe(401);
    await expect(missing.json()).resolves.toMatchObject({ error: { code: 'AUTH_ERROR' } });

    const disabled = await fetch(`${gatewayBaseUrl()}/api/v1/models`, {
      headers: authHeaders(E2E_KEYS.disabled)
    });
    expect(disabled.status).toBe(403);
    await expect(disabled.json()).resolves.toMatchObject({ error: { code: 'KEY_DISABLED' } });

    const modelDenied = await fetch(`${gatewayBaseUrl()}/api/v1/chat/completions`, {
      method: 'POST',
      headers: {
        ...authHeaders(E2E_KEYS.modelLimited),
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-main',
        messages: [{ role: 'user', content: 'denied' }]
      })
    });
    expect(modelDenied.status).toBe(403);
    await expect(modelDenied.json()).resolves.toMatchObject({ error: { code: 'MODEL_NOT_ALLOWED' } });
  });

  it('blocks requests that exceed daily token budget', async () => {
    const response = await fetch(`${gatewayBaseUrl()}/api/v1/chat/completions`, {
      method: 'POST',
      headers: {
        ...authHeaders(E2E_KEYS.budgetLow),
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-main',
        messages: [{ role: 'user', content: 'this prompt should exceed the one token daily budget' }]
      })
    });

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'BUDGET_EXCEEDED' } });
  });

  it('runs the admin auth HTTP lifecycle', async () => {
    const login = await fetch(`${gatewayBaseUrl()}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'correct-e2e-owner-password' })
    });
    const tokenPair = (await login.json()) as { accessToken: string; refreshToken: string };

    expect(login.status).toBe(200);
    expect(tokenPair.accessToken).toBeTruthy();
    expect(tokenPair.refreshToken).toBeTruthy();

    const refresh = await fetch(`${gatewayBaseUrl()}/api/admin/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokenPair.refreshToken })
    });

    expect(refresh.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run specs without the E2E stack and verify they fail usefully**

Run:

```bash
LLM_GATEWAY_E2E_BASE_URL=http://127.0.0.1:3100 pnpm exec vitest run --config vitest.config.js apps/llm-gateway/test/e2e/llm-gateway-http.e2e-spec.ts
```

Expected: FAIL with a readiness/connection error. This proves the specs are not silently passing without a stack.

- [ ] **Step 3: Commit**

Run:

```bash
git add apps/llm-gateway/test/e2e/llm-gateway-http.e2e-spec.ts
git commit -m "test(llm-gateway): add http e2e specs"
```

## Task 6: Add Compose Stack, Dockerfile, and Runner Script

**Files:**

- Create: `apps/llm-gateway/docker-compose.e2e.yml`
- Create: `apps/llm-gateway/Dockerfile.e2e`
- Create: `apps/llm-gateway/scripts/run-e2e.mjs`
- Modify: `apps/llm-gateway/package.json`

- [ ] **Step 1: Add E2E Dockerfile**

Create `apps/llm-gateway/Dockerfile.e2e`:

```Dockerfile
FROM node:22-bookworm-slim

WORKDIR /repo

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/llm-gateway/package.json apps/llm-gateway/package.json

RUN pnpm install --frozen-lockfile

COPY . .

WORKDIR /repo/apps/llm-gateway

EXPOSE 3000
```

- [ ] **Step 2: Add E2E compose file**

Create `apps/llm-gateway/docker-compose.e2e.yml`:

```yaml
services:
  llm-gateway-e2e-postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: llm_gateway_e2e
      POSTGRES_USER: llm_gateway_e2e
      POSTGRES_PASSWORD: llm_gateway_e2e_password
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U "$${POSTGRES_USER}" -d "$${POSTGRES_DB}"']
      interval: 2s
      timeout: 5s
      retries: 20

  llm-gateway-e2e-app:
    build:
      context: ../..
      dockerfile: apps/llm-gateway/Dockerfile.e2e
    depends_on:
      llm-gateway-e2e-postgres:
        condition: service_healthy
    environment:
      NODE_ENV: test
      PORT: 3000
      DATABASE_URL: postgresql://llm_gateway_e2e:llm_gateway_e2e_password@llm-gateway-e2e-postgres:5432/llm_gateway_e2e
      LLM_GATEWAY_RUNTIME: postgres
      LLM_GATEWAY_PROVIDER_MODE: mock
      LLM_GATEWAY_API_KEY_SECRET: llm-gateway-e2e-api-key-secret
      LLM_GATEWAY_ADMIN_JWT_SECRET: llm-gateway-e2e-admin-jwt-secret
    command: >
      sh -c "pnpm exec tsx test/e2e/seed.ts &&
             pnpm dev --hostname 0.0.0.0 --port 3000"
    ports:
      - '${LLM_GATEWAY_E2E_PORT:-3100}:3000'

  llm-gateway-e2e-runner:
    build:
      context: ../..
      dockerfile: apps/llm-gateway/Dockerfile.e2e
    depends_on:
      llm-gateway-e2e-app:
        condition: service_started
    environment:
      DATABASE_URL: postgresql://llm_gateway_e2e:llm_gateway_e2e_password@llm-gateway-e2e-postgres:5432/llm_gateway_e2e
      LLM_GATEWAY_E2E_BASE_URL: http://llm-gateway-e2e-app:3000
    command: >
      sh -c "pnpm exec vitest run --config vitest.config.js apps/llm-gateway/test/e2e/llm-gateway-http.e2e-spec.ts"
    working_dir: /repo
```

- [ ] **Step 3: Add runner script**

Create `apps/llm-gateway/scripts/run-e2e.mjs`:

```js
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runnerArg = process.argv.find(arg => arg.startsWith('--runner='));
const runner = runnerArg?.split('=')[1] ?? 'container';
const keepUp = process.argv.includes('--keep-up');
const projectName = `llm-gateway-e2e-${Date.now()}`;
const composeArgs = ['compose', '-p', projectName, '-f', 'docker-compose.e2e.yml'];

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: appRoot,
    stdio: 'inherit',
    ...options
  });
}

function docker(args) {
  return run('docker', [...composeArgs, ...args]);
}

function printLogs() {
  docker(['logs', '--no-color', 'llm-gateway-e2e-app']);
  docker(['ps']);
}

let status = 1;

try {
  if (runner === 'container') {
    const result = docker([
      'up',
      '--build',
      '--abort-on-container-exit',
      '--exit-code-from',
      'llm-gateway-e2e-runner',
      'llm-gateway-e2e-runner'
    ]);
    status = typeof result.status === 'number' ? result.status : 1;
  } else if (runner === 'host') {
    const up = docker(['up', '--build', '-d', 'llm-gateway-e2e-postgres', 'llm-gateway-e2e-app']);
    if (up.status !== 0) {
      status = up.status ?? 1;
    } else {
      const result = run(
        'pnpm',
        ['exec', 'vitest', 'run', '--config', '../../vitest.config.js', 'test/e2e/llm-gateway-http.e2e-spec.ts'],
        {
          env: {
            ...process.env,
            LLM_GATEWAY_E2E_BASE_URL: `http://127.0.0.1:${process.env.LLM_GATEWAY_E2E_PORT ?? '3100'}`
          }
        }
      );
      status = typeof result.status === 'number' ? result.status : 1;
    }
  } else {
    console.error(`[llm-gateway:e2e] unsupported runner: ${runner}`);
    status = 1;
  }

  if (status !== 0) {
    printLogs();
  }
} finally {
  if (!keepUp) {
    docker(['down', '-v', '--remove-orphans']);
  } else {
    console.log(`[llm-gateway:e2e] keeping compose project ${projectName} up for debugging`);
  }
}

process.exit(status);
```

- [ ] **Step 4: Add package scripts**

Modify `apps/llm-gateway/package.json` scripts:

```json
{
  "test:e2e": "node scripts/run-e2e.mjs --runner=container",
  "test:e2e:local": "node scripts/run-e2e.mjs --runner=host",
  "test:e2e:up": "docker compose -f docker-compose.e2e.yml up -d llm-gateway-e2e-postgres llm-gateway-e2e-app",
  "test:e2e:down": "docker compose -f docker-compose.e2e.yml down -v --remove-orphans"
}
```

Keep existing scripts unchanged.

- [ ] **Step 5: Run config docs test and E2E**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/llm-gateway/test/env-docs.test.ts
pnpm --dir apps/llm-gateway test:e2e
```

Expected: docs test PASS and E2E PASS. If E2E fails, fix the exact runtime, seed, or container error before continuing.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/llm-gateway/Dockerfile.e2e apps/llm-gateway/docker-compose.e2e.yml apps/llm-gateway/scripts/run-e2e.mjs apps/llm-gateway/package.json apps/llm-gateway/test/env-docs.test.ts
git commit -m "test(llm-gateway): add e2e compose runner"
```

## Task 7: Update Integration Documentation

**Files:**

- Create: `docs/integration/llm-gateway-e2e.md`
- Modify: `docs/integration/README.md`
- Modify if needed: `docs/integration/llm-gateway-postgres-login.md`

- [ ] **Step 1: Add E2E operations doc**

Create `docs/integration/llm-gateway-e2e.md`:

````md
# LLM Gateway E2E 测试栈

状态：current
文档类型：integration
适用范围：`apps/llm-gateway`、Docker Compose E2E、后端 HTTP 契约
本主题主文档：`docs/integration/llm-gateway-e2e.md`
本文只覆盖：容器化 E2E 启动、seed、运行、排障和 CI 边界
最后核对：2026-04-25

## 1. 目标

`apps/llm-gateway` 的 E2E 测试使用独立 `docker-compose.e2e.yml`，启动 PostgreSQL、llm-gateway app 和测试 runner。该栈不复用本地开发 compose，不写入 `.db/postgres`，测试结束后默认删除 volume。

## 2. 命令

```bash
pnpm --dir apps/llm-gateway test:e2e
pnpm --dir apps/llm-gateway test:e2e:local
pnpm --dir apps/llm-gateway test:e2e -- --keep-up
```
````

`test:e2e` 是 CI 权威入口，runner 在 compose 网络内访问 `http://llm-gateway-e2e-app:3000`。

`test:e2e:local` 用于本地调试，宿主机通过 `http://127.0.0.1:3100` 访问 app。

## 3. Seed 数据

E2E seed 会创建：

- owner 管理员，用于 admin auth login / refresh。
- `e2e-valid-full` key，允许访问 `gpt-main` 与 `minimax-main`。
- `e2e-model-limited` key，只允许访问 `minimax-main`。
- `e2e-budget-low` key，用于预算错误。
- `e2e-disabled` key，用于禁用 key 错误。
- `gpt-main` 与 `minimax-main` mock 模型。

## 4. Provider 边界

默认 E2E 只使用 mock provider，不访问真实 OpenAI、MiniMax 或 MiMo，不需要真实 provider key。

## 5. 排障

失败时 `scripts/run-e2e.mjs` 会打印 app logs 和 compose 状态。需要保留现场时使用 `--keep-up`，调试完成后执行：

```bash
pnpm --dir apps/llm-gateway test:e2e:down
```

## 6. CI 边界

E2E 不并入根级 `pnpm verify`。CI 应以独立 job 在 `apps/llm-gateway/**` 或 `docs/integration/llm-gateway-*` 改动时执行：

```bash
pnpm --dir apps/llm-gateway test:e2e
```

````

- [ ] **Step 2: Update docs index**

In `docs/integration/README.md`, add an entry next to the existing LLM Gateway PostgreSQL login link:

```md
- LLM Gateway E2E 测试栈：`docs/integration/llm-gateway-e2e.md`
````

- [ ] **Step 3: Clarify local development doc if scripts changed**

In `docs/integration/llm-gateway-postgres-login.md`, add one sentence to section 2:

```md
容器化 E2E 使用独立的 `apps/llm-gateway/docker-compose.e2e.yml`，不复用本地开发数据库、固定容器名或 `.db/postgres` 数据目录；E2E 细节见 `docs/integration/llm-gateway-e2e.md`。
```

- [ ] **Step 4: Run docs checks**

Run:

```bash
pnpm check:docs
pnpm exec vitest run --config vitest.config.js apps/llm-gateway/test/env-docs.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add docs/integration/llm-gateway-e2e.md docs/integration/README.md docs/integration/llm-gateway-postgres-login.md apps/llm-gateway/test/env-docs.test.ts
git commit -m "docs: document llm gateway e2e stack"
```

## Task 8: Final Verification and Cleanup

**Files:**

- Review all files touched in Tasks 1-7.

- [ ] **Step 1: Run focused verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/llm-gateway/test/postgres-gateway-repository.test.ts apps/llm-gateway/test/gateway-route-runtime-postgres.test.ts apps/llm-gateway/test/env-docs.test.ts
pnpm exec tsc -p apps/llm-gateway/tsconfig.json --noEmit
pnpm --dir apps/llm-gateway test:e2e
```

Expected: all PASS.

- [ ] **Step 2: Run affected verification**

Run:

```bash
pnpm verify:affected
```

Expected: PASS. If blocked by Docker availability, credentials, or unrelated pre-existing workspace failures, record the exact failing command and keep the focused evidence from Step 1.

- [ ] **Step 3: Check for accidental source artifacts and stale files**

Run:

```bash
git status --short
pnpm check:docs
```

Expected: only intentional tracked changes remain before the final commit, and docs check PASS.

- [ ] **Step 4: Final commit if needed**

If Task 8 required fixes, commit them:

```bash
git add apps/llm-gateway docs/integration
git commit -m "chore(llm-gateway): finalize e2e verification"
```

## Self-Review

- Spec coverage: tasks cover isolated compose stack, container and host runner, seed data, mock provider, HTTP E2E, cleanup, docs, and verification.
- Placeholder scan: no `TBD`, `TODO`, or open-ended implementation steps remain.
- Type consistency: plan uses existing `GatewayRepository`, `GatewayModelRecord`, `createAdminAuthService`, `createPostgresAdminAuthRepository`, and existing contract schemas. The only intentional API addition is `createVirtualApiKeyForPlaintext`.
