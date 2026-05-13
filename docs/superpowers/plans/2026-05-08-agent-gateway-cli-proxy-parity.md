# Agent Gateway CLI Proxy Parity Implementation Plan

状态：draft
文档类型：plan
适用范围：`apps/frontend/agent-gateway`、`apps/backend/agent-server/src/domains/agent-gateway`、`apps/backend/agent-server/src/api/agent-gateway`、`packages/core/src/contracts/agent-gateway`、`docs/contracts/api/agent-gateway.md`
最后核对：2026-05-08

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `apps/frontend/agent-gateway` and the `agent-server` Agent Gateway domain to functional parity with the management capabilities in `/Users/dev/Desktop/Cli-Proxy-API-Management-Center`, while keeping this repository's schema-first, adapter-bounded architecture.

**Architecture:** Keep the reference project as an external Web UI compatibility source, not as code to copy. Stable API contracts live in `packages/core/src/contracts/agent-gateway`; `agent-server` owns adapters, repositories, secret boundaries, and management orchestration; `apps/frontend/agent-gateway` consumes only `@agent/core` schemas through `AgentGatewayApiClient`. Provider-specific and CLI Proxy raw payload shapes must be normalized inside backend adapters or frontend-local compatibility helpers before reaching UI components.

**Tech Stack:** TypeScript, zod, NestJS, React 19, Vite, Vitest, `@agent/core`, existing pnpm workspace scripts, `fs-extra` for filesystem operations when persistence requires file access.

---

## Scope Check

This plan covers parity with the reference Web UI management surface, not production LLM traffic forwarding. The reference project states it is a Web UI for CLI Proxy API Management API and does not itself forward proxy traffic, so this plan focuses on management API connection, config, API keys, provider settings, auth files, OAuth policy, quotas, logs, system information, and mature UI workflows.

The plan is intentionally split into independently testable vertical slices. Each task should land with tests and docs before the next task depends on it.

## Current Baseline

Already available in this repository:

- `packages/core/src/contracts/agent-gateway`: schema-first contracts for login, snapshot, config patch, provider/credential/quota writes, relay smoke, usage/logs, and deterministic OAuth start/complete.
- `apps/backend/agent-server/src/domains/agent-gateway`: in-memory repository, secret vault, provider router, deterministic mock provider, relay service, OAuth service.
- `apps/frontend/agent-gateway`: login, workspace tabs, provider/credential/quota/logs/pipeline views, API client methods, minimal write and OAuth action entry points.
- Docs:
  - `docs/contracts/api/agent-gateway.md`
  - `docs/apps/frontend/agent-gateway/README.md`
  - `docs/apps/backend/agent-server/agent-gateway.md`

Major gaps versus `/Users/dev/Desktop/Cli-Proxy-API-Management-Center`:

- Remote management API connection model.
- Raw `/config.yaml` editing, reload, diff, and section-level config controls.
- Proxy `api-keys` management and usage.
- Provider-specific config pages for Gemini, Codex, Claude, Vertex, OpenAI-compatible, and Ampcode.
- Auth file batch upload/download/delete, filtering, pagination, field patching, model listing.
- OAuth status polling, callback submission, excluded models, and model alias mappings.
- Provider-specific quota payloads and refresh behavior.
- Log tail, polling, search, hide management traffic, clear, and request log downloads.
- System page with version, latest version, quick links, and `/v1/models` grouping.
- Mature UI workflow affordances: route structure, confirmation modal, notification center, unsaved-changes guard, loading/error/success states.

## File Structure

### Contracts

- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.schemas.ts`
  - Add stable schemas for remote connection profiles, raw config, API keys, provider-specific records, auth file batch results, OAuth policy, quota details, log files, and system models.
- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.types.ts`
  - Export inferred types for every new schema.
- Test: `packages/core/test/agent-gateway/agent-gateway-cli-proxy-parity.schemas.test.ts`
  - Parse representative payloads from each parity surface.

### Backend

- Create: `apps/backend/agent-server/src/domains/agent-gateway/management/agent-gateway-management-client.ts`
  - Defines the project-owned management client interface.
- Create: `apps/backend/agent-server/src/domains/agent-gateway/management/memory-agent-gateway-management-client.ts`
  - Deterministic local implementation for tests.
- Create: `apps/backend/agent-server/src/domains/agent-gateway/management/cli-proxy-management-client.ts`
  - Adapter for external CLI Proxy Management API.
- Create: `apps/backend/agent-server/src/domains/agent-gateway/config/agent-gateway-config-file.service.ts`
  - Handles raw config read/write/reload/diff boundaries.
- Create: `apps/backend/agent-server/src/domains/agent-gateway/providers/agent-gateway-provider-normalizers.ts`
  - Converts provider-specific raw shapes into stable contracts.
- Create: `apps/backend/agent-server/src/domains/agent-gateway/logs/agent-gateway-log.service.ts`
  - Handles log tail/search/clear/file listing/download projections.
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/agent-gateway.module.ts`
  - Wire new services and management client providers.
- Modify: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway.controller.ts`
  - Add HTTP endpoints for each completed parity slice.
- Test: `apps/backend/agent-server/test/agent-gateway/*.spec.ts`

### Frontend

- Modify: `apps/frontend/agent-gateway/src/api/agent-gateway-api.ts`
  - Add API methods for parity surfaces.
- Create: `apps/frontend/agent-gateway/src/app/pages/ConnectionPage.tsx`
- Create: `apps/frontend/agent-gateway/src/app/pages/ConfigEditorPage.tsx`
- Create: `apps/frontend/agent-gateway/src/app/pages/ApiKeysPage.tsx`
- Create: `apps/frontend/agent-gateway/src/app/pages/ProviderConfigPage.tsx`
- Create: `apps/frontend/agent-gateway/src/app/pages/AuthFilesManagerPage.tsx`
- Create: `apps/frontend/agent-gateway/src/app/pages/OAuthPolicyPage.tsx`
- Create: `apps/frontend/agent-gateway/src/app/pages/QuotaDetailPage.tsx`
- Create: `apps/frontend/agent-gateway/src/app/pages/LogsManagerPage.tsx`
- Create: `apps/frontend/agent-gateway/src/app/pages/SystemPage.tsx`
- Create: `apps/frontend/agent-gateway/src/app/components/ConfirmDialog.tsx`
- Create: `apps/frontend/agent-gateway/src/app/components/NotificationCenter.tsx`
- Create: `apps/frontend/agent-gateway/src/app/hooks/useUnsavedChangesGuard.ts`
- Modify: `apps/frontend/agent-gateway/src/app/GatewayWorkspace.tsx`
  - Add navigation targets and route-like view state.
- Modify: `apps/frontend/agent-gateway/src/app/App.scss`
  - Extend dense operational UI styles for editors, tables, modals, and status bars.
- Test: `apps/frontend/agent-gateway/test/*.test.tsx`

### Docs

- Modify: `docs/contracts/api/agent-gateway.md`
- Modify: `docs/apps/frontend/agent-gateway/README.md`
- Modify: `docs/apps/backend/agent-server/agent-gateway.md`
- Create: `docs/apps/frontend/agent-gateway/cli-proxy-parity.md`

---

## Task 1: Remote Management Connection Contract

**Files:**

- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.schemas.ts`
- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.types.ts`
- Create: `packages/core/test/agent-gateway/agent-gateway-cli-proxy-parity.schemas.test.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/management/agent-gateway-management-client.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/management/memory-agent-gateway-management-client.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/agent-gateway.module.ts`
- Test: `apps/backend/agent-server/test/agent-gateway/agent-gateway-management-client.spec.ts`

- [ ] **Step 1: Write failing core contract test**

Create `packages/core/test/agent-gateway/agent-gateway-cli-proxy-parity.schemas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  GatewayConnectionProfileSchema,
  GatewayConnectionStatusResponseSchema,
  GatewaySaveConnectionProfileRequestSchema
} from '../../src/contracts/agent-gateway';

describe('agent gateway CLI Proxy parity contracts', () => {
  it('parses remote management connection contracts', () => {
    expect(
      GatewaySaveConnectionProfileRequestSchema.parse({
        apiBase: 'https://remote.router-for.me/v0/management',
        managementKey: 'mgmt-secret',
        timeoutMs: 15000
      })
    ).toEqual({
      apiBase: 'https://remote.router-for.me/v0/management',
      managementKey: 'mgmt-secret',
      timeoutMs: 15000
    });

    expect(
      GatewayConnectionProfileSchema.parse({
        apiBase: 'https://remote.router-for.me/v0/management',
        managementKeyMasked: 'mgm***ret',
        timeoutMs: 15000,
        updatedAt: '2026-05-08T00:00:00.000Z'
      })
    ).toMatchObject({ managementKeyMasked: 'mgm***ret' });

    expect(
      GatewayConnectionStatusResponseSchema.parse({
        status: 'connected',
        checkedAt: '2026-05-08T00:00:01.000Z',
        serverVersion: '1.2.3',
        serverBuildDate: '2026-05-01'
      })
    ).toMatchObject({ status: 'connected' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway/agent-gateway-cli-proxy-parity.schemas.test.ts
```

Expected: FAIL because connection schemas are not exported.

- [ ] **Step 3: Add connection schemas**

Add to `packages/core/src/contracts/agent-gateway/agent-gateway.schemas.ts`:

```ts
export const GatewayConnectionStatusSchema = z.enum(['connected', 'disconnected', 'checking', 'error']);

export const GatewaySaveConnectionProfileRequestSchema = z.object({
  apiBase: z.string().url(),
  managementKey: z.string().min(1),
  timeoutMs: z.number().int().positive().max(120000).default(15000)
});

export const GatewayConnectionProfileSchema = z.object({
  apiBase: z.string().url(),
  managementKeyMasked: z.string(),
  timeoutMs: z.number().int().positive(),
  updatedAt: z.string()
});

export const GatewayConnectionStatusResponseSchema = z.object({
  status: GatewayConnectionStatusSchema,
  checkedAt: z.string(),
  serverVersion: z.string().nullable(),
  serverBuildDate: z.string().nullable(),
  error: z.string().optional()
});
```

- [ ] **Step 4: Export connection types**

Add imports and exports to `packages/core/src/contracts/agent-gateway/agent-gateway.types.ts`:

```ts
export type GatewayConnectionStatus = z.infer<typeof GatewayConnectionStatusSchema>;
export type GatewaySaveConnectionProfileRequest = z.infer<typeof GatewaySaveConnectionProfileRequestSchema>;
export type GatewayConnectionProfile = z.infer<typeof GatewayConnectionProfileSchema>;
export type GatewayConnectionStatusResponse = z.infer<typeof GatewayConnectionStatusResponseSchema>;
```

- [ ] **Step 5: Add backend management client contract**

Create `apps/backend/agent-server/src/domains/agent-gateway/management/agent-gateway-management-client.ts`:

```ts
import type { GatewayConnectionStatusResponse, GatewaySaveConnectionProfileRequest } from '@agent/core';

export const AGENT_GATEWAY_MANAGEMENT_CLIENT = Symbol('AGENT_GATEWAY_MANAGEMENT_CLIENT');

export interface AgentGatewayManagementClient {
  saveProfile(request: GatewaySaveConnectionProfileRequest): Promise<void>;
  checkConnection(): Promise<GatewayConnectionStatusResponse>;
}
```

- [ ] **Step 6: Add deterministic memory management client**

Create `apps/backend/agent-server/src/domains/agent-gateway/management/memory-agent-gateway-management-client.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { GatewayConnectionStatusResponse, GatewaySaveConnectionProfileRequest } from '@agent/core';
import type { AgentGatewayManagementClient } from './agent-gateway-management-client';

@Injectable()
export class MemoryAgentGatewayManagementClient implements AgentGatewayManagementClient {
  private profile: GatewaySaveConnectionProfileRequest | null = null;

  async saveProfile(request: GatewaySaveConnectionProfileRequest): Promise<void> {
    this.profile = { ...request };
  }

  async checkConnection(): Promise<GatewayConnectionStatusResponse> {
    return {
      status: this.profile ? 'connected' : 'disconnected',
      checkedAt: '2026-05-08T00:00:00.000Z',
      serverVersion: this.profile ? 'memory-cli-proxy' : null,
      serverBuildDate: this.profile ? '2026-05-08' : null
    };
  }
}
```

- [ ] **Step 7: Add backend test**

Create `apps/backend/agent-server/test/agent-gateway/agent-gateway-management-client.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';

describe('MemoryAgentGatewayManagementClient', () => {
  it('reports disconnected before a profile and connected after save', async () => {
    const client = new MemoryAgentGatewayManagementClient();

    await expect(client.checkConnection()).resolves.toMatchObject({ status: 'disconnected' });

    await client.saveProfile({
      apiBase: 'https://remote.router-for.me/v0/management',
      managementKey: 'secret',
      timeoutMs: 15000
    });

    await expect(client.checkConnection()).resolves.toMatchObject({
      status: 'connected',
      serverVersion: 'memory-cli-proxy'
    });
  });
});
```

- [ ] **Step 8: Wire provider in module**

Modify `apps/backend/agent-server/src/domains/agent-gateway/agent-gateway.module.ts`:

```ts
{
  provide: AGENT_GATEWAY_MANAGEMENT_CLIENT,
  useClass: MemoryAgentGatewayManagementClient
}
```

- [ ] **Step 9: Run verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway/agent-gateway-cli-proxy-parity.schemas.test.ts apps/backend/agent-server/test/agent-gateway/agent-gateway-management-client.spec.ts
pnpm exec tsc -p packages/core/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: PASS.

---

## Task 2: Connection UI and API Client

**Files:**

- Modify: `apps/frontend/agent-gateway/src/api/agent-gateway-api.ts`
- Create: `apps/frontend/agent-gateway/src/app/pages/ConnectionPage.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/gateway-view-model.ts`
- Modify: `apps/frontend/agent-gateway/src/app/GatewayWorkspace.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/App.scss`
- Test: `apps/frontend/agent-gateway/test/agent-gateway-api.test.ts`
- Test: `apps/frontend/agent-gateway/test/agent-gateway-workspace.test.tsx`

- [ ] **Step 1: Add failing API client test**

Append to `apps/frontend/agent-gateway/test/agent-gateway-api.test.ts`:

```ts
it('calls connection profile endpoints', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        apiBase: 'https://remote.router-for.me/v0/management',
        managementKeyMasked: 'sec***ret',
        timeoutMs: 15000,
        updatedAt: '2026-05-08T00:00:00.000Z'
      })
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'connected',
        checkedAt: '2026-05-08T00:00:01.000Z',
        serverVersion: 'memory-cli-proxy',
        serverBuildDate: '2026-05-08'
      })
    });
  vi.stubGlobal('fetch', fetchMock);
  const client = new AgentGatewayApiClient({
    getAccessToken: () => 'access',
    refreshAccessToken: async () => 'fresh'
  });

  await expect(
    client.saveConnectionProfile({
      apiBase: 'https://remote.router-for.me/v0/management',
      managementKey: 'secret',
      timeoutMs: 15000
    })
  ).resolves.toMatchObject({ managementKeyMasked: 'sec***ret' });
  await expect(client.checkConnection()).resolves.toMatchObject({ status: 'connected' });

  expect(fetchMock.mock.calls.map(call => [call[0], (call[1] as RequestInit).method])).toEqual([
    ['/agent-gateway/connection/profile', 'PUT'],
    ['/agent-gateway/connection/check', 'POST']
  ]);
});
```

- [ ] **Step 2: Run API test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-gateway/test/agent-gateway-api.test.ts
```

Expected: FAIL because `saveConnectionProfile` and `checkConnection` do not exist.

- [ ] **Step 3: Add client methods**

Modify `apps/frontend/agent-gateway/src/api/agent-gateway-api.ts`:

```ts
saveConnectionProfile(request: GatewaySaveConnectionProfileRequest): Promise<GatewayConnectionProfile> {
  return this.put('/agent-gateway/connection/profile', request, GatewayConnectionProfileSchema);
}

checkConnection(): Promise<GatewayConnectionStatusResponse> {
  return this.post('/agent-gateway/connection/check', {}, GatewayConnectionStatusResponseSchema);
}
```

- [ ] **Step 4: Add failing workspace render test**

Append to `apps/frontend/agent-gateway/test/agent-gateway-workspace.test.tsx`:

```ts
it('renders connection management view', () => {
  const html = renderToStaticMarkup(
    <GatewayWorkspace
      activeView="connection"
      onActiveViewChange={() => undefined}
      onLogout={() => undefined}
      snapshot={snapshot}
      logs={{ items: [] }}
      usage={{ items: [] }}
    />
  );

  expect(html).toContain('Management API');
  expect(html).toContain('保存连接');
  expect(html).toContain('测试连接');
});
```

- [ ] **Step 5: Add connection view id**

Modify `apps/frontend/agent-gateway/src/app/gateway-view-model.ts`:

```ts
export const GATEWAY_VIEWS = [
  { id: 'overview', label: '总览' },
  { id: 'connection', label: '连接' },
  { id: 'providers', label: '上游方' },
  { id: 'credentials', label: '认证文件' },
  { id: 'quotas', label: '配额' },
  { id: 'pipeline', label: '调用管线' },
  { id: 'logs', label: '日志与探测' }
] as const;
```

- [ ] **Step 6: Create connection page**

Create `apps/frontend/agent-gateway/src/app/pages/ConnectionPage.tsx`:

```tsx
export function ConnectionPage() {
  return (
    <section className="page-stack" aria-label="Management API">
      <div className="section-heading">
        <h2>Management API</h2>
        <p>连接远端 CLI Proxy API Management API，management key 只通过写命令提交。</p>
      </div>
      <form className="command-panel">
        <label>
          API Base
          <input name="apiBase" defaultValue="https://remote.router-for.me/v0/management" />
        </label>
        <label>
          Management Key
          <input name="managementKey" type="password" />
        </label>
        <label>
          Timeout
          <input name="timeoutMs" type="number" defaultValue={15000} />
        </label>
        <div className="command-actions">
          <button type="submit">保存连接</button>
          <button type="button">测试连接</button>
        </div>
      </form>
    </section>
  );
}
```

- [ ] **Step 7: Wire workspace view**

Modify `apps/frontend/agent-gateway/src/app/GatewayWorkspace.tsx`:

```tsx
import { ConnectionPage } from './pages/ConnectionPage';

if (activeView === 'connection') {
  return <ConnectionPage />;
}
```

- [ ] **Step 8: Run frontend verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-gateway/test/agent-gateway-api.test.ts apps/frontend/agent-gateway/test/agent-gateway-workspace.test.tsx
pnpm --dir apps/frontend/agent-gateway typecheck
```

Expected: PASS.

---

## Task 3: Raw Config and Visual Config Editor

**Files:**

- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.schemas.ts`
- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.types.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/config/agent-gateway-config-file.service.ts`
- Modify: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway.controller.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/agent-gateway.module.ts`
- Modify: `apps/frontend/agent-gateway/src/api/agent-gateway-api.ts`
- Create: `apps/frontend/agent-gateway/src/app/pages/ConfigEditorPage.tsx`
- Test: `packages/core/test/agent-gateway/agent-gateway-cli-proxy-parity.schemas.test.ts`
- Test: `apps/backend/agent-server/test/agent-gateway/agent-gateway-config-file.service.spec.ts`
- Test: `apps/frontend/agent-gateway/test/agent-gateway-config-editor.test.tsx`

- [ ] **Step 1: Add failing config schema test**

Append to `packages/core/test/agent-gateway/agent-gateway-cli-proxy-parity.schemas.test.ts`:

```ts
it('parses raw config file contracts', () => {
  expect(
    GatewayRawConfigResponseSchema.parse({
      content: 'debug: true\nrequest-retry: 2\n',
      format: 'yaml',
      version: 'config-1'
    })
  ).toMatchObject({ format: 'yaml' });

  expect(
    GatewaySaveRawConfigRequestSchema.parse({
      content: 'debug: false\nrequest-retry: 3\n',
      expectedVersion: 'config-1'
    })
  ).toMatchObject({ expectedVersion: 'config-1' });

  expect(
    GatewayConfigDiffResponseSchema.parse({
      changed: true,
      before: 'debug: true\n',
      after: 'debug: false\n'
    })
  ).toMatchObject({ changed: true });
});
```

- [ ] **Step 2: Add config schemas**

Add:

```ts
export const GatewayRawConfigResponseSchema = z.object({
  content: z.string(),
  format: z.literal('yaml'),
  version: z.string()
});

export const GatewaySaveRawConfigRequestSchema = z.object({
  content: z.string(),
  expectedVersion: z.string().optional()
});

export const GatewayConfigDiffResponseSchema = z.object({
  changed: z.boolean(),
  before: z.string(),
  after: z.string()
});

export const GatewayReloadConfigResponseSchema = z.object({
  reloaded: z.boolean(),
  reloadedAt: z.string()
});
```

- [ ] **Step 3: Add config service test**

Create `apps/backend/agent-server/test/agent-gateway/agent-gateway-config-file.service.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AgentGatewayConfigFileService } from '../../src/domains/agent-gateway/config/agent-gateway-config-file.service';

describe('AgentGatewayConfigFileService', () => {
  it('reads, diffs, saves, and reloads raw yaml config deterministically', async () => {
    const service = new AgentGatewayConfigFileService('debug: true\n');

    await expect(service.readRawConfig()).resolves.toMatchObject({ content: 'debug: true\n', format: 'yaml' });
    await expect(service.diffRawConfig({ content: 'debug: false\n' })).resolves.toMatchObject({ changed: true });
    await expect(service.saveRawConfig({ content: 'debug: false\n' })).resolves.toMatchObject({
      content: 'debug: false\n'
    });
    await expect(service.reloadConfig()).resolves.toMatchObject({ reloaded: true });
  });
});
```

- [ ] **Step 4: Implement config service**

Create `apps/backend/agent-server/src/domains/agent-gateway/config/agent-gateway-config-file.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type {
  GatewayConfigDiffResponse,
  GatewayRawConfigResponse,
  GatewayReloadConfigResponse,
  GatewaySaveRawConfigRequest
} from '@agent/core';

@Injectable()
export class AgentGatewayConfigFileService {
  private content: string;
  private version = 1;

  constructor(initialContent = 'debug: true\nrequest-retry: 2\n') {
    this.content = initialContent;
  }

  async readRawConfig(): Promise<GatewayRawConfigResponse> {
    return { content: this.content, format: 'yaml', version: `config-${this.version}` };
  }

  async diffRawConfig(request: GatewaySaveRawConfigRequest): Promise<GatewayConfigDiffResponse> {
    return { changed: request.content !== this.content, before: this.content, after: request.content };
  }

  async saveRawConfig(request: GatewaySaveRawConfigRequest): Promise<GatewayRawConfigResponse> {
    this.content = request.content;
    this.version += 1;
    return this.readRawConfig();
  }

  async reloadConfig(): Promise<GatewayReloadConfigResponse> {
    return { reloaded: true, reloadedAt: new Date().toISOString() };
  }
}
```

- [ ] **Step 5: Add backend endpoints**

Add to `AgentGatewayController`:

```ts
@Get('config/raw')
rawConfig(): Promise<GatewayRawConfigResponse> {
  return this.configFileService.readRawConfig();
}

@Post('config/raw/diff')
diffRawConfig(@Body() body: unknown): Promise<GatewayConfigDiffResponse> {
  const parsed = GatewaySaveRawConfigRequestSchema.safeParse(body);
  if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'raw config 参数无效' });
  return this.configFileService.diffRawConfig(parsed.data);
}

@Put('config/raw')
saveRawConfig(@Body() body: unknown): Promise<GatewayRawConfigResponse> {
  const parsed = GatewaySaveRawConfigRequestSchema.safeParse(body);
  if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'raw config 参数无效' });
  return this.configFileService.saveRawConfig(parsed.data);
}

@Post('config/reload')
reloadConfig(): Promise<GatewayReloadConfigResponse> {
  return this.configFileService.reloadConfig();
}
```

- [ ] **Step 6: Add frontend page test**

Create `apps/frontend/agent-gateway/test/agent-gateway-config-editor.test.tsx`:

```ts
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConfigEditorPage } from '../src/app/pages/ConfigEditorPage';

describe('ConfigEditorPage', () => {
  it('renders raw yaml editor controls', () => {
    const html = renderToStaticMarkup(
      <ConfigEditorPage content={'debug: true\n'} version="config-1" />
    );

    expect(html).toContain('config.yaml');
    expect(html).toContain('保存配置');
    expect(html).toContain('查看差异');
    expect(html).toContain('重新加载');
  });
});
```

- [ ] **Step 7: Create config editor page**

Create `apps/frontend/agent-gateway/src/app/pages/ConfigEditorPage.tsx`:

```tsx
interface ConfigEditorPageProps {
  content?: string;
  version?: string;
}

export function ConfigEditorPage({ content = '', version = 'unknown' }: ConfigEditorPageProps) {
  return (
    <section className="page-stack" aria-label="config.yaml">
      <div className="section-heading">
        <h2>config.yaml</h2>
        <p>编辑 CLI Proxy API 原始 YAML 配置，保存前可查看差异。</p>
      </div>
      <div className="editor-toolbar">
        <span>Version: {version}</span>
        <button type="button">查看差异</button>
        <button type="button">保存配置</button>
        <button type="button">重新加载</button>
      </div>
      <textarea className="raw-config-editor" defaultValue={content} spellCheck={false} />
    </section>
  );
}
```

- [ ] **Step 8: Run verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway/agent-gateway-cli-proxy-parity.schemas.test.ts apps/backend/agent-server/test/agent-gateway/agent-gateway-config-file.service.spec.ts apps/frontend/agent-gateway/test/agent-gateway-config-editor.test.tsx
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/frontend/agent-gateway typecheck
```

Expected: PASS.

---

## Task 4: API Keys Management

**Files:**

- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.schemas.ts`
- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.types.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/api-keys/agent-gateway-api-key.service.ts`
- Modify: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway.controller.ts`
- Create: `apps/frontend/agent-gateway/src/app/pages/ApiKeysPage.tsx`
- Modify: `apps/frontend/agent-gateway/src/api/agent-gateway-api.ts`
- Test: `packages/core/test/agent-gateway/agent-gateway-cli-proxy-parity.schemas.test.ts`
- Test: `apps/backend/agent-server/test/agent-gateway/agent-gateway-api-key.service.spec.ts`
- Test: `apps/frontend/agent-gateway/test/agent-gateway-api-keys-page.test.tsx`

- [ ] **Step 1: Add API key schema test**

Append:

```ts
it('parses proxy API key management contracts', () => {
  expect(
    GatewayApiKeyListResponseSchema.parse({
      items: [{ index: 0, valueMasked: 'sk-***abc', lastUsedAt: null }]
    })
  ).toMatchObject({ items: [{ index: 0 }] });

  expect(GatewayReplaceApiKeysRequestSchema.parse({ keys: ['sk-one', 'sk-two'] }).keys).toHaveLength(2);
  expect(GatewayUpdateApiKeyRequestSchema.parse({ index: 1, value: 'sk-next' })).toMatchObject({ index: 1 });
  expect(GatewayDeleteApiKeyRequestSchema.parse({ index: 0 })).toMatchObject({ index: 0 });
});
```

- [ ] **Step 2: Add API key schemas**

Add:

```ts
export const GatewayApiKeyRecordSchema = z.object({
  index: z.number().int().nonnegative(),
  valueMasked: z.string(),
  lastUsedAt: z.string().nullable()
});

export const GatewayApiKeyListResponseSchema = z.object({
  items: z.array(GatewayApiKeyRecordSchema)
});

export const GatewayReplaceApiKeysRequestSchema = z.object({
  keys: z.array(z.string().min(1))
});

export const GatewayUpdateApiKeyRequestSchema = z.object({
  index: z.number().int().nonnegative(),
  value: z.string().min(1)
});

export const GatewayDeleteApiKeyRequestSchema = z.object({
  index: z.number().int().nonnegative()
});
```

- [ ] **Step 3: Add service test**

Create `apps/backend/agent-server/test/agent-gateway/agent-gateway-api-key.service.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AgentGatewayApiKeyService } from '../../src/domains/agent-gateway/api-keys/agent-gateway-api-key.service';

describe('AgentGatewayApiKeyService', () => {
  it('replaces, updates, masks, and deletes proxy API keys', async () => {
    const service = new AgentGatewayApiKeyService();

    await service.replace({ keys: ['sk-one', 'sk-two'] });
    await expect(service.list()).resolves.toMatchObject({
      items: [
        { index: 0, valueMasked: 'sk-***one' },
        { index: 1, valueMasked: 'sk-***two' }
      ]
    });

    await service.update({ index: 1, value: 'sk-three' });
    await expect(service.list()).resolves.toMatchObject({ items: [{ index: 0 }, { valueMasked: 'sk-***ree' }] });

    await service.delete({ index: 0 });
    await expect(service.list()).resolves.toMatchObject({ items: [{ index: 0, valueMasked: 'sk-***ree' }] });
  });
});
```

- [ ] **Step 4: Implement API key service**

Create `apps/backend/agent-server/src/domains/agent-gateway/api-keys/agent-gateway-api-key.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type {
  GatewayApiKeyListResponse,
  GatewayDeleteApiKeyRequest,
  GatewayReplaceApiKeysRequest,
  GatewayUpdateApiKeyRequest
} from '@agent/core';

@Injectable()
export class AgentGatewayApiKeyService {
  private keys: string[] = [];

  async list(): Promise<GatewayApiKeyListResponse> {
    return {
      items: this.keys.map((key, index) => ({ index, valueMasked: maskKey(key), lastUsedAt: null }))
    };
  }

  async replace(request: GatewayReplaceApiKeysRequest): Promise<GatewayApiKeyListResponse> {
    this.keys = [...request.keys];
    return this.list();
  }

  async update(request: GatewayUpdateApiKeyRequest): Promise<GatewayApiKeyListResponse> {
    this.keys[request.index] = request.value;
    return this.list();
  }

  async delete(request: GatewayDeleteApiKeyRequest): Promise<GatewayApiKeyListResponse> {
    this.keys.splice(request.index, 1);
    return this.list();
  }
}

function maskKey(key: string): string {
  return key.length <= 6 ? '***' : `${key.slice(0, 3)}***${key.slice(-3)}`;
}
```

- [ ] **Step 5: Add controller endpoints**

Add:

```ts
@Get('api-keys')
apiKeys(): Promise<GatewayApiKeyListResponse> {
  return this.apiKeyService.list();
}

@Put('api-keys')
replaceApiKeys(@Body() body: unknown): Promise<GatewayApiKeyListResponse> {
  const parsed = GatewayReplaceApiKeysRequestSchema.safeParse(body);
  if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'API key 参数无效' });
  return this.apiKeyService.replace(parsed.data);
}

@Patch('api-keys/:index')
updateApiKey(@Param('index') index: string, @Body() body: unknown): Promise<GatewayApiKeyListResponse> {
  const parsed = GatewayUpdateApiKeyRequestSchema.safeParse({ ...(body as object), index: Number(index) });
  if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'API key 参数无效' });
  return this.apiKeyService.update(parsed.data);
}

@Delete('api-keys/:index')
deleteApiKey(@Param('index') index: string): Promise<GatewayApiKeyListResponse> {
  const parsed = GatewayDeleteApiKeyRequestSchema.safeParse({ index: Number(index) });
  if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'API key 删除参数无效' });
  return this.apiKeyService.delete(parsed.data);
}
```

- [ ] **Step 6: Add frontend page test**

Create `apps/frontend/agent-gateway/test/agent-gateway-api-keys-page.test.tsx`:

```ts
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ApiKeysPage } from '../src/app/pages/ApiKeysPage';

describe('ApiKeysPage', () => {
  it('renders masked proxy API keys and mutation controls', () => {
    const html = renderToStaticMarkup(
      <ApiKeysPage items={[{ index: 0, valueMasked: 'sk-***abc', lastUsedAt: null }]} />
    );

    expect(html).toContain('API Keys');
    expect(html).toContain('sk-***abc');
    expect(html).toContain('替换全部');
    expect(html).toContain('更新');
    expect(html).toContain('删除');
  });
});
```

- [ ] **Step 7: Create API keys page**

Create `apps/frontend/agent-gateway/src/app/pages/ApiKeysPage.tsx`:

```tsx
import type { GatewayApiKeyRecord } from '@agent/core';

interface ApiKeysPageProps {
  items: GatewayApiKeyRecord[];
}

export function ApiKeysPage({ items }: ApiKeysPageProps) {
  return (
    <section className="page-stack" aria-label="API Keys">
      <div className="section-heading">
        <h2>API Keys</h2>
        <p>管理代理对外接口使用的客户端 API keys，列表只显示遮罩值。</p>
      </div>
      <form className="command-panel">
        <label>
          Keys
          <textarea name="keys" defaultValue={items.map(item => item.valueMasked).join('\n')} />
        </label>
        <div className="command-actions">
          <button type="submit">替换全部</button>
          <button type="button">更新</button>
          <button type="button" className="danger-action">
            删除
          </button>
        </div>
      </form>
    </section>
  );
}
```

- [ ] **Step 8: Run verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway/agent-gateway-cli-proxy-parity.schemas.test.ts apps/backend/agent-server/test/agent-gateway/agent-gateway-api-key.service.spec.ts apps/frontend/agent-gateway/test/agent-gateway-api-keys-page.test.tsx
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/frontend/agent-gateway typecheck
```

Expected: PASS.

---

## Task 5: Provider-Specific Configuration Parity

**Files:**

- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.schemas.ts`
- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.types.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/providers/agent-gateway-provider-normalizers.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/services/agent-gateway.service.ts`
- Modify: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway.controller.ts`
- Create: `apps/frontend/agent-gateway/src/app/pages/ProviderConfigPage.tsx`
- Test: `packages/core/test/agent-gateway/agent-gateway-cli-proxy-parity.schemas.test.ts`
- Test: `apps/backend/agent-server/test/agent-gateway/agent-gateway-provider-normalizers.spec.ts`
- Test: `apps/frontend/agent-gateway/test/agent-gateway-provider-config-page.test.tsx`

- [ ] **Step 1: Add provider-specific schema test**

Append:

```ts
it('parses provider-specific config records', () => {
  expect(
    GatewayProviderConfigRecordSchema.parse({
      providerType: 'openaiCompatible',
      id: 'openai-main',
      displayName: 'OpenAI Main',
      enabled: true,
      baseUrl: 'https://api.openai.com/v1',
      priority: 1,
      prefix: 'openai',
      proxyUrl: null,
      headers: { 'x-team': 'platform' },
      models: [{ name: 'gpt-5.4', alias: 'gpt-main', priority: 1, testModel: 'gpt-5.4' }],
      excludedModels: ['bad-model'],
      credentials: [{ credentialId: 'key-1', apiKeyMasked: 'sk-***abc', status: 'valid' }],
      cloakPolicy: { strictMode: true, sensitiveWords: ['secret'] }
    })
  ).toMatchObject({ providerType: 'openaiCompatible', models: [{ alias: 'gpt-main' }] });
});
```

- [ ] **Step 2: Add provider-specific schemas**

Add:

```ts
export const GatewayProviderTypeSchema = z.enum(['gemini', 'codex', 'claude', 'vertex', 'openaiCompatible', 'ampcode']);

export const GatewayModelAliasRuleSchema = z.object({
  name: z.string().min(1),
  alias: z.string().optional(),
  priority: z.number().int().optional(),
  testModel: z.string().optional()
});

export const GatewayProviderCredentialSchema = z.object({
  credentialId: z.string(),
  apiKeyMasked: z.string().optional(),
  status: z.enum(['valid', 'missing', 'disabled'])
});

export const GatewayProviderConfigRecordSchema = z.object({
  providerType: GatewayProviderTypeSchema,
  id: z.string(),
  displayName: z.string(),
  enabled: z.boolean(),
  baseUrl: z.string().nullable(),
  priority: z.number().int().optional(),
  prefix: z.string().optional(),
  proxyUrl: z.string().nullable(),
  headers: z.record(z.string(), z.string()).optional(),
  models: z.array(GatewayModelAliasRuleSchema),
  excludedModels: z.array(z.string()),
  credentials: z.array(GatewayProviderCredentialSchema),
  cloakPolicy: z
    .object({
      mode: z.string().optional(),
      strictMode: z.boolean().optional(),
      sensitiveWords: z.array(z.string()).default([])
    })
    .optional()
});

export const GatewayProviderConfigListResponseSchema = z.object({
  items: z.array(GatewayProviderConfigRecordSchema)
});
```

- [ ] **Step 3: Add normalizer test**

Create `apps/backend/agent-server/test/agent-gateway/agent-gateway-provider-normalizers.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeOpenAICompatibleProvider } from '../../src/domains/agent-gateway/providers/agent-gateway-provider-normalizers';

describe('agent gateway provider normalizers', () => {
  it('maps CLI Proxy OpenAI-compatible raw payload to stable provider config', () => {
    expect(
      normalizeOpenAICompatibleProvider({
        name: 'OpenAI Main',
        'base-url': 'https://api.openai.com/v1',
        disabled: false,
        'api-key-entries': [{ 'api-key': 'sk-secret', headers: { 'x-team': 'platform' } }],
        models: [{ name: 'gpt-5.4', alias: 'gpt-main', priority: 1, 'test-model': 'gpt-5.4' }]
      })
    ).toMatchObject({
      providerType: 'openaiCompatible',
      displayName: 'OpenAI Main',
      credentials: [{ apiKeyMasked: 'sk-***ret' }],
      models: [{ alias: 'gpt-main', testModel: 'gpt-5.4' }]
    });
  });
});
```

- [ ] **Step 4: Implement normalizer**

Create `apps/backend/agent-server/src/domains/agent-gateway/providers/agent-gateway-provider-normalizers.ts`:

```ts
import type { GatewayProviderConfigRecord } from '@agent/core';

export function normalizeOpenAICompatibleProvider(raw: Record<string, unknown>): GatewayProviderConfigRecord {
  const apiKeyEntries = Array.isArray(raw['api-key-entries']) ? raw['api-key-entries'] : [];
  const models = Array.isArray(raw.models) ? raw.models : [];

  return {
    providerType: 'openaiCompatible',
    id: String(raw.name ?? 'openai-compatible'),
    displayName: String(raw.name ?? 'OpenAI Compatible'),
    enabled: raw.disabled !== true,
    baseUrl: raw['base-url'] ? String(raw['base-url']) : null,
    proxyUrl: raw['proxy-url'] ? String(raw['proxy-url']) : null,
    headers: normalizeHeaders(raw.headers),
    models: models.map(normalizeModelAlias),
    excludedModels: normalizeStringArray(raw['excluded-models']),
    credentials: apiKeyEntries.map((entry, index) => {
      const record = isRecord(entry) ? entry : {};
      return {
        credentialId: `key-${index}`,
        apiKeyMasked: maskKey(String(record['api-key'] ?? '')),
        status: record['api-key'] ? 'valid' : 'missing'
      };
    })
  };
}

function normalizeModelAlias(value: unknown) {
  const record = isRecord(value) ? value : {};
  return {
    name: String(record.name ?? ''),
    alias: record.alias ? String(record.alias) : undefined,
    priority: Number.isFinite(Number(record.priority)) ? Number(record.priority) : undefined,
    testModel: record['test-model'] ? String(record['test-model']) : undefined
  };
}

function normalizeHeaders(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, String(item)]));
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(item => String(item)).filter(Boolean) : [];
}

function maskKey(key: string): string {
  return key.length <= 6 ? '***' : `${key.slice(0, 3)}***${key.slice(-3)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
```

- [ ] **Step 5: Add frontend provider page test**

Create `apps/frontend/agent-gateway/test/agent-gateway-provider-config-page.test.tsx`:

```ts
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProviderConfigPage } from '../src/app/pages/ProviderConfigPage';

describe('ProviderConfigPage', () => {
  it('renders provider-specific tabs and fields', () => {
    const html = renderToStaticMarkup(
      <ProviderConfigPage
        providers={[
          {
            providerType: 'openaiCompatible',
            id: 'openai-main',
            displayName: 'OpenAI Main',
            enabled: true,
            baseUrl: 'https://api.openai.com/v1',
            proxyUrl: null,
            models: [{ name: 'gpt-5.4', alias: 'gpt-main' }],
            excludedModels: [],
            credentials: [{ credentialId: 'key-1', apiKeyMasked: 'sk-***abc', status: 'valid' }]
          }
        ]}
      />
    );

    expect(html).toContain('OpenAI Compatible');
    expect(html).toContain('gpt-main');
    expect(html).toContain('导入模型');
    expect(html).toContain('保存 Provider');
  });
});
```

- [ ] **Step 6: Create provider config page**

Create `apps/frontend/agent-gateway/src/app/pages/ProviderConfigPage.tsx`:

```tsx
import type { GatewayProviderConfigRecord } from '@agent/core';

interface ProviderConfigPageProps {
  providers: GatewayProviderConfigRecord[];
}

export function ProviderConfigPage({ providers }: ProviderConfigPageProps) {
  return (
    <section className="page-stack" aria-label="Provider Config">
      <div className="section-heading">
        <h2>Provider Config</h2>
        <p>按 Gemini、Codex、Claude、Vertex、OpenAI Compatible、Ampcode 管理 provider-specific 字段。</p>
      </div>
      <div className="segmented-nav">
        <button type="button">Gemini</button>
        <button type="button">Codex</button>
        <button type="button">Claude</button>
        <button type="button">Vertex</button>
        <button type="button">OpenAI Compatible</button>
        <button type="button">Ampcode</button>
      </div>
      {providers.map(provider => (
        <article className="detail-panel" key={provider.id}>
          <h3>{provider.displayName}</h3>
          <p>{provider.baseUrl}</p>
          <p>{provider.models.map(model => model.alias ?? model.name).join(', ')}</p>
          <div className="command-actions">
            <button type="button">导入模型</button>
            <button type="button">保存 Provider</button>
          </div>
        </article>
      ))}
    </section>
  );
}
```

- [ ] **Step 7: Run verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway/agent-gateway-cli-proxy-parity.schemas.test.ts apps/backend/agent-server/test/agent-gateway/agent-gateway-provider-normalizers.spec.ts apps/frontend/agent-gateway/test/agent-gateway-provider-config-page.test.tsx
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/frontend/agent-gateway typecheck
```

Expected: PASS.

---

## Task 6: Auth Files Batch Operations and Model Listing

**Files:**

- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.schemas.ts`
- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.types.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/auth-files/agent-gateway-auth-file.service.ts`
- Modify: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway.controller.ts`
- Create: `apps/frontend/agent-gateway/src/app/pages/AuthFilesManagerPage.tsx`
- Test: `packages/core/test/agent-gateway/agent-gateway-cli-proxy-parity.schemas.test.ts`
- Test: `apps/backend/agent-server/test/agent-gateway/agent-gateway-auth-file.service.spec.ts`
- Test: `apps/frontend/agent-gateway/test/agent-gateway-auth-files-manager.test.tsx`

- [ ] **Step 1: Add auth file batch schema test**

Append:

```ts
it('parses auth file batch and model list contracts', () => {
  expect(
    GatewayAuthFileBatchMutationResponseSchema.parse({
      status: 'partial',
      succeeded: 1,
      files: ['codex.json'],
      failed: [{ name: 'bad.json', error: 'invalid json' }]
    })
  ).toMatchObject({ status: 'partial', succeeded: 1 });

  expect(
    GatewayAuthFileModelListResponseSchema.parse({
      credentialFileId: 'codex-json',
      models: ['gpt-5.4', 'gpt-5.4-mini']
    })
  ).toMatchObject({ models: ['gpt-5.4', 'gpt-5.4-mini'] });
});
```

- [ ] **Step 2: Add auth file schemas**

Add:

```ts
export const GatewayAuthFileBatchFailureSchema = z.object({
  name: z.string(),
  error: z.string()
});

export const GatewayAuthFileBatchMutationResponseSchema = z.object({
  status: z.enum(['ok', 'partial', 'error']),
  succeeded: z.number().int().nonnegative(),
  files: z.array(z.string()),
  failed: z.array(GatewayAuthFileBatchFailureSchema)
});

export const GatewayPatchAuthFileFieldsRequestSchema = z.object({
  credentialFileId: z.string().min(1),
  prefix: z.string().optional(),
  proxyUrl: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  priority: z.number().int().optional(),
  note: z.string().optional()
});

export const GatewayAuthFileModelListResponseSchema = z.object({
  credentialFileId: z.string(),
  models: z.array(z.string())
});
```

- [ ] **Step 3: Add backend service test**

Create `apps/backend/agent-server/test/agent-gateway/agent-gateway-auth-file.service.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AgentGatewayAuthFileService } from '../../src/domains/agent-gateway/auth-files/agent-gateway-auth-file.service';

describe('AgentGatewayAuthFileService', () => {
  it('returns batch mutation results and model lists', async () => {
    const service = new AgentGatewayAuthFileService();

    await expect(service.uploadBatch([{ name: 'codex.json', content: '{"ok":true}' }])).resolves.toMatchObject({
      status: 'ok',
      succeeded: 1,
      files: ['codex.json']
    });

    await expect(service.listModels('codex.json')).resolves.toMatchObject({
      credentialFileId: 'codex.json',
      models: ['gpt-5.4']
    });
  });
});
```

- [ ] **Step 4: Implement auth file service**

Create `apps/backend/agent-server/src/domains/agent-gateway/auth-files/agent-gateway-auth-file.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { GatewayAuthFileBatchMutationResponse, GatewayAuthFileModelListResponse } from '@agent/core';

interface UploadFileInput {
  name: string;
  content: string;
}

@Injectable()
export class AgentGatewayAuthFileService {
  private readonly files = new Map<string, string>();

  async uploadBatch(files: UploadFileInput[]): Promise<GatewayAuthFileBatchMutationResponse> {
    const failed: Array<{ name: string; error: string }> = [];
    const succeeded: string[] = [];
    for (const file of files) {
      try {
        JSON.parse(file.content);
        this.files.set(file.name, file.content);
        succeeded.push(file.name);
      } catch {
        failed.push({ name: file.name, error: 'invalid json' });
      }
    }
    return {
      status: failed.length && succeeded.length ? 'partial' : failed.length ? 'error' : 'ok',
      succeeded: succeeded.length,
      files: succeeded,
      failed
    };
  }

  async deleteBatch(names: string[]): Promise<GatewayAuthFileBatchMutationResponse> {
    names.forEach(name => this.files.delete(name));
    return { status: 'ok', succeeded: names.length, files: names, failed: [] };
  }

  async listModels(credentialFileId: string): Promise<GatewayAuthFileModelListResponse> {
    return { credentialFileId, models: this.files.has(credentialFileId) ? ['gpt-5.4'] : [] };
  }
}
```

- [ ] **Step 5: Add frontend page test**

Create `apps/frontend/agent-gateway/test/agent-gateway-auth-files-manager.test.tsx`:

```ts
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AuthFilesManagerPage } from '../src/app/pages/AuthFilesManagerPage';

describe('AuthFilesManagerPage', () => {
  it('renders batch controls, filtering, and model list affordances', () => {
    const html = renderToStaticMarkup(
      <AuthFilesManagerPage
        credentialFiles={[{ id: 'codex.json', provider: 'Codex', path: 'codex.json', status: 'valid', lastCheckedAt: '2026-05-08T00:00:00.000Z' }]}
      />
    );

    expect(html).toContain('批量上传');
    expect(html).toContain('批量删除');
    expect(html).toContain('搜索认证文件');
    expect(html).toContain('查看模型');
  });
});
```

- [ ] **Step 6: Create auth files manager page**

Create `apps/frontend/agent-gateway/src/app/pages/AuthFilesManagerPage.tsx`:

```tsx
import type { GatewayCredentialFile } from '@agent/core';

interface AuthFilesManagerPageProps {
  credentialFiles: GatewayCredentialFile[];
}

export function AuthFilesManagerPage({ credentialFiles }: AuthFilesManagerPageProps) {
  return (
    <section className="page-stack" aria-label="Auth Files Manager">
      <div className="section-heading">
        <h2>Auth Files Manager</h2>
        <p>批量管理 CLI/OAuth credential files，查询 projection 不返回文件正文。</p>
      </div>
      <div className="command-panel">
        <input aria-label="搜索认证文件" placeholder="搜索认证文件" />
        <div className="command-actions">
          <button type="button">批量上传</button>
          <button type="button" className="danger-action">
            批量删除
          </button>
        </div>
      </div>
      {credentialFiles.map(file => (
        <article className="detail-panel" key={file.id}>
          <h3>{file.id}</h3>
          <p>{file.provider}</p>
          <button type="button">查看模型</button>
        </article>
      ))}
    </section>
  );
}
```

- [ ] **Step 7: Run verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway/agent-gateway-cli-proxy-parity.schemas.test.ts apps/backend/agent-server/test/agent-gateway/agent-gateway-auth-file.service.spec.ts apps/frontend/agent-gateway/test/agent-gateway-auth-files-manager.test.tsx
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/frontend/agent-gateway typecheck
```

Expected: PASS.

---

## Task 7: OAuth Policy, Excluded Models, and Alias Mapping

**Files:**

- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.schemas.ts`
- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.types.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/oauth/agent-gateway-oauth-policy.service.ts`
- Modify: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway.controller.ts`
- Create: `apps/frontend/agent-gateway/src/app/pages/OAuthPolicyPage.tsx`
- Test: `packages/core/test/agent-gateway/agent-gateway-cli-proxy-parity.schemas.test.ts`
- Test: `apps/backend/agent-server/test/agent-gateway/agent-gateway-oauth-policy.service.spec.ts`
- Test: `apps/frontend/agent-gateway/test/agent-gateway-oauth-policy-page.test.tsx`

- [ ] **Step 1: Add OAuth policy schema test**

Append:

```ts
it('parses OAuth policy contracts', () => {
  expect(
    GatewayOAuthPolicySchema.parse({
      provider: 'codex',
      excludedModels: ['*-preview'],
      modelAliases: [{ sourceModel: 'gpt-5.4', alias: 'gpt-main' }]
    })
  ).toMatchObject({ provider: 'codex', excludedModels: ['*-preview'] });
});
```

- [ ] **Step 2: Add OAuth policy schemas**

Add:

```ts
export const GatewayOAuthProviderSchema = z.enum(['codex', 'anthropic', 'antigravity', 'gemini-cli', 'kimi']);

export const GatewayOAuthModelAliasSchema = z.object({
  sourceModel: z.string().min(1),
  alias: z.string().min(1)
});

export const GatewayOAuthPolicySchema = z.object({
  provider: GatewayOAuthProviderSchema,
  excludedModels: z.array(z.string()),
  modelAliases: z.array(GatewayOAuthModelAliasSchema)
});

export const GatewayOAuthPolicyListResponseSchema = z.object({
  items: z.array(GatewayOAuthPolicySchema)
});

export const GatewayUpdateOAuthExcludedModelsRequestSchema = z.object({
  provider: GatewayOAuthProviderSchema,
  models: z.array(z.string())
});

export const GatewayUpdateOAuthModelAliasesRequestSchema = z.object({
  provider: GatewayOAuthProviderSchema,
  aliases: z.array(GatewayOAuthModelAliasSchema)
});
```

- [ ] **Step 3: Add policy service test**

Create `apps/backend/agent-server/test/agent-gateway/agent-gateway-oauth-policy.service.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AgentGatewayOAuthPolicyService } from '../../src/domains/agent-gateway/oauth/agent-gateway-oauth-policy.service';

describe('AgentGatewayOAuthPolicyService', () => {
  it('updates excluded models and model aliases', async () => {
    const service = new AgentGatewayOAuthPolicyService();

    await service.updateExcludedModels({ provider: 'codex', models: ['*-preview'] });
    await service.updateModelAliases({ provider: 'codex', aliases: [{ sourceModel: 'gpt-5.4', alias: 'gpt-main' }] });

    await expect(service.list()).resolves.toMatchObject({
      items: [{ provider: 'codex', excludedModels: ['*-preview'], modelAliases: [{ alias: 'gpt-main' }] }]
    });
  });
});
```

- [ ] **Step 4: Implement OAuth policy service**

Create `apps/backend/agent-server/src/domains/agent-gateway/oauth/agent-gateway-oauth-policy.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type {
  GatewayOAuthPolicy,
  GatewayOAuthPolicyListResponse,
  GatewayUpdateOAuthExcludedModelsRequest,
  GatewayUpdateOAuthModelAliasesRequest
} from '@agent/core';

@Injectable()
export class AgentGatewayOAuthPolicyService {
  private readonly policies = new Map<string, GatewayOAuthPolicy>();

  async list(): Promise<GatewayOAuthPolicyListResponse> {
    return { items: [...this.policies.values()] };
  }

  async updateExcludedModels(request: GatewayUpdateOAuthExcludedModelsRequest): Promise<GatewayOAuthPolicy> {
    const current = this.policy(request.provider);
    const next = { ...current, excludedModels: [...request.models] };
    this.policies.set(request.provider, next);
    return next;
  }

  async updateModelAliases(request: GatewayUpdateOAuthModelAliasesRequest): Promise<GatewayOAuthPolicy> {
    const current = this.policy(request.provider);
    const next = { ...current, modelAliases: [...request.aliases] };
    this.policies.set(request.provider, next);
    return next;
  }

  private policy(provider: GatewayOAuthPolicy['provider']): GatewayOAuthPolicy {
    return this.policies.get(provider) ?? { provider, excludedModels: [], modelAliases: [] };
  }
}
```

- [ ] **Step 5: Add frontend page test**

Create `apps/frontend/agent-gateway/test/agent-gateway-oauth-policy-page.test.tsx`:

```ts
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OAuthPolicyPage } from '../src/app/pages/OAuthPolicyPage';

describe('OAuthPolicyPage', () => {
  it('renders excluded model and alias editors', () => {
    const html = renderToStaticMarkup(
      <OAuthPolicyPage policies={[{ provider: 'codex', excludedModels: ['*-preview'], modelAliases: [{ sourceModel: 'gpt-5.4', alias: 'gpt-main' }] }]} />
    );

    expect(html).toContain('OAuth Policy');
    expect(html).toContain('*-preview');
    expect(html).toContain('gpt-main');
    expect(html).toContain('保存排除模型');
    expect(html).toContain('保存模型别名');
  });
});
```

- [ ] **Step 6: Create OAuth policy page**

Create `apps/frontend/agent-gateway/src/app/pages/OAuthPolicyPage.tsx`:

```tsx
import type { GatewayOAuthPolicy } from '@agent/core';

interface OAuthPolicyPageProps {
  policies: GatewayOAuthPolicy[];
}

export function OAuthPolicyPage({ policies }: OAuthPolicyPageProps) {
  return (
    <section className="page-stack" aria-label="OAuth Policy">
      <div className="section-heading">
        <h2>OAuth Policy</h2>
        <p>管理 OAuth excluded models 和 model alias mappings。</p>
      </div>
      {policies.map(policy => (
        <article className="detail-panel" key={policy.provider}>
          <h3>{policy.provider}</h3>
          <p>{policy.excludedModels.join(', ')}</p>
          <p>{policy.modelAliases.map(alias => `${alias.sourceModel} -> ${alias.alias}`).join(', ')}</p>
          <div className="command-actions">
            <button type="button">保存排除模型</button>
            <button type="button">保存模型别名</button>
          </div>
        </article>
      ))}
    </section>
  );
}
```

- [ ] **Step 7: Run verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway/agent-gateway-cli-proxy-parity.schemas.test.ts apps/backend/agent-server/test/agent-gateway/agent-gateway-oauth-policy.service.spec.ts apps/frontend/agent-gateway/test/agent-gateway-oauth-policy-page.test.tsx
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/frontend/agent-gateway typecheck
```

Expected: PASS.

---

## Task 8: Provider-Specific Quota Detail

**Files:**

- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.schemas.ts`
- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.types.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/quotas/agent-gateway-quota-detail.service.ts`
- Create: `apps/frontend/agent-gateway/src/app/pages/QuotaDetailPage.tsx`
- Test: `packages/core/test/agent-gateway/agent-gateway-cli-proxy-parity.schemas.test.ts`
- Test: `apps/backend/agent-server/test/agent-gateway/agent-gateway-quota-detail.service.spec.ts`
- Test: `apps/frontend/agent-gateway/test/agent-gateway-quota-detail-page.test.tsx`

- [ ] **Step 1: Add quota detail schema test**

Append:

```ts
it('parses provider-specific quota details', () => {
  expect(
    GatewayQuotaDetailResponseSchema.parse({
      items: [
        {
          provider: 'claude',
          scope: 'daily',
          status: 'warning',
          usedTokens: 900,
          limitTokens: 1000,
          resetAt: '2026-05-09T00:00:00.000Z',
          rawSummary: { account: 'team-a' }
        }
      ]
    })
  ).toMatchObject({ items: [{ provider: 'claude', status: 'warning' }] });
});
```

- [ ] **Step 2: Add quota detail schema**

Add:

```ts
export const GatewayQuotaDetailSchema = z.object({
  provider: z.enum(['claude', 'antigravity', 'codex', 'gemini-cli', 'kimi', 'openaiCompatible']),
  scope: z.string(),
  status: GatewayQuotaStatusSchema,
  usedTokens: z.number().int().nonnegative(),
  limitTokens: z.number().int().positive(),
  resetAt: z.string(),
  rawSummary: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional()
});

export const GatewayQuotaDetailResponseSchema = z.object({
  items: z.array(GatewayQuotaDetailSchema)
});
```

- [ ] **Step 3: Add backend quota detail service test**

Create `apps/backend/agent-server/test/agent-gateway/agent-gateway-quota-detail.service.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AgentGatewayQuotaDetailService } from '../../src/domains/agent-gateway/quotas/agent-gateway-quota-detail.service';

describe('AgentGatewayQuotaDetailService', () => {
  it('returns deterministic provider quota details', async () => {
    const service = new AgentGatewayQuotaDetailService();

    await expect(service.list()).resolves.toMatchObject({
      items: [{ provider: 'claude', scope: 'daily' }]
    });
  });
});
```

- [ ] **Step 4: Implement quota detail service**

Create `apps/backend/agent-server/src/domains/agent-gateway/quotas/agent-gateway-quota-detail.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { GatewayQuotaDetailResponse } from '@agent/core';

@Injectable()
export class AgentGatewayQuotaDetailService {
  async list(): Promise<GatewayQuotaDetailResponse> {
    return {
      items: [
        {
          provider: 'claude',
          scope: 'daily',
          status: 'warning',
          usedTokens: 900,
          limitTokens: 1000,
          resetAt: '2026-05-09T00:00:00.000Z',
          rawSummary: { account: 'team-a' }
        }
      ]
    };
  }
}
```

- [ ] **Step 5: Add frontend quota detail page test**

Create `apps/frontend/agent-gateway/test/agent-gateway-quota-detail-page.test.tsx`:

```ts
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QuotaDetailPage } from '../src/app/pages/QuotaDetailPage';

describe('QuotaDetailPage', () => {
  it('renders provider-specific quota cards', () => {
    const html = renderToStaticMarkup(
      <QuotaDetailPage items={[{ provider: 'claude', scope: 'daily', status: 'warning', usedTokens: 900, limitTokens: 1000, resetAt: '2026-05-09T00:00:00.000Z' }]} />
    );

    expect(html).toContain('Quota Detail');
    expect(html).toContain('claude');
    expect(html).toContain('900 / 1000');
    expect(html).toContain('刷新配额');
  });
});
```

- [ ] **Step 6: Create quota detail page**

Create `apps/frontend/agent-gateway/src/app/pages/QuotaDetailPage.tsx`:

```tsx
import type { GatewayQuotaDetail } from '@agent/core';

interface QuotaDetailPageProps {
  items: GatewayQuotaDetail[];
}

export function QuotaDetailPage({ items }: QuotaDetailPageProps) {
  return (
    <section className="page-stack" aria-label="Quota Detail">
      <div className="section-heading">
        <h2>Quota Detail</h2>
        <p>展示 provider-specific quota payload 的稳定摘要。</p>
      </div>
      <button type="button">刷新配额</button>
      {items.map(item => (
        <article className="detail-panel" key={`${item.provider}-${item.scope}`}>
          <h3>{item.provider}</h3>
          <p>{item.scope}</p>
          <p>
            {item.usedTokens} / {item.limitTokens}
          </p>
        </article>
      ))}
    </section>
  );
}
```

- [ ] **Step 7: Run verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway/agent-gateway-cli-proxy-parity.schemas.test.ts apps/backend/agent-server/test/agent-gateway/agent-gateway-quota-detail.service.spec.ts apps/frontend/agent-gateway/test/agent-gateway-quota-detail-page.test.tsx
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/frontend/agent-gateway typecheck
```

Expected: PASS.

---

## Task 9: Logs Manager and Request Log Downloads

**Files:**

- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.schemas.ts`
- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.types.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/logs/agent-gateway-log.service.ts`
- Modify: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway.controller.ts`
- Create: `apps/frontend/agent-gateway/src/app/pages/LogsManagerPage.tsx`
- Test: `packages/core/test/agent-gateway/agent-gateway-cli-proxy-parity.schemas.test.ts`
- Test: `apps/backend/agent-server/test/agent-gateway/agent-gateway-log.service.spec.ts`
- Test: `apps/frontend/agent-gateway/test/agent-gateway-logs-manager-page.test.tsx`

- [ ] **Step 1: Add log schema test**

Append:

```ts
it('parses log manager contracts', () => {
  expect(
    GatewayLogFileListResponseSchema.parse({
      items: [{ name: 'request-error-1.log', sizeBytes: 42, updatedAt: '2026-05-08T00:00:00.000Z' }]
    })
  ).toMatchObject({ items: [{ name: 'request-error-1.log' }] });

  expect(
    GatewayLogSearchRequestSchema.parse({
      query: 'error',
      hideManagementTraffic: true,
      limit: 100
    })
  ).toMatchObject({ hideManagementTraffic: true });
});
```

- [ ] **Step 2: Add log schemas**

Add:

```ts
export const GatewayLogSearchRequestSchema = z.object({
  query: z.string().optional(),
  hideManagementTraffic: z.boolean().default(false),
  limit: z.number().int().positive().max(500).default(100)
});

export const GatewayLogFileRecordSchema = z.object({
  name: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  updatedAt: z.string()
});

export const GatewayLogFileListResponseSchema = z.object({
  items: z.array(GatewayLogFileRecordSchema)
});

export const GatewayClearLogsResponseSchema = z.object({
  cleared: z.boolean(),
  clearedAt: z.string()
});
```

- [ ] **Step 3: Add backend log service test**

Create `apps/backend/agent-server/test/agent-gateway/agent-gateway-log.service.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AgentGatewayLogService } from '../../src/domains/agent-gateway/logs/agent-gateway-log.service';

describe('AgentGatewayLogService', () => {
  it('searches logs, lists files, and clears logs', async () => {
    const service = new AgentGatewayLogService();

    await expect(service.search({ query: 'proxy', hideManagementTraffic: true, limit: 10 })).resolves.toMatchObject({
      items: [{ message: 'proxy request completed' }]
    });
    await expect(service.listRequestErrorFiles()).resolves.toMatchObject({
      items: [{ name: 'request-error-1.log' }]
    });
    await expect(service.clear()).resolves.toMatchObject({ cleared: true });
  });
});
```

- [ ] **Step 4: Implement log service**

Create `apps/backend/agent-server/src/domains/agent-gateway/logs/agent-gateway-log.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type {
  GatewayClearLogsResponse,
  GatewayLogFileListResponse,
  GatewayLogListResponse,
  GatewayLogSearchRequest
} from '@agent/core';

@Injectable()
export class AgentGatewayLogService {
  async search(request: GatewayLogSearchRequest): Promise<GatewayLogListResponse> {
    const items = [
      {
        id: 'log-proxy-1',
        occurredAt: '2026-05-08T00:00:00.000Z',
        level: 'info' as const,
        stage: 'proxy' as const,
        provider: 'OpenAI',
        message: 'proxy request completed',
        inputTokens: 10,
        outputTokens: 20
      }
    ];
    return {
      items: items.filter(item => !request.query || item.message.includes(request.query)).slice(0, request.limit)
    };
  }

  async listRequestErrorFiles(): Promise<GatewayLogFileListResponse> {
    return { items: [{ name: 'request-error-1.log', sizeBytes: 42, updatedAt: '2026-05-08T00:00:00.000Z' }] };
  }

  async clear(): Promise<GatewayClearLogsResponse> {
    return { cleared: true, clearedAt: new Date().toISOString() };
  }
}
```

- [ ] **Step 5: Add frontend logs manager page test**

Create `apps/frontend/agent-gateway/test/agent-gateway-logs-manager-page.test.tsx`:

```ts
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LogsManagerPage } from '../src/app/pages/LogsManagerPage';

describe('LogsManagerPage', () => {
  it('renders tail, search, clear, and download controls', () => {
    const html = renderToStaticMarkup(<LogsManagerPage />);

    expect(html).toContain('Logs Manager');
    expect(html).toContain('搜索日志');
    expect(html).toContain('隐藏管理流量');
    expect(html).toContain('清空日志');
    expect(html).toContain('下载错误日志');
  });
});
```

- [ ] **Step 6: Create logs manager page**

Create `apps/frontend/agent-gateway/src/app/pages/LogsManagerPage.tsx`:

```tsx
export function LogsManagerPage() {
  return (
    <section className="page-stack" aria-label="Logs Manager">
      <div className="section-heading">
        <h2>Logs Manager</h2>
        <p>搜索、tail、清理和下载 CLI Proxy request logs。</p>
      </div>
      <div className="command-panel">
        <input aria-label="搜索日志" placeholder="搜索日志" />
        <label>
          <input type="checkbox" />
          隐藏管理流量
        </label>
        <div className="command-actions">
          <button type="button">开始 Tail</button>
          <button type="button" className="danger-action">
            清空日志
          </button>
          <button type="button">下载错误日志</button>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 7: Run verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway/agent-gateway-cli-proxy-parity.schemas.test.ts apps/backend/agent-server/test/agent-gateway/agent-gateway-log.service.spec.ts apps/frontend/agent-gateway/test/agent-gateway-logs-manager-page.test.tsx
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/frontend/agent-gateway typecheck
```

Expected: PASS.

---

## Task 10: System Page and Model Discovery

**Files:**

- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.schemas.ts`
- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.types.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/system/agent-gateway-system.service.ts`
- Modify: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway.controller.ts`
- Create: `apps/frontend/agent-gateway/src/app/pages/SystemPage.tsx`
- Test: `packages/core/test/agent-gateway/agent-gateway-cli-proxy-parity.schemas.test.ts`
- Test: `apps/backend/agent-server/test/agent-gateway/agent-gateway-system.service.spec.ts`
- Test: `apps/frontend/agent-gateway/test/agent-gateway-system-page.test.tsx`

- [ ] **Step 1: Add system schema test**

Append:

```ts
it('parses system version and model discovery contracts', () => {
  expect(
    GatewaySystemInfoResponseSchema.parse({
      serverVersion: '1.2.3',
      serverBuildDate: '2026-05-01',
      latestVersion: '1.2.4',
      docsUrl: 'https://help.router-for.me/'
    })
  ).toMatchObject({ latestVersion: '1.2.4' });

  expect(
    GatewayModelDiscoveryResponseSchema.parse({
      groups: [{ provider: 'openai', models: ['gpt-5.4'] }]
    })
  ).toMatchObject({ groups: [{ provider: 'openai' }] });
});
```

- [ ] **Step 2: Add system schemas**

Add:

```ts
export const GatewaySystemInfoResponseSchema = z.object({
  serverVersion: z.string().nullable(),
  serverBuildDate: z.string().nullable(),
  latestVersion: z.string().nullable(),
  docsUrl: z.string().url()
});

export const GatewayModelGroupSchema = z.object({
  provider: z.string(),
  models: z.array(z.string())
});

export const GatewayModelDiscoveryResponseSchema = z.object({
  groups: z.array(GatewayModelGroupSchema)
});
```

- [ ] **Step 3: Add backend system service test**

Create `apps/backend/agent-server/test/agent-gateway/agent-gateway-system.service.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AgentGatewaySystemService } from '../../src/domains/agent-gateway/system/agent-gateway-system.service';

describe('AgentGatewaySystemService', () => {
  it('returns system info and grouped models', async () => {
    const service = new AgentGatewaySystemService();

    await expect(service.info()).resolves.toMatchObject({ serverVersion: 'memory-cli-proxy' });
    await expect(service.models()).resolves.toMatchObject({ groups: [{ provider: 'openai' }] });
  });
});
```

- [ ] **Step 4: Implement system service**

Create `apps/backend/agent-server/src/domains/agent-gateway/system/agent-gateway-system.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { GatewayModelDiscoveryResponse, GatewaySystemInfoResponse } from '@agent/core';

@Injectable()
export class AgentGatewaySystemService {
  async info(): Promise<GatewaySystemInfoResponse> {
    return {
      serverVersion: 'memory-cli-proxy',
      serverBuildDate: '2026-05-08',
      latestVersion: 'memory-cli-proxy',
      docsUrl: 'https://help.router-for.me/'
    };
  }

  async models(): Promise<GatewayModelDiscoveryResponse> {
    return { groups: [{ provider: 'openai', models: ['gpt-5.4'] }] };
  }
}
```

- [ ] **Step 5: Add frontend system page test**

Create `apps/frontend/agent-gateway/test/agent-gateway-system-page.test.tsx`:

```ts
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SystemPage } from '../src/app/pages/SystemPage';

describe('SystemPage', () => {
  it('renders version, quick links, and grouped models', () => {
    const html = renderToStaticMarkup(
      <SystemPage
        info={{ serverVersion: '1.2.3', serverBuildDate: '2026-05-01', latestVersion: '1.2.4', docsUrl: 'https://help.router-for.me/' }}
        modelGroups={[{ provider: 'openai', models: ['gpt-5.4'] }]}
      />
    );

    expect(html).toContain('System');
    expect(html).toContain('1.2.3');
    expect(html).toContain('检查最新版本');
    expect(html).toContain('gpt-5.4');
  });
});
```

- [ ] **Step 6: Create system page**

Create `apps/frontend/agent-gateway/src/app/pages/SystemPage.tsx`:

```tsx
import type { GatewayModelGroup, GatewaySystemInfoResponse } from '@agent/core';

interface SystemPageProps {
  info: GatewaySystemInfoResponse;
  modelGroups: GatewayModelGroup[];
}

export function SystemPage({ info, modelGroups }: SystemPageProps) {
  return (
    <section className="page-stack" aria-label="System">
      <div className="section-heading">
        <h2>System</h2>
        <p>查看 CLI Proxy API 版本、文档链接和 `/v1/models` 分组。</p>
      </div>
      <div className="detail-panel">
        <p>Version: {info.serverVersion}</p>
        <p>Build: {info.serverBuildDate}</p>
        <p>Latest: {info.latestVersion}</p>
        <a href={info.docsUrl}>Help</a>
        <button type="button">检查最新版本</button>
      </div>
      {modelGroups.map(group => (
        <article className="detail-panel" key={group.provider}>
          <h3>{group.provider}</h3>
          <p>{group.models.join(', ')}</p>
        </article>
      ))}
    </section>
  );
}
```

- [ ] **Step 7: Run verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway/agent-gateway-cli-proxy-parity.schemas.test.ts apps/backend/agent-server/test/agent-gateway/agent-gateway-system.service.spec.ts apps/frontend/agent-gateway/test/agent-gateway-system-page.test.tsx
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/frontend/agent-gateway typecheck
```

Expected: PASS.

---

## Task 11: Mature UI Workflow Controls

**Files:**

- Create: `apps/frontend/agent-gateway/src/app/components/ConfirmDialog.tsx`
- Create: `apps/frontend/agent-gateway/src/app/components/NotificationCenter.tsx`
- Create: `apps/frontend/agent-gateway/src/app/hooks/useUnsavedChangesGuard.ts`
- Modify: `apps/frontend/agent-gateway/src/app/GatewayWorkspace.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/App.scss`
- Test: `apps/frontend/agent-gateway/test/agent-gateway-workflow-controls.test.tsx`

- [ ] **Step 1: Add workflow controls test**

Create `apps/frontend/agent-gateway/test/agent-gateway-workflow-controls.test.tsx`:

```ts
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConfirmDialog } from '../src/app/components/ConfirmDialog';
import { NotificationCenter } from '../src/app/components/NotificationCenter';

describe('agent gateway workflow controls', () => {
  it('renders confirmation and notification surfaces', () => {
    expect(
      renderToStaticMarkup(
        <ConfirmDialog title="删除 Provider" message="确认删除 openai-main?" confirmLabel="删除" cancelLabel="取消" />
      )
    ).toContain('确认删除 openai-main?');

    expect(
      renderToStaticMarkup(
        <NotificationCenter items={[{ id: 'notice-1', level: 'success', message: '保存成功' }]} />
      )
    ).toContain('保存成功');
  });
});
```

- [ ] **Step 2: Create ConfirmDialog**

Create `apps/frontend/agent-gateway/src/app/components/ConfirmDialog.tsx`:

```tsx
interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}

export function ConfirmDialog({ title, message, confirmLabel, cancelLabel }: ConfirmDialogProps) {
  return (
    <section className="modal-surface" role="dialog" aria-label={title}>
      <h2>{title}</h2>
      <p>{message}</p>
      <div className="command-actions">
        <button type="button">{cancelLabel}</button>
        <button type="button" className="danger-action">
          {confirmLabel}
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Create NotificationCenter**

Create `apps/frontend/agent-gateway/src/app/components/NotificationCenter.tsx`:

```tsx
interface NotificationItem {
  id: string;
  level: 'success' | 'info' | 'warning' | 'error';
  message: string;
}

interface NotificationCenterProps {
  items: NotificationItem[];
}

export function NotificationCenter({ items }: NotificationCenterProps) {
  return (
    <aside className="notification-center" aria-label="通知">
      {items.map(item => (
        <div className={`notice notice-${item.level}`} key={item.id}>
          {item.message}
        </div>
      ))}
    </aside>
  );
}
```

- [ ] **Step 4: Create unsaved changes guard hook**

Create `apps/frontend/agent-gateway/src/app/hooks/useUnsavedChangesGuard.ts`:

```ts
import { useEffect } from 'react';

export function useUnsavedChangesGuard(hasUnsavedChanges: boolean): void {
  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);
}
```

- [ ] **Step 5: Add CSS**

Modify `apps/frontend/agent-gateway/src/app/App.scss`:

```css
.modal-surface,
.notification-center {
  border: 1px solid #d9e0dc;
  border-radius: 8px;
  background: #ffffff;
}

.modal-surface {
  max-width: 420px;
  padding: 16px;
}

.notification-center {
  display: grid;
  gap: 8px;
  padding: 10px;
}

.notice {
  padding: 10px 12px;
  border-radius: 6px;
  background: #eef4f1;
}
```

- [ ] **Step 6: Run verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-gateway/test/agent-gateway-workflow-controls.test.tsx
pnpm --dir apps/frontend/agent-gateway typecheck
```

Expected: PASS.

---

## Task 12: Integration Docs and Final Verification

**Files:**

- Modify: `docs/contracts/api/agent-gateway.md`
- Modify: `docs/apps/frontend/agent-gateway/README.md`
- Modify: `docs/apps/backend/agent-server/agent-gateway.md`
- Create: `docs/apps/frontend/agent-gateway/cli-proxy-parity.md`
- Modify: `docs/superpowers/plans/2026-05-08-agent-gateway-cli-proxy-parity.md`

- [ ] **Step 1: Run stale docs scan**

Run:

```bash
rg -n "Cli-Proxy|CLI Proxy|Agent Gateway|api-keys|auth-files|oauth|quota|logs|config.yaml|planned|current" docs/apps/frontend/agent-gateway docs/apps/backend/agent-server docs/contracts/api/agent-gateway.md docs/superpowers/plans/2026-05-08-agent-gateway-cli-proxy-parity.md
```

Expected: scan output identifies every doc paragraph that needs status alignment.

- [ ] **Step 2: Create parity doc**

Create `docs/apps/frontend/agent-gateway/cli-proxy-parity.md`:

```md
# Agent Gateway CLI Proxy Parity

状态：current
文档类型：reference
适用范围：`apps/frontend/agent-gateway`、`apps/backend/agent-server/src/domains/agent-gateway`
最后核对：2026-05-08

本文件记录 `apps/frontend/agent-gateway` 与 `/Users/dev/Desktop/Cli-Proxy-API-Management-Center` 的管理能力对齐状态。

## Current

- Remote Management API connection profile.
- Raw config read/write/diff/reload.
- Proxy API key management.
- Provider-specific config projections.
- Auth file batch mutation and model listing.
- OAuth policy excluded models and aliases.
- Provider-specific quota details.
- Logs manager and request error file projections.
- System version and model discovery.

## Boundaries

- 本仓库不直接复制参考项目 UI 代码。
- CLI Proxy raw payload 必须经过 contract、adapter 或 normalizer。
- 明文 key 只允许出现在写命令 payload 中。
```

- [ ] **Step 3: Update API docs**

Update `docs/contracts/api/agent-gateway.md` so every endpoint implemented in Tasks 1-10 is listed as `current`, and reference-only endpoints remain `planned` with an explicit reason.

- [ ] **Step 4: Update frontend/backend docs**

Update:

- `docs/apps/frontend/agent-gateway/README.md`
- `docs/apps/backend/agent-server/agent-gateway.md`

Mention:

- connection profile;
- raw config;
- api keys;
- provider-specific config;
- auth file batch operations;
- OAuth policy;
- quota detail;
- logs manager;
- system page;
- exact verification commands.

- [ ] **Step 5: Mark plan completed**

Modify this file's metadata:

```md
状态：completed
```

- [ ] **Step 6: Run final affected verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway apps/backend/agent-server/test/agent-gateway apps/frontend/agent-gateway/test
pnpm exec tsc -p packages/core/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/frontend/agent-gateway typecheck
pnpm build:lib
pnpm --dir apps/frontend/agent-gateway build
pnpm --dir apps/backend/agent-server build
pnpm check:docs
```

Expected: PASS.

---

## Execution Order

1. Task 1: Remote Management Connection Contract
2. Task 2: Connection UI and API Client
3. Task 3: Raw Config and Visual Config Editor
4. Task 4: API Keys Management
5. Task 5: Provider-Specific Configuration Parity
6. Task 6: Auth Files Batch Operations and Model Listing
7. Task 7: OAuth Policy, Excluded Models, and Alias Mapping
8. Task 8: Provider-Specific Quota Detail
9. Task 9: Logs Manager and Request Log Downloads
10. Task 10: System Page and Model Discovery
11. Task 11: Mature UI Workflow Controls
12. Task 12: Integration Docs and Final Verification

## Completion Definition

Agent Gateway reaches CLI Proxy Management Web UI parity when:

- A remote CLI Proxy Management API profile can be saved, masked, and checked.
- Raw `config.yaml` can be read, diffed, saved, and reloaded through stable contracts.
- Proxy API keys can be listed, replaced, updated, deleted, and displayed only as masked values.
- Gemini, Codex, Claude, Vertex, OpenAI-compatible, and Ampcode provider-specific projections have stable schemas and UI affordances.
- Auth files support batch mutation, field patch affordances, filtering, and model listing.
- OAuth start/complete remains available, and OAuth policy excluded models / alias mappings are represented.
- Quota detail supports provider-specific summaries.
- Logs support search, hide-management filter, clear, file listing, and download affordances.
- System page shows version, latest version, docs links, and grouped model discovery.
- UI includes confirmation, notifications, and unsaved-change protection for destructive or mutable flows.
- Docs are current, stale planned/current wording is cleaned up, and all final verification commands pass.
