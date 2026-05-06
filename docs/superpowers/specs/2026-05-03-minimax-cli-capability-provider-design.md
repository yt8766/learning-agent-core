# MiniMax CLI Capability Provider Design

状态：proposed
文档类型：spec
适用范围：`packages/adapters`、`packages/tools`、`packages/runtime`、`packages/config`、`agents/intel-engine`、`agents/supervisor`、`agents/coder`、`docs/packages/adapters/*`、`docs/integration/daily-tech-intelligence-briefing-design.md`、`docs/apps/backend/agent-server/frontend-ai-intel-system-design.md`
最后核对：2026-05-03

## 背景

当前仓库已经通过 `packages/adapters/src/mcp/minimax/` 暴露了两台官方 MCP server：

- `minimax-mcp`（媒体生成：`text_to_audio` / `text_to_image` / `generate_video` / `music_generation` 等）
- `minimax-token-plan-mcp`（Token Plan 工具：`web_search` / `understand_image`）

`minimax-token-plan-mcp` 依赖 `uvx minimax-coding-plan-mcp -y` 启动，即在 Node 运行时外再拉一个 Python / uvx 工具链。intel-engine 的 `run-web-search.ts` 已经按 `webSearchPrime` → `minimax:web_search` 的优先级接入，`briefing-category-collector.ts` 也直接复用同一个 capability id。

MiniMax 官方在 [Token Plan MCP 文档](https://platform.minimaxi.com/docs/token-plan/mcp-guide.md) 明确写了「**推荐使用 MiniMax CLI 替代 MCP，配置更简单、使用更高效**」。官方 [mmx-cli README](https://github.com/MiniMax-AI/cli) 确认：

- `mmx search query --q <text> --output json` 有机器可读 JSON 输出。
- `mmx vision describe --image <url|file> --prompt <text>` 对应 `understand_image` 的能力面。
- 鉴权支持 `mmx auth login --api-key sk-xxx`（持久到 `~/.mmx/config.json`），也允许每次命令传 `--api-key`。
- 只需 Node 18+，不需要 uvx / Python。

因此本 spec 把 `minimax-token-plan-mcp` 所承载的搜索与图像理解能力彻底从 MCP 切到 CLI 执行器，`minimax-mcp` 媒体 server 保持不变。

## 问题判断

直接让业务层 `child_process.exec('mmx ...')` 是错的，会违反 `AGENTS.md` §6.0 的「第三方能力边界」：

- `run-web-search.ts`、`briefing-category-collector.ts`、`hubu-web-search.ts`、`gongbu-code-tool-resolution.ts`、`executor-node-search-followup.ts` 等消费方已经依赖稳定 `mcpClientManager.invokeTool(toolName, request)` 契约；不能在业务层复用两种调用风格。
- Governance（approval、risk、trustClass、allowedProfiles、evidence、sandbox policy）都挂在 capability + MCP client manager 路径上；直接 exec 会绕过这一层。
- `minimax:web_search` / `minimax:understand_image` 稳定 capabilityId 被 downstream 引用，契约不能破。

同时，仓库已经具备可以容纳 CLI 的抽象位：

- `AdapterMcpTransport` 已有 `'local-adapter' | 'stdio' | 'http' | 'sse' | 'streamable-http'` 五种传输。
- `packages/tools/src/transports/` 已按传输拆成 stdio / http / local-adapter 三个 handler，新增传输已经有固定模式。
- `AdapterMcpServerDefinition.allowedProfiles` 已包含 `'cli'` profile 语义位。

因此最干净的做法是：**新增 `cli` 传输 + `minimax` CLI capability provider**，把 `minimax:web_search` 与 `minimax:understand_image` 的 `serverId` 指到新的 `minimax-cli` server，由新传输 handler 负责 spawn `mmx` 子进程、解析 JSON、归一到 `ToolExecutionResult`。稳定 capabilityId / `mcpClientManager.invokeTool` 契约零改动。

## 目标

1. 引入 `cli` 传输类型与对应 handler，能够在不污染 MCP 抽象的前提下承载子进程执行型 capability。
2. 新增 `minimax-cli` capability provider，声明 `minimax:web_search` 与 `minimax:understand_image` 为 CLI-backed capability。
3. 保持 `minimax:web_search` / `minimax:understand_image` 作为稳定 capabilityId；downstream（intel-engine / supervisor / coder）**零代码改动**。
4. 彻底删除 `minimax-token-plan-mcp` server 注册、相关 uvx 参数、相关测试与文档段落；仓库不再通过 `minimax-coding-plan-mcp` uvx 进程。
5. Provider 在 `validate()` / 启动期做 mmx 可用性检测，失败时给出明确错误与安装指引。
6. 鉴权使用项目级 secret：provider 从 settings/secret 读取 `MINIMAX_API_KEY`，每次 `mmx` 调用传 `--api-key`；不依赖用户本机 `~/.mmx/config.json`。
7. 同步更新设计文档与集成文档，消除旧 uvx 路径的误导。

## 非目标

- 不动 `minimax-mcp` 媒体 server（音视频、图像、音乐生成仍走 stdio MCP / uvx）。本 spec 只替换 Token Plan MCP 部分。
- 不实现面向终端用户的产品化 CLI（上一条对话里讨论的 `apps/cli` / `mmx-like` 产品），那是独立工作。
- 不重构 `mcp-skill-provider-adapter.ts` 里 `AdapterMcpServerDefinition.transport` 现存的 `'local-adapter' | 'stdio' | 'http'` 窄集，只追加 `'cli'`。
- 不为 `mmx-cli` 提供 bundled 安装。运维侧自行 `npm i -g mmx-cli` 或运行时明确报错。
- 不对 `webSearchPrime` 这条优先级路径做任何改动；`run-web-search.ts` 的回退语义保留。

## 总体架构

```text
business layer (agents/intel-engine, agents/supervisor, agents/coder, ...)
            │
            ▼
mcpClientManager.invokeTool('web_search' | 'understand_image', request)
            │
            ▼
packages/tools/src/mcp/mcp-client-manager.ts
            │  resolveServer(capabilityId) -> McpServerDefinition{ transport: 'cli' }
            ▼
packages/tools/src/transports/mcp-cli-transport.ts  (新增)
            │  spawn('mmx', ['search', 'query', '--q', ..., '--output', 'json', '--api-key', sk])
            ▼
mmx-cli subprocess (externally installed)
```

Provider 层：

```text
packages/adapters/src/cli/
└─ minimax/
   ├─ minimax-cli-provider.ts           (AdapterMcpSkillProviderAdapter 实现)
   ├─ minimax-cli-capabilities.ts       (capability 定义)
   └─ index.ts                          (barrel)
```

注意：保留 `packages/adapters/src/cli/` 目录名而不是 `packages/adapters/src/mcp/minimax/` 子目录，是为了把"非 MCP 的第三方能力接入"在物理上和 MCP 区分开，避免继续把 MCP 抽象撑胀。provider 仍然实现 `AdapterMcpSkillProviderAdapter`（因为 downstream 注册表就是这个契约），但其 `buildInstallPlan` 返回的 server 的 `transport === 'cli'`。

## 契约细节

### 1. Transport 枚举扩展

`packages/adapters/src/mcp-skill-provider-adapter.ts`：

```ts
export type AdapterMcpTransport = 'local-adapter' | 'stdio' | 'http' | 'sse' | 'streamable-http' | 'cli';

export interface AdapterMcpServerDefinition {
  ...
  transport: 'local-adapter' | 'stdio' | 'http' | 'cli';   // 追加 'cli'
  command?: string;       // 对 cli 传输仍复用：CLI 可执行文件名，默认 'mmx'
  args?: string[];        // 不用；cli 传输由 capability 元数据 + 运行时 query 决定
  env?: Record<string, string>;  // CLI 子进程环境变量（含 MINIMAX_API_HOST / MINIMAX_API_KEY）
}
```

`packages/tools/src/mcp/mcp-server-registry.ts`、`packages/tools/src/mcp/mcp-transport-types.ts` 同步扩展。

### 2. CLI 传输 handler

`packages/tools/src/transports/mcp-cli-transport.ts`（新文件）：

```ts
export interface CliToolPayloadBuilder {
  (
    request: ToolExecutionRequest,
    capability: McpCapabilityDefinition
  ): {
    args: string[];
    stdin?: string;
  };
}

export interface CliToolResponseParser {
  (raw: { stdout: string; stderr: string; exitCode: number }): unknown;
}

export interface CliCapabilityBinding {
  capabilityId: string;
  buildPayload: CliToolPayloadBuilder;
  parseResponse: CliToolResponseParser;
  timeoutMs?: number;
}

export class CliTransportHandler implements McpTransportHandler {
  readonly transport = 'cli' as const;

  constructor(
    private readonly bindings: Map<string, CliCapabilityBinding>,
    private readonly runner: CliRunner = defaultCliRunner
  ) {}

  async invoke(server, capability, request): Promise<ToolExecutionResult> {
    /* spawn + parse */
  }
  async discover(server, capabilities) {
    /* stateless: return registered capabilities */
  }
  getHealth(server, capabilities): McpTransportHealth {
    /* 'healthy' | 'disabled' | 'degraded' */
  }
}
```

- `defaultCliRunner` 基于 `node:child_process.execFile`，超时默认 30000 ms，内存上限复用沙箱约束。
- `binding` 由 provider 在装配期传入（不硬编码 MiniMax-specific 逻辑到传输层）。
- 失败语义：非零退出码 → `ok: false`，`errorMessage` 取 stderr 首 1KiB；JSON 解析失败 → `ok: false, errorMessage: 'cli_response_parse_failed'`。

### 3. MiniMax CLI provider

`packages/adapters/src/cli/minimax/minimax-cli-capabilities.ts`：

```ts
export const MINIMAX_CLI_SERVER_ID = 'minimax-cli';

export function buildMiniMaxCliCapabilities(serverId = MINIMAX_CLI_SERVER_ID): AdapterMcpCapabilityDefinition[] {
  return [
    {
      id: 'minimax:web_search',
      toolName: 'web_search',
      serverId,
      displayName: 'MiniMax CLI web search',
      riskLevel: 'low',
      requiresApproval: false,
      category: 'knowledge',
      dataScope: 'web-search-query-and-results',
      writeScope: 'none'
    },
    {
      id: 'minimax:understand_image',
      toolName: 'understand_image',
      serverId,
      displayName: 'MiniMax CLI image understanding',
      riskLevel: 'medium',
      requiresApproval: true,
      category: 'knowledge',
      dataScope: 'image-url-or-local-image-content',
      writeScope: 'none'
    }
  ];
}
```

`packages/adapters/src/cli/minimax/minimax-cli-provider.ts`：

```ts
export function createMiniMaxCliSkillProvider(): AdapterMcpSkillProviderAdapter {
  return {
    descriptor: {
      id: 'minimax-cli',
      displayName: 'MiniMax CLI',
      description:
        'MiniMax Token Plan web search and image understanding via mmx-cli (https://github.com/MiniMax-AI/cli).',
      builtIn: true,
      trustClass: 'official',
      supportedTransports: ['cli'],
      skillIds: buildMiniMaxCliCapabilities().map(c => c.id),
      documentationUrl: 'https://platform.minimaxi.com/docs/token-plan/minimax-cli'
    },
    secretRequirements: [{ key: 'MINIMAX_API_KEY', label: 'MiniMax API key', required: true, sensitive: true }],
    validate(input) {
      if (!input.secrets.MINIMAX_API_KEY) return { ok: false, errors: ['missing_MINIMAX_API_KEY'] };
      return { ok: true };
    },
    buildInstallPlan(input) {
      const serverId = input.serverId ?? MINIMAX_CLI_SERVER_ID;
      const server: AdapterMcpServerDefinition = {
        id: serverId,
        displayName: 'MiniMax CLI',
        transport: 'cli',
        enabled: input.enabled ?? true,
        source: 'minimax',
        trustClass: 'official',
        dataScope: 'web-search-and-image-understanding',
        writeScope: 'none',
        installationMode: 'configured',
        allowedProfiles: ['platform', 'company', 'personal', 'cli'],
        command: readOption(input, 'command') ?? 'mmx',
        env: {
          MINIMAX_API_HOST: resolveMiniMaxApiHost(input),
          MINIMAX_API_KEY: input.secrets.MINIMAX_API_KEY ?? ''
        }
      };
      return {
        servers: [server],
        capabilities: buildMiniMaxCliCapabilities(serverId),
        warnings: []
      };
    }
  };
}
```

### 4. MiniMax CLI binding（payload + response）

`packages/adapters/src/cli/minimax/minimax-cli-bindings.ts`：

```ts
export function createMiniMaxCliBindings(params: {
  getApiKey: () => string | undefined;
  apiHost?: string;
}): CliCapabilityBinding[] {
  return [
    {
      capabilityId: 'minimax:web_search',
      timeoutMs: 30_000,
      buildPayload(request) {
        const query = readQueryField(request.input); // { query: string }
        const args = ['search', 'query', '--q', query, '--output', 'json'];
        const key = params.getApiKey();
        if (key) args.push('--api-key', key);
        return { args };
      },
      parseResponse(raw) {
        if (raw.exitCode !== 0) throw new Error(`mmx_exit_${raw.exitCode}`);
        const payload = JSON.parse(raw.stdout);
        return normalizeSearchResponse(payload); // { results: [{title,url,summary,publishedAt,sourceName}] }
      }
    },
    {
      capabilityId: 'minimax:understand_image',
      timeoutMs: 60_000,
      buildPayload(request) {
        const { prompt, image_url } = readImageFields(request.input);
        const args = ['vision', 'describe', '--image', image_url, '--prompt', prompt, '--output', 'json'];
        const key = params.getApiKey();
        if (key) args.push('--api-key', key);
        return { args };
      },
      parseResponse(raw) {
        /* 对齐现有 understand_image 返回形状 */
      }
    }
  ];
}
```

`normalizeSearchResponse` 输出必须严格匹配 `run-web-search.ts::mapSearchResults` 现在期望的形状：`{ results: [{ title, url, snippet|summary, publishedAt?, sourceName? }] }`。

### 5. 接线与注册

- `packages/adapters/src/index.ts`：导出 `createMiniMaxCliSkillProvider`、`createMiniMaxCliBindings`。
- `packages/adapters/test/mcp/default-mcp-skill-providers.test.ts`：原 `minimax-token-plan-mcp` 断言删除，替换为 `minimax-cli` 断言；`minimax:web_search` / `minimax:understand_image` 的 `serverId` 从 `minimax-token-plan-mcp` 改为 `minimax-cli`。
- `packages/tools/src/mcp/mcp-client-manager.ts`：传输 handler 注册表增加 `cli` → `CliTransportHandler` 实例。
- `packages/runtime/src/runtime/agent-runtime-mcp-configuration.ts`：启动装配时把 MiniMax CLI bindings 挂到 `CliTransportHandler`；healthCheck 失败（`mmx` 不可用或 `MINIMAX_API_KEY` 缺失）时 server 被标记为 `disabled` 而不是崩溃。
- `packages/adapters/src/mcp/minimax/minimax-mcp-capabilities.ts`：删除 `minimax:web_search` / `minimax:understand_image` 条目（只保留媒体能力）。
- `packages/adapters/src/mcp/minimax/minimax-mcp-provider.ts`：删除 `minimax-token-plan-mcp` server 与对应环境变量构造；仅保留 `minimax-mcp` 媒体 server。

### 6. Downstream 零改动验证面

以下文件**不改**，但要补测试断言它们仍能用：

- `agents/intel-engine/src/flows/intel/nodes/run-web-search.ts`：`resolveSearchTool` 在 `minimax:web_search` 分支返回 `{ capabilityId: 'minimax:web_search', toolName: 'web_search', kind: 'minimaxTokenPlan' }` 不变。已有测试 `run-web-search.spec.ts` 的 mock 用 `capabilityId === 'minimax:web_search'` 走到同一代码路径，保持绿。
- `agents/intel-engine/src/runtime/briefing/briefing-category-collector.ts`、`briefing.service.test.ts` 相关断言。
- `agents/supervisor/src/flows/ministries/hubu-search/hubu-web-search.ts`。
- `agents/coder/src/flows/ministries/gongbu-code/gongbu-code-tool-resolution.ts`、`executor-node-search-followup.ts`。
- `packages/tools/src/definitions/knowledge-tool-definitions.ts`。

上述消费方只依赖 capability id 和 `mcpClientManager` 契约，不依赖 server id / transport。

### 7. 运行时健康检测

`CliTransportHandler.getHealth(server)`：

- 检测 `command`（默认 `mmx`）是否在 PATH 上（`which mmx` 或 `mmx --version`，结果缓存 60s）。
- 不可用 → `{ healthState: 'disabled', healthReason: 'cli_binary_missing' }`。
- 可用但环境缺少 `MINIMAX_API_KEY` → `{ healthState: 'disabled', healthReason: 'missing_api_key' }`。
- 正常 → `{ healthState: 'healthy' }`。

Runtime 扫到 `disabled` capability 后，`intel-engine` 现有的 `'webSearchPrime or minimax:web_search capability is unavailable'` 错误分支会自然承接，不需要额外业务改动。

## 安全与审计

- `mmx` 子进程参数里只传 `query`、`prompt`、`image_url`，不传 shell metacharacter 敏感 token；使用 `execFile`（不是 `exec`）避免 shell injection。
- `--api-key` 通过 argv 传入意味着在进程表里可见；仓库语境下这是可接受的（与 MCP 通过 env 传 `MINIMAX_API_KEY` 风险相当），但需要在设计文档里明确这一点，并在 provider `env` 里同时设置 `MINIMAX_API_KEY`，让 mmx 支持的 env 变量路径优先生效——如果官方 mmx 支持从 env 读 key，则仅设置 env，`buildPayload` 不再 append `--api-key`。落地时由 `CliRunner` 的契约决定。
- `timeoutMs` 默认 30s（搜索）/ 60s（图像理解），超时子进程必须被 `SIGKILL`，错误归一到 `errorMessage: 'cli_timeout'`。
- CLI stdout 大小上限 4 MiB，超过截断并返回 `errorMessage: 'cli_response_too_large'`。
- `mcpClientManager.invokeTool` 现有的审计 / evidence / approval pipeline 自动覆盖，因为 capability + invoke 路径未变。

## 回归风险

| 风险                                  | 缓解                                                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 运行机缺失 `mmx` 二进制               | provider `validate()` + transport health 明确报错 `cli_binary_missing`；文档指引 `npm i -g mmx-cli`  |
| `mmx search` 的 JSON 输出未来字段变化 | `normalizeSearchResponse` 做可选字段兜底；新增契约 Spec 测试覆盖官方 README 当前样例                 |
| downstream 误以为 MCP server 存在     | `mcp-client-manager.local-http.test.ts` / registry 测试断言 `minimax-token-plan-mcp` server 不再注册 |
| 搜索延迟增加（子进程冷启动）          | 第一次 spawn 后 benchmark；若超过 5s，后续版本可考虑 `mmx` 驻留模式或 HTTP SDK                       |
| `--api-key` 出现在进程表              | 优先走 env；若必须 argv，文档提示在多租户机器上隔离 API key                                          |

## 验证策略

五层验证（映射到 `docs/packages/evals/verification-system-guidelines.md`）：

- **Type**：`pnpm exec tsc -p packages/adapters/tsconfig.json --noEmit`、`pnpm exec tsc -p packages/tools/tsconfig.json --noEmit`、`pnpm exec tsc -p packages/runtime/tsconfig.json --noEmit`、`pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit`。
- **Spec**：
  - `packages/adapters/test/cli/minimax-cli-provider.spec.ts`：provider descriptor / capabilities / buildInstallPlan 结构。
  - `packages/adapters/test/mcp/default-mcp-skill-providers.test.ts`：更新后的 capability 清单。
- **Unit**：
  - `packages/adapters/test/cli/minimax-cli-bindings.test.ts`：`buildPayload` / `parseResponse` 的正确性，含错误路径（非零 exit、非 JSON stdout、空 results）。
  - `packages/tools/test/transports/mcp-cli-transport.test.ts`：传输 handler 的 invoke / discover / health，mock `CliRunner`。
- **Demo**：`packages/adapters/demo/minimax-cli-provider.demo.ts` 最小闭环（mock runner），加入 `pnpm test:demo` 清单。
- **Integration**：
  - `agents/intel-engine/test/flows/intel/run-web-search.spec.ts`：扩展一个 case 用 `capabilityId === 'minimax:web_search'` + 新 CLI transport mock，断言 downstream 行为不变。
  - `packages/tools/test/mcp/mcp-client-manager.local-http.test.ts`：追加一个 CLI 注册用例（或新建同目录 `.cli-spec.ts`）。

## 需要清理的旧物料

- `packages/adapters/src/mcp/minimax/minimax-mcp-provider.ts`：删除 `minimax-token-plan-mcp` server / `resolveMiniMaxApiHost` 对 Token Plan 的分支、`DEFAULT_MINIMAX_TOKEN_PLAN_SERVER_ID`、`MINIMAX_MCP_BASE_PATH` / `MINIMAX_API_RESOURCE_MODE` 对 Token Plan server 的 env（媒体 server 保留）。
- `packages/adapters/src/mcp/minimax/minimax-mcp-capabilities.ts`：删除 `minimax:web_search` / `minimax:understand_image`；函数签名仅保留 `serverId` 参数。
- `docs/packages/tools/minimax-mcp-provider-design.md`：重写为「媒体 server 走 MCP，搜索 / 图像理解走 CLI」；原 `minimax-coding-plan-mcp` 段落删除。
- `docs/packages/adapters/mcp-skill-providers.md`：同步删除 Token Plan server 段落，新增 minimax-cli 段落或单独文档链接。
- `docs/integration/daily-tech-intelligence-briefing-design.md` L375：`MiniMax Token Plan minimax:web_search 已作为同类搜索供应商接入` → 改为「`minimax:web_search` 由 MiniMax CLI provider 承载」。
- `docs/apps/backend/agent-server/frontend-ai-intel-system-design.md` L46：同上。

## 文档交付面

- 新增 `docs/packages/adapters/minimax-cli-provider.md`（此 spec 的"当前实现"版本，供运维 / 二次开发者查阅）。
- 更新 `docs/packages/adapters/mcp-skill-providers.md`、`docs/packages/adapters/README.md`（如含索引）。
- 更新 `docs/conventions/local-development-guide.md` / `.env.example` 若有 `MINIMAX_MCP_BASE_PATH` 等 Token Plan MCP 残留变量。
- 本 spec 文件（`docs/superpowers/specs/2026-05-03-minimax-cli-capability-provider-design.md`）状态在实现完成后改为 `implemented`。

## 后续延伸（本 spec 不含）

- 若 mmx-cli 上游提供 `--json-strict` / stable schema 版本标记，provider 在 `validate()` 中额外断言版本下限。
- 若官方出 Node SDK（非 CLI、HTTP 直连），可作为第三种 backend，通过同一 `minimax:web_search` capability id 再次替换底层实现。
- 面向用户的产品化 CLI（仓库自己的 `apps/cli`）是独立工作，不在本 spec 范围。
