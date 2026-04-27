# Sandbox API

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-chat`、`apps/frontend/agent-admin`、`packages/runtime`、`packages/tools`
最后核对：2026-04-26

本文记录 sandbox profile、执行限制、运行状态投影、SSE 事件、错误语义与前后端职责。工具执行入口见 [Agent Tool Execution API](/docs/contracts/api/tool-execution.md)。

开发入口速查：

- 后端主入口：`apps/backend/agent-server/src/sandbox/*`
- Agent Tool 接线入口：`apps/backend/agent-server/src/agent-tools/*` 在 request 创建后调用 sandbox preflight，并在审批恢复时同步恢复关联 sandbox run
- 前端消费：`apps/frontend/agent-admin` sandbox API facade；`apps/frontend/agent-chat` 通过 agent-tools projection、SSE 与 checkpoint 读取 sandbox 状态
- Contract 回归：sandbox service/controller/repository 测试与 `test/integration/frontend-backend/sse-payload-contract.int-spec.ts`

## 目的

Sandbox 是工具执行的安全边界，不是独立聊天能力。它负责把文件系统、终端、浏览器、网络、scaffold、MCP fallback 等能力收束到可审计的限制配置里。

本阶段目标：

- 后端在工具执行前明确 sandbox profile、权限范围和风险等级。
- 前端能展示 sandbox 当前阶段、尝试次数、判定和阻断原因。
- 高风险或越权动作进入 approval resume，不由具体工具临时拼接审批字段。
- 错误响应不泄漏宿主机绝对敏感路径、第三方 executor 原始错误或未脱敏命令参数。

## 当前实现状态

已落地的最小闭环：

- 后端入口：`apps/backend/agent-server/src/sandbox/*`，Nest controller 使用 `@Controller('sandbox')`，经全局 `api` prefix 后暴露为 `/api/sandbox/*`。
- 后端当前使用 in-memory repository 保存 `SandboxRunRecord`，并提供 `exportSnapshot()` / `restoreSnapshot()` 作为后续替换持久化的边界；snapshot 只暴露 `{ runs: SandboxRunRecord[] }`，restore 会先 parse 完整 snapshot 再替换内部状态，避免非法 snapshot 清空当前数据。
- `GET /api/sandbox/profiles` 已返回文档核心 profile 的安全摘要，包括只读、workspace write、network restricted、browser automation、release ops、host 与 danger-full-access。
- `POST /api/sandbox/preflight` 已按 profile、risk class、denied paths 与 denied commands 做最小策略判定：`host`、`danger-full-access`、`release-ops`、`high` 与 `critical` 风险进入 `require_approval`；命中 denied path / command 直接 `deny`；其他计划返回 `allow`。
- `POST /api/sandbox/execute` 已通过 `@agent/tools` 的 `SandboxProviderRegistry` 执行受控命令；默认注册 `LocalProcessSandboxProvider` 与 `SimulatedSandboxProvider`，只把 `readonly`、`read-only`、`workspace-readonly` 映射为 provider `readonly`，把 `verification` 映射为 provider `verification`。service 不直接 `spawn`。
- execute 结果会保存为 `SandboxRunRecord`，`stage` 为 `execution`，provider 成功为 `status: "passed"` / `verdict: "allow"`，provider 或策略拒绝为 `status: "failed"` / `verdict: "block"`；`host`、`danger-full-access`、`release-ops` 等高风险 profile 仍返回 `blocked` run 与 approval projection，不会调用 provider。
- execute `outputPreview` 只使用 provider `outputSummary` 或策略摘要；`metadata` 只保留安全白名单摘要，例如调用方安全标记、`providerId`、`exitCode`、`durationMs`、`errorMessage`、approval projection，不保存 provider `rawOutput`、stdout/stderr、raw input/output、vendor payload 或完整命令。
- `GET /api/sandbox/runs/:runId`、`cancel` 与 `approval` 已覆盖状态查询、终态冲突、审批 approve / bypass / reject / abort / feedback / input 的最小状态流。
- `/api/agent-tools/requests` 已在 request 创建后调用 sandbox preflight，并把 `sandboxRunId`、`sandboxDecision`、`sandboxProfile` 写入 execution request metadata；sandbox `require_approval` 会复用 agent-tools 审批入口等待恢复，`approve` / `bypass` 恢复时会同步调用 `/api/sandbox/runs/:runId/approval` 对应 service 方法。
- `agent-admin` 已提供 sandbox API facade：`listSandboxProfiles`、`preflightSandboxRun`、`getSandboxRun`、`cancelSandboxRun`、`resumeSandboxRunApproval`；前端 helper 会做最小 contract 校验并保留上游请求错误。

仍未落地的部分：

- sandbox run 真实落盘、checkpoint / SSE 广播、Runtime 主链直接接线、Admin/Chat 展示补拉仍需后续推进。
- 当前 facade 是治理协议入口和 contract 回归入口；`agent-tools` HTTP facade 已最小接入 preflight，但 chat/runtime 内部旧工具链仍需后续迁移到同一稳定边界。

与 tool-execution / auto-review 的职责边界：

- sandbox 是工具执行安全边界，默认由 agent-tools 在 request 执行前调用；直接调用 `/api/sandbox/*` 只用于治理、预检、受控命令执行和 contract 回归。
- sandbox `require_approval` 进入 agent-tools 的统一审批恢复链路，避免各工具自定义恢复 payload。
- sandbox 允许且 request 仍可执行时，agent-tools 才进入 auto-review；sandbox `deny` 不应再创建自动审查。
- 写入 agent-tools SSE / projection 的 sandbox 信息只允许使用 `sandboxRunId`、`sandboxDecision`、`sandboxProfile`、`reasonCode` 等治理摘要，不得写入未脱敏命令、raw output、敏感路径或 provider 原始 payload。

## Profile 与权限模型

Sandbox profile 是策略输入，不是前端可随意写入的执行权限。

当前文档约定的 profile 覆盖工具层已有 profile 与 sandbox provider profile。`profile` 是治理语义；provider 还可以在内部映射出 `mode`、network 和 writable root 等执行参数。

| profile              | 说明                                                                |
| -------------------- | ------------------------------------------------------------------- |
| `readonly`           | 工具层只读 profile；可读取受控 workspace 或 memory 投影。           |
| `read-only`          | sandbox provider 只读 profile；等价于只读 mode，禁止写入。          |
| `verification`       | sandbox provider 校验 profile；只允许测试、类型检查等安全校验命令。 |
| `workspace-readonly` | 只读 workspace 文件，禁止写入、删除和外部网络。                     |
| `workspace-write`    | 可在允许路径写入 workspace，禁止越过 denied paths。                 |
| `network-restricted` | 只允许访问 allowlist host；默认不开放任意公网。                     |
| `network-enabled`    | sandbox provider 网络开放 profile；必须通过 policy 明确授权和审计。 |
| `browser-automation` | 受控浏览器自动化；不得读取用户个人浏览器 profile。                  |
| `release-ops`        | 发布、CI 或远端操作，高风险，默认需要审批。                         |
| `host`               | 宿主级执行，仅限管理员明确授权和审计链路。                          |
| `danger-full-access` | sandbox provider 全权限 profile；治理语义等同高风险宿主级执行。     |

兼容要求：

- `readonly` 与 `read-only` 都表示只读执行能力；新 provider 接线优先输出 `read-only`，工具层历史入口可继续接收 `readonly`。
- `workspace-write` 是工具层和 provider 层共享的稳定 profile，不得在文档、schema 或 UI 中拆成不同含义。
- `host` 与 `danger-full-access` 都必须进入高风险审批和审计链路；不得作为前端可自行选择的普通执行模式。

## 当前 Provider 实现

`packages/tools` 当前提供三类 provider：

| provider        | profile                                       | capability | 状态                                               |
| --------------- | --------------------------------------------- | ---------- | -------------------------------------------------- |
| `simulated`     | `readonly`、`verification`                    | `command`  | 测试和无副作用演示用途。                           |
| `local-process` | `readonly`、`verification`                    | `command`  | 本地安全子集，使用 argv 执行，不经 host shell。    |
| `docker`        | `readonly`、`verification`、`workspace-write` | `command`  | Docker 容器执行，默认 image 可配置，默认禁用网络。 |

Docker provider 约束：

- 默认 image 为 `node:20-alpine`，调用方可在 provider options 中替换。
- `readonly` 与 `verification` 使用只读 workspace mount；`workspace-write` 使用可写 workspace mount。
- 默认 `SandboxPolicy` 仍只允许 `readonly` 和 `verification`；启用 `workspace-write` 必须显式传入允许该 profile 的 policy。
- host 侧使用 `spawn(docker, args, { shell: false })`，并暴露 command plan builder / runner 注入，方便在无 Docker 环境测试。
- 当前容器内仍通过 `sh -lc <command>` 执行命令字符串；后续若要更强隔离，应把工具调用收敛为 semantic command 或容器内 argv 计划。

权限范围使用 `ExecutionPermissionScope` 语义：

```ts
{
  workspaceRoot?: string;
  allowedPaths?: string[];
  deniedPaths?: string[];
  allowedHosts?: string[];
  deniedHosts?: string[];
  allowedCommands?: string[];
  deniedCommands?: string[];
}
```

## REST Endpoints

| 方法   | 地址                                | 参数                                                                                                                 | 返回值                     | 说明                                      |
| ------ | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------- | ----------------------------------------- |
| `GET`  | `/api/sandbox/profiles`             | 无                                                                                                                   | `SandboxProfileRecord[]`   | 获取当前可见 sandbox profile 与限制摘要。 |
| `POST` | `/api/sandbox/preflight`            | body: `SandboxPreflightRequest`                                                                                      | `SandboxPreflightResponse` | 对一次计划执行做权限、风险和审批预检。    |
| `POST` | `/api/sandbox/execute`              | body: `SandboxExecuteCommandRequest`                                                                                 | `SandboxRunRecord`         | 通过稳定 sandbox provider 边界执行命令。  |
| `GET`  | `/api/sandbox/runs/:runId`          | path: `runId`                                                                                                        | `SandboxRunRecord`         | 获取 sandbox run 状态投影。               |
| `POST` | `/api/sandbox/runs/:runId/cancel`   | path: `runId`; body: `{ sessionId?: string; taskId?: string; actor?: string; reason?: string }`                      | `SandboxRunRecord`         | 取消 sandbox run。                        |
| `POST` | `/api/sandbox/runs/:runId/approval` | path: `runId`; body: `{ sessionId: string; interrupt: SandboxApprovalResumeInput; actor?: string; reason?: string }` | `SandboxRunRecord`         | 审批恢复 sandbox run。                    |

`/api/sandbox/*` 面向治理、预检和投影。真实工具执行仍通过 [Agent Tool Execution API](/docs/contracts/api/tool-execution.md) 创建 request。

`/api/sandbox/execute` 是后端 sandbox 命令执行服务边界，用于受控命令执行和 contract 回归；业务工具链仍应优先通过 tool execution API 进入治理流程。

## Request Schema

`SandboxPreflightRequest`：

```ts
{
  sessionId?: string;
  taskId: string;
  requestId?: string;
  toolName: string;
  profile: string;
  riskClass?: "low" | "medium" | "high" | "critical";
  commandPreview?: string;
  inputPreview?: string;
  permissionScope?: {
    workspaceRoot?: string;
    allowedPaths?: string[];
    deniedPaths?: string[];
    allowedHosts?: string[];
    deniedHosts?: string[];
    allowedCommands?: string[];
    deniedCommands?: string[];
  };
  metadata?: Record<string, unknown>;
}
```

`SandboxPreflightResponse`：

```ts
{
  decision: "allow" | "require_approval" | "deny";
  reasonCode: string;
  reason: string;
  profile: string;
  normalizedPermissionScope: ExecutionPermissionScope;
  requiresApproval: boolean;
  approval?: {
    approvalId: string;
    interruptId: string;
    resumeEndpoint: "/api/sandbox/runs/:runId/approval" | "/api/agent-tools/requests/:requestId/approval";
  };
}
```

`SandboxExecuteCommandRequest`：

```ts
{
  sessionId?: string;
  taskId: string;
  requestId?: string;
  command: string;
  profile: string;
  cwd: string;
  timeoutMs?: number;
  permissionScope?: {
    workspaceRoot?: string;
    allowedPaths?: string[];
    deniedPaths?: string[];
    allowedHosts?: string[];
    deniedHosts?: string[];
    allowedCommands?: string[];
    deniedCommands?: string[];
  };
  metadata?: Record<string, unknown>;
}
```

execute 兼容与安全规则：

- `readonly`、`read-only`、`workspace-readonly` 归一到 provider `readonly`；`verification` 归一到 provider `verification`。
- 默认策略只允许 `readonly` 与 `verification` provider profile；`workspace-write` 若未配置可接受 provider，会返回 `failed` / `block` run，而不是回退到 host shell。
- 命中 denied path / denied command、shell operator 或 provider policy deny 时，返回 `failed` / `block` run。
- `host`、`danger-full-access`、`release-ops` 和 profile 自带 `requiresApproval` 的执行请求返回 `blocked` / `block` run，并在 metadata 中提供 `approvalId`、`interruptId` 与 `resumeEndpoint`，不执行 provider。

`SandboxRunRecord`：

```ts
{
  runId: string;
  requestId?: string;
  taskId: string;
  sessionId?: string;
  profile: string;
  stage: "preflight" | "prepare" | "execute" | "execution" | "verify" | "cleanup";
  status: "pending" | "running" | "passed" | "failed" | "blocked" | "cancelled" | "exhausted";
  attempt: number;
  maxAttempts: number;
  verdict?: "allow" | "warn" | "block" | "unknown";
  exhaustedReason?: string;
  outputPreview?: string;
  evidenceIds?: string[];
  artifactIds?: string[];
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}
```

## SSE Events

Sandbox 状态通过 chat SSE 与 runtime checkpoint 同步。数据帧仍为 `ChatEventRecord`。

| 事件类型                   | payload 关键字段                                                                                        | 说明                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------- |
| `execution_step_started`   | `{ requestId?: string; runId?: string; stage: "preflight" \| "prepare" \| "execute" \| "verify" }`      | sandbox 阶段开始。         |
| `execution_step_completed` | `{ requestId?: string; runId?: string; stage: string; status: string; verdict?: string }`               | sandbox 阶段完成。         |
| `execution_step_blocked`   | `{ requestId?: string; runId?: string; reasonCode: string; approvalId?: string; interruptId?: string }` | sandbox 因策略或权限阻断。 |
| `interrupt_pending`        | `{ interruptId: string; kind: "tool_execution"; requestId?: string; runId?: string }`                   | sandbox 触发审批等待。     |
| `interrupt_resumed`        | `{ interruptId: string; kind: "tool_execution"; requestId?: string; runId?: string; action: string }`   | 审批恢复。                 |

Checkpoint 中的 `sandboxState` 用于断流兜底，前端至少识别：

```ts
{
  node: "sandbox";
  stage: string;
  status: string;
  attempt: number;
  maxAttempts: number;
  verdict?: string;
  exhaustedReason?: string;
}
```

## Approval Resume Payload

`SandboxApprovalResumeInput`：

```ts
{
  interruptId?: string;
  action: "approve" | "reject" | "feedback" | "input" | "bypass" | "abort";
  runId?: string;
  requestId?: string;
  approvalId?: string;
  feedback?: string;
  value?: string;
  payload?: {
    profileOverride?: string;
    permissionScopePatch?: Partial<ExecutionPermissionScope>;
    maxAttemptsOverride?: number;
    approvalScope?: "once" | "session" | "always";
    reasonCode?: string;
    [key: string]: unknown;
  };
}
```

恢复规则：

- `approve`：允许本次 sandbox run 继续；如有 `permissionScopePatch`，后端必须重新做规范化和审计。
- `reject`：拒绝本次 run，对应工具 request 不得继续执行。
- `feedback`：把反馈写入 interrupt history，并交由 Runtime / Supervisor 调整方案。
- `input`：补充缺失路径、命令、host 或参数，后端必须重新 preflight。
- `bypass`：只允许治理权限 actor 使用，且不能越过强制 denied paths、denied commands 或用户浏览器数据保护。
- `abort`：取消 run，并将相关 request 收口到 `cancelled`。

## Error Semantics

| 错误码                         | 建议 HTTP 状态 | 语义                                                                                    |
| ------------------------------ | -------------- | --------------------------------------------------------------------------------------- |
| `sandbox_profile_not_found`    | `404`          | 指定 profile 不存在或当前调用方不可见。                                                 |
| `sandbox_preflight_invalid`    | `400`          | preflight 请求体无效、空 route run id、空 session/task id、路径/host/command 格式非法。 |
| `sandbox_policy_denied`        | `403`          | sandbox 策略拒绝本次执行。                                                              |
| `sandbox_approval_required`    | `409`          | 当前执行需要审批后才能继续。                                                            |
| `sandbox_run_not_found`        | `404`          | 指定 run 不存在或不可见。                                                               |
| `sandbox_run_conflict`         | `409`          | run 已终态、重复恢复、重复取消或状态游标过期。                                          |
| `sandbox_executor_unavailable` | `503`          | 本地 sandbox、远端 sandbox 或 transport 不可用。                                        |
| `sandbox_execution_failed`     | `500`          | 执行失败；返回脱敏摘要和可追踪 id。                                                     |

所有错误响应都使用统一 error envelope，并优先附带 `runId`、`requestId`、`taskId`、`profile`、`reasonCode`。审批恢复时 path `runId`、body interrupt `approvalId` 与已存在 run 的 approval 必须对齐；不一致返回稳定错误，不得静默恢复其他 run。

## 前后端职责

后端负责：

- 统一解析 profile、permission scope、risk class 与 policy decision。
- 对路径、host、command 做规范化、allow/deny 判定和敏感信息脱敏。
- 写入 sandbox run、checkpoint `sandboxState`、SSE 事件和 observability projection。
- 禁止访问用户个人浏览器 profile、登录态、cookie、local storage、indexedDB 和站点缓存。

`agent-chat` 负责：

- 展示 sandbox 阶段、尝试次数、verdict、阻断原因和审批卡。
- 使用 interrupt resume payload 恢复，不直接扩权执行。
- 断流后以 checkpoint `sandboxState` 校准 UI。

`agent-admin` 负责：

- 展示 profile、permission scope、run 历史、失败原因和健康状态。
- 对 `release-ops`、`host`、`network-restricted` 等高风险 profile 提供明确审计上下文。
- 不允许把 sandbox profile 编辑成绕过 policy 的前端开关。

## Compatibility Rules

- 新增 profile 必须先写入本文、真实宿主 schema 或配置来源，并补 parse / policy 回归；不得只在 provider、工具 skeleton 或前端展示层单独新增。
- 旧 `sandboxState.status` 字符串可被前端宽松展示，但新状态必须向本文枚举收敛。
- `bypass` 不是通用恢复动作，必须受权限和审计保护。
- sandbox API 不替代 tool execution API；它只负责预检、限制和状态投影。
- 不允许把第三方 executor 原始错误、未脱敏命令、敏感路径或浏览器 profile 数据写入前端 payload。
