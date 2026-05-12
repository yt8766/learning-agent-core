# Agent Gateway CLI Proxy Remaining Parity Implementation Plan

状态：completed
文档类型：plan
适用范围：`apps/frontend/agent-gateway`、`apps/backend/agent-server/src/domains/agent-gateway`、`apps/backend/agent-server/src/api/agent-gateway`、`packages/core/src/contracts/agent-gateway`、`docs/contracts/api/agent-gateway.md`
最后核对：2026-05-09

> 完成记录：本计划已在 2026-05-09 完成代码、测试和文档收口。实现采用 `AgentGatewayManagementController` 承载新增 parity endpoints，避免继续膨胀既有主 controller；`AgentGatewayModule` 通过显式环境变量选择 `CliProxyManagementClient`，默认仍保留 deterministic memory client。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining CLI Proxy Management Web UI parity gaps so Agent Gateway can operate against a real `/v0/management` backend with complete provider, auth-file, OAuth, quota, logs, system, dashboard, and UI mutation flows.

**Architecture:** Keep `@agent/core` as the schema-first contract boundary, keep `agent-server` as the adapter/facade owner, and keep `apps/frontend/agent-gateway` as a management console that never consumes raw CLI Proxy vendor payloads. Real CLI Proxy HTTP calls must enter through `CliProxyManagementClient`, then be normalized into project-owned schemas before reaching controllers or UI.

**Tech Stack:** TypeScript, zod, NestJS, React 19, Vite, Vitest, `@agent/core`, existing pnpm workspace scripts, `fs-extra` only when a backend persistence boundary needs filesystem access.

---

## Scope Check

This plan starts from the current 2026-05-09 baseline, where the first parity wave already landed:

- Core schemas for connection, raw config, proxy API keys, provider config, auth files, OAuth policy aliases, quota detail, logs, system models, dashboard summary, `api-call`, Vertex import, and Ampcode mappings.
- Backend deterministic management services plus `CliProxyManagementClient` skeleton.
- Frontend pages for Connection, Config, API Keys, Logs, System, Provider Config, Auth Files Manager, OAuth Policy, and workflow controls.
- Passing affected tests: `packages/core/test/agent-gateway`, `apps/backend/agent-server/test/agent-gateway`, `apps/frontend/agent-gateway/test`.

This plan only covers the missing production parity work. It does not implement actual OpenAI-compatible relay traffic forwarding, billing, long-term persistence, or a database migration.

## File Structure

### Contracts

- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway-cli-proxy-parity.schemas.ts`
  - Add missing request/response schemas only when this plan exposes a new HTTP endpoint.
- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.types.ts`
  - Export inferred types for new schemas.
- Test: `packages/core/test/agent-gateway/agent-gateway-cli-proxy-parity.schemas.test.ts`
  - Parse every added payload shape.

### Backend

- Modify: `apps/backend/agent-server/src/domains/agent-gateway/agent-gateway.module.ts`
  - Configure memory vs real CLI Proxy management client selection.
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/management/cli-proxy-management-client.ts`
  - Expand real adapter coverage.
- Create: `apps/backend/agent-server/src/domains/agent-gateway/dashboard/agent-gateway-dashboard.service.ts`
  - Dashboard summary facade.
- Create: `apps/backend/agent-server/src/domains/agent-gateway/providers/agent-gateway-provider-config.service.ts`
  - Provider-specific config facade.
- Create: `apps/backend/agent-server/src/domains/agent-gateway/auth-files/agent-gateway-auth-file-management.service.ts`
  - Auth file batch/list/download/patch facade.
- Create: `apps/backend/agent-server/src/domains/agent-gateway/oauth/agent-gateway-oauth-policy.service.ts`
  - OAuth policy, callback polling, model alias, and Vertex import facade.
- Create: `apps/backend/agent-server/src/domains/agent-gateway/quotas/agent-gateway-api-call.service.ts`
  - Stable `/api-call` management proxy facade and quota parser boundary.
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/logs/agent-gateway-log.service.ts`
  - Add request log by id, file content download, raw/parsed, structured filters, and after cursor behavior.
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/system/agent-gateway-system.service.ts`
  - Add latest-version check, request-log setting, and clear-login-storage command projection.
- Modify: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway.controller.ts`
  - Expose new stable endpoints.
- Test: `apps/backend/agent-server/test/agent-gateway/*.spec.ts`

### Frontend

- Modify: `apps/frontend/agent-gateway/src/api/agent-gateway-api.ts`
  - Add methods for new stable endpoints.
- Create: `apps/frontend/agent-gateway/src/app/pages/DashboardPage.tsx`
  - Reference-project-style summary page.
- Modify: `apps/frontend/agent-gateway/src/app/pages/ProviderConfigPage.tsx`
  - Connect provider CRUD, model discovery, test model, and Ampcode mappings.
- Modify: `apps/frontend/agent-gateway/src/app/pages/AuthFilesManagerPage.tsx`
  - Connect batch upload/download/delete, patch, model listing, and filters.
- Modify: `apps/frontend/agent-gateway/src/app/pages/OAuthPolicyPage.tsx`
  - Connect excluded models, aliases, callback/status polling, Gemini project id, and Vertex import.
- Create: `apps/frontend/agent-gateway/src/app/pages/QuotaDetailPage.tsx`
  - Display provider-specific quota details from `/api-call`.
- Modify: `apps/frontend/agent-gateway/src/app/pages/LogsManagerPage.tsx`
  - Connect download, structured filters, raw/parsed toggle, and incremental polling.
- Modify: `apps/frontend/agent-gateway/src/app/pages/SystemPage.tsx`
  - Connect latest-version, request-log switch, and local session cleanup control.
- Modify: `apps/frontend/agent-gateway/src/app/GatewayWorkspace.tsx`
  - Route the new dashboard/quota-detail flow.
- Modify: `apps/frontend/agent-gateway/src/app/gateway-view-model.ts`
  - Add stable view ids.
- Modify: `apps/frontend/agent-gateway/src/app/App.scss`
  - Add dense styles for the new controls.
- Test: `apps/frontend/agent-gateway/test/*.test.tsx`

### Docs

- Modify: `docs/contracts/api/agent-gateway.md`
- Modify: `docs/apps/frontend/agent-gateway/README.md`
- Modify: `docs/apps/backend/agent-server/agent-gateway.md`
- Modify: `docs/apps/frontend/agent-gateway/cli-proxy-parity.md`

---

## Task 1: Configure Real CLI Proxy Management Client Selection

**Files:**

- Modify: `apps/backend/agent-server/src/domains/agent-gateway/agent-gateway.module.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/management/cli-proxy-management-client.ts`
- Test: `apps/backend/agent-server/test/agent-gateway/agent-gateway.module.spec.ts`
- Test: `apps/backend/agent-server/test/agent-gateway/cli-proxy-management-client.spec.ts`

- [ ] **Step 1: Write failing module selection tests**

Add this test case to `apps/backend/agent-server/test/agent-gateway/agent-gateway.module.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { AgentGatewayModule } from '../../src/domains/agent-gateway/agent-gateway.module';
import { AGENT_GATEWAY_MANAGEMENT_CLIENT } from '../../src/domains/agent-gateway/management/agent-gateway-management-client';
import { CliProxyManagementClient } from '../../src/domains/agent-gateway/management/cli-proxy-management-client';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';

it('uses memory management client by default and CLI Proxy client when configured', async () => {
  const memoryModule = await Test.createTestingModule({ imports: [AgentGatewayModule] }).compile();
  expect(memoryModule.get(AGENT_GATEWAY_MANAGEMENT_CLIENT)).toBeInstanceOf(MemoryAgentGatewayManagementClient);

  process.env.AGENT_GATEWAY_MANAGEMENT_MODE = 'cli-proxy';
  process.env.AGENT_GATEWAY_MANAGEMENT_API_BASE = 'https://router.example.com';
  process.env.AGENT_GATEWAY_MANAGEMENT_KEY = 'mgmt-secret';
  try {
    const cliModule = await Test.createTestingModule({ imports: [AgentGatewayModule] }).compile();
    expect(cliModule.get(AGENT_GATEWAY_MANAGEMENT_CLIENT)).toBeInstanceOf(CliProxyManagementClient);
  } finally {
    delete process.env.AGENT_GATEWAY_MANAGEMENT_MODE;
    delete process.env.AGENT_GATEWAY_MANAGEMENT_API_BASE;
    delete process.env.AGENT_GATEWAY_MANAGEMENT_KEY;
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway.module.spec.ts
```

Expected: FAIL because the module still always wires the memory client.

- [ ] **Step 3: Implement provider selection**

In `apps/backend/agent-server/src/domains/agent-gateway/agent-gateway.module.ts`, replace the fixed management provider with:

```ts
{
  provide: AGENT_GATEWAY_MANAGEMENT_CLIENT,
  useFactory: () => {
    if (process.env.AGENT_GATEWAY_MANAGEMENT_MODE === 'cli-proxy') {
      return new CliProxyManagementClient({
        apiBase: process.env.AGENT_GATEWAY_MANAGEMENT_API_BASE ?? '',
        managementKey: process.env.AGENT_GATEWAY_MANAGEMENT_KEY ?? ''
      });
    }
    return new MemoryAgentGatewayManagementClient();
  }
}
```

Also import `CliProxyManagementClient` from `./management/cli-proxy-management-client`.

- [ ] **Step 4: Guard invalid real adapter configuration**

In `apps/backend/agent-server/src/domains/agent-gateway/management/cli-proxy-management-client.ts`, make the constructor throw a stable error when real mode lacks required config:

```ts
if (!options.apiBase || !options.managementKey) {
  throw new Error('CLI Proxy management client requires apiBase and managementKey');
}
```

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway.module.spec.ts apps/backend/agent-server/test/agent-gateway/cli-proxy-management-client.spec.ts
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit --pretty false
```

Expected: PASS.

---

## Task 2: Dashboard Parity

**Files:**

- Create: `apps/backend/agent-server/src/domains/agent-gateway/dashboard/agent-gateway-dashboard.service.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/agent-gateway.module.ts`
- Modify: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway.controller.ts`
- Modify: `apps/frontend/agent-gateway/src/api/agent-gateway-api.ts`
- Create: `apps/frontend/agent-gateway/src/app/pages/DashboardPage.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/GatewayWorkspace.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/gateway-view-model.ts`
- Test: `apps/backend/agent-server/test/agent-gateway/agent-gateway-dashboard.service.spec.ts`
- Test: `apps/frontend/agent-gateway/test/agent-gateway-dashboard-page.test.tsx`
- Test: `apps/frontend/agent-gateway/test/agent-gateway-api.test.ts`

- [ ] **Step 1: Write failing backend dashboard test**

Create `apps/backend/agent-server/test/agent-gateway/agent-gateway-dashboard.service.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AgentGatewayDashboardService } from '../../src/domains/agent-gateway/dashboard/agent-gateway-dashboard.service';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';
import { MemoryAgentGatewayRepository } from '../../src/domains/agent-gateway/repositories/memory-agent-gateway.repository';

describe('AgentGatewayDashboardService', () => {
  it('builds a CLI Proxy style dashboard summary from stable projections', async () => {
    const repository = new MemoryAgentGatewayRepository();
    const management = new MemoryAgentGatewayManagementClient();
    await management.saveProfile({
      apiBase: 'https://router.example.com/v0/management',
      managementKey: 'secret',
      timeoutMs: 15000
    });
    await management.replaceApiKeys({ keys: ['sk-one'] });

    const service = new AgentGatewayDashboardService(repository, management);
    const summary = await service.summary();

    expect(summary.connection).toMatchObject({
      status: 'connected',
      apiBase: 'https://router.example.com/v0/management'
    });
    expect(summary.counts.managementApiKeys).toBe(1);
    expect(summary.counts.authFiles).toBeGreaterThan(0);
    expect(summary.providers[0]).toHaveProperty('providerKind');
    expect(summary.routing.strategy).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-dashboard.service.spec.ts
```

Expected: FAIL because `AgentGatewayDashboardService` does not exist.

- [ ] **Step 3: Implement backend dashboard service**

Create `apps/backend/agent-server/src/domains/agent-gateway/dashboard/agent-gateway-dashboard.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';
import type { GatewayDashboardSummaryResponse, GatewayProviderKind } from '@agent/core';
import type { AgentGatewayManagementClient } from '../management/agent-gateway-management-client';
import { AGENT_GATEWAY_MANAGEMENT_CLIENT } from '../management/agent-gateway-management-client';
import type { AgentGatewayRepository } from '../repositories/agent-gateway.repository';
import { AGENT_GATEWAY_REPOSITORY } from '../repositories/agent-gateway.repository';

@Injectable()
export class AgentGatewayDashboardService {
  constructor(
    @Inject(AGENT_GATEWAY_REPOSITORY) private readonly repository: AgentGatewayRepository,
    @Inject(AGENT_GATEWAY_MANAGEMENT_CLIENT) private readonly managementClient: AgentGatewayManagementClient
  ) {}

  async summary(): Promise<GatewayDashboardSummaryResponse> {
    const [config, providers, credentialFiles, apiKeys, connection, models] = await Promise.all([
      this.repository.getConfig(),
      this.repository.listProviders(),
      this.repository.listCredentialFiles(),
      this.managementClient.listApiKeys(),
      this.managementClient.checkConnection(),
      this.managementClient.discoverModels()
    ]);
    return {
      observedAt: new Date().toISOString(),
      connection: {
        status: connection.status,
        apiBase: null,
        serverVersion: connection.serverVersion,
        serverBuildDate: connection.serverBuildDate
      },
      counts: {
        managementApiKeys: apiKeys.items.length,
        authFiles: credentialFiles.length,
        providerCredentials: providers.length,
        availableModels: models.groups.reduce((total, group) => total + group.models.length, 0)
      },
      providers: providers.map(provider => ({
        providerKind: inferProviderKind(provider.provider),
        configured: true,
        enabled: provider.status === 'disabled' ? 0 : 1,
        disabled: provider.status === 'disabled' ? 1 : 0,
        modelCount: provider.modelFamilies.length
      })),
      routing: {
        strategy: 'priority',
        forceModelPrefix: false,
        requestRetry: config.retryLimit,
        wsAuth: true,
        proxyUrl: null
      }
    };
  }
}

function inferProviderKind(name: string): GatewayProviderKind {
  const normalized = name.toLowerCase();
  if (normalized.includes('gemini')) return 'gemini';
  if (normalized.includes('codex')) return 'codex';
  if (normalized.includes('claude') || normalized.includes('anthropic')) return 'claude';
  if (normalized.includes('vertex')) return 'vertex';
  if (normalized.includes('ampcode')) return 'ampcode';
  return 'custom';
}
```

- [ ] **Step 4: Add controller endpoint**

In `apps/backend/agent-server/src/api/agent-gateway/agent-gateway.controller.ts`, inject `AgentGatewayDashboardService` and add:

```ts
@Get('dashboard')
dashboard(): Promise<GatewayDashboardSummaryResponse> {
  if (!this.dashboardService) {
    throw new BadRequestException({ code: 'DASHBOARD_UNAVAILABLE', message: 'Dashboard 服务未配置' });
  }
  return this.dashboardService.summary();
}
```

- [ ] **Step 5: Add frontend API method and page test**

Create `apps/frontend/agent-gateway/test/agent-gateway-dashboard-page.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DashboardPage } from '../src/app/pages/DashboardPage';

describe('DashboardPage', () => {
  it('renders CLI Proxy dashboard summary counts', () => {
    const html = renderToStaticMarkup(
      <DashboardPage
        summary={{
          observedAt: '2026-05-09T00:00:00.000Z',
          connection: {
            status: 'connected',
            apiBase: 'https://router.example.com/v0/management',
            serverVersion: '1.2.3',
            serverBuildDate: '2026-05-01'
          },
          counts: {
            managementApiKeys: 2,
            authFiles: 3,
            providerCredentials: 4,
            availableModels: 9
          },
          providers: [],
          routing: {
            strategy: 'priority',
            forceModelPrefix: false,
            requestRetry: 2,
            wsAuth: true,
            proxyUrl: null
          }
        }}
      />
    );
    expect(html).toContain('Dashboard');
    expect(html).toContain('2 API Keys');
    expect(html).toContain('9 Models');
  });
});
```

- [ ] **Step 6: Implement dashboard page**

Create `apps/frontend/agent-gateway/src/app/pages/DashboardPage.tsx`:

```tsx
import type { GatewayDashboardSummaryResponse } from '@agent/core';

interface DashboardPageProps {
  summary: GatewayDashboardSummaryResponse;
}

export function DashboardPage({ summary }: DashboardPageProps) {
  return (
    <section className="page-stack" aria-label="Dashboard">
      <div className="section-heading">
        <h2>Dashboard</h2>
        <p>{summary.connection.apiBase ?? 'Local deterministic management client'}</p>
      </div>
      <div className="metric-grid">
        <article className="metric-card">
          <strong>{summary.counts.managementApiKeys}</strong>
          <span>API Keys</span>
        </article>
        <article className="metric-card">
          <strong>{summary.counts.authFiles}</strong>
          <span>Auth Files</span>
        </article>
        <article className="metric-card">
          <strong>{summary.counts.providerCredentials}</strong>
          <span>Provider Keys</span>
        </article>
        <article className="metric-card">
          <strong>{summary.counts.availableModels}</strong>
          <span>Models</span>
        </article>
      </div>
      <div className="detail-panel">
        <p>Connection: {summary.connection.status}</p>
        <p>Version: {summary.connection.serverVersion ?? '-'}</p>
        <p>Routing: {summary.routing.strategy}</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 7: Run verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-dashboard.service.spec.ts apps/frontend/agent-gateway/test/agent-gateway-dashboard-page.test.tsx apps/frontend/agent-gateway/test/agent-gateway-api.test.ts
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit --pretty false
pnpm --dir apps/frontend/agent-gateway typecheck
```

Expected: PASS.

---

## Task 3: Provider-Specific Backend and UI Actions

**Files:**

- Create: `apps/backend/agent-server/src/domains/agent-gateway/providers/agent-gateway-provider-config.service.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/management/cli-proxy-management-client.ts`
- Modify: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway.controller.ts`
- Modify: `apps/frontend/agent-gateway/src/api/agent-gateway-api.ts`
- Modify: `apps/frontend/agent-gateway/src/app/pages/ProviderConfigPage.tsx`
- Test: `apps/backend/agent-server/test/agent-gateway/agent-gateway-provider-config.service.spec.ts`
- Test: `apps/frontend/agent-gateway/test/agent-gateway-provider-auth-pages.test.tsx`

- [ ] **Step 1: Write failing backend provider config test**

Create `apps/backend/agent-server/test/agent-gateway/agent-gateway-provider-config.service.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AgentGatewayProviderConfigService } from '../../src/domains/agent-gateway/providers/agent-gateway-provider-config.service';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';

describe('AgentGatewayProviderConfigService', () => {
  it('lists and saves provider-specific configs through the management boundary', async () => {
    const service = new AgentGatewayProviderConfigService(new MemoryAgentGatewayManagementClient());

    await expect(service.list()).resolves.toMatchObject({
      items: expect.any(Array)
    });
    await expect(
      service.save({
        providerType: 'openaiCompatible',
        id: 'openai-router',
        displayName: 'OpenAI Router',
        enabled: true,
        baseUrl: 'https://router.example.com/v1',
        models: [{ name: 'gpt-5.4', testModel: 'gpt-5.4' }],
        excludedModels: [],
        credentials: [],
        rawSource: 'adapter'
      })
    ).resolves.toMatchObject({ id: 'openai-router', providerType: 'openaiCompatible' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-provider-config.service.spec.ts
```

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Extend management client interface**

Add these methods to `AgentGatewayManagementClient`:

```ts
listProviderConfigs(): Promise<GatewayProviderSpecificConfigListResponse>;
saveProviderConfig(request: GatewayProviderSpecificConfigRecord): Promise<GatewayProviderSpecificConfigRecord>;
discoverProviderModels(providerId: string): Promise<GatewaySystemModelsResponse>;
testProviderModel(providerId: string, model: string): Promise<GatewayProbeResponse>;
```

- [ ] **Step 4: Implement service facade**

Create `apps/backend/agent-server/src/domains/agent-gateway/providers/agent-gateway-provider-config.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';
import type {
  GatewayProbeResponse,
  GatewayProviderSpecificConfigListResponse,
  GatewayProviderSpecificConfigRecord,
  GatewaySystemModelsResponse
} from '@agent/core';
import type { AgentGatewayManagementClient } from '../management/agent-gateway-management-client';
import { AGENT_GATEWAY_MANAGEMENT_CLIENT } from '../management/agent-gateway-management-client';

@Injectable()
export class AgentGatewayProviderConfigService {
  constructor(
    @Inject(AGENT_GATEWAY_MANAGEMENT_CLIENT) private readonly managementClient: AgentGatewayManagementClient
  ) {}

  list(): Promise<GatewayProviderSpecificConfigListResponse> {
    return this.managementClient.listProviderConfigs();
  }

  save(request: GatewayProviderSpecificConfigRecord): Promise<GatewayProviderSpecificConfigRecord> {
    return this.managementClient.saveProviderConfig(request);
  }

  discoverModels(providerId: string): Promise<GatewaySystemModelsResponse> {
    return this.managementClient.discoverProviderModels(providerId);
  }

  testModel(providerId: string, model: string): Promise<GatewayProbeResponse> {
    return this.managementClient.testProviderModel(providerId, model);
  }
}
```

- [ ] **Step 5: Implement memory and CLI Proxy adapter methods**

In `MemoryAgentGatewayManagementClient`, store provider configs in a `Map<string, GatewayProviderSpecificConfigRecord>` and return schema-compatible records.

In `CliProxyManagementClient`, map:

```ts
GET / gemini - api - key;
GET / codex - api - key;
GET / claude - api - key;
GET / vertex - api - key;
GET / openai - compatibility;
GET / ampcode;
```

into `GatewayProviderSpecificConfigListResponseSchema`. For saves, route by `providerType`:

```ts
PUT / gemini - api - key;
PUT / codex - api - key;
PUT / claude - api - key;
PUT / vertex - api - key;
PUT / openai - compatibility;
PUT / ampcode / model - mappings;
```

- [ ] **Step 6: Connect frontend actions**

In `apps/frontend/agent-gateway/src/app/pages/ProviderConfigPage.tsx`, accept props:

```tsx
interface ProviderConfigPageProps {
  onRefreshModels?: (providerId: string) => void;
  onTestModel?: (providerId: string, model: string) => void;
  onSaveProvider?: (providerId: string) => void;
}
```

Render buttons with `onClick` handlers for `Model discovery`, `Test model`, `Upstream key mappings`, `Model mappings`, and `Force mappings`.

- [ ] **Step 7: Run verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-provider-config.service.spec.ts apps/frontend/agent-gateway/test/agent-gateway-provider-auth-pages.test.tsx
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit --pretty false
pnpm --dir apps/frontend/agent-gateway typecheck
```

Expected: PASS.

---

## Task 4: Auth Files Backend Governance

**Files:**

- Create: `apps/backend/agent-server/src/domains/agent-gateway/auth-files/agent-gateway-auth-file-management.service.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/management/cli-proxy-management-client.ts`
- Modify: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway.controller.ts`
- Modify: `apps/frontend/agent-gateway/src/api/agent-gateway-api.ts`
- Modify: `apps/frontend/agent-gateway/src/app/pages/AuthFilesManagerPage.tsx`
- Test: `apps/backend/agent-server/test/agent-gateway/agent-gateway-auth-file-management.service.spec.ts`
- Test: `apps/frontend/agent-gateway/test/agent-gateway-provider-auth-pages.test.tsx`

- [ ] **Step 1: Write failing auth files backend test**

Create `apps/backend/agent-server/test/agent-gateway/agent-gateway-auth-file-management.service.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AgentGatewayAuthFileManagementService } from '../../src/domains/agent-gateway/auth-files/agent-gateway-auth-file-management.service';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';

describe('AgentGatewayAuthFileManagementService', () => {
  it('supports list, batch upload, status patch, field patch, model listing, download, and delete', async () => {
    const service = new AgentGatewayAuthFileManagementService(new MemoryAgentGatewayManagementClient());

    await expect(
      service.batchUpload({
        files: [{ fileName: 'gemini.json', contentBase64: 'e30=', providerKind: 'gemini' }]
      })
    ).resolves.toMatchObject({ accepted: [{ fileName: 'gemini.json' }] });

    await expect(service.list({ query: 'gemini', limit: 20 })).resolves.toMatchObject({
      items: [{ fileName: 'gemini.json' }]
    });
    await expect(service.patchFields({ authFileId: 'gemini.json', metadata: { priority: 1 } })).resolves.toMatchObject({
      id: 'gemini.json'
    });
    await expect(service.models('gemini.json')).resolves.toMatchObject({ authFileId: 'gemini.json' });
    await expect(service.download('gemini.json')).resolves.toContain('gemini');
    await expect(service.delete({ names: ['gemini.json'] })).resolves.toMatchObject({ deleted: ['gemini.json'] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-auth-file-management.service.spec.ts
```

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Add missing schemas if needed**

If `GatewayAuthFileDeleteRequestSchema` and `GatewayAuthFileDeleteResponseSchema` are missing, add them to `agent-gateway-cli-proxy-parity.schemas.ts`:

```ts
export const GatewayAuthFileDeleteRequestSchema = z.object({
  names: z.array(z.string().min(1)).optional(),
  all: z.boolean().optional()
});

export const GatewayAuthFileDeleteResponseSchema = z.object({
  deleted: z.array(z.string()),
  skipped: z.array(z.object({ name: z.string(), reason: z.string() }))
});
```

- [ ] **Step 4: Implement service facade**

Create `apps/backend/agent-server/src/domains/agent-gateway/auth-files/agent-gateway-auth-file-management.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';
import type {
  GatewayAuthFileBatchUploadRequest,
  GatewayAuthFileBatchUploadResponse,
  GatewayAuthFileListResponse,
  GatewayAuthFileModelListResponse,
  GatewayAuthFilePatchRequest,
  GatewayAuthFile
} from '@agent/core';
import type { AgentGatewayManagementClient } from '../management/agent-gateway-management-client';
import { AGENT_GATEWAY_MANAGEMENT_CLIENT } from '../management/agent-gateway-management-client';

export interface GatewayAuthFileListQuery {
  query?: string;
  providerKind?: string;
  cursor?: string;
  limit?: number;
}

export interface GatewayAuthFileDeleteRequest {
  names?: string[];
  all?: boolean;
}

export interface GatewayAuthFileDeleteResponse {
  deleted: string[];
  skipped: Array<{ name: string; reason: string }>;
}

@Injectable()
export class AgentGatewayAuthFileManagementService {
  constructor(
    @Inject(AGENT_GATEWAY_MANAGEMENT_CLIENT) private readonly managementClient: AgentGatewayManagementClient
  ) {}

  list(query: GatewayAuthFileListQuery): Promise<GatewayAuthFileListResponse> {
    return this.managementClient.listAuthFiles(query);
  }

  batchUpload(request: GatewayAuthFileBatchUploadRequest): Promise<GatewayAuthFileBatchUploadResponse> {
    return this.managementClient.batchUploadAuthFiles(request);
  }

  patchFields(request: GatewayAuthFilePatchRequest): Promise<GatewayAuthFile> {
    return this.managementClient.patchAuthFileFields(request);
  }

  models(authFileId: string): Promise<GatewayAuthFileModelListResponse> {
    return this.managementClient.listAuthFileModels(authFileId);
  }

  download(authFileId: string): Promise<string> {
    return this.managementClient.downloadAuthFile(authFileId);
  }

  delete(request: GatewayAuthFileDeleteRequest): Promise<GatewayAuthFileDeleteResponse> {
    return this.managementClient.deleteAuthFiles(request);
  }
}
```

- [ ] **Step 5: Map CLI Proxy endpoints**

In `CliProxyManagementClient`, implement:

```ts
GET /auth-files
POST multipart /auth-files
PATCH /auth-files/status
PATCH /auth-files/fields
DELETE /auth-files
GET /auth-files/download?name=<name>
GET /auth-files/models?name=<name>
GET /model-definitions/:channel
```

Normalize each response into `GatewayAuthFileListResponseSchema`, `GatewayAuthFileBatchUploadResponseSchema`, `GatewayAuthFileSchema`, and `GatewayAuthFileModelListResponseSchema`.

- [ ] **Step 6: Connect frontend actions**

In `AuthFilesManagerPage.tsx`, add props:

```tsx
interface AuthFilesManagerPageProps {
  onBatchUpload?: () => void;
  onBatchDownload?: () => void;
  onBatchDelete?: () => void;
  onToggleStatus?: () => void;
  onPatchFields?: () => void;
  onListModels?: () => void;
}
```

Wire the existing buttons to these callbacks.

- [ ] **Step 7: Run verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-auth-file-management.service.spec.ts apps/frontend/agent-gateway/test/agent-gateway-provider-auth-pages.test.tsx
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit --pretty false
pnpm --dir apps/frontend/agent-gateway typecheck
```

Expected: PASS.

---

## Task 5: OAuth Policy, Polling, Callback, Gemini Project, and Vertex Import

**Files:**

- Create: `apps/backend/agent-server/src/domains/agent-gateway/oauth/agent-gateway-oauth-policy.service.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/management/cli-proxy-management-client.ts`
- Modify: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway.controller.ts`
- Modify: `apps/frontend/agent-gateway/src/api/agent-gateway-api.ts`
- Modify: `apps/frontend/agent-gateway/src/app/pages/OAuthPolicyPage.tsx`
- Test: `apps/backend/agent-server/test/agent-gateway/agent-gateway-oauth-policy.service.spec.ts`
- Test: `apps/frontend/agent-gateway/test/agent-gateway-provider-auth-pages.test.tsx`

- [ ] **Step 1: Write failing OAuth policy service test**

Create `apps/backend/agent-server/test/agent-gateway/agent-gateway-oauth-policy.service.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AgentGatewayOAuthPolicyService } from '../../src/domains/agent-gateway/oauth/agent-gateway-oauth-policy.service';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';

describe('AgentGatewayOAuthPolicyService', () => {
  it('manages excluded models, aliases, callback polling, Gemini project id, and Vertex import', async () => {
    const service = new AgentGatewayOAuthPolicyService(new MemoryAgentGatewayManagementClient());

    await expect(service.listAliases('gemini')).resolves.toMatchObject({ providerId: 'gemini' });
    await expect(
      service.saveAliases({
        providerId: 'gemini',
        modelAliases: [{ channel: 'gemini-cli', sourceModel: 'gemini-2.5-pro', alias: 'gemini-pro', fork: true }]
      })
    ).resolves.toMatchObject({ modelAliases: [{ fork: true }] });
    await expect(service.status('oauth-state-1')).resolves.toMatchObject({ state: 'oauth-state-1' });
    await expect(
      service.submitCallback({ provider: 'gemini', redirectUrl: 'http://localhost/callback?code=abc' })
    ).resolves.toMatchObject({ accepted: true });
    await expect(service.startGeminiCli({ projectId: 'ALL' })).resolves.toHaveProperty('verificationUri');
    await expect(
      service.importVertexCredential({
        fileName: 'vertex.json',
        contentBase64: 'e30=',
        location: 'us-central1'
      })
    ).resolves.toMatchObject({ imported: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-oauth-policy.service.spec.ts
```

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement OAuth policy service**

Create `apps/backend/agent-server/src/domains/agent-gateway/oauth/agent-gateway-oauth-policy.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';
import type {
  GatewayOAuthModelAliasListResponse,
  GatewayUpdateOAuthModelAliasRulesRequest,
  GatewayVertexCredentialImportRequest,
  GatewayVertexCredentialImportResponse
} from '@agent/core';
import type { AgentGatewayManagementClient } from '../management/agent-gateway-management-client';
import { AGENT_GATEWAY_MANAGEMENT_CLIENT } from '../management/agent-gateway-management-client';

export interface GatewayOAuthStatusResponse {
  state: string;
  status: 'pending' | 'completed' | 'expired' | 'error';
  checkedAt: string;
}

export interface GatewayOAuthCallbackRequest {
  provider: string;
  redirectUrl: string;
}

export interface GatewayOAuthCallbackResponse {
  accepted: boolean;
  provider: string;
  completedAt: string;
}

export interface GatewayGeminiCliOAuthStartRequest {
  projectId?: string;
}

@Injectable()
export class AgentGatewayOAuthPolicyService {
  constructor(
    @Inject(AGENT_GATEWAY_MANAGEMENT_CLIENT) private readonly managementClient: AgentGatewayManagementClient
  ) {}

  listAliases(providerId: string): Promise<GatewayOAuthModelAliasListResponse> {
    return this.managementClient.listOAuthModelAliases(providerId);
  }

  saveAliases(request: GatewayUpdateOAuthModelAliasRulesRequest): Promise<GatewayOAuthModelAliasListResponse> {
    return this.managementClient.saveOAuthModelAliases(request);
  }

  status(state: string): Promise<GatewayOAuthStatusResponse> {
    return this.managementClient.getOAuthStatus(state);
  }

  submitCallback(request: GatewayOAuthCallbackRequest): Promise<GatewayOAuthCallbackResponse> {
    return this.managementClient.submitOAuthCallback(request);
  }

  startGeminiCli(request: GatewayGeminiCliOAuthStartRequest) {
    return this.managementClient.startGeminiCliOAuth(request);
  }

  importVertexCredential(
    request: GatewayVertexCredentialImportRequest
  ): Promise<GatewayVertexCredentialImportResponse> {
    return this.managementClient.importVertexCredential(request);
  }
}
```

- [ ] **Step 4: Map CLI Proxy endpoints**

In `CliProxyManagementClient`, implement:

```ts
GET /oauth-model-alias
PATCH /oauth-model-alias
GET /get-auth-status?state=<state>
POST /oauth-callback
GET /gemini-cli-auth-url?is_webui=true&project_id=<projectId>
POST multipart /vertex/import
```

For `projectId`, pass `ALL` exactly when the user selects all projects.

- [ ] **Step 5: Connect frontend callbacks**

In `OAuthPolicyPage.tsx`, add props:

```tsx
interface OAuthPolicyPageProps {
  onAddExcludedModel?: () => void;
  onCreateAlias?: () => void;
  onForkAlias?: () => void;
  onStartCallbackPolling?: () => void;
  onRefreshStatus?: () => void;
  onImportVertexPolicy?: () => void;
}
```

Wire the existing action buttons to these callbacks.

- [ ] **Step 6: Run verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-oauth-policy.service.spec.ts apps/frontend/agent-gateway/test/agent-gateway-provider-auth-pages.test.tsx
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit --pretty false
pnpm --dir apps/frontend/agent-gateway typecheck
```

Expected: PASS.

---

## Task 6: Quota `/api-call` Management Proxy and Provider Parsers

**Files:**

- Create: `apps/backend/agent-server/src/domains/agent-gateway/quotas/agent-gateway-api-call.service.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/quotas/agent-gateway-quota-detail.service.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/management/cli-proxy-management-client.ts`
- Modify: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway.controller.ts`
- Modify: `apps/frontend/agent-gateway/src/api/agent-gateway-api.ts`
- Create: `apps/frontend/agent-gateway/src/app/pages/QuotaDetailPage.tsx`
- Test: `apps/backend/agent-server/test/agent-gateway/agent-gateway-api-call.service.spec.ts`
- Test: `apps/frontend/agent-gateway/test/agent-gateway-quota-detail-page.test.tsx`

- [ ] **Step 1: Write failing API call service test**

Create `apps/backend/agent-server/test/agent-gateway/agent-gateway-api-call.service.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AgentGatewayApiCallService } from '../../src/domains/agent-gateway/quotas/agent-gateway-api-call.service';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';

describe('AgentGatewayApiCallService', () => {
  it('normalizes provider quota payloads through the management api-call boundary', async () => {
    const service = new AgentGatewayApiCallService(new MemoryAgentGatewayManagementClient());

    await expect(
      service.call({
        providerKind: 'claude',
        method: 'GET',
        path: '/v1/organizations/usage',
        headers: {},
        body: null
      })
    ).resolves.toMatchObject({ ok: true });

    await expect(service.refreshQuotaDetails('claude')).resolves.toMatchObject({
      items: [{ providerId: 'claude', status: 'warning' }]
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-api-call.service.spec.ts
```

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement API call facade**

Create `apps/backend/agent-server/src/domains/agent-gateway/quotas/agent-gateway-api-call.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';
import type {
  GatewayManagementApiCallRequest,
  GatewayManagementApiCallResponse,
  GatewayProviderKind,
  GatewayQuotaDetailListResponse
} from '@agent/core';
import type { AgentGatewayManagementClient } from '../management/agent-gateway-management-client';
import { AGENT_GATEWAY_MANAGEMENT_CLIENT } from '../management/agent-gateway-management-client';

@Injectable()
export class AgentGatewayApiCallService {
  constructor(
    @Inject(AGENT_GATEWAY_MANAGEMENT_CLIENT) private readonly managementClient: AgentGatewayManagementClient
  ) {}

  call(request: GatewayManagementApiCallRequest): Promise<GatewayManagementApiCallResponse> {
    return this.managementClient.managementApiCall(request);
  }

  refreshQuotaDetails(providerKind: GatewayProviderKind): Promise<GatewayQuotaDetailListResponse> {
    return this.managementClient.refreshQuotaDetails(providerKind);
  }
}
```

- [ ] **Step 4: Implement provider parser boundary**

In `CliProxyManagementClient`, implement:

```ts
POST / api - call;
```

Then parse provider-specific payloads into `GatewayQuotaDetailListResponseSchema` for:

```ts
claude;
codex;
gemini;
antigravity;
kimi;
```

When a provider response has no numeric token limit, emit:

```ts
{
  limit: 0,
  used: 0,
  remaining: 0,
  status: 'normal'
}
```

and preserve provider summary fields inside `rawSummary`.

- [ ] **Step 5: Implement frontend quota detail page**

Create `apps/frontend/agent-gateway/src/app/pages/QuotaDetailPage.tsx`:

```tsx
import type { GatewayQuotaDetailListResponse } from '@agent/core';

interface QuotaDetailPageProps {
  details: GatewayQuotaDetailListResponse;
  onRefreshProvider?: (providerId: string) => void;
}

export function QuotaDetailPage({ details, onRefreshProvider }: QuotaDetailPageProps) {
  return (
    <section className="page-stack" aria-label="Quota Detail">
      <div className="section-heading">
        <h2>Quota Detail</h2>
        <p>Provider-specific quota projection normalized from management api-call.</p>
      </div>
      {details.items.map(item => (
        <article className="detail-panel" key={item.id}>
          <h3>{item.providerId}</h3>
          <p>
            {item.model} · {item.scope} · {item.status}
          </p>
          <p>
            {item.used} / {item.limit}
          </p>
          <button type="button" onClick={() => onRefreshProvider?.(item.providerId)}>
            Refresh provider quota
          </button>
        </article>
      ))}
    </section>
  );
}
```

- [ ] **Step 6: Run verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-api-call.service.spec.ts apps/frontend/agent-gateway/test/agent-gateway-quota-detail-page.test.tsx
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit --pretty false
pnpm --dir apps/frontend/agent-gateway typecheck
```

Expected: PASS.

---

## Task 7: Logs Complete Runtime

**Files:**

- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway-cli-proxy-parity.schemas.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/logs/agent-gateway-log.service.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/management/cli-proxy-management-client.ts`
- Modify: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway.controller.ts`
- Modify: `apps/frontend/agent-gateway/src/api/agent-gateway-api.ts`
- Modify: `apps/frontend/agent-gateway/src/app/pages/LogsManagerPage.tsx`
- Test: `apps/backend/agent-server/test/agent-gateway/agent-gateway-log.service.spec.ts`
- Test: `apps/frontend/agent-gateway/test/agent-gateway-logs-manager-page.test.tsx`

- [ ] **Step 1: Write failing logs service test**

Create `apps/backend/agent-server/test/agent-gateway/agent-gateway-log.service.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AgentGatewayLogService } from '../../src/domains/agent-gateway/logs/agent-gateway-log.service';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';

describe('AgentGatewayLogService', () => {
  it('supports incremental tail, structured filters, by-id download, and error file download', async () => {
    const service = new AgentGatewayLogService(new MemoryAgentGatewayManagementClient());

    await expect(service.tail({ after: '2026-05-08T00:00:00.000Z', limit: 10 })).resolves.toHaveProperty('nextCursor');
    await expect(service.search({ query: 'POST', hideManagementTraffic: true, limit: 10 })).resolves.toMatchObject({
      items: [{ method: 'POST' }]
    });
    await expect(service.downloadRequestLog('log-proxy-1')).resolves.toContain('log-proxy-1');
    await expect(service.downloadRequestErrorFile('request-error-1.log')).resolves.toContain('request-error-1.log');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-log.service.spec.ts
```

Expected: FAIL because download methods and structured filters are not complete.

- [ ] **Step 3: Add service methods**

In `AgentGatewayLogService`, add:

```ts
downloadRequestLog(id: string): Promise<string> {
  return this.managementClient.downloadRequestLog(id);
}

downloadRequestErrorFile(fileName: string): Promise<string> {
  return this.managementClient.downloadRequestErrorFile(fileName);
}
```

- [ ] **Step 4: Map CLI Proxy endpoints**

In `CliProxyManagementClient`, implement:

```ts
GET /logs?after=<cursor>
DELETE /logs
GET /request-error-logs
GET /request-error-logs/:filename
GET /request-log-by-id/:id
```

For structured filters, filter normalized entries by:

```ts
method;
statusCode;
path;
managementTraffic;
query;
```

- [ ] **Step 5: Connect frontend Logs Manager**

Update `LogsManagerPage.tsx` to render:

```tsx
<select name="method">
  <option value="">All methods</option>
  <option value="GET">GET</option>
  <option value="POST">POST</option>
  <option value="PUT">PUT</option>
  <option value="PATCH">PATCH</option>
  <option value="DELETE">DELETE</option>
</select>
<select name="status">
  <option value="">All status</option>
  <option value="2xx">2xx</option>
  <option value="4xx">4xx</option>
  <option value="5xx">5xx</option>
</select>
<button type="button">Download request by id</button>
<button type="button">Download error log file</button>
<button type="button">Raw view</button>
<button type="button">Parsed view</button>
```

- [ ] **Step 6: Run verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-log.service.spec.ts apps/frontend/agent-gateway/test/agent-gateway-logs-manager-page.test.tsx
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit --pretty false
pnpm --dir apps/frontend/agent-gateway typecheck
```

Expected: PASS.

---

## Task 8: System Complete Runtime

**Files:**

- Modify: `apps/backend/agent-server/src/domains/agent-gateway/system/agent-gateway-system.service.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/management/cli-proxy-management-client.ts`
- Modify: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway.controller.ts`
- Modify: `apps/frontend/agent-gateway/src/api/agent-gateway-api.ts`
- Modify: `apps/frontend/agent-gateway/src/app/pages/SystemPage.tsx`
- Test: `apps/backend/agent-server/test/agent-gateway/agent-gateway-system.service.spec.ts`
- Test: `apps/frontend/agent-gateway/test/agent-gateway-system-page.test.tsx`

- [ ] **Step 1: Write failing system service test**

Create `apps/backend/agent-server/test/agent-gateway/agent-gateway-system.service.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AgentGatewaySystemService } from '../../src/domains/agent-gateway/system/agent-gateway-system.service';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';

describe('AgentGatewaySystemService', () => {
  it('checks latest version, toggles request log, and exposes clear-login-storage command projection', async () => {
    const service = new AgentGatewaySystemService(new MemoryAgentGatewayManagementClient());

    await expect(service.latestVersion()).resolves.toMatchObject({ latestVersion: expect.any(String) });
    await expect(service.setRequestLogEnabled(true)).resolves.toMatchObject({ requestLog: true });
    await expect(service.clearLoginStorage()).resolves.toMatchObject({ cleared: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-system.service.spec.ts
```

Expected: FAIL because these methods do not exist.

- [ ] **Step 3: Implement service methods**

In `AgentGatewaySystemService`, add:

```ts
latestVersion() {
  return this.managementClient.latestVersion();
}

setRequestLogEnabled(enabled: boolean) {
  return this.managementClient.setRequestLogEnabled(enabled);
}

clearLoginStorage() {
  return Promise.resolve({ cleared: true, clearedAt: new Date().toISOString() });
}
```

- [ ] **Step 4: Map CLI Proxy endpoints**

In `CliProxyManagementClient`, implement:

```ts
GET / latest - version;
PUT / request - log;
```

The `clearLoginStorage` action is frontend-local and must not delete browser data from backend code.

- [ ] **Step 5: Connect frontend System page**

In `SystemPage.tsx`, add buttons:

```tsx
<button type="button">Check latest version</button>
<button type="button">Enable request log</button>
<button type="button">Clear local login storage</button>
```

Wire `Clear local login storage` to the frontend auth storage helper only; do not touch Chrome profile directories.

- [ ] **Step 6: Run verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-system.service.spec.ts apps/frontend/agent-gateway/test/agent-gateway-system-page.test.tsx
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit --pretty false
pnpm --dir apps/frontend/agent-gateway typecheck
```

Expected: PASS.

---

## Task 9: UI Mutation Flow Completion

**Files:**

- Modify: `apps/frontend/agent-gateway/src/app/App.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/GatewayWorkspace.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/pages/ConfigEditorPage.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/pages/ApiKeysPage.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/pages/ProviderConfigPage.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/pages/AuthFilesManagerPage.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/pages/OAuthPolicyPage.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/pages/LogsManagerPage.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/components/ConfirmDialog.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/components/NotificationCenter.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/hooks/useUnsavedChangesGuard.ts`
- Test: `apps/frontend/agent-gateway/test/agent-gateway-workflow-controls.test.tsx`

- [ ] **Step 1: Write failing workflow test**

Create `apps/frontend/agent-gateway/test/agent-gateway-workflow-controls.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConfigEditorPage } from '../src/app/pages/ConfigEditorPage';
import { LogsManagerPage } from '../src/app/pages/LogsManagerPage';

describe('Agent Gateway workflow controls', () => {
  it('renders save state, confirmation, notification, and unsaved guard affordances on mutable pages', () => {
    const configHtml = renderToStaticMarkup(
      <ConfigEditorPage content="debug: true\n" version="config-1" dirty saving lastMessage="保存中" />
    );
    expect(configHtml).toContain('未保存');
    expect(configHtml).toContain('保存中');

    const logsHtml = renderToStaticMarkup(
      <LogsManagerPage confirmClearLabel="确认清空日志" lastMessage="日志已清空" />
    );
    expect(logsHtml).toContain('确认清空日志');
    expect(logsHtml).toContain('日志已清空');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-gateway/test/agent-gateway-workflow-controls.test.tsx
```

Expected: FAIL because pages do not accept these props.

- [ ] **Step 3: Add shared mutation state shape**

In `GatewayWorkspace.tsx`, define:

```ts
interface GatewayMutationState {
  saving: boolean;
  dirty: boolean;
  lastMessage: string | null;
  lastError: string | null;
}
```

Pass this shape to mutable pages.

- [ ] **Step 4: Wire Config editor**

Update `ConfigEditorPage` props:

```tsx
interface ConfigEditorPageProps {
  content?: string;
  version?: string;
  dirty?: boolean;
  saving?: boolean;
  lastMessage?: string | null;
  onDiff?: () => void;
  onSave?: () => void;
  onReload?: () => void;
}
```

Render:

```tsx
{
  dirty ? <span className="status-pill">未保存</span> : null;
}
{
  saving ? <span className="status-pill">保存中</span> : null;
}
{
  lastMessage ? <p>{lastMessage}</p> : null;
}
```

- [ ] **Step 5: Wire destructive confirmations**

For delete/clear actions in API Keys, Auth Files, Provider Config, OAuth Policy, and Logs Manager, call:

```ts
openConfirm({
  title: '确认操作',
  message: '该操作会修改 CLI Proxy 管理配置。',
  confirmLabel: '确认',
  cancelLabel: '取消',
  onConfirm: action
});
```

- [ ] **Step 6: Run verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-gateway/test/agent-gateway-workflow-controls.test.tsx apps/frontend/agent-gateway/test/agent-gateway-workspace.test.tsx
pnpm --dir apps/frontend/agent-gateway typecheck
```

Expected: PASS.

---

## Task 10: Documentation and Final Verification

**Files:**

- Modify: `docs/contracts/api/agent-gateway.md`
- Modify: `docs/apps/frontend/agent-gateway/README.md`
- Modify: `docs/apps/backend/agent-server/agent-gateway.md`
- Modify: `docs/apps/frontend/agent-gateway/cli-proxy-parity.md`
- Modify: `docs/superpowers/plans/2026-05-09-agent-gateway-cli-proxy-remaining-parity.md`

- [ ] **Step 1: Scan docs for stale parity wording**

Run:

```bash
rg -n "planned|尚未|memory client|CliProxyManagementClient|api-call|auth-files|oauth|request-log|Dashboard|log-files" docs/contracts/api/agent-gateway.md docs/apps/frontend/agent-gateway docs/apps/backend/agent-server/agent-gateway.md docs/superpowers/plans/2026-05-09-agent-gateway-cli-proxy-remaining-parity.md
```

Expected: Output shows each current/planned statement that must be reclassified.

- [ ] **Step 2: Update API contract status table**

In `docs/contracts/api/agent-gateway.md`, mark these as `current` after their tasks pass:

```markdown
| Dashboard | `GET /api/agent-gateway/dashboard` | `GET /agent-gateway/dashboard` | `current` |
| Provider-specific config | `GET /api/agent-gateway/provider-configs` | `GET /agent-gateway/provider-configs` | `current` |
| Auth Files management | `GET /api/agent-gateway/auth-files` | `GET /agent-gateway/auth-files` | `current` |
| OAuth policy | `GET /api/agent-gateway/oauth/model-aliases/:providerId` | `GET /agent-gateway/oauth/model-aliases/:providerId` | `current` |
| Quota api-call | `POST /api/agent-gateway/api-call` | `POST /agent-gateway/api-call` | `current` |
```

- [ ] **Step 3: Update module docs**

In `docs/apps/backend/agent-server/agent-gateway.md`, add a short section:

```markdown
## Real CLI Proxy Mode

Set `AGENT_GATEWAY_MANAGEMENT_MODE=cli-proxy`, `AGENT_GATEWAY_MANAGEMENT_API_BASE=<base-url>`, and `AGENT_GATEWAY_MANAGEMENT_KEY=<key>` to use `CliProxyManagementClient`. The adapter normalizes `/v0/management` responses into `@agent/core` schemas before controller responses are emitted.
```

In `docs/apps/frontend/agent-gateway/README.md`, add:

```markdown
The workspace now includes Dashboard, Connection, Config, API Keys, Provider Config, Auth Files Manager, OAuth Policy, Quota Detail, Logs, Pipeline, Providers, Credential Files, and System views. Mutating flows use confirmation, notification, and unsaved-change affordances.
```

- [ ] **Step 4: Run full affected verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway apps/backend/agent-server/test/agent-gateway apps/frontend/agent-gateway/test
pnpm exec tsc -p packages/core/tsconfig.json --noEmit --pretty false
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit --pretty false
pnpm --dir apps/frontend/agent-gateway typecheck
pnpm --dir apps/frontend/agent-gateway build
pnpm check:docs
```

Expected: All commands PASS.

## Execution Order

1. Task 1: Configure real CLI Proxy management client selection.
2. Task 2: Dashboard parity.
3. Task 3: Provider-specific backend and UI actions.
4. Task 4: Auth Files backend governance.
5. Task 5: OAuth policy, polling, callback, Gemini project, and Vertex import.
6. Task 6: Quota `/api-call` management proxy and provider parsers.
7. Task 7: Logs complete runtime.
8. Task 8: System complete runtime.
9. Task 9: UI mutation flow completion.
10. Task 10: Documentation and final verification.

## Completion Definition

Agent Gateway reaches remaining CLI Proxy Management Web UI parity when:

- `AgentGatewayModule` can select `CliProxyManagementClient` through explicit environment configuration.
- Dashboard shows connection, API Base, version, API key count, auth file count, provider key count, available model count, and routing summary.
- Provider-specific Gemini, Codex, Claude, Vertex, OpenAI-compatible, and Ampcode config flows are available through stable backend services and frontend actions.
- Auth Files support batch upload, download, delete, status toggle, field patch, model listing, filtering, searching, sorting, and pagination.
- OAuth policy supports excluded models, aliases with `fork`, callback/status polling, Gemini CLI `project_id`, callback URL submission, and Vertex credential import.
- Quota details are refreshed through the stable management `api-call` boundary and normalized provider parsers.
- Logs support request-id download, request error file download, raw/parsed switching, after-cursor polling, and structured filters.
- System supports latest-version checks, request-log setting, and frontend-local login storage cleanup.
- Mutable UI flows use confirmation, notification, error, loading, and unsaved-change states.
- Docs match implementation status, stale parity wording is removed, and affected tests/typechecks/build/docs checks pass.
