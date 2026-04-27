# MiniMax MCP Provider Design

状态：completed
文档类型：history
适用范围：`packages/tools/src/mcp`、`packages/tools/src/transports`、后续 MCP provider 接入
最后核对：2026-04-23

## 1. 背景

`packages/tools/src/mcp` 当前已经具备 MCP 基础运行能力：

- `McpServerRegistry`：登记 MCP server 的传输、端点、命令、环境变量与治理元数据。
- `McpCapabilityRegistry`：登记 capability、风险等级、审批要求与 policy override。
- `McpClientManager`：按 capability / toolName 路由到可用 server，并委托 transport handler 执行。
- `McpTransportHandler`：抽象 `local-adapter`、`http`、`stdio` 三类传输。
- `HttpTransportHandler` / `StdioTransportHandler`：已支持 `tools/list` discovery 与 `tools/call` invocation。

当前缺口是：这些能力已经能“执行一个已登记的 MCP server”，但还缺少“供应商 MCP provider 接口”。如果直接把 MiniMax、智谱等供应商配置散落在调用方或 registry 初始化代码里，会导致：

- 每个 provider 都重复拼 `McpServerDefinition` 与 `McpCapabilityDefinition`。
- API key、region、base path、transport 偏好与工具风险分级缺少统一 contract。
- 后续 `agent-admin` 的 Connector & Policy Center 很难以同一模型治理不同 MCP provider。
- provider 的 vendor-specific 配置容易穿透到 runtime / graph / service 层。

因此，本设计目标是：`packages/tools/src/mcp` 提供稳定接口，`packages/adapters` 承载 MiniMax、智谱等具体 MCP provider / MCP skill 适配实现。执行时，adapter 统一产出标准 `McpServerDefinition + McpCapabilityDefinition`，再复用现有 transport。

## 2. MiniMax MCP 当前事实

MiniMax 官方 MCP server 提供 Python 与 JavaScript 实现，主要能力包括文本转语音、声音列表、声音克隆、视频生成、图片生成、视频任务查询、音乐生成和 voice design。官方 Token Plan MCP 另提供 `web_search` 与 `understand_image`，常见本地接入方式是通过 `uvx minimax-coding-plan-mcp -y` 启动 stdio server。媒体 MCP 常见本地接入方式是通过 `uvx minimax-mcp -y` 启动 stdio server；两类 server 都通过环境变量传入 `MINIMAX_API_KEY`、`MINIMAX_API_HOST`、`MINIMAX_MCP_BASE_PATH`、`MINIMAX_API_RESOURCE_MODE`。

参考来源：

- [MiniMax MCP Guide](https://platform.minimax.io/docs/guides/mcp-guide)
- [MiniMax Token Plan MCP Guide](https://platform.minimaxi.com/docs/guides/token-plan-mcp-guide)
- [MiniMax-AI/MiniMax-MCP](https://github.com/minimax-ai/minimax-mcp)

## 3. 设计目标

- `packages/tools` 提供 provider 接口和 registry/factory，不直接内联 MiniMax / 智谱业务逻辑。
- `packages/adapters` 作为各种 MCP skills / provider 的默认适配落点，负责把供应商配置映射为项目内稳定 contract，不让第三方字段穿透到业务层。
- `McpClientManager` 继续只感知 server、capability 与 transport handler，不感知 MiniMax、智谱等品牌。
- MiniMax 首期优先支持 `stdio`，因为当前仓库已经有成熟 `StdioTransportHandler`。
- MiniMax 的 SSE / streamable HTTP 能力不直接塞进现有 `http` 伪协议；需要单独 transport 或 adapter 明确语义。
- 所有高成本或外部副作用能力默认可治理：风险等级、审批、数据范围、写入范围、secret 要求可观测。
- `agent-admin` 后续能基于同一 provider descriptor 渲染安装说明、密钥要求、健康状态和 policy override。

## 4. 非目标

- 本设计不把 MiniMax 能力实现成本地 executor。
- 本设计不让 graph、runtime service 或前端直接依赖 MiniMax SDK / Python 包 / JS 包。
- 本设计不在 `packages/tools` 内实现 MiniMax API HTTP SDK；MiniMax 官方 MCP server 已经是 adapter 边界。
- 本设计不把 provider discovery 结果自动提升为可执行能力；远端发现能力必须经过项目侧风险分级后才能进入 registry。

## 5. 推荐分层

```text
packages/tools/src/mcp/
├─ mcp-provider-types.ts        # provider interface / config / descriptor
├─ mcp-provider-registry.ts     # provider adapter registry
├─ mcp-provider-installer.ts    # provider -> server/capability registration helper
├─ mcp-server-registry.ts       # 现有 server registry
├─ mcp-capability-registry.ts   # 现有 capability registry
└─ mcp-client-manager.ts        # 现有 invocation / discovery manager

packages/adapters/src/mcp/
├─ minimax/
│  ├─ minimax-mcp-provider.ts   # MiniMax MCP provider implementation
│  └─ minimax-mcp-capabilities.ts
├─ zhipu/
│  ├─ zhipu-mcp-provider.ts     # 智谱 MCP provider implementation
│  └─ zhipu-mcp-capabilities.ts
└─ index.ts

apps/backend/*/src/app/
└─ mcp-providers.ts             # composition root：选择启用哪些 provider，注入 secret/config
```

说明：

- `packages/tools` 提供接口、registry 与安装 helper。
- `packages/adapters` 承载具体 provider / MCP skill 适配实现，符合“第三方能力通过 adapter/provider 边界进入系统”的仓库规范。
- 应用启动层负责读取 profile、secret、region 与开关，避免 `packages/tools` 依赖环境来源。

落位结论：

- MCP 协议抽象、server registry、capability registry、transport handler 继续放在 `packages/tools`。
- MiniMax、智谱、内部供应商或社区 MCP skills 的 vendor-specific 配置、安装计划、能力清单与默认风险分级放在 `packages/adapters/src/mcp/<provider>/`。
- `packages/tools` 不新增 `providers/minimax` 这类长期目录；如迁移期不得不临时放置，必须标注过渡态并尽快迁回 `packages/adapters`。

## 6. 核心接口草案

```ts
export type McpProviderId = 'minimax' | 'zhipu' | string;

export type McpProviderTransport = 'stdio' | 'http' | 'sse' | 'streamable-http';

export interface McpProviderSecretRequirement {
  key: string;
  label: string;
  required: boolean;
  sensitive: boolean;
}

export interface McpProviderInstallInput {
  providerId: McpProviderId;
  serverId?: string;
  profile: 'platform' | 'company' | 'personal' | 'cli';
  transportPreference?: McpProviderTransport;
  enabled?: boolean;
  region?: string;
  secrets: Record<string, string>;
  options?: Record<string, unknown>;
}

export interface McpProviderInstallPlan {
  server: McpServerDefinition;
  capabilities: McpCapabilityDefinition[];
  warnings: string[];
}

export interface McpProviderAdapter {
  readonly id: McpProviderId;
  readonly displayName: string;
  readonly trustClass: McpServerDefinition['trustClass'];
  readonly supportedTransports: McpProviderTransport[];
  readonly secretRequirements: McpProviderSecretRequirement[];

  validate(input: McpProviderInstallInput): { ok: true } | { ok: false; errors: string[] };
  buildInstallPlan(input: McpProviderInstallInput): McpProviderInstallPlan;
}
```

首期可以把接口保持在“provider -> install plan”层，不要求 provider 自己执行 tool call。这样 provider adapter 只负责：

- 校验配置。
- 构造 `McpServerDefinition`。
- 构造项目侧已治理的 `McpCapabilityDefinition[]`。
- 给出风险提示或 region/host 警告。

执行仍由现有 `McpClientManager` 与 transport handler 完成。

## 7. MiniMax Provider 映射草案

MiniMax 首期建议实现为 `stdio` provider：

```ts
const miniMaxServer: McpServerDefinition = {
  id: input.serverId ?? 'minimax-mcp',
  displayName: 'MiniMax MCP',
  transport: 'stdio',
  enabled: input.enabled ?? true,
  source: 'minimax',
  trustClass: 'official',
  dataScope: 'external-media-generation',
  writeScope: 'external-billing-and-local-output',
  installationMode: 'configured',
  allowedProfiles: ['platform', 'company', 'personal', 'cli'],
  command: 'uvx',
  args: ['minimax-mcp', '-y'],
  env: {
    MINIMAX_API_KEY: input.secrets.MINIMAX_API_KEY,
    MINIMAX_API_HOST: resolveMiniMaxApiHost(input.region, input.options),
    MINIMAX_MCP_BASE_PATH: String(input.options?.basePath ?? ''),
    MINIMAX_API_RESOURCE_MODE: String(input.options?.resourceMode ?? 'url')
  }
};
```

建议首期固定登记这些 capability：

| capability id                    | toolName                 | category    | riskLevel  | requiresApproval | 说明                                |
| -------------------------------- | ------------------------ | ----------- | ---------- | ---------------- | ----------------------------------- |
| `minimax:text_to_audio`          | `text_to_audio`          | `action`    | `medium`   | `true`           | 生成音频，涉及外部计费与内容生成    |
| `minimax:list_voices`            | `list_voices`            | `knowledge` | `low`      | `false`          | 只读查询声音列表                    |
| `minimax:voice_clone`            | `voice_clone`            | `action`    | `critical` | `true`           | 声音克隆，高风险生物特征 / 伪造风险 |
| `minimax:generate_video`         | `generate_video`         | `action`    | `high`     | `true`           | 视频生成，外部计费与内容安全风险    |
| `minimax:text_to_image`          | `text_to_image`          | `action`    | `high`     | `true`           | 图片生成，外部计费与内容安全风险    |
| `minimax:query_video_generation` | `query_video_generation` | `knowledge` | `low`      | `false`          | 查询任务状态                        |
| `minimax:music_generation`       | `music_generation`       | `action`    | `high`     | `true`           | 音乐生成，版权与计费风险            |
| `minimax:voice_design`           | `voice_design`           | `action`    | `high`     | `true`           | 声音设计，生成式音频风险            |

首期 capability 不建议仅依赖远端 `tools/list` 自动注册。可以允许 discovery 展示远端工具清单，但只有项目侧静态登记过风险策略的工具才能执行。原因是 MCP remote discovery 只说明“有这个工具”，不能替代项目治理语义。

## 8. 方案对比

### 方案 A：仅使用现有 registry 手写 MiniMax 配置

做法：

- 在启动层直接 `servers.register(...)` 与 `capabilities.register(...)`。
- 不新增 provider 接口。
- MiniMax 通过现有 stdio transport 执行。

优点：

- 实现最快，几乎不改架构。
- 当前 `StdioTransportHandler` 已能覆盖 `uvx minimax-mcp -y` 这种接入方式。

缺点：

- 智谱、MiniMax、后续 provider 会复制配置拼装逻辑。
- 密钥、region、风险等级和安装说明缺少统一 contract。
- `agent-admin` 很难基于统一 descriptor 做治理 UI。

适用场景：

- 只想快速试通 MiniMax，且短期不做 provider 平台化。

### 方案 B：在 `packages/tools` 新增轻量 `McpProviderAdapter` 接口，provider 可临时同包

做法：

- `packages/tools/src/mcp` 新增 provider types / registry / installer。
- provider 实现可以暂时放在 `packages/tools/src/mcp/providers` 或后续迁移到 `packages/adapters`。
- `McpProviderInstaller` 将 provider install plan 注册进现有 server/capability registry。

优点：

- 改动可控，和现有 `McpClientManager` / transport 解耦。
- 很容易支持 MiniMax stdio。
- 智谱等 provider 只需实现同一接口。
- 能为 Connector & Policy Center 提供统一 provider descriptor。

缺点：

- 如果 provider 实现也放在 `packages/tools`，会让供应商逻辑进入工具平台包，长期边界不够干净。
- 需要补 provider contract 测试、MiniMax install plan 测试和 docs。

适用场景：

- 只适合极短期原型。若已经确认要用 `packages/adapters` 适配各种 MCP skills，不建议作为正式落点。

### 方案 C：`packages/tools` 只放接口，具体 provider / MCP skills 全部放 `packages/adapters`

做法：

- `packages/tools/src/mcp` 只新增 `McpProviderAdapter`、registry、installer。
- `packages/adapters/src/mcp/<provider>/` 实现 MiniMax、智谱等具体 MCP provider / MCP skill adapter。
- 应用 composition root 显式导入 adapter 并注册。

优点：

- 最符合仓库第三方依赖边界规范。
- `packages/tools` 保持供应商无关，只提供平台 contract。
- 后续智谱、MiniMax、内部 MCP provider 与社区 MCP skills 都能独立演进。

缺点：

- 首轮需要跨 `packages/tools` 与 `packages/adapters`。
- 需要检查 `packages/adapters` 当前导出边界，避免引入新的依赖环。

适用场景：

- 推荐作为正式方案。若本轮要“可持续接入多个 MCP provider / MCP skills”，应选这个方案。

### 方案 D：引入完整 MCP Marketplace / Connector 安装模型

做法：

- provider descriptor、安装表单 schema、secret binding、policy template、health check、capability approval template 全部平台化。
- `agent-admin` Connector & Policy Center 直接使用这套模型做安装、启停、授权、观测。

优点：

- 平台化最完整，适合大量 MCP provider。
- 治理、审计、审批、secret 管理和 UI 能一次性打通。

缺点：

- 工作量最大，容易把“支持 MiniMax MCP”扩大成完整 marketplace 项目。
- 如果没有同时推进前后端，容易留下半成品配置层。

适用场景：

- 已确定要做 MCP provider 市场、组织级连接器治理、可视化安装流程时再选。

## 9. 已采用方案

已采用方案 C：`packages/tools` 只提供 MCP provider contract 与安装注册机制，所有具体 MCP skills / provider 适配都落在 `packages/adapters`。

1. `packages/tools/src/mcp` 已新增 MCP skill provider 接口、registry 和 installer。
2. MiniMax provider 实现已放在 `packages/adapters/src/mcp/minimax/`。
3. Zhipu provider 实现已放在 `packages/adapters/src/mcp/zhipu/`。
4. 应用启动层后续只需注册 provider，读取 secret / profile / region，生成 install plan。
5. 后续为 MiniMax / Zhipu SSE 或 streamable HTTP 单独新增 transport，不把 SSE 混进当前 `HttpTransportHandler` 的 POST RPC 简化协议。

这个路径的收益是：首期能尽快支持 MiniMax，同时不把 MiniMax 特例写死进 `McpClientManager`，也不让供应商适配逻辑污染 `packages/tools`。

## 10. 首期任务拆分建议

### 10.1 Contract 与 registry

- 新增 `packages/tools/src/mcp/mcp-provider-types.ts`。
- 新增 `packages/tools/src/mcp/mcp-provider-registry.ts`。
- 新增 `packages/tools/src/mcp/mcp-provider-installer.ts`。
- 从 `@agent/tools` 根入口显式导出 provider contract。

### 10.2 MiniMax adapter

落点：`packages/adapters/src/mcp/minimax/`。

- 新增 `createMiniMaxMcpProvider()`。
- 校验 `MINIMAX_API_KEY` 必填。
- 校验 `MINIMAX_API_HOST` 与 region 匹配；默认 global 使用 `https://api.minimax.io`，mainland 使用 `https://api.minimaxi.com`。
- 默认 `MINIMAX_API_RESOURCE_MODE=url`，避免 server 将媒体写到不可控路径；如果使用 `local`，必须要求 `basePath`。
- 生成 stdio server definition：`command=uvx`，`args=['minimax-mcp', '-y']`。
- 静态登记 MiniMax 官方工具的项目侧风险等级。

### 10.3 治理与审批

- `voice_clone` 默认 `critical + requiresApproval=true`。
- 生成音频、图片、视频、音乐类工具默认至少 `high/medium + requiresApproval=true`。
- 查询类工具默认 `low + requiresApproval=false`。
- 所有 MiniMax action capability 的 `writeScope` 标记为 `external-billing-and-content-generation` 或更细粒度枚举。

### 10.4 测试

- Provider validate：缺少 API key 时失败。
- Provider install plan：global/mainland host 映射正确。
- Capability policy：MiniMax 高风险 capability 默认需要审批。
- Installer：provider install plan 能注册进 `McpServerRegistry` 与 `McpCapabilityRegistry`。
- Manager integration：注册 MiniMax stdio mock server 后能通过 `invokeCapability` 调用 `tools/call`。

### 10.5 文档

- 更新 `docs/packages/tools/README.md` 加入本设计文档。
- MiniMax 落地后更新 `docs/packages/tools/runtime-governance-and-sandbox.md`，说明 provider adapter 与 transport handler 的关系。
- 如果新增 `packages/adapters` 实现，同步更新 `docs/packages/adapters/README.md` 或对应 provider 文档。

## 11. 关键决策点

- provider 接口放哪里：建议接口在 `packages/tools`，实现优先在 `packages/adapters`。
- MiniMax 首期 transport：建议只承诺 `stdio`；SSE 作为后续独立 transport。
- discovery 是否自动注册能力：建议不自动注册，只用于观测；执行能力必须项目侧静态声明风险策略。
- secret 管理：provider adapter 只声明 secret requirements，不直接读取 `.env`；应用 composition root 注入。
- capability 命名：`capability.id` 使用 provider 前缀，如 `minimax:text_to_audio`；`toolName` 保持 MCP 原始工具名，便于 `tools/call`。

## 12. 迁移风险

- `McpServerDefinition['transport']` 当前只允许 `local-adapter | stdio | http`；如果要支持 MiniMax SSE，需要扩展类型与新增 transport handler。
- 当前 `HttpTransportHandler` 是简化 POST JSON-RPC 调用，并不等同于 MCP SSE；不要直接把 `transport: 'http'` 当作 SSE 使用。
- provider adapter 不应返回 vendor SDK response；所有执行结果仍必须归一到 `ToolExecutionResult`。
- MiniMax 生成类能力会产生外部计费与内容安全风险，默认不能绕过审批。
- `uvx` 是否存在属于部署环境能力，provider validate 只能校验配置；运行时健康检查需要通过 discovery 或启动失败结果反馈。

## 13. 建议选择

如果目标是“现在支持 MiniMax MCP，并为智谱、Figma 等后续 provider / MCP skills 留好接口”，当前已经选择方案 C：

- `@agent/tools` 暴露 `McpSkillProviderAdapter`、`McpSkillProviderRegistry` 与 `installMcpSkillProvider()`。
- `@agent/adapters` 暴露 `registerDefaultMcpSkillProviders(registry)`，以结构化兼容方式注册默认 adapters，避免让 `@agent/adapters` 反向依赖 `@agent/tools` 并形成包环。
- MiniMax adapter 放在 `packages/adapters/src/mcp/minimax/`，只产出标准 server/capability，不改 `McpClientManager` 主流程。
- Zhipu adapter 放在 `packages/adapters/src/mcp/zhipu/`，覆盖联网搜索、网页读取、开源仓库读取和视觉理解 MCP。
- Figma 等后续 MCP skills 按同一接口新增 provider adapter。
- 后续再补 SSE transport 与 Connector & Policy Center 安装 UI。

这样可以最小化首期风险，同时避免把 MiniMax 写成一次性特例。
