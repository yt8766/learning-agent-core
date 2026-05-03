# MiniMax CLI Capability Provider Implementation Plan

状态：current
文档类型：plan
适用范围：`packages/adapters`、`packages/tools`、`packages/runtime`、`packages/config`
最后核对：2026-05-03

> **For agentic workers:** REQUIRED SUB-SKILL: 使用 `.agents/skills/executing-plans` 或 `.agents/skills/subagent-driven-development`，按 checkbox (`- [ ]`) 逐步推进。

**Goal:** 把 `minimax:web_search` 与 `minimax:understand_image` 的底层实现从 `minimax-coding-plan-mcp`（uvx/stdio MCP）切到 `mmx-cli`（CLI 子进程），彻底删除 `minimax-token-plan-mcp` server 注册；稳定 capabilityId 契约零破坏。

**Architecture:** 新增 `cli` 传输类型 + `CliTransportHandler`；新增 `packages/adapters/src/cli/minimax/` provider；`minimax:web_search` / `minimax:understand_image` 的 `serverId` 指到新 `minimax-cli` server，由传输 handler spawn `mmx` 并解析 JSON 输出；downstream 不改。

**Tech Stack:** TypeScript 5.8 · Node 22 · `node:child_process.execFile` · Vitest 4 · pnpm workspace · `AdapterMcpSkillProviderAdapter`

**配套 spec：** `docs/superpowers/specs/2026-05-03-minimax-cli-capability-provider-design.md`

---

## 文件结构预览

- 新建
  - `packages/adapters/src/cli/index.ts`
  - `packages/adapters/src/cli/minimax/index.ts`
  - `packages/adapters/src/cli/minimax/minimax-cli-capabilities.ts`
  - `packages/adapters/src/cli/minimax/minimax-cli-bindings.ts`
  - `packages/adapters/src/cli/minimax/minimax-cli-provider.ts`
  - `packages/adapters/test/cli/minimax-cli-provider.test.ts`
  - `packages/adapters/test/cli/minimax-cli-bindings.test.ts`
  - `packages/adapters/demo/minimax-cli-provider.demo.ts`
  - `packages/tools/src/transports/mcp-cli-transport.ts`
  - `packages/tools/test/transports/mcp-cli-transport.test.ts`
  - `docs/packages/adapters/minimax-cli-provider.md`
- 修改
  - `packages/adapters/src/index.ts`（barrel 追加 cli 导出）
  - `packages/adapters/src/mcp-skill-provider-adapter.ts`（`AdapterMcpTransport` / `AdapterMcpServerDefinition.transport` 追加 `'cli'`）
  - `packages/adapters/src/mcp/minimax/minimax-mcp-provider.ts`（删 Token Plan server）
  - `packages/adapters/src/mcp/minimax/minimax-mcp-capabilities.ts`（删 web_search / understand_image）
  - `packages/adapters/test/mcp/default-mcp-skill-providers.test.ts`（更新断言）
  - `packages/tools/src/transports/mcp-transport-handlers.ts`（导出 cli handler）
  - `packages/tools/src/mcp/mcp-client-manager.ts`（注册 cli transport + bindings）
  - `packages/tools/src/mcp/mcp-server-registry.ts`、`packages/tools/src/mcp/mcp-transport-types.ts`（transport 枚举）
  - `packages/runtime/src/runtime/agent-runtime-mcp-configuration.ts`（装配期挂 MiniMax CLI bindings）
  - `agents/intel-engine/test/flows/intel/run-web-search.spec.ts`（追加 CLI 分支断言）
  - `docs/packages/tools/minimax-mcp-provider-design.md`（重写 Token Plan 段落）
  - `docs/packages/adapters/mcp-skill-providers.md`（Token Plan → minimax-cli）
  - `docs/integration/daily-tech-intelligence-briefing-design.md` L375
  - `docs/apps/backend/agent-server/frontend-ai-intel-system-design.md` L46

---

## Task 1：扩展 transport 枚举到 `'cli'`

**Files:**

- Modify: `packages/adapters/src/mcp-skill-provider-adapter.ts`
- Modify: `packages/tools/src/mcp/mcp-transport-types.ts`
- Modify: `packages/tools/src/mcp/mcp-server-registry.ts`

- [ ] **Step 1：在 `AdapterMcpTransport` 追加 `'cli'`，`AdapterMcpServerDefinition.transport` 联合类型同步追加。**
- [ ] **Step 2：`McpTransport` / `McpServerDefinition.transport` 在 `packages/tools` 中同步扩展。**
- [ ] **Step 3：运行 `pnpm exec tsc -p packages/adapters/tsconfig.json --noEmit` 与 `pnpm exec tsc -p packages/tools/tsconfig.json --noEmit` 确认无编译错误。**
- [ ] **Step 4：commit**

```bash
git add packages/adapters/src/mcp-skill-provider-adapter.ts \
        packages/tools/src/mcp/mcp-transport-types.ts \
        packages/tools/src/mcp/mcp-server-registry.ts
git commit -m "feat(adapters): extend transport enum with 'cli' for CLI-backed capabilities"
```

---

## Task 2：为 CLI 传输写失败单测

**Files:**

- Test: `packages/tools/test/transports/mcp-cli-transport.test.ts`

- [ ] **Step 1：写 3 个失败用例——成功路径 / exit code 非零 / JSON 解析失败。**

```ts
import { describe, expect, it, vi } from 'vitest';
import { CliTransportHandler } from '../../src/transports/mcp-cli-transport';

describe('CliTransportHandler', () => {
  const capability = {
    id: 'minimax:web_search',
    toolName: 'web_search',
    serverId: 'minimax-cli',
    riskLevel: 'low' as const,
    requiresApproval: false,
    category: 'knowledge' as const
  };
  const server = { id: 'minimax-cli', transport: 'cli' as const, enabled: true, command: 'mmx' } as any;

  it('spawns mmx with built args and parses JSON stdout', async () => {
    const runner = vi
      .fn()
      .mockResolvedValue({
        stdout: '{"results":[{"title":"t","url":"https://x","summary":"s"}]}',
        stderr: '',
        exitCode: 0
      });
    const handler = new CliTransportHandler(
      new Map([
        [
          'minimax:web_search',
          {
            capabilityId: 'minimax:web_search',
            buildPayload: () => ({ args: ['search', 'query', '--q', 'foo', '--output', 'json'] }),
            parseResponse: r => JSON.parse(r.stdout)
          }
        ]
      ]),
      runner
    );
    const result = await handler.invoke(server, capability, {
      toolName: 'web_search',
      input: { query: 'foo' },
      taskId: 't',
      intent: 'CALL_EXTERNAL_API',
      requestedBy: 'agent'
    } as any);
    expect(runner).toHaveBeenCalledWith(
      'mmx',
      ['search', 'query', '--q', 'foo', '--output', 'json'],
      expect.any(Object)
    );
    expect(result.ok).toBe(true);
    expect(result.rawOutput).toEqual({ results: [{ title: 't', url: 'https://x', summary: 's' }] });
  });

  it('returns ok=false when cli exits non-zero', async () => {
    const runner = vi.fn().mockResolvedValue({ stdout: '', stderr: 'boom', exitCode: 2 });
    const handler = new CliTransportHandler(
      new Map([
        [
          'minimax:web_search',
          {
            capabilityId: 'minimax:web_search',
            buildPayload: () => ({ args: [] }),
            parseResponse: () => ({})
          }
        ]
      ]),
      runner
    );
    const result = await handler.invoke(server, capability, {
      toolName: 'web_search',
      input: {},
      taskId: 't',
      intent: 'CALL_EXTERNAL_API',
      requestedBy: 'agent'
    } as any);
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain('mmx_exit_2');
  });

  it('returns ok=false when parser throws', async () => {
    const runner = vi.fn().mockResolvedValue({ stdout: 'not json', stderr: '', exitCode: 0 });
    const handler = new CliTransportHandler(
      new Map([
        [
          'minimax:web_search',
          {
            capabilityId: 'minimax:web_search',
            buildPayload: () => ({ args: [] }),
            parseResponse: r => {
              JSON.parse(r.stdout);
              return {};
            }
          }
        ]
      ]),
      runner
    );
    const result = await handler.invoke(server, capability, {
      toolName: 'web_search',
      input: {},
      taskId: 't',
      intent: 'CALL_EXTERNAL_API',
      requestedBy: 'agent'
    } as any);
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toBe('cli_response_parse_failed');
  });
});
```

- [ ] **Step 2：`pnpm --filter @agent/tools test -- mcp-cli-transport` — 确认全部 FAIL（文件不存在 / 类不存在）。**
- [ ] **Step 3：不 commit，进入 Task 3 写实现。**

---

## Task 3：实现 `CliTransportHandler`

**Files:**

- Create: `packages/tools/src/transports/mcp-cli-transport.ts`
- Modify: `packages/tools/src/transports/mcp-transport-handlers.ts`

- [ ] **Step 1：实现 handler，含 `CliRunner` 接口与默认 `execFile` 运行器。**

```ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ToolExecutionRequest, ToolExecutionResult } from '@agent/runtime';
import type { McpCapabilityDefinition } from '../mcp/mcp-capability-registry';
import type { McpServerDefinition } from '../mcp/mcp-server-registry';
import type { McpTransportDiscovery, McpTransportHandler, McpTransportHealth } from '../mcp/mcp-transport-types';

const execFileAsync = promisify(execFile);

export interface CliRunOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}
export interface CliRunner {
  (
    command: string,
    args: string[],
    options: { timeoutMs: number; env: Record<string, string | undefined>; maxBuffer: number }
  ): Promise<CliRunOutput>;
}

export const defaultCliRunner: CliRunner = async (command, args, options) => {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      env: { ...process.env, ...options.env },
      maxBuffer: options.maxBuffer,
      timeout: options.timeoutMs,
      windowsHide: true
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err: any) {
    return {
      stdout: typeof err?.stdout === 'string' ? err.stdout : '',
      stderr: typeof err?.stderr === 'string' ? err.stderr : String(err?.message ?? err),
      exitCode: typeof err?.code === 'number' ? err.code : 1
    };
  }
};

export interface CliCapabilityBinding {
  capabilityId: string;
  buildPayload(request: ToolExecutionRequest, capability: McpCapabilityDefinition): { args: string[]; stdin?: string };
  parseResponse(raw: CliRunOutput): unknown;
  timeoutMs?: number;
}

export class CliTransportHandler implements McpTransportHandler {
  readonly transport = 'cli' as const;

  constructor(
    private readonly bindings: Map<string, CliCapabilityBinding>,
    private readonly runner: CliRunner = defaultCliRunner
  ) {}

  async invoke(
    server: McpServerDefinition,
    capability: McpCapabilityDefinition,
    request: ToolExecutionRequest
  ): Promise<ToolExecutionResult> {
    const binding = this.bindings.get(capability.id);
    if (!binding) {
      return {
        ok: false,
        errorMessage: `cli_binding_missing:${capability.id}`,
        serverId: server.id,
        capabilityId: capability.id,
        transportUsed: 'cli'
      };
    }
    const command = server.command ?? 'mmx';
    const { args } = binding.buildPayload(request, capability);
    const raw = await this.runner(command, args, {
      timeoutMs: binding.timeoutMs ?? 30_000,
      env: server.env ?? {},
      maxBuffer: 4 * 1024 * 1024
    });
    if (raw.exitCode !== 0) {
      return {
        ok: false,
        errorMessage: `mmx_exit_${raw.exitCode}: ${raw.stderr.slice(0, 1024)}`,
        serverId: server.id,
        capabilityId: capability.id,
        transportUsed: 'cli'
      };
    }
    try {
      const rawOutput = binding.parseResponse(raw);
      return { ok: true, rawOutput, serverId: server.id, capabilityId: capability.id, transportUsed: 'cli' };
    } catch {
      return {
        ok: false,
        errorMessage: 'cli_response_parse_failed',
        serverId: server.id,
        capabilityId: capability.id,
        transportUsed: 'cli'
      };
    }
  }

  getHealth(server: McpServerDefinition, capabilities: McpCapabilityDefinition[]): McpTransportHealth {
    if (!server.enabled)
      return { healthState: 'disabled', healthReason: 'connector_disabled', implementedCapabilityCount: 0 };
    const apiKey = server.env?.MINIMAX_API_KEY;
    if (!apiKey) return { healthState: 'disabled', healthReason: 'missing_api_key', implementedCapabilityCount: 0 };
    return { healthState: 'healthy', implementedCapabilityCount: capabilities.length };
  }

  async discover(
    _server: McpServerDefinition,
    capabilities: McpCapabilityDefinition[]
  ): Promise<McpTransportDiscovery> {
    return {
      sessionState: 'stateless',
      discoveredCapabilities: capabilities.map(c => c.toolName),
      discoveryMode: 'registered'
    };
  }
}
```

- [ ] **Step 2：`packages/tools/src/transports/mcp-transport-handlers.ts` 追加 `export * from './mcp-cli-transport';`**
- [ ] **Step 3：`pnpm --filter @agent/tools test -- mcp-cli-transport` 确认 PASS。**
- [ ] **Step 4：commit**

```bash
git add packages/tools/src/transports/mcp-cli-transport.ts \
        packages/tools/src/transports/mcp-transport-handlers.ts \
        packages/tools/test/transports/mcp-cli-transport.test.ts
git commit -m "feat(tools): add CliTransportHandler for CLI-backed capabilities"
```

---

## Task 4：MiniMax CLI bindings 的失败单测 + 实现

**Files:**

- Create: `packages/adapters/src/cli/minimax/minimax-cli-capabilities.ts`
- Create: `packages/adapters/src/cli/minimax/minimax-cli-bindings.ts`
- Create: `packages/adapters/src/cli/minimax/index.ts`
- Create: `packages/adapters/src/cli/index.ts`
- Test: `packages/adapters/test/cli/minimax-cli-bindings.test.ts`

- [ ] **Step 1：先写 bindings 测试——覆盖 web_search 和 understand_image 的 payload + parse。**

```ts
import { describe, expect, it } from 'vitest';
import { createMiniMaxCliBindings } from '../../src/cli/minimax/minimax-cli-bindings';

describe('createMiniMaxCliBindings', () => {
  const bindings = createMiniMaxCliBindings({ getApiKey: () => 'sk-123' });
  const webSearch = bindings.find(b => b.capabilityId === 'minimax:web_search')!;
  const vision = bindings.find(b => b.capabilityId === 'minimax:understand_image')!;

  it('builds web_search argv with query + --output json + --api-key', () => {
    const { args } = webSearch.buildPayload({ input: { query: 'hello' } } as any, {} as any);
    expect(args).toEqual(['search', 'query', '--q', 'hello', '--output', 'json', '--api-key', 'sk-123']);
  });

  it('parses web_search JSON into normalized results', () => {
    const raw = {
      stdout: '{"results":[{"title":"T","url":"https://x","summary":"S","publishedAt":"2026-05-03"}]}',
      stderr: '',
      exitCode: 0
    };
    expect(webSearch.parseResponse(raw)).toEqual({
      results: [{ title: 'T', url: 'https://x', summary: 'S', publishedAt: '2026-05-03' }]
    });
  });

  it('throws when web_search returns invalid JSON', () => {
    expect(() => webSearch.parseResponse({ stdout: 'garbage', stderr: '', exitCode: 0 })).toThrow();
  });

  it('builds understand_image argv with image + prompt + --output json', () => {
    const { args } = vision.buildPayload(
      { input: { prompt: 'describe', image_url: 'https://x/a.jpg' } } as any,
      {} as any
    );
    expect(args).toEqual([
      'vision',
      'describe',
      '--image',
      'https://x/a.jpg',
      '--prompt',
      'describe',
      '--output',
      'json',
      '--api-key',
      'sk-123'
    ]);
  });
});
```

- [ ] **Step 2：运行 `pnpm --filter @agent/adapters test -- minimax-cli-bindings` 确认 FAIL。**

- [ ] **Step 3：实现 `minimax-cli-capabilities.ts`（spec §契约细节.3）。**
- [ ] **Step 4：实现 `minimax-cli-bindings.ts`（spec §契约细节.4），其中 `normalizeSearchResponse` 保证字段与 intel-engine `mapSearchResults` 兼容。**
- [ ] **Step 5：`packages/adapters/src/cli/minimax/index.ts` + `packages/adapters/src/cli/index.ts` 做 barrel 导出。**
- [ ] **Step 6：运行 `pnpm --filter @agent/adapters test -- minimax-cli-bindings` 确认 PASS。**
- [ ] **Step 7：commit**

```bash
git add packages/adapters/src/cli \
        packages/adapters/test/cli/minimax-cli-bindings.test.ts
git commit -m "feat(adapters): add MiniMax CLI capability definitions and bindings"
```

---

## Task 5：MiniMax CLI provider 的失败单测 + 实现

**Files:**

- Create: `packages/adapters/src/cli/minimax/minimax-cli-provider.ts`
- Test: `packages/adapters/test/cli/minimax-cli-provider.test.ts`
- Modify: `packages/adapters/src/index.ts`

- [ ] **Step 1：写 provider 测试——descriptor / validate / buildInstallPlan。**

```ts
import { describe, expect, it } from 'vitest';
import { createMiniMaxCliSkillProvider } from '../../src/cli/minimax/minimax-cli-provider';

describe('MiniMax CLI skill provider', () => {
  const provider = createMiniMaxCliSkillProvider();

  it('declares built-in official provider with cli transport and two capabilities', () => {
    expect(provider.descriptor).toMatchObject({
      id: 'minimax-cli',
      trustClass: 'official',
      builtIn: true,
      supportedTransports: ['cli']
    });
    expect(provider.descriptor.skillIds.sort()).toEqual(['minimax:understand_image', 'minimax:web_search']);
  });

  it('rejects install when MINIMAX_API_KEY missing', () => {
    const result = provider.validate({ providerId: 'minimax-cli', profile: 'platform', secrets: {} });
    expect(result).toEqual({ ok: false, errors: ['missing_MINIMAX_API_KEY'] });
  });

  it('builds cli server + 2 capabilities when secret present', () => {
    const plan = provider.buildInstallPlan({
      providerId: 'minimax-cli',
      profile: 'platform',
      secrets: { MINIMAX_API_KEY: 'sk' }
    });
    expect(plan.servers).toHaveLength(1);
    expect(plan.servers[0]).toMatchObject({
      id: 'minimax-cli',
      transport: 'cli',
      command: 'mmx',
      trustClass: 'official'
    });
    expect(plan.servers[0].allowedProfiles).toEqual(['platform', 'company', 'personal', 'cli']);
    expect(plan.capabilities.map(c => c.id).sort()).toEqual(['minimax:understand_image', 'minimax:web_search']);
    plan.capabilities.forEach(c => expect(c.serverId).toBe('minimax-cli'));
  });
});
```

- [ ] **Step 2：`pnpm --filter @agent/adapters test -- minimax-cli-provider` 确认 FAIL。**
- [ ] **Step 3：实现 `minimax-cli-provider.ts`（spec §契约细节.3）。**
- [ ] **Step 4：`packages/adapters/src/index.ts` 追加 `export { createMiniMaxCliSkillProvider } from './cli/minimax';` 及 bindings / capabilities 的公开导出。**
- [ ] **Step 5：`pnpm --filter @agent/adapters test -- minimax-cli-provider` 确认 PASS。**
- [ ] **Step 6：commit**

```bash
git add packages/adapters/src/cli/minimax/minimax-cli-provider.ts \
        packages/adapters/src/index.ts \
        packages/adapters/test/cli/minimax-cli-provider.test.ts
git commit -m "feat(adapters): add MiniMax CLI skill provider"
```

---

## Task 6：删除 `minimax-token-plan-mcp` 与对应 capabilities

**Files:**

- Modify: `packages/adapters/src/mcp/minimax/minimax-mcp-provider.ts`
- Modify: `packages/adapters/src/mcp/minimax/minimax-mcp-capabilities.ts`
- Modify: `packages/adapters/test/mcp/default-mcp-skill-providers.test.ts`

- [ ] **Step 1：先改测试——`default-mcp-skill-providers.test.ts` 断言 `minimax-token-plan-mcp` 不存在，`minimax:web_search` / `minimax:understand_image` 由 `createMiniMaxCliSkillProvider` 提供，`minimax-mcp` 仅保留媒体 capability。**
- [ ] **Step 2：运行确认 FAIL：`pnpm --filter @agent/adapters test -- default-mcp-skill-providers`。**
- [ ] **Step 3：在 `minimax-mcp-capabilities.ts` 删除 `minimax:web_search` / `minimax:understand_image`；签名简化为 `buildMiniMaxMcpCapabilities(serverId = 'minimax-mcp')`。**
- [ ] **Step 4：在 `minimax-mcp-provider.ts` 删除 `DEFAULT_MINIMAX_TOKEN_PLAN_SERVER_ID` / `tokenPlanServer` / `resourceMode` 警告；`buildInstallPlan` 只返回一台 `minimax-mcp` stdio server。**
- [ ] **Step 5：运行 `pnpm --filter @agent/adapters test -- default-mcp-skill-providers` 确认 PASS；同时跑全量 `pnpm --filter @agent/adapters test` 看是否有连带。**
- [ ] **Step 6：commit**

```bash
git add packages/adapters/src/mcp/minimax/minimax-mcp-provider.ts \
        packages/adapters/src/mcp/minimax/minimax-mcp-capabilities.ts \
        packages/adapters/test/mcp/default-mcp-skill-providers.test.ts
git commit -m "refactor(adapters): remove minimax-token-plan-mcp in favor of CLI provider"
```

---

## Task 7：在 mcp-client-manager 注册 CLI transport 与 MiniMax bindings

**Files:**

- Modify: `packages/tools/src/mcp/mcp-client-manager.ts`
- Modify: `packages/runtime/src/runtime/agent-runtime-mcp-configuration.ts`
- Test: `packages/tools/test/mcp/mcp-client-manager.local-http.test.ts`（若有便宜的扩展点）或新建 `packages/tools/test/mcp/mcp-client-manager.cli.test.ts`

- [ ] **Step 1：在 `mcp-client-manager.ts` 的 transport registry 初始化处增加 `'cli': new CliTransportHandler(bindings)`，`bindings` 通过构造函数选项注入（避免耦合 MiniMax）。**
- [ ] **Step 2：在 `agent-runtime-mcp-configuration.ts` 装配期，从 `@agent/adapters` 导入 `createMiniMaxCliBindings({ getApiKey: () => settings.providers.minimax?.apiKey })`，把 bindings 传给 `McpClientManager`。**
- [ ] **Step 3：新增 `packages/tools/test/mcp/mcp-client-manager.cli.test.ts`：注册一个 fake cli server + fake binding + fake runner，驱动 `invokeTool` 走完 CLI 路径，断言 `rawOutput` 与 `transportUsed: 'cli'`。**
- [ ] **Step 4：`pnpm --filter @agent/tools test -- mcp-client-manager` 与 `pnpm --filter @agent/runtime test` 全绿。**
- [ ] **Step 5：commit**

```bash
git add packages/tools/src/mcp/mcp-client-manager.ts \
        packages/runtime/src/runtime/agent-runtime-mcp-configuration.ts \
        packages/tools/test/mcp/mcp-client-manager.cli.test.ts
git commit -m "feat(runtime): wire MiniMax CLI bindings into mcp-client-manager"
```

---

## Task 8：intel-engine 的集成回归

**Files:**

- Modify: `agents/intel-engine/test/flows/intel/run-web-search.spec.ts`

- [ ] **Step 1：追加一个用例：`mcpClientManager` 在 `hasCapability('minimax:web_search')` 时 `invokeTool('web_search', ...)` 返回形如 `{ ok: true, rawOutput: { results: [...] } }`（模拟 CLI handler 的归一化输出）；断言 `rawResults` 被正确填充。**
- [ ] **Step 2：保留原 `minimax:web_search` 用例作为"capability id 契约不破"证明。**
- [ ] **Step 3：跑 `pnpm --filter @agent/intel-engine test -- run-web-search` 全绿。**
- [ ] **Step 4：跑更大范围 `pnpm --filter @agent/intel-engine test` 确认 briefing-category-collector、briefing.service 相关测试仍绿。**
- [ ] **Step 5：commit**

```bash
git add agents/intel-engine/test/flows/intel/run-web-search.spec.ts
git commit -m "test(intel-engine): cover minimax:web_search capability served by CLI transport"
```

---

## Task 9：Demo（`pnpm test:demo` 入口）

**Files:**

- Create: `packages/adapters/demo/minimax-cli-provider.demo.ts`

- [ ] **Step 1：写一个最小可运行 demo——构造 provider，打印 descriptor + buildInstallPlan 结果 + mock runner 下 web_search 调用结果；不真正 spawn `mmx`。**
- [ ] **Step 2：确认 `scripts/run-package-demos.js` 能发现它（参照 adapters 已有 demo 结构）。**
- [ ] **Step 3：跑 `pnpm test:demo`（scope 到 adapters）全绿。**
- [ ] **Step 4：commit**

```bash
git add packages/adapters/demo/minimax-cli-provider.demo.ts
git commit -m "test(adapters): add MiniMax CLI provider demo"
```

---

## Task 10：Cleanup 与文档

**Files:**

- Rewrite: `docs/packages/tools/minimax-mcp-provider-design.md`
- Modify: `docs/packages/adapters/mcp-skill-providers.md`
- Create: `docs/packages/adapters/minimax-cli-provider.md`
- Modify: `docs/integration/daily-tech-intelligence-briefing-design.md` L375
- Modify: `docs/apps/backend/agent-server/frontend-ai-intel-system-design.md` L46
- Modify: `docs/conventions/local-development-guide.md`（若含 `MINIMAX_MCP_BASE_PATH` / uvx Token Plan 安装指引）

- [ ] **Step 1：`minimax-mcp-provider-design.md` 重写成"媒体走 MCP，搜索 / 图像理解走 CLI"；删除 `minimax-coding-plan-mcp` 段落。**
- [ ] **Step 2：`mcp-skill-providers.md` 的 minimax 段落拆两部分：媒体 MCP + 链接到 `minimax-cli-provider.md`。**
- [ ] **Step 3：新建 `minimax-cli-provider.md`，按 §6.1 要求记录当前实现、入口、边界、错误语义、安装指引（`npm i -g mmx-cli`）、rollback 路径。**
- [ ] **Step 4：改两处集成文档的描述（"MiniMax Token Plan minimax:web_search..." → "由 MiniMax CLI provider 承载..."）。**
- [ ] **Step 5：清理 `docs/conventions/local-development-guide.md` 中的 uvx / Token Plan MCP 环境变量残留（若有）。**
- [ ] **Step 6：把 spec 文件顶部 `状态：proposed` 改为 `implemented`。**
- [ ] **Step 7：commit**

```bash
git add docs/
git commit -m "docs: migrate MiniMax Token Plan integration narrative to CLI provider"
```

---

## Task 11：受影响范围验证收尾

- [ ] **Step 1：`pnpm check:docs` — 确保所有文档链接和目录规范合规。**
- [ ] **Step 2：`pnpm check:barrel-layout` — 因为新增 `packages/adapters/src/cli/`，确认 barrel 合规。**
- [ ] **Step 3：`pnpm exec tsc -p packages/adapters/tsconfig.json --noEmit`。**
- [ ] **Step 4：`pnpm exec tsc -p packages/tools/tsconfig.json --noEmit`。**
- [ ] **Step 5：`pnpm exec tsc -p packages/runtime/tsconfig.json --noEmit`。**
- [ ] **Step 6：`pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit`。**
- [ ] **Step 7：`pnpm test:unit:affected`（应自动包含 adapters / tools / runtime / intel-engine）。**
- [ ] **Step 8：`pnpm test:integration:affected`。**
- [ ] **Step 9：`pnpm test:spec:affected`。**
- [ ] **Step 10：`pnpm test:demo:affected`。**
- [ ] **Step 11：如果任一红灯不是本轮引入，按 `AGENTS.md` §7 记录 blocker；如是本轮引入，先修再交付。**

---

## Self-Review 检查清单

- 每个 Task 是否都有对应 spec 要求？
  - Transport 枚举 → Task 1
  - CLI transport handler → Task 2–3
  - MiniMax capabilities / bindings → Task 4
  - MiniMax provider → Task 5
  - Token Plan MCP 删除 → Task 6
  - mcp-client-manager 接线 → Task 7
  - intel-engine 回归 → Task 8
  - Demo → Task 9
  - Docs + Cleanup → Task 10
  - 全量验证 → Task 11
- 是否所有 placeholder 都被移除？✓（所有 code step 都有具体代码）
- 类型 / 方法名是否前后一致？`CliTransportHandler` / `CliCapabilityBinding` / `CliRunner` / `createMiniMaxCliSkillProvider` / `createMiniMaxCliBindings` / `buildMiniMaxCliCapabilities` / `MINIMAX_CLI_SERVER_ID` 全文一致。
- Downstream 契约是否确实零改动？intel-engine / supervisor / coder 的 `minimax:web_search` 引用未动，只通过测试验证依然可用。✓

---

## Execution Handoff

- 使用 `.agents/skills/executing-plans` 按 Task 顺序推进。Task 1、6、10 属于"纯重命名 / 搬运"，可以批量；Task 2–5 严格 TDD；Task 11 不合并到前面的 commit。
- 涉及 `pnpm add` 的依赖变更不在本计划内（无需新增运行时依赖，`child_process` 为 node 内置）。
- 运行时环境缺少 `mmx` 二进制时，Task 11 的 integration 验证不会走真实 CLI —— runner 全部走 mock。真实环境启用需要单独在运维手册注明 `npm i -g mmx-cli`。
