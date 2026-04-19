# tools 包交接文档

状态：current
文档类型：guide
适用范围：`packages/tools`
最后核对：2026-04-19

## 包定位

`packages/tools` 是 tool definition、registry、executor、sandbox、approval preflight 与 MCP transport 的真实宿主。

## 当前主要目录

- `src/definitions/`
- `src/registry/`
- `src/executors/`
- `src/sandbox/`
- `src/approval/`
- `src/mcp/`
- `src/transports/`

## 修改前先读

- [docs/tools/README.md](/Users/dev/Desktop/learning-agent-core/docs/tools/README.md)
- [docs/tools/package-structure-guidelines.md](/Users/dev/Desktop/learning-agent-core/docs/tools/package-structure-guidelines.md)
- [docs/tools/runtime-governance-and-sandbox.md](/Users/dev/Desktop/learning-agent-core/docs/tools/runtime-governance-and-sandbox.md)

## 改动边界

- 这里负责工具能力与执行治理，不负责 agent route、chat 主流程或 review 主流程。
- executor、sandbox、approval rule 应保持明确边界，不要做成一个万能入口。
- 涉及文件系统操作时，默认优先 `fs-extra`，并注意审批与安全约束。

## 验证

- `pnpm exec tsc -p packages/tools/tsconfig.json --noEmit`
- `pnpm --dir packages/tools test`
- `pnpm --dir packages/tools test:integration`

## 交接提醒

- 工具层改动风险常常体现在权限、审批和 side effect，不只是类型通过就够了。
