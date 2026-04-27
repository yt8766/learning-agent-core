# tools 包交接文档

状态：current
文档类型：guide
适用范围：`packages/tools`
最后核对：2026-04-26

## 包定位

`packages/tools` 是 tool definition、registry、executor、sandbox、approval preflight 与 MCP transport 的真实宿主。

## 当前主要目录

- `src/definitions/`
- `src/registry/`
- `src/executors/`
- `src/sandbox/`
- `src/approval/`
- `src/auto-review/`
- `src/command/`
- `src/mcp/`
- `src/agent-surface/`
- `src/transports/`

## 修改前先读

- [docs/packages/tools/README.md](/docs/packages/tools/README.md)
- [docs/packages/tools/package-structure-guidelines.md](/docs/packages/tools/package-structure-guidelines.md)
- [docs/packages/tools/runtime-governance-and-sandbox.md](/docs/packages/tools/runtime-governance-and-sandbox.md)

## 改动边界

- 这里负责工具能力与执行治理，不负责 agent route、chat 主流程或 review 主流程。
- executor、sandbox、approval rule 应保持明确边界，不要做成一个万能入口。
- 涉及文件系统操作时，默认优先 `fs-extra`，并注意审批与安全约束。
- sandbox provider 只能暴露项目自定义的稳定 `ToolExecutionResult` 语义。Docker runner、local process spawn 或宿主错误必须归一为稳定错误摘要，例如 `sandbox_provider_error`，不得把原始 `Error`、vendor response 或 host object 穿透到根入口、业务层或公共 contract。
- `LocalSandboxExecutor` 不允许用 `ok: true` 伪造未知工具执行成功；未知工具必须返回稳定失败摘要，例如 `unsupported_tool`。网络、浏览器或截图占位可以保留安全 placeholder，但 raw output 只能包含脱敏摘要与明确的 `simulated` / `placeholder` 标记，不能回显 headers、body、secret 或把文本占位伪装成真实截图。
- `packages/tools/src/index.ts` 只导出稳定能力入口；内部归一化 helper、provider 私有实现细节和第三方对象不能从根入口泄漏。

## 验证

- `pnpm exec tsc -p packages/tools/tsconfig.json --noEmit`
- `pnpm --dir packages/tools test`
- `pnpm --dir packages/tools test:integration`

## 交接提醒

- 工具层改动风险常常体现在权限、审批和 side effect，不只是类型通过就够了。
