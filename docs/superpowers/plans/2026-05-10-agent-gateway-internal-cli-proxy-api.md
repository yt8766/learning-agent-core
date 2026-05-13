# Agent Gateway Internal CLI Proxy API Implementation Plan

状态：draft
文档类型：plan
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-gateway`、`packages/core/src/contracts/agent-gateway`、`docs/contracts/api/agent-gateway.md`
最后核对：2026-05-10

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an internal, simplified CLIProxyAPI inside `agent-server` with Gateway clients, proxy API keys, quotas, usage logs, and minimal OpenAI-compatible `/v1/models` plus `/v1/chat/completions` runtime, then expose client management in `agent-gateway`.

**Architecture:** Stable JSON contracts live in `packages/core/src/contracts/agent-gateway` and drive backend plus frontend types. `agent-server` owns Gateway client/key/quota/runtime services under `src/domains/agent-gateway`, while controllers only parse schemas and map HTTP errors. `apps/frontend/agent-gateway` consumes schema-first management APIs and adds a Clients page; external CLIProxyAPI connection becomes advanced compatibility, not the default product path.

**Tech Stack:** TypeScript, zod, NestJS, React, TanStack Query, Vitest, existing `@agent/core` package exports, in-memory repositories for the first slice.

---

## File Structure

- Create: `packages/core/test/agent-gateway/agent-gateway-internal-cli-proxy.schemas.test.ts`
- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.schemas.ts`
- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.types.ts`
- Modify: `packages/core/src/contracts/agent-gateway/index.ts`
- Create: `apps/backend/agent-server/test/agent-gateway/agent-gateway-client-runtime.spec.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/clients/agent-gateway-client.repository.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/clients/memory-agent-gateway-client.repository.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/clients/agent-gateway-client.service.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/clients/agent-gateway-client-api-key.service.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/clients/agent-gateway-client-quota.service.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime/agent-gateway-runtime-auth.service.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime/agent-gateway-runtime-accounting.service.ts`
- Create: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway-clients.controller.ts`
- Create: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway-openai-compatible.controller.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/agent-gateway.module.ts`
- Modify: `apps/frontend/agent-gateway/src/api/agent-gateway-api.ts`
- Modify: `apps/frontend/agent-gateway/src/app/gateway-view-model.ts`
- Modify: `apps/frontend/agent-gateway/src/app/GatewayWorkspace.tsx`
- Create: `apps/frontend/agent-gateway/src/app/pages/ClientsPage.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/styles/management.scss`
- Modify: `apps/frontend/agent-gateway/test/agent-gateway-api.test.ts`
- Create: `apps/frontend/agent-gateway/test/agent-gateway-clients-page.test.tsx`
- Modify: `docs/contracts/api/agent-gateway.md`
- Modify: `docs/apps/backend/agent-server/agent-gateway.md`
- Modify: `docs/apps/frontend/agent-gateway/README.md`
- Modify: `docs/apps/frontend/agent-gateway/cli-proxy-parity.md`

## Task 1: Core Contracts

**Files:**

- Create: `packages/core/test/agent-gateway/agent-gateway-internal-cli-proxy.schemas.test.ts`
- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.schemas.ts`
- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.types.ts`
- Modify: `packages/core/src/contracts/agent-gateway/index.ts`

- [ ] **Step 1: Write the failing contract test**

Create `packages/core/test/agent-gateway/agent-gateway-internal-cli-proxy.schemas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  GatewayClientApiKeyListResponseSchema,
  GatewayClientListResponseSchema,
  GatewayClientQuotaSchema,
  GatewayClientRequestLogListResponseSchema,
  GatewayCreateClientApiKeyResponseSchema,
  GatewayOpenAIChatCompletionRequestSchema,
  GatewayOpenAIChatCompletionResponseSchema,
  GatewayOpenAICompatibleErrorResponseSchema,
  GatewayOpenAIModelsResponseSchema,
  GatewayUpdateClientQuotaRequestSchema
} from '../../src/contracts/agent-gateway';

describe('agent gateway internal CLI proxy contracts', () => {
  it('parses Gateway client, key, quota, usage log, and OpenAI-compatible runtime contracts', () => {
    expect(
      GatewayClientListResponseSchema.parse({
        items: [
          {
            id: 'client-acme',
            name: 'Acme App',
            description: 'internal app',
            ownerEmail: 'owner@example.com',
            status: 'active',
            tags: ['internal'],
            createdAt: '2026-05-10T00:00:00.000Z',
            updatedAt: '2026-05-10T00:00:00.000Z'
          }
        ]
      }).items[0].status
    ).toBe('active');

    expect(
      GatewayCreateClientApiKeyResponseSchema.parse({
        apiKey: {
          id: 'key-1',
          clientId: 'client-acme',
          name: 'default',
          prefix: 'agp_live_1234',
          status: 'active',
          scopes: ['models.read', 'chat.completions'],
          createdAt: '2026-05-10T00:00:00.000Z',
          expiresAt: null,
          lastUsedAt: null
        },
        secret: 'agp_live_secret'
      }).secret
    ).toBe('agp_live_secret');

    expect(
      GatewayClientApiKeyListResponseSchema.parse({
        items: [
          {
            id: 'key-1',
            clientId: 'client-acme',
            name: 'default',
            prefix: 'agp_live_1234',
            status: 'active',
            scopes: ['models.read'],
            createdAt: '2026-05-10T00:00:00.000Z',
            expiresAt: null,
            lastUsedAt: null
          }
        ]
      }).items[0]
    ).not.toHaveProperty('secret');

    expect(
      GatewayClientQuotaSchema.parse({
        clientId: 'client-acme',
        period: 'monthly',
        tokenLimit: 1000,
        requestLimit: 10,
        usedTokens: 20,
        usedRequests: 1,
        resetAt: '2026-06-01T00:00:00.000Z',
        status: 'normal'
      }).tokenLimit
    ).toBe(1000);

    expect(
      GatewayUpdateClientQuotaRequestSchema.parse({
        tokenLimit: 5000,
        requestLimit: 50,
        resetAt: '2026-06-01T00:00:00.000Z'
      })
    ).toMatchObject({ requestLimit: 50 });

    expect(
      GatewayClientRequestLogListResponseSchema.parse({
        items: [
          {
            id: 'req-1',
            clientId: 'client-acme',
            apiKeyId: 'key-1',
            occurredAt: '2026-05-10T00:00:01.000Z',
            endpoint: '/v1/chat/completions',
            model: 'gpt-5.4',
            providerId: 'openai-primary',
            statusCode: 200,
            inputTokens: 2,
            outputTokens: 3,
            latencyMs: 12
          }
        ]
      }).items
    ).toHaveLength(1);

    expect(
      GatewayOpenAIChatCompletionRequestSchema.parse({
        model: 'gpt-5.4',
        messages: [{ role: 'user', content: 'ping' }],
        stream: false
      }).messages[0].content
    ).toBe('ping');

    expect(
      GatewayOpenAIChatCompletionResponseSchema.parse({
        id: 'chatcmpl-1',
        object: 'chat.completion',
        created: 1778342400,
        model: 'gpt-5.4',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'pong' },
            finish_reason: 'stop'
          }
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
      }).choices[0].message.content
    ).toBe('pong');

    expect(
      GatewayOpenAIModelsResponseSchema.parse({
        object: 'list',
        data: [{ id: 'gpt-5.4', object: 'model', created: 1778342400, owned_by: 'openai-primary' }]
      }).data[0].id
    ).toBe('gpt-5.4');

    expect(
      GatewayOpenAICompatibleErrorResponseSchema.parse({
        error: {
          message: 'quota exceeded',
          type: 'rate_limit_error',
          code: 'quota_exceeded'
        }
      }).error.code
    ).toBe('quota_exceeded');
  });
});
```

- [ ] **Step 2: Run the contract test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway/agent-gateway-internal-cli-proxy.schemas.test.ts
```

Expected: FAIL because the new schemas are not exported.

- [ ] **Step 3: Add the schemas**

Append to `packages/core/src/contracts/agent-gateway/agent-gateway.schemas.ts`:

```ts
export const GatewayClientStatusSchema = z.enum(['active', 'disabled', 'suspended']);
export const GatewayClientSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  ownerEmail: z.string().email().optional(),
  status: GatewayClientStatusSchema,
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string()
});
export const GatewayClientListResponseSchema = z.object({ items: z.array(GatewayClientSchema) });
export const GatewayCreateClientRequestSchema = GatewayClientSchema.pick({
  name: true,
  description: true,
  ownerEmail: true,
  tags: true
}).partial({ description: true, ownerEmail: true, tags: true });
export const GatewayUpdateClientRequestSchema = GatewayCreateClientRequestSchema.partial().extend({
  status: GatewayClientStatusSchema.optional()
});
export const GatewayClientApiKeyStatusSchema = z.enum(['active', 'disabled', 'revoked']);
export const GatewayClientApiKeyScopeSchema = z.enum(['chat.completions', 'models.read']);
export const GatewayClientApiKeySchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  name: z.string().min(1),
  prefix: z.string().min(1),
  status: GatewayClientApiKeyStatusSchema,
  scopes: z.array(GatewayClientApiKeyScopeSchema),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
  lastUsedAt: z.string().nullable()
});
export const GatewayClientApiKeyListResponseSchema = z.object({ items: z.array(GatewayClientApiKeySchema) });
export const GatewayCreateClientApiKeyRequestSchema = z.object({
  name: z.string().min(1),
  scopes: z.array(GatewayClientApiKeyScopeSchema).default(['models.read', 'chat.completions']),
  expiresAt: z.string().nullable().optional()
});
export const GatewayUpdateClientApiKeyRequestSchema = z.object({
  name: z.string().min(1).optional(),
  status: GatewayClientApiKeyStatusSchema.optional(),
  scopes: z.array(GatewayClientApiKeyScopeSchema).optional(),
  expiresAt: z.string().nullable().optional()
});
export const GatewayCreateClientApiKeyResponseSchema = z.object({
  apiKey: GatewayClientApiKeySchema,
  secret: z.string().min(1)
});
export const GatewayClientQuotaSchema = z.object({
  clientId: z.string().min(1),
  period: z.literal('monthly'),
  tokenLimit: z.number().int().positive(),
  requestLimit: z.number().int().positive(),
  usedTokens: z.number().int().nonnegative(),
  usedRequests: z.number().int().nonnegative(),
  resetAt: z.string(),
  status: GatewayQuotaStatusSchema
});
export const GatewayUpdateClientQuotaRequestSchema = GatewayClientQuotaSchema.pick({
  tokenLimit: true,
  requestLimit: true,
  resetAt: true
});
export const GatewayClientUsageSummarySchema = z.object({
  clientId: z.string().min(1),
  window: z.literal('current-period'),
  requestCount: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
  lastRequestAt: z.string().nullable()
});
export const GatewayClientRequestLogSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  apiKeyId: z.string().min(1),
  occurredAt: z.string(),
  endpoint: z.enum(['/v1/models', '/v1/chat/completions']),
  model: z.string().nullable(),
  providerId: z.string().nullable(),
  statusCode: z.number().int(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  latencyMs: z.number().nonnegative(),
  errorCode: z.string().optional()
});
export const GatewayClientRequestLogListResponseSchema = z.object({ items: z.array(GatewayClientRequestLogSchema) });
export const GatewayOpenAIChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string()
});
export const GatewayOpenAIChatCompletionRequestSchema = z.object({
  model: z.string().min(1),
  messages: z.array(GatewayOpenAIChatMessageSchema).min(1),
  stream: z.boolean().optional(),
  temperature: z.number().optional(),
  max_tokens: z.number().int().positive().optional()
});
export const GatewayOpenAIChatCompletionResponseSchema = z.object({
  id: z.string().min(1),
  object: z.literal('chat.completion'),
  created: z.number().int(),
  model: z.string().min(1),
  choices: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      message: z.object({ role: z.literal('assistant'), content: z.string() }),
      finish_reason: z.enum(['stop', 'length', 'error'])
    })
  ),
  usage: z.object({
    prompt_tokens: z.number().int().nonnegative(),
    completion_tokens: z.number().int().nonnegative(),
    total_tokens: z.number().int().nonnegative()
  })
});
export const GatewayOpenAIModelSchema = z.object({
  id: z.string().min(1),
  object: z.literal('model'),
  created: z.number().int(),
  owned_by: z.string().min(1)
});
export const GatewayOpenAIModelsResponseSchema = z.object({
  object: z.literal('list'),
  data: z.array(GatewayOpenAIModelSchema)
});
export const GatewayOpenAICompatibleErrorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.enum([
      'invalid_request_error',
      'authentication_error',
      'permission_error',
      'rate_limit_error',
      'api_error'
    ]),
    code: z.string()
  })
});
```

- [ ] **Step 4: Export inferred types**

Append matching `z.infer` exports in `packages/core/src/contracts/agent-gateway/agent-gateway.types.ts`, then confirm `packages/core/src/contracts/agent-gateway/index.ts` already exports `agent-gateway.schemas` and `agent-gateway.types`. Add explicit exports only if the barrel is missing them:

```ts
export type GatewayClient = z.infer<typeof GatewayClientSchema>;
export type GatewayClientListResponse = z.infer<typeof GatewayClientListResponseSchema>;
export type GatewayCreateClientRequest = z.infer<typeof GatewayCreateClientRequestSchema>;
export type GatewayUpdateClientRequest = z.infer<typeof GatewayUpdateClientRequestSchema>;
export type GatewayClientApiKey = z.infer<typeof GatewayClientApiKeySchema>;
export type GatewayClientApiKeyListResponse = z.infer<typeof GatewayClientApiKeyListResponseSchema>;
export type GatewayCreateClientApiKeyRequest = z.infer<typeof GatewayCreateClientApiKeyRequestSchema>;
export type GatewayUpdateClientApiKeyRequest = z.infer<typeof GatewayUpdateClientApiKeyRequestSchema>;
export type GatewayCreateClientApiKeyResponse = z.infer<typeof GatewayCreateClientApiKeyResponseSchema>;
export type GatewayClientQuota = z.infer<typeof GatewayClientQuotaSchema>;
export type GatewayUpdateClientQuotaRequest = z.infer<typeof GatewayUpdateClientQuotaRequestSchema>;
export type GatewayClientUsageSummary = z.infer<typeof GatewayClientUsageSummarySchema>;
export type GatewayClientRequestLog = z.infer<typeof GatewayClientRequestLogSchema>;
export type GatewayClientRequestLogListResponse = z.infer<typeof GatewayClientRequestLogListResponseSchema>;
export type GatewayOpenAIChatCompletionRequest = z.infer<typeof GatewayOpenAIChatCompletionRequestSchema>;
export type GatewayOpenAIChatCompletionResponse = z.infer<typeof GatewayOpenAIChatCompletionResponseSchema>;
export type GatewayOpenAIModelsResponse = z.infer<typeof GatewayOpenAIModelsResponseSchema>;
export type GatewayOpenAICompatibleErrorResponse = z.infer<typeof GatewayOpenAICompatibleErrorResponseSchema>;
```

- [ ] **Step 5: Run the contract test to verify it passes**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway/agent-gateway-internal-cli-proxy.schemas.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/contracts/agent-gateway packages/core/test/agent-gateway/agent-gateway-internal-cli-proxy.schemas.test.ts
git commit -m "feat: add agent gateway client proxy contracts"
```

## Task 2: Backend Client Repository And Management Services

**Files:**

- Create: `apps/backend/agent-server/test/agent-gateway/agent-gateway-client-runtime.spec.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/clients/agent-gateway-client.repository.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/clients/memory-agent-gateway-client.repository.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/clients/agent-gateway-client.service.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/clients/agent-gateway-client-api-key.service.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/clients/agent-gateway-client-quota.service.ts`
- Create: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway-clients.controller.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/agent-gateway.module.ts`

- [ ] **Step 1: Write failing backend management tests**

Create `apps/backend/agent-server/test/agent-gateway/agent-gateway-client-runtime.spec.ts` with the management tests first:

```ts
import { describe, expect, it } from 'vitest';
import { AgentGatewayClientsController } from '../../src/api/agent-gateway/agent-gateway-clients.controller';
import { AgentGatewayClientApiKeyService } from '../../src/domains/agent-gateway/clients/agent-gateway-client-api-key.service';
import { AgentGatewayClientQuotaService } from '../../src/domains/agent-gateway/clients/agent-gateway-client-quota.service';
import { AgentGatewayClientService } from '../../src/domains/agent-gateway/clients/agent-gateway-client.service';
import { MemoryAgentGatewayClientRepository } from '../../src/domains/agent-gateway/clients/memory-agent-gateway-client.repository';

function createClientsController() {
  const repository = new MemoryAgentGatewayClientRepository(() => new Date('2026-05-10T00:00:00.000Z'));
  return {
    controller: new AgentGatewayClientsController(
      new AgentGatewayClientService(repository),
      new AgentGatewayClientApiKeyService(repository, () => 'agp_live_secret'),
      new AgentGatewayClientQuotaService(repository)
    ),
    repository
  };
}

describe('AgentGatewayClientsController', () => {
  it('creates clients, creates one-time API keys, and lists only masked key metadata', async () => {
    const { controller } = createClientsController();
    const client = await controller.createClient({
      name: 'Acme App',
      ownerEmail: 'owner@example.com',
      tags: ['internal']
    });

    expect(client).toMatchObject({ id: 'client-acme-app', status: 'active' });

    const createdKey = await controller.createApiKey(client.id, {
      name: 'default',
      scopes: ['models.read', 'chat.completions'],
      expiresAt: null
    });

    expect(createdKey.secret).toBe('agp_live_secret');
    expect(createdKey.apiKey.prefix).toBe('agp_live');
    expect((await controller.listApiKeys(client.id)).items[0]).not.toHaveProperty('secret');
  });

  it('updates client quota and exposes usage defaults', async () => {
    const { controller } = createClientsController();
    const client = await controller.createClient({ name: 'Quota App' });
    const quota = await controller.updateQuota(client.id, {
      tokenLimit: 100,
      requestLimit: 5,
      resetAt: '2026-06-01T00:00:00.000Z'
    });

    expect(quota).toMatchObject({ clientId: client.id, tokenLimit: 100, requestLimit: 5, status: 'normal' });
    expect(await controller.usage(client.id)).toMatchObject({
      clientId: client.id,
      requestCount: 0,
      totalTokens: 0
    });
  });

  it('disables clients and API keys through management routes', async () => {
    const { controller } = createClientsController();
    const client = await controller.createClient({ name: 'Disable App' });
    const key = await controller.createApiKey(client.id, { name: 'default' });

    await expect(controller.disableClient(client.id)).resolves.toMatchObject({ status: 'disabled' });
    await expect(controller.updateApiKey(client.id, key.apiKey.id, { status: 'disabled' })).resolves.toMatchObject({
      status: 'disabled'
    });
  });
});
```

- [ ] **Step 2: Run the backend test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-client-runtime.spec.ts
```

Expected: FAIL because the controller and services do not exist.

- [ ] **Step 3: Add the repository contract**

Create `apps/backend/agent-server/src/domains/agent-gateway/clients/agent-gateway-client.repository.ts`:

```ts
import type {
  GatewayClient,
  GatewayClientApiKey,
  GatewayClientQuota,
  GatewayClientRequestLog,
  GatewayClientUsageSummary
} from '@agent/core';

export const AGENT_GATEWAY_CLIENT_REPOSITORY = Symbol('AGENT_GATEWAY_CLIENT_REPOSITORY');

export interface GatewayClientApiKeyRecord extends GatewayClientApiKey {
  secretHash: string;
}

export interface GatewayUsageDelta {
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  occurredAt: string;
}

export interface AgentGatewayClientRepository {
  listClients(): Promise<GatewayClient[]>;
  createClient(client: GatewayClient): Promise<GatewayClient>;
  findClient(clientId: string): Promise<GatewayClient | undefined>;
  updateClient(client: GatewayClient): Promise<GatewayClient>;
  listApiKeys(clientId: string): Promise<GatewayClientApiKeyRecord[]>;
  createApiKey(record: GatewayClientApiKeyRecord): Promise<GatewayClientApiKeyRecord>;
  findApiKeyByHash(secretHash: string): Promise<GatewayClientApiKeyRecord | undefined>;
  updateApiKey(record: GatewayClientApiKeyRecord): Promise<GatewayClientApiKeyRecord>;
  touchApiKey(apiKeyId: string, lastUsedAt: string): Promise<void>;
  getQuota(clientId: string): Promise<GatewayClientQuota | undefined>;
  upsertQuota(quota: GatewayClientQuota): Promise<GatewayClientQuota>;
  getUsage(clientId: string): Promise<GatewayClientUsageSummary>;
  addUsage(clientId: string, delta: GatewayUsageDelta): Promise<GatewayClientUsageSummary>;
  appendRequestLog(log: GatewayClientRequestLog): Promise<void>;
  listRequestLogs(clientId: string, limit: number): Promise<GatewayClientRequestLog[]>;
}
```

- [ ] **Step 4: Add the memory repository**

Create `apps/backend/agent-server/src/domains/agent-gateway/clients/memory-agent-gateway-client.repository.ts`:

```ts
import type {
  GatewayClient,
  GatewayClientQuota,
  GatewayClientRequestLog,
  GatewayClientUsageSummary
} from '@agent/core';
import type {
  AgentGatewayClientRepository,
  GatewayClientApiKeyRecord,
  GatewayUsageDelta
} from './agent-gateway-client.repository';

export class MemoryAgentGatewayClientRepository implements AgentGatewayClientRepository {
  private readonly clients = new Map<string, GatewayClient>();
  private readonly apiKeys = new Map<string, GatewayClientApiKeyRecord>();
  private readonly quotas = new Map<string, GatewayClientQuota>();
  private readonly usage = new Map<string, GatewayClientUsageSummary>();
  private readonly logs: GatewayClientRequestLog[] = [];

  constructor(private readonly now: () => Date = () => new Date()) {}

  async listClients(): Promise<GatewayClient[]> {
    return Array.from(this.clients.values()).map(client => ({ ...client, tags: [...client.tags] }));
  }

  async createClient(client: GatewayClient): Promise<GatewayClient> {
    this.clients.set(client.id, { ...client, tags: [...client.tags] });
    this.ensureDefaults(client.id);
    return { ...client, tags: [...client.tags] };
  }

  async findClient(clientId: string): Promise<GatewayClient | undefined> {
    const client = this.clients.get(clientId);
    return client ? { ...client, tags: [...client.tags] } : undefined;
  }

  async updateClient(client: GatewayClient): Promise<GatewayClient> {
    this.clients.set(client.id, { ...client, tags: [...client.tags] });
    return { ...client, tags: [...client.tags] };
  }

  async listApiKeys(clientId: string): Promise<GatewayClientApiKeyRecord[]> {
    return Array.from(this.apiKeys.values())
      .filter(key => key.clientId === clientId)
      .map(key => ({ ...key, scopes: [...key.scopes] }));
  }

  async createApiKey(record: GatewayClientApiKeyRecord): Promise<GatewayClientApiKeyRecord> {
    this.apiKeys.set(record.id, { ...record, scopes: [...record.scopes] });
    return { ...record, scopes: [...record.scopes] };
  }

  async findApiKeyByHash(secretHash: string): Promise<GatewayClientApiKeyRecord | undefined> {
    const key = Array.from(this.apiKeys.values()).find(item => item.secretHash === secretHash);
    return key ? { ...key, scopes: [...key.scopes] } : undefined;
  }

  async updateApiKey(record: GatewayClientApiKeyRecord): Promise<GatewayClientApiKeyRecord> {
    this.apiKeys.set(record.id, { ...record, scopes: [...record.scopes] });
    return { ...record, scopes: [...record.scopes] };
  }

  async touchApiKey(apiKeyId: string, lastUsedAt: string): Promise<void> {
    const current = this.apiKeys.get(apiKeyId);
    if (current) this.apiKeys.set(apiKeyId, { ...current, lastUsedAt });
  }

  async getQuota(clientId: string): Promise<GatewayClientQuota | undefined> {
    this.ensureDefaults(clientId);
    const quota = this.quotas.get(clientId);
    return quota ? { ...quota } : undefined;
  }

  async upsertQuota(quota: GatewayClientQuota): Promise<GatewayClientQuota> {
    this.quotas.set(quota.clientId, { ...quota });
    return { ...quota };
  }

  async getUsage(clientId: string): Promise<GatewayClientUsageSummary> {
    this.ensureDefaults(clientId);
    return { ...this.usage.get(clientId)! };
  }

  async addUsage(clientId: string, delta: GatewayUsageDelta): Promise<GatewayClientUsageSummary> {
    const current = await this.getUsage(clientId);
    const next: GatewayClientUsageSummary = {
      ...current,
      requestCount: current.requestCount + delta.requestCount,
      inputTokens: current.inputTokens + delta.inputTokens,
      outputTokens: current.outputTokens + delta.outputTokens,
      totalTokens: current.totalTokens + delta.totalTokens,
      estimatedCostUsd: current.estimatedCostUsd + delta.estimatedCostUsd,
      lastRequestAt: delta.occurredAt
    };
    this.usage.set(clientId, next);
    const quota = await this.getQuota(clientId);
    if (quota) {
      const usedTokens = quota.usedTokens + delta.totalTokens;
      const usedRequests = quota.usedRequests + delta.requestCount;
      this.quotas.set(clientId, {
        ...quota,
        usedTokens,
        usedRequests,
        status: usedTokens >= quota.tokenLimit || usedRequests >= quota.requestLimit ? 'exceeded' : 'normal'
      });
    }
    return { ...next };
  }

  async appendRequestLog(log: GatewayClientRequestLog): Promise<void> {
    this.logs.unshift({ ...log });
  }

  async listRequestLogs(clientId: string, limit: number): Promise<GatewayClientRequestLog[]> {
    return this.logs.filter(log => log.clientId === clientId).slice(0, Math.min(Math.max(limit, 1), 100));
  }

  private ensureDefaults(clientId: string): void {
    const now = this.now().toISOString();
    if (!this.quotas.has(clientId)) {
      this.quotas.set(clientId, {
        clientId,
        period: 'monthly',
        tokenLimit: 100000,
        requestLimit: 1000,
        usedTokens: 0,
        usedRequests: 0,
        resetAt: '2026-06-01T00:00:00.000Z',
        status: 'normal'
      });
    }
    if (!this.usage.has(clientId)) {
      this.usage.set(clientId, {
        clientId,
        window: 'current-period',
        requestCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        lastRequestAt: null
      });
    }
  }
}
```

- [ ] **Step 5: Add client, key, and quota services**

Create the three service files with these public methods:

```ts
// apps/backend/agent-server/src/domains/agent-gateway/clients/agent-gateway-client.service.ts
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { GatewayClient, GatewayCreateClientRequest, GatewayUpdateClientRequest } from '@agent/core';
import { AGENT_GATEWAY_CLIENT_REPOSITORY, type AgentGatewayClientRepository } from './agent-gateway-client.repository';

@Injectable()
export class AgentGatewayClientService {
  constructor(@Inject(AGENT_GATEWAY_CLIENT_REPOSITORY) private readonly repository: AgentGatewayClientRepository) {}

  list() {
    return this.repository.listClients().then(items => ({ items }));
  }

  async create(request: GatewayCreateClientRequest): Promise<GatewayClient> {
    const now = new Date().toISOString();
    return this.repository.createClient({
      id: `client-${slug(request.name)}`,
      name: request.name,
      description: request.description,
      ownerEmail: request.ownerEmail,
      status: 'active',
      tags: request.tags ?? [],
      createdAt: now,
      updatedAt: now
    });
  }

  async get(clientId: string): Promise<GatewayClient> {
    const client = await this.repository.findClient(clientId);
    if (!client) throw new NotFoundException({ code: 'gateway_client_not_found', message: 'Gateway client not found' });
    return client;
  }

  async update(clientId: string, request: GatewayUpdateClientRequest): Promise<GatewayClient> {
    const current = await this.get(clientId);
    return this.repository.updateClient({
      ...current,
      ...request,
      tags: request.tags ?? current.tags,
      updatedAt: new Date().toISOString()
    });
  }
}

function slug(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'client'
  );
}
```

```ts
// apps/backend/agent-server/src/domains/agent-gateway/clients/agent-gateway-client-api-key.service.ts
import { createHash } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  GatewayCreateClientApiKeyRequest,
  GatewayCreateClientApiKeyResponse,
  GatewayUpdateClientApiKeyRequest
} from '@agent/core';
import { AGENT_GATEWAY_CLIENT_REPOSITORY, type AgentGatewayClientRepository } from './agent-gateway-client.repository';

@Injectable()
export class AgentGatewayClientApiKeyService {
  constructor(
    @Inject(AGENT_GATEWAY_CLIENT_REPOSITORY) private readonly repository: AgentGatewayClientRepository,
    private readonly createSecret: () => string = () => `agp_live_${crypto.randomUUID().replace(/-/g, '')}`
  ) {}

  async list(clientId: string) {
    const items = await this.repository.listApiKeys(clientId);
    return { items: items.map(({ secretHash, ...item }) => item) };
  }

  async create(
    clientId: string,
    request: GatewayCreateClientApiKeyRequest
  ): Promise<GatewayCreateClientApiKeyResponse> {
    const secret = this.createSecret();
    const now = new Date().toISOString();
    const record = await this.repository.createApiKey({
      id: `key-${Date.now()}`,
      clientId,
      name: request.name,
      prefix: secret.slice(0, 8),
      status: 'active',
      scopes: request.scopes ?? ['models.read', 'chat.completions'],
      createdAt: now,
      expiresAt: request.expiresAt ?? null,
      lastUsedAt: null,
      secretHash: hashSecret(secret)
    });
    const { secretHash, ...apiKey } = record;
    return { apiKey, secret };
  }

  async update(clientId: string, apiKeyId: string, request: GatewayUpdateClientApiKeyRequest) {
    const current = (await this.repository.listApiKeys(clientId)).find(key => key.id === apiKeyId);
    if (!current)
      throw new NotFoundException({ code: 'gateway_api_key_not_found', message: 'Gateway API key not found' });
    const next = await this.repository.updateApiKey({
      ...current,
      ...request,
      scopes: request.scopes ?? current.scopes
    });
    const { secretHash, ...apiKey } = next;
    return apiKey;
  }

  async revoke(clientId: string, apiKeyId: string) {
    return this.update(clientId, apiKeyId, { status: 'revoked' });
  }
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}
```

```ts
// apps/backend/agent-server/src/domains/agent-gateway/clients/agent-gateway-client-quota.service.ts
import { Inject, Injectable } from '@nestjs/common';
import type { GatewayUpdateClientQuotaRequest } from '@agent/core';
import { AGENT_GATEWAY_CLIENT_REPOSITORY, type AgentGatewayClientRepository } from './agent-gateway-client.repository';

@Injectable()
export class AgentGatewayClientQuotaService {
  constructor(@Inject(AGENT_GATEWAY_CLIENT_REPOSITORY) private readonly repository: AgentGatewayClientRepository) {}

  async get(clientId: string) {
    return this.repository.getQuota(clientId);
  }

  async update(clientId: string, request: GatewayUpdateClientQuotaRequest) {
    const current = await this.repository.getQuota(clientId);
    return this.repository.upsertQuota({
      clientId,
      period: 'monthly',
      tokenLimit: request.tokenLimit,
      requestLimit: request.requestLimit,
      usedTokens: current?.usedTokens ?? 0,
      usedRequests: current?.usedRequests ?? 0,
      resetAt: request.resetAt,
      status: 'normal'
    });
  }

  usage(clientId: string) {
    return this.repository.getUsage(clientId);
  }

  async logs(clientId: string, limit = 50) {
    return { items: await this.repository.listRequestLogs(clientId, limit) };
  }
}
```

- [ ] **Step 6: Add the management controller**

Create `apps/backend/agent-server/src/api/agent-gateway/agent-gateway-clients.controller.ts`:

```ts
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards
} from '@nestjs/common';
import {
  GatewayCreateClientApiKeyRequestSchema,
  GatewayCreateClientRequestSchema,
  GatewayListQuerySchema,
  GatewayUpdateClientApiKeyRequestSchema,
  GatewayUpdateClientQuotaRequestSchema,
  GatewayUpdateClientRequestSchema
} from '@agent/core';
import { AgentGatewayAuthGuard } from '../../domains/agent-gateway/auth/agent-gateway-auth.guard';
import { AgentGatewayClientApiKeyService } from '../../domains/agent-gateway/clients/agent-gateway-client-api-key.service';
import { AgentGatewayClientQuotaService } from '../../domains/agent-gateway/clients/agent-gateway-client-quota.service';
import { AgentGatewayClientService } from '../../domains/agent-gateway/clients/agent-gateway-client.service';

@Controller('agent-gateway/clients')
@UseGuards(AgentGatewayAuthGuard)
export class AgentGatewayClientsController {
  constructor(
    private readonly clients: AgentGatewayClientService,
    private readonly apiKeys: AgentGatewayClientApiKeyService,
    private readonly quotas: AgentGatewayClientQuotaService
  ) {}

  @Get() listClients() {
    return this.clients.list();
  }
  @Post() createClient(@Body() body: unknown) {
    return this.clients.create(parse(GatewayCreateClientRequestSchema, body));
  }
  @Get(':clientId') getClient(@Param('clientId') clientId: string) {
    return this.clients.get(clientId);
  }
  @Patch(':clientId') updateClient(@Param('clientId') clientId: string, @Body() body: unknown) {
    return this.clients.update(clientId, parse(GatewayUpdateClientRequestSchema, body));
  }
  @Patch(':clientId/enable') enableClient(@Param('clientId') clientId: string) {
    return this.clients.update(clientId, { status: 'active' });
  }
  @Patch(':clientId/disable') disableClient(@Param('clientId') clientId: string) {
    return this.clients.update(clientId, { status: 'disabled' });
  }
  @Get(':clientId/api-keys') listApiKeys(@Param('clientId') clientId: string) {
    return this.apiKeys.list(clientId);
  }
  @Post(':clientId/api-keys') createApiKey(@Param('clientId') clientId: string, @Body() body: unknown) {
    return this.apiKeys.create(clientId, parse(GatewayCreateClientApiKeyRequestSchema, body));
  }
  @Patch(':clientId/api-keys/:apiKeyId') updateApiKey(
    @Param('clientId') clientId: string,
    @Param('apiKeyId') apiKeyId: string,
    @Body() body: unknown
  ) {
    return this.apiKeys.update(clientId, apiKeyId, parse(GatewayUpdateClientApiKeyRequestSchema, body));
  }
  @Post(':clientId/api-keys/:apiKeyId/rotate') rotateApiKey(@Param('clientId') clientId: string) {
    return this.apiKeys.create(clientId, { name: 'rotated key', scopes: ['models.read', 'chat.completions'] });
  }
  @Delete(':clientId/api-keys/:apiKeyId') deleteApiKey(
    @Param('clientId') clientId: string,
    @Param('apiKeyId') apiKeyId: string
  ) {
    return this.apiKeys.revoke(clientId, apiKeyId);
  }
  @Get(':clientId/quota') quota(@Param('clientId') clientId: string) {
    return this.quotas.get(clientId);
  }
  @Put(':clientId/quota') updateQuota(@Param('clientId') clientId: string, @Body() body: unknown) {
    return this.quotas.update(clientId, parse(GatewayUpdateClientQuotaRequestSchema, body));
  }
  @Get(':clientId/usage') usage(@Param('clientId') clientId: string) {
    return this.quotas.usage(clientId);
  }
  @Get(':clientId/logs') logs(@Param('clientId') clientId: string, @Query() query: unknown) {
    const parsed = GatewayListQuerySchema.safeParse(query);
    return this.quotas.logs(clientId, parsed.success ? parsed.data.limit : 50);
  }
}

function parse<T>(
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
  body: unknown
): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new BadRequestException({ code: 'invalid_request', message: 'Invalid Agent Gateway client request' });
  return parsed.data;
}
```

- [ ] **Step 7: Wire providers in the module**

Modify `apps/backend/agent-server/src/domains/agent-gateway/agent-gateway.module.ts`:

```ts
import { AgentGatewayClientsController } from '../../api/agent-gateway/agent-gateway-clients.controller';
import { AGENT_GATEWAY_CLIENT_REPOSITORY } from './clients/agent-gateway-client.repository';
import { AgentGatewayClientApiKeyService } from './clients/agent-gateway-client-api-key.service';
import { AgentGatewayClientQuotaService } from './clients/agent-gateway-client-quota.service';
import { AgentGatewayClientService } from './clients/agent-gateway-client.service';
import { MemoryAgentGatewayClientRepository } from './clients/memory-agent-gateway-client.repository';
```

Add `AgentGatewayClientsController` to `controllers`, add the three services to `providers`, and add:

```ts
{
  provide: AGENT_GATEWAY_CLIENT_REPOSITORY,
  useClass: MemoryAgentGatewayClientRepository
}
```

- [ ] **Step 8: Run the backend management test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-client-runtime.spec.ts
```

Expected: PASS for the three management tests.

- [ ] **Step 9: Commit**

```bash
git add apps/backend/agent-server/src/api/agent-gateway/agent-gateway-clients.controller.ts apps/backend/agent-server/src/domains/agent-gateway apps/backend/agent-server/test/agent-gateway/agent-gateway-client-runtime.spec.ts
git commit -m "feat: add agent gateway client management"
```

## Task 3: Backend OpenAI-Compatible Runtime

**Files:**

- Modify: `apps/backend/agent-server/test/agent-gateway/agent-gateway-client-runtime.spec.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime/agent-gateway-runtime-auth.service.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime/agent-gateway-runtime-accounting.service.ts`
- Create: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway-openai-compatible.controller.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/agent-gateway.module.ts`

- [ ] **Step 1: Add failing runtime tests**

Append to `apps/backend/agent-server/test/agent-gateway/agent-gateway-client-runtime.spec.ts`:

```ts
import { AgentGatewayOpenAICompatibleController } from '../../src/api/agent-gateway/agent-gateway-openai-compatible.controller';
import { MockAgentGatewayProvider } from '../../src/domains/agent-gateway/providers/mock-agent-gateway-provider';
import { MemoryAgentGatewayRepository } from '../../src/domains/agent-gateway/repositories/memory-agent-gateway.repository';
import { AgentGatewayRuntimeAccountingService } from '../../src/domains/agent-gateway/runtime/agent-gateway-runtime-accounting.service';
import { AgentGatewayRuntimeAuthService } from '../../src/domains/agent-gateway/runtime/agent-gateway-runtime-auth.service';
import { AgentGatewayRelayService } from '../../src/domains/agent-gateway/runtime/agent-gateway-relay.service';

async function createRuntimeController() {
  const clientRepository = new MemoryAgentGatewayClientRepository(() => new Date('2026-05-10T00:00:00.000Z'));
  const clients = new AgentGatewayClientService(clientRepository);
  const keys = new AgentGatewayClientApiKeyService(clientRepository, () => 'agp_live_runtime_secret');
  const quotas = new AgentGatewayClientQuotaService(clientRepository);
  const client = await clients.create({ name: 'Runtime App' });
  await quotas.update(client.id, { tokenLimit: 100, requestLimit: 5, resetAt: '2026-06-01T00:00:00.000Z' });
  const key = await keys.create(client.id, { name: 'runtime', scopes: ['models.read', 'chat.completions'] });
  const gatewayRepository = new MemoryAgentGatewayRepository();
  return {
    controller: new AgentGatewayOpenAICompatibleController(
      new AgentGatewayRuntimeAuthService(clientRepository),
      new AgentGatewayRelayService(gatewayRepository, [new MockAgentGatewayProvider()]),
      new AgentGatewayRuntimeAccountingService(clientRepository)
    ),
    clientId: client.id,
    secret: key.secret,
    repository: clientRepository
  };
}

describe('AgentGatewayOpenAICompatibleController', () => {
  it('lists models through a client API key', async () => {
    const { controller, secret } = await createRuntimeController();
    await expect(controller.models(`Bearer ${secret}`)).resolves.toMatchObject({
      object: 'list',
      data: [{ id: 'gpt-5.4' }]
    });
  });

  it('completes chat requests, records usage, and writes request logs', async () => {
    const { controller, secret, clientId, repository } = await createRuntimeController();
    const response = await controller.chatCompletions(`Bearer ${secret}`, {
      model: 'gpt-5.4',
      messages: [{ role: 'user', content: 'ping' }],
      stream: false
    });

    expect(response.choices[0].message.content).toContain('mock relay response: ping');
    expect((await repository.getUsage(clientId)).requestCount).toBe(1);
    expect(await repository.listRequestLogs(clientId, 10)).toHaveLength(1);
  });

  it('rejects disabled API keys and quota exceeded runtime requests', async () => {
    const { controller, secret, clientId, repository } = await createRuntimeController();
    await repository.upsertQuota({
      clientId,
      period: 'monthly',
      tokenLimit: 1,
      requestLimit: 1,
      usedTokens: 1,
      usedRequests: 1,
      resetAt: '2026-06-01T00:00:00.000Z',
      status: 'exceeded'
    });

    await expect(
      controller.chatCompletions(`Bearer ${secret}`, {
        model: 'gpt-5.4',
        messages: [{ role: 'user', content: 'ping' }]
      })
    ).rejects.toMatchObject({ status: 429 });
  });

  it('rejects streaming explicitly in the first slice', async () => {
    const { controller, secret } = await createRuntimeController();
    await expect(
      controller.chatCompletions(`Bearer ${secret}`, {
        model: 'gpt-5.4',
        messages: [{ role: 'user', content: 'ping' }],
        stream: true
      })
    ).rejects.toMatchObject({ status: 400 });
  });
});
```

- [ ] **Step 2: Run runtime tests to verify they fail**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-client-runtime.spec.ts
```

Expected: FAIL because runtime auth/accounting/controller files do not exist.

- [ ] **Step 3: Add runtime auth service**

Create `apps/backend/agent-server/src/domains/agent-gateway/runtime/agent-gateway-runtime-auth.service.ts`:

```ts
import { Inject, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import type { GatewayClient } from '@agent/core';
import {
  AGENT_GATEWAY_CLIENT_REPOSITORY,
  type AgentGatewayClientRepository,
  type GatewayClientApiKeyRecord
} from '../clients/agent-gateway-client.repository';
import { hashSecret } from '../clients/agent-gateway-client-api-key.service';

export interface GatewayRuntimePrincipal {
  client: GatewayClient;
  apiKey: GatewayClientApiKeyRecord;
}

@Injectable()
export class AgentGatewayRuntimeAuthService {
  constructor(@Inject(AGENT_GATEWAY_CLIENT_REPOSITORY) private readonly repository: AgentGatewayClientRepository) {}

  async authenticate(authorization: string | undefined): Promise<GatewayRuntimePrincipal> {
    const secret = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
    if (!secret)
      throw new UnauthorizedException(openAIError('invalid_api_key', 'Missing proxy API key', 'authentication_error'));
    const apiKey = await this.repository.findApiKeyByHash(hashSecret(secret));
    if (!apiKey || apiKey.status === 'revoked') {
      throw new UnauthorizedException(openAIError('invalid_api_key', 'Invalid proxy API key', 'authentication_error'));
    }
    if (apiKey.status !== 'active') {
      throw new ForbiddenException(openAIError('api_key_disabled', 'Proxy API key is disabled', 'permission_error'));
    }
    const client = await this.repository.findClient(apiKey.clientId);
    if (!client || client.status !== 'active') {
      throw new ForbiddenException(openAIError('client_disabled', 'Gateway client is disabled', 'permission_error'));
    }
    return { client, apiKey };
  }
}

export function openAIError(
  code: string,
  message: string,
  type: 'invalid_request_error' | 'authentication_error' | 'permission_error' | 'rate_limit_error' | 'api_error'
) {
  return { error: { message, type, code } };
}
```

- [ ] **Step 4: Add runtime accounting service**

Create `apps/backend/agent-server/src/domains/agent-gateway/runtime/agent-gateway-runtime-accounting.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';
import type { GatewayClientRequestLog, GatewayRelayUsage } from '@agent/core';
import {
  AGENT_GATEWAY_CLIENT_REPOSITORY,
  type AgentGatewayClientRepository
} from '../clients/agent-gateway-client.repository';
import type { GatewayRuntimePrincipal } from './agent-gateway-runtime-auth.service';

@Injectable()
export class AgentGatewayRuntimeAccountingService {
  constructor(@Inject(AGENT_GATEWAY_CLIENT_REPOSITORY) private readonly repository: AgentGatewayClientRepository) {}

  async assertQuota(principal: GatewayRuntimePrincipal, estimatedInputTokens: number): Promise<void> {
    const quota = await this.repository.getQuota(principal.client.id);
    if (!quota) return;
    if (quota.usedRequests + 1 > quota.requestLimit || quota.usedTokens + estimatedInputTokens > quota.tokenLimit) {
      const error = new Error('quota exceeded') as Error & { status?: number; response?: unknown };
      error.status = 429;
      error.response = { error: { message: 'quota exceeded', type: 'rate_limit_error', code: 'quota_exceeded' } };
      throw error;
    }
  }

  async recordSuccess(
    principal: GatewayRuntimePrincipal,
    usage: GatewayRelayUsage,
    log: Omit<GatewayClientRequestLog, 'clientId' | 'apiKeyId'>
  ): Promise<void> {
    await this.repository.addUsage(principal.client.id, {
      requestCount: 1,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      estimatedCostUsd: 0,
      occurredAt: log.occurredAt
    });
    await this.repository.touchApiKey(principal.apiKey.id, log.occurredAt);
    await this.repository.appendRequestLog({ ...log, clientId: principal.client.id, apiKeyId: principal.apiKey.id });
  }
}
```

- [ ] **Step 5: Add OpenAI-compatible controller**

Create `apps/backend/agent-server/src/api/agent-gateway/agent-gateway-openai-compatible.controller.ts`:

```ts
import { BadRequestException, Controller, Get, Headers, Post, Body } from '@nestjs/common';
import {
  GatewayOpenAIChatCompletionRequestSchema,
  type GatewayOpenAIChatCompletionResponse,
  type GatewayOpenAIModelsResponse
} from '@agent/core';
import { AgentGatewayRelayService } from '../../domains/agent-gateway/runtime/agent-gateway-relay.service';
import { AgentGatewayRuntimeAccountingService } from '../../domains/agent-gateway/runtime/agent-gateway-runtime-accounting.service';
import {
  AgentGatewayRuntimeAuthService,
  openAIError
} from '../../domains/agent-gateway/runtime/agent-gateway-runtime-auth.service';

@Controller('v1')
export class AgentGatewayOpenAICompatibleController {
  constructor(
    private readonly auth: AgentGatewayRuntimeAuthService,
    private readonly relay: AgentGatewayRelayService,
    private readonly accounting: AgentGatewayRuntimeAccountingService
  ) {}

  @Get('models')
  async models(@Headers('authorization') authorization?: string): Promise<GatewayOpenAIModelsResponse> {
    await this.auth.authenticate(authorization);
    return {
      object: 'list',
      data: [{ id: 'gpt-5.4', object: 'model', created: Math.floor(Date.now() / 1000), owned_by: 'openai-primary' }]
    };
  }

  @Post('chat/completions')
  async chatCompletions(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown
  ): Promise<GatewayOpenAIChatCompletionResponse> {
    const parsed = GatewayOpenAIChatCompletionRequestSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        openAIError('invalid_request', 'Invalid chat completion request', 'invalid_request_error')
      );
    if (parsed.data.stream)
      throw new BadRequestException(
        openAIError('stream_not_supported', 'stream is not supported in this gateway slice', 'invalid_request_error')
      );

    const principal = await this.auth.authenticate(authorization);
    const estimatedInputTokens = parsed.data.messages.reduce(
      (sum, message) => sum + Math.ceil(message.content.length / 4),
      0
    );
    await this.accounting.assertQuota(principal, estimatedInputTokens);
    const startedAt = Date.now();
    const relayResponse = await this.relay.relay({
      model: parsed.data.model,
      messages: parsed.data.messages,
      stream: false
    });
    const occurredAt = new Date().toISOString();
    await this.accounting.recordSuccess(principal, relayResponse.usage, {
      id: `req-${Date.now()}`,
      occurredAt,
      endpoint: '/v1/chat/completions',
      model: relayResponse.model,
      providerId: relayResponse.providerId,
      statusCode: 200,
      inputTokens: relayResponse.usage.inputTokens,
      outputTokens: relayResponse.usage.outputTokens,
      latencyMs: Date.now() - startedAt
    });
    return {
      id: relayResponse.id,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: relayResponse.model,
      choices: [{ index: 0, message: { role: 'assistant', content: relayResponse.content }, finish_reason: 'stop' }],
      usage: {
        prompt_tokens: relayResponse.usage.inputTokens,
        completion_tokens: relayResponse.usage.outputTokens,
        total_tokens: relayResponse.usage.totalTokens
      }
    };
  }
}
```

- [ ] **Step 6: Wire runtime services and controller**

Modify `apps/backend/agent-server/src/domains/agent-gateway/agent-gateway.module.ts` to import `AgentGatewayOpenAICompatibleController`, `AgentGatewayRuntimeAuthService`, and `AgentGatewayRuntimeAccountingService`; add the controller and providers.

- [ ] **Step 7: Run backend runtime tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-client-runtime.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Run existing Agent Gateway backend tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway
```

Expected: PASS. Existing management parity tests must still pass.

- [ ] **Step 9: Commit**

```bash
git add apps/backend/agent-server/src/api/agent-gateway apps/backend/agent-server/src/domains/agent-gateway apps/backend/agent-server/test/agent-gateway/agent-gateway-client-runtime.spec.ts
git commit -m "feat: add agent gateway openai compatible runtime"
```

## Task 4: Frontend API Client And Clients Page

**Files:**

- Modify: `apps/frontend/agent-gateway/test/agent-gateway-api.test.ts`
- Create: `apps/frontend/agent-gateway/test/agent-gateway-clients-page.test.tsx`
- Modify: `apps/frontend/agent-gateway/src/api/agent-gateway-api.ts`
- Modify: `apps/frontend/agent-gateway/src/app/gateway-view-model.ts`
- Modify: `apps/frontend/agent-gateway/src/app/GatewayWorkspace.tsx`
- Create: `apps/frontend/agent-gateway/src/app/pages/ClientsPage.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/styles/management.scss`

- [ ] **Step 1: Add failing frontend API test**

Append to `apps/frontend/agent-gateway/test/agent-gateway-api.test.ts`:

```ts
it('calls Gateway client management endpoints', async () => {
  axiosRequestMock
    .mockResolvedValueOnce({
      status: 200,
      data: {
        items: [
          {
            id: 'client-acme',
            name: 'Acme',
            status: 'active',
            tags: [],
            createdAt: '2026-05-10T00:00:00.000Z',
            updatedAt: '2026-05-10T00:00:00.000Z'
          }
        ]
      }
    })
    .mockResolvedValueOnce({
      status: 200,
      data: {
        id: 'client-acme',
        name: 'Acme',
        status: 'active',
        tags: [],
        createdAt: '2026-05-10T00:00:00.000Z',
        updatedAt: '2026-05-10T00:00:00.000Z'
      }
    })
    .mockResolvedValueOnce({ status: 200, data: { items: [] } })
    .mockResolvedValueOnce({
      status: 200,
      data: {
        apiKey: {
          id: 'key-1',
          clientId: 'client-acme',
          name: 'default',
          prefix: 'agp_live',
          status: 'active',
          scopes: ['models.read'],
          createdAt: '2026-05-10T00:00:00.000Z',
          expiresAt: null,
          lastUsedAt: null
        },
        secret: 'agp_live_secret'
      }
    })
    .mockResolvedValueOnce({
      status: 200,
      data: {
        clientId: 'client-acme',
        period: 'monthly',
        tokenLimit: 100,
        requestLimit: 5,
        usedTokens: 0,
        usedRequests: 0,
        resetAt: '2026-06-01T00:00:00.000Z',
        status: 'normal'
      }
    })
    .mockResolvedValueOnce({
      status: 200,
      data: {
        clientId: 'client-acme',
        window: 'current-period',
        requestCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        lastRequestAt: null
      }
    })
    .mockResolvedValueOnce({ status: 200, data: { items: [] } });
  const client = new AgentGatewayApiClient({ getAccessToken: () => 'access', refreshAccessToken: async () => 'fresh' });

  await expect(client.clients()).resolves.toMatchObject({ items: [{ id: 'client-acme' }] });
  await expect(client.createClient({ name: 'Acme' })).resolves.toMatchObject({ id: 'client-acme' });
  await expect(client.clientApiKeys('client-acme')).resolves.toEqual({ items: [] });
  await expect(client.createClientApiKey('client-acme', { name: 'default' })).resolves.toMatchObject({
    secret: 'agp_live_secret'
  });
  await expect(
    client.updateClientQuota('client-acme', { tokenLimit: 100, requestLimit: 5, resetAt: '2026-06-01T00:00:00.000Z' })
  ).resolves.toMatchObject({ tokenLimit: 100 });
  await expect(client.clientUsage('client-acme')).resolves.toMatchObject({ requestCount: 0 });
  await expect(client.clientLogs('client-acme')).resolves.toEqual({ items: [] });

  expect(axiosRequestMock.mock.calls.map(call => [call[0].method ?? 'GET', call[0].url])).toEqual([
    ['GET', '/api/agent-gateway/clients'],
    ['POST', '/api/agent-gateway/clients'],
    ['GET', '/api/agent-gateway/clients/client-acme/api-keys'],
    ['POST', '/api/agent-gateway/clients/client-acme/api-keys'],
    ['PUT', '/api/agent-gateway/clients/client-acme/quota'],
    ['GET', '/api/agent-gateway/clients/client-acme/usage'],
    ['GET', '/api/agent-gateway/clients/client-acme/logs?limit=50']
  ]);
});
```

- [ ] **Step 2: Add failing Clients page test**

Create `apps/frontend/agent-gateway/test/agent-gateway-clients-page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClientsPage } from '../src/app/pages/ClientsPage';

describe('ClientsPage', () => {
  it('renders clients, API keys, quota, usage, logs, and one-time secret notice', () => {
    render(
      <ClientsPage
        clients={{
          items: [
            {
              id: 'client-acme',
              name: 'Acme App',
              status: 'active',
              tags: ['internal'],
              createdAt: '2026-05-10T00:00:00.000Z',
              updatedAt: '2026-05-10T00:00:00.000Z'
            }
          ]
        }}
        apiKeys={{
          items: [
            {
              id: 'key-1',
              clientId: 'client-acme',
              name: 'default',
              prefix: 'agp_live',
              status: 'active',
              scopes: ['models.read'],
              createdAt: '2026-05-10T00:00:00.000Z',
              expiresAt: null,
              lastUsedAt: null
            }
          ]
        }}
        quota={{
          clientId: 'client-acme',
          period: 'monthly',
          tokenLimit: 1000,
          requestLimit: 100,
          usedTokens: 200,
          usedRequests: 10,
          resetAt: '2026-06-01T00:00:00.000Z',
          status: 'normal'
        }}
        usage={{
          clientId: 'client-acme',
          window: 'current-period',
          requestCount: 10,
          inputTokens: 100,
          outputTokens: 100,
          totalTokens: 200,
          estimatedCostUsd: 0,
          lastRequestAt: '2026-05-10T00:00:00.000Z'
        }}
        logs={{
          items: [
            {
              id: 'req-1',
              clientId: 'client-acme',
              apiKeyId: 'key-1',
              occurredAt: '2026-05-10T00:00:00.000Z',
              endpoint: '/v1/chat/completions',
              model: 'gpt-5.4',
              providerId: 'openai-primary',
              statusCode: 200,
              inputTokens: 1,
              outputTokens: 1,
              latencyMs: 12
            }
          ]
        }}
        oneTimeSecret="agp_live_secret"
        onCreateClient={vi.fn()}
        onCreateApiKey={vi.fn()}
        onUpdateQuota={vi.fn()}
        onDisableClient={vi.fn()}
      />
    );

    expect(screen.getByText('Acme App')).toBeInTheDocument();
    expect(screen.getByText('agp_live')).toBeInTheDocument();
    expect(screen.getByText('agp_live_secret')).toBeInTheDocument();
    expect(screen.getByText('/v1/chat/completions')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run frontend tests to verify they fail**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-gateway/test/agent-gateway-api.test.ts apps/frontend/agent-gateway/test/agent-gateway-clients-page.test.tsx
```

Expected: FAIL because client methods and `ClientsPage` do not exist.

- [ ] **Step 4: Add API client imports and methods**

Modify `apps/frontend/agent-gateway/src/api/agent-gateway-api.ts` to import the new schemas and types, then add methods:

```ts
clients(): Promise<GatewayClientListResponse> {
  return this.get('/agent-gateway/clients', GatewayClientListResponseSchema);
}

createClient(request: GatewayCreateClientRequest): Promise<GatewayClient> {
  return this.post('/agent-gateway/clients', request, GatewayClientSchema);
}

updateClient(clientId: string, request: GatewayUpdateClientRequest): Promise<GatewayClient> {
  return this.patch(`/agent-gateway/clients/${encodeURIComponent(clientId)}`, request, GatewayClientSchema);
}

disableClient(clientId: string): Promise<GatewayClient> {
  return this.patch(`/agent-gateway/clients/${encodeURIComponent(clientId)}/disable`, {}, GatewayClientSchema);
}

clientApiKeys(clientId: string): Promise<GatewayClientApiKeyListResponse> {
  return this.get(`/agent-gateway/clients/${encodeURIComponent(clientId)}/api-keys`, GatewayClientApiKeyListResponseSchema);
}

createClientApiKey(clientId: string, request: GatewayCreateClientApiKeyRequest): Promise<GatewayCreateClientApiKeyResponse> {
  return this.post(`/agent-gateway/clients/${encodeURIComponent(clientId)}/api-keys`, request, GatewayCreateClientApiKeyResponseSchema);
}

updateClientQuota(clientId: string, request: GatewayUpdateClientQuotaRequest): Promise<GatewayClientQuota> {
  return this.put(`/agent-gateway/clients/${encodeURIComponent(clientId)}/quota`, request, GatewayClientQuotaSchema);
}

clientUsage(clientId: string): Promise<GatewayClientUsageSummary> {
  return this.get(`/agent-gateway/clients/${encodeURIComponent(clientId)}/usage`, GatewayClientUsageSummarySchema);
}

clientLogs(clientId: string, limit = 50): Promise<GatewayClientRequestLogListResponse> {
  return this.get(`/agent-gateway/clients/${encodeURIComponent(clientId)}/logs?limit=${limit}`, GatewayClientRequestLogListResponseSchema);
}
```

- [ ] **Step 5: Add view model route**

Modify `apps/frontend/agent-gateway/src/app/gateway-view-model.ts`:

```ts
export type GatewayViewId =
  | 'dashboard'
  | 'clients'
  | 'config'
  | 'aiProviders'
  | 'authFiles'
  | 'oauth'
  | 'quota'
  | 'system';

export const gatewayNavigationItems = [
  { id: 'dashboard', label: '总览', path: '/' },
  { id: 'clients', label: '调用方管理', path: '/clients' },
  { id: 'config', label: '配置', path: '/config' },
  { id: 'aiProviders', label: 'AI Providers', path: '/ai-providers' },
  { id: 'authFiles', label: '认证文件', path: '/auth-files' },
  { id: 'oauth', label: 'OAuth', path: '/oauth' },
  { id: 'quota', label: '配额管理', path: '/quota' },
  { id: 'system', label: '系统', path: '/system' }
];
```

Preserve any existing fields on navigation items by adding the `clients` item instead of replacing unrelated properties.

- [ ] **Step 6: Add ClientsPage**

Create `apps/frontend/agent-gateway/src/app/pages/ClientsPage.tsx`:

```tsx
import type {
  GatewayClientApiKeyListResponse,
  GatewayClientListResponse,
  GatewayClientQuota,
  GatewayClientRequestLogListResponse,
  GatewayClientUsageSummary,
  GatewayCreateClientApiKeyRequest,
  GatewayCreateClientRequest,
  GatewayUpdateClientQuotaRequest
} from '@agent/core';
import { GatewayTable } from '../components/GatewayTable';

interface ClientsPageProps {
  clients: GatewayClientListResponse;
  apiKeys: GatewayClientApiKeyListResponse;
  quota: GatewayClientQuota | null;
  usage: GatewayClientUsageSummary | null;
  logs: GatewayClientRequestLogListResponse;
  oneTimeSecret?: string | null;
  onCreateClient: (request: GatewayCreateClientRequest) => void;
  onCreateApiKey: (request: GatewayCreateClientApiKeyRequest) => void;
  onUpdateQuota: (request: GatewayUpdateClientQuotaRequest) => void;
  onDisableClient: (clientId: string) => void;
}

export function ClientsPage({
  clients,
  apiKeys,
  quota,
  usage,
  logs,
  oneTimeSecret,
  onCreateClient,
  onCreateApiKey,
  onUpdateQuota,
  onDisableClient
}: ClientsPageProps) {
  const selected = clients.items[0] ?? null;
  return (
    <section className="gateway-management-page gateway-clients-page" aria-label="调用方管理">
      <header className="management-page-header">
        <div>
          <h1>调用方管理</h1>
          <p>管理中转客户、Proxy API Key、额度、用量和请求日志。</p>
        </div>
      </header>
      {oneTimeSecret ? (
        <div className="one-time-secret" role="status">
          <strong>只显示一次</strong>
          <code>{oneTimeSecret}</code>
        </div>
      ) : null}
      <form
        className="command-panel"
        onSubmit={event => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          onCreateClient({
            name: String(form.get('name') ?? ''),
            ownerEmail: String(form.get('ownerEmail') ?? '') || undefined,
            tags: String(form.get('tags') ?? '')
              .split(',')
              .map(tag => tag.trim())
              .filter(Boolean)
          });
        }}
      >
        <label>
          名称
          <input name="name" />
        </label>
        <label>
          Owner Email
          <input name="ownerEmail" />
        </label>
        <label>
          Tags
          <input name="tags" />
        </label>
        <button type="submit">创建调用方</button>
      </form>
      <GatewayTable
        getRowKey={client => client.id}
        items={clients.items}
        columns={[
          { key: 'name', header: '名称', render: client => client.name },
          {
            key: 'status',
            header: '状态',
            render: client => <span className={`status-pill ${client.status}`}>{client.status}</span>
          },
          { key: 'tags', header: 'Tags', render: client => client.tags.join(', ') || '-' },
          {
            key: 'actions',
            header: '操作',
            render: client => (
              <button type="button" onClick={() => onDisableClient(client.id)}>
                禁用
              </button>
            )
          }
        ]}
      />
      {selected ? (
        <div className="client-detail-grid">
          <article className="command-panel">
            <h2>{selected.name} API Keys</h2>
            <button
              type="button"
              onClick={() => onCreateApiKey({ name: 'default', scopes: ['models.read', 'chat.completions'] })}
            >
              生成 API Key
            </button>
            <GatewayTable
              getRowKey={key => key.id}
              items={apiKeys.items}
              columns={[
                { key: 'name', header: '名称', render: key => key.name },
                { key: 'prefix', header: 'Prefix', render: key => key.prefix },
                { key: 'status', header: '状态', render: key => key.status }
              ]}
            />
          </article>
          <article className="command-panel">
            <h2>额度</h2>
            <p>{quota ? `${quota.usedTokens} / ${quota.tokenLimit} tokens` : '未设置'}</p>
            <p>{usage ? `${usage.requestCount} requests, ${usage.totalTokens} tokens` : '暂无用量'}</p>
            <button
              type="button"
              onClick={() =>
                onUpdateQuota({ tokenLimit: 100000, requestLimit: 1000, resetAt: '2026-06-01T00:00:00.000Z' })
              }
            >
              重置默认额度
            </button>
          </article>
        </div>
      ) : null}
      <GatewayTable
        getRowKey={log => log.id}
        items={logs.items}
        columns={[
          { key: 'endpoint', header: 'Endpoint', render: log => log.endpoint },
          { key: 'model', header: 'Model', render: log => log.model ?? '-' },
          { key: 'statusCode', header: 'Status', render: log => String(log.statusCode) },
          { key: 'latencyMs', header: 'Latency', render: log => `${log.latencyMs}ms` }
        ]}
      />
    </section>
  );
}
```

- [ ] **Step 7: Wire the page in GatewayWorkspace and App queries**

Modify `apps/frontend/agent-gateway/src/app/GatewayWorkspace.tsx` to render `ClientsPage` when `activeView === 'clients'`. Modify `apps/frontend/agent-gateway/src/app/App.tsx` to query:

```ts
const clientsQuery = useQuery({
  queryKey: ['agent-gateway', 'clients', auth.accessToken],
  queryFn: () => api.clients(),
  enabled: Boolean(auth.accessToken)
});
```

Use the first client as the initial detail target for `clientApiKeys`, `clientUsage`, `clientLogs`, and `clientQuota`. On create/write success call `queryClient.invalidateQueries({ queryKey: ['agent-gateway'] })` and save `oneTimeSecret` in component state after `createClientApiKey`.

- [ ] **Step 8: Add minimal CSS**

Append to `apps/frontend/agent-gateway/src/app/styles/management.scss`:

```css
.gateway-clients-page .one-time-secret {
  display: grid;
  gap: 6px;
  border: 1px solid #b45309;
  background: #fffbeb;
  color: #78350f;
  padding: 12px;
  border-radius: 8px;
}

.gateway-clients-page .one-time-secret code {
  font-size: 13px;
  overflow-wrap: anywhere;
}

.client-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

@media (max-width: 840px) {
  .client-detail-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 9: Run frontend tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-gateway/test/agent-gateway-api.test.ts apps/frontend/agent-gateway/test/agent-gateway-clients-page.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/frontend/agent-gateway/src apps/frontend/agent-gateway/test
git commit -m "feat: add agent gateway client management ui"
```

## Task 5: Documentation Cleanup

**Files:**

- Modify: `docs/contracts/api/agent-gateway.md`
- Modify: `docs/apps/backend/agent-server/agent-gateway.md`
- Modify: `docs/apps/frontend/agent-gateway/README.md`
- Modify: `docs/apps/frontend/agent-gateway/cli-proxy-parity.md`

- [ ] **Step 1: Scan current docs for misleading phrasing**

Run:

```bash
rg -n "连接外部 CLIProxyAPI|remote management|AGENT_GATEWAY_MANAGEMENT_MODE|management key|provider quota|调用方|/v1/chat/completions|/v1/models" docs/contracts/api/agent-gateway.md docs/apps/backend/agent-server/agent-gateway.md docs/apps/frontend/agent-gateway/README.md docs/apps/frontend/agent-gateway/cli-proxy-parity.md
```

Expected: existing docs still emphasize remote management parity and do not yet describe Gateway clients as the primary path.

- [ ] **Step 2: Update API contract docs**

In `docs/contracts/api/agent-gateway.md`, add a “内建 CLIProxyAPI 主线” section near the current HTTP entry list:

````markdown
## 内建 CLIProxyAPI 主线

`agent-server` 默认提供内建简易 CLIProxyAPI。`apps/frontend/agent-gateway` 的主线不是连接外部 CLIProxyAPI，而是管理本服务内的 Gateway clients、client API keys、quota、usage 和 request logs。

Runtime 入口不挂在 `/api` 前缀下：

```text
GET  /v1/models
POST /v1/chat/completions
```
````

Runtime 使用 `Authorization: Bearer <client-api-key>` 鉴权。Identity access token 只用于 `/api/agent-gateway/*` 管理面。查询 client API key 只返回 prefix；明文 secret 只在创建或轮换响应中出现一次。

````

- [ ] **Step 3: Update backend and frontend docs**

In `docs/apps/backend/agent-server/agent-gateway.md`, add the backend ownership rule:

```markdown
## 内建中转运行时

`agent-server` 拥有 Gateway client、client API key、client quota、usage accounting 和 `/v1/*` runtime。Controller 只负责 HTTP wiring 与 schema parse；key hash、quota 判断、usage 写入和 request log 写入必须留在 `src/domains/agent-gateway`。
````

In `docs/apps/frontend/agent-gateway/README.md`, add the frontend ownership rule:

```markdown
## 调用方管理

`agent-gateway` 前端必须提供 Gateway clients 管理，不再只展示 provider/auth file 配置。调用方管理页负责创建客户、生成 client API key、设置额度、查看用量和请求日志。
```

In `docs/apps/frontend/agent-gateway/cli-proxy-parity.md`, mark remote connection as advanced compatibility:

```markdown
## 外部 CLIProxyAPI 兼容连接

外部 CLIProxyAPI connection 仅保留为高级兼容和调试参考。当前主线是 `agent-server` 内建 CLIProxyAPI；不要把 remote management connection 写成默认部署前置条件。
```

- [ ] **Step 4: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/contracts/api/agent-gateway.md docs/apps/backend/agent-server/agent-gateway.md docs/apps/frontend/agent-gateway/README.md docs/apps/frontend/agent-gateway/cli-proxy-parity.md
git commit -m "docs: document internal agent gateway proxy runtime"
```

## Task 6: Affected Verification

**Files:**

- No new source files. This task verifies the integrated change set.

- [ ] **Step 1: Run focused tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway apps/backend/agent-server/test/agent-gateway apps/frontend/agent-gateway/test
```

Expected: PASS.

- [ ] **Step 2: Run affected type checks**

Run:

```bash
pnpm exec tsc -p packages/core/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/frontend/agent-gateway typecheck
```

Expected: PASS.

- [ ] **Step 3: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

- [ ] **Step 4: Run implementation cleanup scan**

Run:

```bash
rg -n "连接外部 CLIProxyAPI|remote management connection.*default|provider quota.*调用方|占位词" apps/backend/agent-server/src/domains/agent-gateway apps/backend/agent-server/src/api/agent-gateway apps/frontend/agent-gateway/src docs/contracts/api/agent-gateway.md docs/apps/backend/agent-server/agent-gateway.md docs/apps/frontend/agent-gateway
```

Expected: no current-state text claims external CLIProxyAPI connection is the default, no provider quota is described as client quota, and no placeholder text remains.

- [ ] **Step 5: Commit verification-only fixes if any were needed**

If Step 1-4 required small fixes, commit them:

```bash
git add apps/backend/agent-server apps/frontend/agent-gateway packages/core docs
git commit -m "chore: verify internal agent gateway proxy runtime"
```

If no fixes were needed, do not create an empty commit.

## Self-Review

- Spec coverage: tasks cover core schema, backend clients/key/quota, OpenAI-compatible runtime, frontend Clients page, docs cleanup, and affected verification.
- Scope control: streaming is explicitly rejected in this slice with `stream_not_supported`; database persistence, billing, and full CLIProxyAPI parity remain out of scope.
- Type consistency: the plan consistently uses `GatewayClient`, `GatewayClientApiKey`, `GatewayClientQuota`, `GatewayClientUsageSummary`, `GatewayClientRequestLog`, `GatewayOpenAIChatCompletion*`, and `GatewayOpenAIModelsResponse`.
- Placeholder scan: no plan step relies on an unspecified placeholder; implementation snippets define the named files and methods used by later tasks.
