# MCP Skill Providers

状态：current
文档类型：reference
适用范围：`packages/adapters/src/mcp`、`packages/tools/src/mcp`
最后核对：2026-04-23

## 1. 当前结论

MCP skills / provider 的边界已经拆成两层：

- `@agent/tools` 提供稳定扩展接口、provider registry、安装器、server registry、capability registry 与 transport runtime。
- `@agent/adapters` 提供具体 MCP skill provider 实现，默认宿主是 `packages/adapters/src/mcp/<provider>/`。

这意味着 MiniMax、智谱、Figma、内部工具或社区 MCP server 都不应长期写进 `packages/tools`。`packages/tools` 只认识标准 `McpSkillProviderAdapter`，不认识具体供应商品牌。

## 2. 当前默认实现

`@agent/adapters` 当前提供两个内置 MCP skill provider：

- `createMiniMaxMcpSkillProvider()`
  - 默认 server：`minimax-mcp`
  - 默认 transport：`stdio`
  - 默认命令：`uvx minimax-mcp -y`
  - secret：`MINIMAX_API_KEY`
  - 能力：音频、声音列表、声音克隆、视频、图片、视频任务查询、音乐、voice design
- `createZhipuMcpSkillProvider()`
  - 默认 remote servers：`zhipu-web-search-prime`、`zhipu-web-reader`、`zhipu-zread`
  - 默认 local server：`zhipu-vision`
  - secret：`Z_AI_API_KEY`
  - 能力：联网搜索、网页读取、开源仓库读取、视觉理解

`registerDefaultMcpSkillProviders(registry)` 会把 MiniMax 与 Zhipu 注册为内置 provider，应用装配层可继续追加 Figma 等开发者自定义 provider。该函数只要求传入对象具备 `register(provider)` 方法，因此 `@agent/adapters` 不需要反向依赖 `@agent/tools`，不会引入 `adapters -> tools -> memory -> adapters` 包环。

## 3. 开发者扩展示例

新增 Figma MCP 时，不需要改 `McpClientManager`。开发者只需实现 `McpSkillProviderAdapter`：

```ts
import type { McpSkillProviderAdapter } from '@agent/tools';

export function createFigmaMcpSkillProvider(): McpSkillProviderAdapter {
  return {
    descriptor: {
      id: 'figma',
      displayName: 'Figma MCP',
      description: 'Design context MCP skills for Figma files.',
      builtIn: false,
      trustClass: 'community',
      supportedTransports: ['stdio'],
      skillIds: ['figma:get_file']
    },
    secretRequirements: [{ key: 'FIGMA_TOKEN', label: 'Figma token', required: true, sensitive: true }],
    validate(input) {
      return input.secrets.FIGMA_TOKEN ? { ok: true } : { ok: false, errors: ['missing_FIGMA_TOKEN'] };
    },
    buildInstallPlan(input) {
      return {
        servers: [
          {
            id: input.serverId ?? 'figma-mcp',
            displayName: 'Figma MCP',
            transport: 'stdio',
            command: 'npx',
            args: ['-y', 'figma-mcp'],
            env: { FIGMA_TOKEN: input.secrets.FIGMA_TOKEN ?? '' },
            enabled: input.enabled ?? true,
            source: 'figma',
            trustClass: 'community'
          }
        ],
        capabilities: [
          {
            id: 'figma:get_file',
            toolName: 'get_file',
            serverId: input.serverId ?? 'figma-mcp',
            displayName: 'Read a Figma file',
            riskLevel: 'medium',
            requiresApproval: true,
            category: 'knowledge'
          }
        ],
        warnings: []
      };
    }
  };
}
```

应用装配层负责把 provider 注册进 `McpSkillProviderRegistry`，再调用 `installMcpSkillProvider()` 将安装计划写入 `McpServerRegistry` 与 `McpCapabilityRegistry`。

## 4. 设计原则

- Provider adapter 只生成安装计划，不直接执行 MCP tool call。
- 执行仍统一经过 `McpClientManager` 与 transport handler。
- 远端 `tools/list` discovery 只用于观测，不自动提升为可执行 capability。
- 每个 capability 必须显式登记风险等级、审批要求、数据范围和写入范围。
- Secret 只通过 install input 注入，adapter 不直接读取 `.env`。
- `stdio` 与当前简化 `http` 已可复用；`sse` / `streamable-http` 需要后续独立 transport 支持。

## 5. 参考资料

- [MiniMax MCP Guide](https://platform.minimax.io/docs/guides/mcp-guide)
- [MiniMax-AI/MiniMax-MCP](https://github.com/minimax-ai/minimax-mcp)
- [智谱视觉理解 MCP](https://docs.bigmodel.cn/cn/coding-plan/mcp/vision-mcp-server)
- [智谱联网搜索 MCP](https://docs.bigmodel.cn/cn/coding-plan/mcp/search-mcp-server)
- [智谱网页读取 MCP](https://docs.bigmodel.cn/cn/coding-plan/mcp/reader-mcp-server)
- [智谱开源仓库 MCP](https://docs.bigmodel.cn/cn/coding-plan/mcp/zread-mcp-server)
