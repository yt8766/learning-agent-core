# Unified Agent Server Design

状态：draft
文档类型：spec
适用范围：`apps/backend/agent-server`、`apps/backend/auth-server`、`apps/backend/knowledge-server`、`docs/contracts/api/**`、`docs/integration/frontend-backend-integration.md`
最后核对：2026-05-07

## 1. 目标

将当前三个后端服务合并为一个后端服务：

- `apps/backend/agent-server` 成为唯一后端 API Host。
- `apps/backend/auth-server` 的统一登录、JWT、refresh rotation、用户管理能力迁入 `agent-server`。
- `apps/backend/knowledge-server` 的 frontend-facing knowledge API、RAG、上传、设置、eval、provider health 能力迁入 `agent-server`。
- 合并后用统一 Identity 体系承载用户、角色与权限域。
- 旧 API 路径保留 thin alias 作为迁移兼容，新开发使用合并后的规范路径。
- 修复当前后端体检发现的高风险点：平台治理接口鉴权缺失、DTO 运行时校验不一致、默认 Postgres 连接和 `synchronize` 风险、remote skill install 外部命令边界偏宽、Runtime Centers facade 过度动态绑定。

本设计只定义结构、边界和迁移阶段。实现应按后续 implementation plan 分阶段推进，每阶段保持服务可运行。

## 2. 非目标

- 不把 runtime 主链、agent graph、prompt、节点编排迁入 backend app；`packages/runtime` 和 `agents/*` 仍是真实宿主。
- 不新增第二个 shared 包，也不恢复 `packages/shared`。
- 不让 controller 直接访问 DB、执行 shell、读取 vendor payload 或实现业务规则。
- 不在本次设计中改变 `agent-chat` 的核心 SSE 路径；`/api/chat/stream` 与 `/api/chat/view-stream` 继续稳定。
- 不通过 `git worktree` 做并行迁移。

## 3. 总体架构

合并后的 `agent-server` 是平台统一 API Host + BFF + Composition Root。它可以装配 runtime、暴露 HTTP/SSE、适配 Nest 错误语义、聚合 admin response，但不作为稳定公共 contract、agent 主链或第三方 vendor 语义的宿主。

推荐目录：

```text
apps/backend/agent-server/src/
  app/
    app.module.ts
    app.bootstrap.ts
    app.config.ts
    app.persistence.ts

  api/
    identity/
      identity.controller.ts
      legacy-auth.controller.ts
      dto/
      schemas/
    knowledge/
      knowledge.controller.ts
      legacy-knowledge.controller.ts
      dto/
      schemas/
    chat/
      chat.controller.ts
      chat-stream.controller.ts
      chat-view-stream.controller.ts
      schemas/
    platform/
      runtime-center.controller.ts
      approvals-center.controller.ts
      learning-center.controller.ts
      evidence-center.controller.ts
      connector-policy-center.controller.ts
      skill-lab.controller.ts
      workspace-center.controller.ts
    tools/
      agent-tools.controller.ts
      sandbox.controller.ts
      auto-review.controller.ts
    workflow/
      workflow-runs.controller.ts
      company-live.controller.ts

  domains/
    identity/
      identity.module.ts
      services/
      repositories/
      policies/
      schemas/
      types/
      compat/
    knowledge/
      knowledge.module.ts
      services/
      repositories/
      rag/
      ingestion/
      storage/
      schemas/
      types/
      compat/
    chat/
      chat.module.ts
      services/
      streams/
      projections/
      schemas/
    runtime/
      runtime.module.ts
      host/
      centers/
      schedules/
      skills/
      connectors/
      workflow/
      schemas/
    governance/
      approvals/
      audit/
      policy/
      auto-review/
    tools/
      execution/
      sandbox/
      catalog/
    workflow/
      runs/
      dispatchers/
      facades/

  platform/
    centers/
      runtime/
      approvals/
      learning/
      evidence/
      connectors-policy/
      skill-lab/
      workspace/
    projections/
    exports/

  infrastructure/
    auth/
      guards/
      decorators/
      token-verifier.ts
      permission-evaluator.ts
    database/
      database.module.ts
      postgres.provider.ts
      postgres-health.service.ts
      migrations/
      schemas/
    config/
      env.schema.ts
      backend-config.service.ts
      cors.ts
      feature-flags.ts
    logger/
    storage/
      oss/
      memory/
    external-process/
      command-runner.ts
      command-policy.ts
      skills-cli-runner.ts
    workers/
      background-runner.ts
      ingestion-worker.ts

  shared/
    errors/
    pipes/
    pagination/
    time/
```

目录职责：

- `app/`：Nest composition root。只负责模块装配、全局 pipe/filter/guard、启动配置和生命周期。
- `api/`：HTTP/SSE 入口层。只做路由、参数解析、zod 校验、错误映射和旧路径 alias。
- `domains/`：backend 内部业务域。每个域通过 service/repository/policy/schema 明确边界。
- `platform/`：`agent-admin` 六大中心 BFF 聚合。只消费 domain/runtime facade，不放领域规则。
- `infrastructure/`：第三方、DB、OSS、外部命令、环境变量、worker adapter、logger 等边界层。
- `shared/`：仅限 backend-local 小工具。如果被多个 package 复用，后续提升到真实 `packages/*`。

## 4. API 路由与兼容

新规范路径：

```text
/api/identity/*
  登录、刷新、退出、当前用户、用户管理、权限查询

/api/knowledge/*
  知识库、文档、上传、RAG、检索、设置、eval、provider health

/api/chat/*
  agent-chat 会话、消息、SSE、view-stream、checkpoint、自然语言审批

/api/platform/*
  agent-admin 六大中心：runtime、approvals、learning、evidence、skill-lab、connector-policy

/api/tools/*
  tool execution、sandbox、auto-review、capability catalog

/api/workflows/*
  workflow runs、company-live、data-report-json、briefing force-run / feedback
```

旧路径 thin alias：

```text
旧 /api/auth/*              -> 新 /api/identity/*
旧 /api/admin/auth/*        -> 新 /api/identity/admin-compat/*
旧 /api/knowledge/v1/*      -> 新 /api/knowledge/*
旧 /api/agent-tools/*       -> 新 /api/tools/executions/*
旧 /api/sandbox/*           -> 新 /api/tools/sandbox/*
旧 /api/auto-review/*       -> 新 /api/tools/auto-review/*
旧 /api/workflow-runs/*     -> 新 /api/workflows/runs/*
旧 /api/company-live/*      -> 新 /api/workflows/company-live/*
旧 /api/platform/*          -> 保持稳定
旧 /api/chat/*              -> 保持稳定
```

兼容约束：

- Alias controller 必须薄，只做 route decoration 和调用同一个 domain service/facade。
- 新旧路径响应 schema 必须一致，除非 contract 明确标注 deprecated 差异。
- 旧路径在文档标注 `deprecated but supported`，并写明删除条件。
- 前端新开发只能调用新路径。
- `/api/chat/stream`、`/api/chat/view-stream` 优先保持稳定。

## 5. Identity 与权限域

合并后只保留一套 Identity 域。`auth-server` 的登录、JWT、refresh rotation、用户管理迁入 `domains/identity`。现有 `agent-server/admin-auth` 不再作为独立认证体系，只保留兼容 controller 和 mapper。

推荐目录：

```text
src/domains/identity/
  identity.module.ts
  services/
    identity-auth.service.ts
    identity-session.service.ts
    identity-user.service.ts
    identity-password.service.ts
  repositories/
    identity.repository.ts
    identity-postgres.repository.ts
    identity-memory.repository.ts
  policies/
    permission-policy.ts
    role-policy.ts
    route-permission.map.ts
  schemas/
    identity-auth.schemas.ts
    identity-user.schemas.ts
    identity-token.schemas.ts
  types/
    identity-principal.types.ts
  compat/
    admin-auth-compat.service.ts
    auth-server-compat.mapper.ts

src/infrastructure/auth/
  guards/
    access-token.guard.ts
    permission.guard.ts
    optional-auth.guard.ts
  decorators/
    current-principal.decorator.ts
    require-permission.decorator.ts
  token-verifier.ts
  permission-evaluator.ts
```

统一 principal：

```ts
type IdentityPrincipal = {
  userId: string;
  accountId?: string;
  roles: Array<'owner' | 'admin' | 'operator' | 'knowledge_member' | 'viewer'>;
  permissions: string[];
  authSource: 'identity';
};
```

权限域：

```text
identity:*          登录态、用户管理、密码、refresh session
runtime:*           runtime center、任务、调度、worker、运行观测
governance:*        approvals、policy、audit、connector enable/disable
knowledge:*         knowledge bases、documents、RAG、settings、eval
tools:*             tool execution、sandbox、auto-review
workflow:*          workflow runs、company-live、data-report、briefing
platform:read       agent-admin center 读权限
platform:write      agent-admin center 写权限
```

关键规则：

- 所有 `/api/platform/*` 写接口必须要求 `platform:write` 或更细权限。
- Connector enable/disable、policy change、skill install、remote skill install、sandbox approval、auto-review resume 必须要求 `governance:write` 或 `tools:approve`。
- Knowledge 普通用户只获得 `knowledge:*` 权限，不自动获得 runtime/platform 权限。
- Owner/admin 才能管理用户和全局 policy。
- SSE 可允许 authenticated read，但内部补拉接口不能裸奔。
- 旧 `/api/admin/auth/*` 返回字段保持兼容，但 token 由 Identity 签发。
- 旧 Knowledge token 如需兼容，应在 `compat/` 映射为 Identity principal，不维护第二套长期 token session。

## 6. 数据库、持久化与配置

合并后只有一套后端数据库配置。默认 local/test 可无 DB 启动；staging/prod 必须显式启用 Postgres。禁止非 test 默认连接 `localhost:5432`，禁止依赖 TypeORM `synchronize` 自动改表。

推荐配置：

```text
BACKEND_PERSISTENCE=memory | postgres
DATABASE_URL=postgres://...
BACKEND_RUN_MIGRATIONS=true | false
BACKEND_ENABLE_LEGACY_ROUTES=true | false
BACKEND_REMOTE_SKILL_INSTALL_ENABLED=false
BACKEND_BACKGROUND_ENABLED=true | false
```

默认值：

- local/test：`BACKEND_PERSISTENCE=memory`
- staging/prod：必须显式 `BACKEND_PERSISTENCE=postgres`
- `synchronize` 永远关闭
- migration 只在 `BACKEND_RUN_MIGRATIONS=true` 时执行
- prod 缺少 DB 或 migration 状态不对时 fail fast

Schema 合并：

```text
auth-server schema
  admin/users/password_credentials/refresh_sessions
  -> identity tables

knowledge-server schema
  knowledge_bases/documents/chunks/uploads/settings/traces/evals
  -> knowledge tables

agent-server schema
  workflow_runs
  runtime state/audit/schedules/skill receipts 后续逐步从 JSON 迁移
  -> runtime/governance tables
```

持久化边界：

- Repository 接口放在 `domains/<domain>/repositories/`。
- Postgres client/provider 放在 `infrastructure/database/`。
- Domain service 不直接读取 `process.env`。
- Controller 不碰 DB。
- JSON file store 只作为 local/dev 或迁移兼容，不作为生产唯一来源。

## 7. Knowledge 合并

`knowledge-server` 的 frontend-facing API 能力迁入 `domains/knowledge`，成为唯一 knowledge 业务宿主。

推荐目录：

```text
src/domains/knowledge/
  knowledge.module.ts
  services/
    knowledge-base.service.ts
    knowledge-document.service.ts
    knowledge-upload.service.ts
    knowledge-rag.service.ts
    knowledge-eval.service.ts
    knowledge-settings.service.ts
    knowledge-provider-health.service.ts
  repositories/
    knowledge.repository.ts
    knowledge-postgres.repository.ts
    knowledge-memory.repository.ts
    mappers/
  ingestion/
    ingestion.queue.ts
    ingestion.worker.ts
    ingestion-payload.adapter.ts
  rag/
    rag-sdk.facade.ts
    planner.provider.ts
    hyde.provider.ts
    rerank.provider.ts
    hallucination-detector.ts
  storage/
    object-storage.provider.ts
    aliyun-oss.provider.ts
    memory-storage.provider.ts
  schemas/
  types/
  compat/
```

规则：

- 现有 `agent-server/src/knowledge` legacy/runtime-internal 路径要么迁入 `domains/knowledge/compat`，要么删除。
- 不能长期保留 legacy knowledge 与新 knowledge 域双主实现。
- Knowledge 权限消费统一 Identity principal。
- RAG、ingestion、storage provider 都走 adapter/facade，不让 OSS、SDK、vendor response 穿透 controller。

## 8. Runtime、Platform 与 Workflow

`packages/runtime` 继续作为 runtime 主链真实宿主。`agent-server` 只保留 host、Nest wiring、admin BFF、context 注入、HTTP/SSE adapter。

推荐目录：

```text
src/domains/runtime/
  runtime.module.ts
  host/
    runtime.host.ts
    runtime-provider-factories.ts
  centers/
    query/
    governance/
    projections/
  skills/
  connectors/
  schedules/
  workflow/
```

规则：

- 当前 `RuntimeCentersService` 动态绑定应逐步改成显式 facade，或拆成 `RuntimeCentersQueryFacade` 与 `RuntimeCentersGovernanceFacade`。
- `api/platform/*` controller 只消费 facade，不直接读 orchestrator raw task dump。
- Daily Tech Intelligence Briefing 仍以 `agents/intel-engine` 为真实宿主；backend 只保留 force-run、feedback、runs 查询、权限审计和错误映射。
- `company-live`、`data-report-json` 等 workflow 仍通过 backend workflow composition facade 调用对应 `agents/*` 能力，不在 service/controller 内重建 graph。

## 9. Skill 安装与外部命令

Remote skill install 是治理后台的高风险供应链入口，必须从“裸 HTTP 触发外部命令”收紧为“审批、策略、受控 runner、审计”链路。

推荐目录：

```text
src/infrastructure/external-process/
  command-runner.ts
  command-policy.ts
  skills-cli-runner.ts

src/domains/runtime/skills/
  skill-source.service.ts
  skill-install.service.ts
  remote-skill-install.policy.ts
  skill-install-audit.service.ts
```

规则：

- 默认 `BACKEND_REMOTE_SKILL_INSTALL_ENABLED=false`。
- 远程 skill 安装必须先生成 receipt + approval，不允许 controller 直接触发安装。
- `shell.exec(commandString)` 改为 `execFile(binary, args)`。
- 子进程只传最小 env，不继承完整 `process.env`。
- repo 必须通过 allowlist/trust policy，至少区分 internal/official/curated/community/unverified。
- `skills check/update` 同样进入治理审计。
- 外部命令记录 command id、actor、approval id、stdout/stderr 摘要、exit code、duration，不记录 secret。

## 10. 实施阶段

### 阶段 1：统一后端骨架

- 建立 `app/api/domains/infrastructure/platform/shared` 目录。
- 调整 `main.ts` 为薄 bootstrap，把 route dump、CORS、全局 pipe/filter/guard 移到 `app/` 和 `infrastructure/`。
- 引入 zod validation pipe 和统一错误 filter。
- 不迁业务，只建立目录边界和测试骨架。

验证：

```bash
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/backend/agent-server turbo:test:unit
```

### 阶段 2：Identity 迁入

- 迁入 `auth-server/src/auth` 到 `domains/identity`。
- 新增 `/api/identity/*`。
- 旧 `/api/auth/*`、`/api/admin/auth/*` 走 alias。
- 平台写接口挂 `@RequirePermission`。
- 删除或标注旧 `admin-auth` 为 compat。

验证：

```bash
pnpm --dir apps/backend/agent-server turbo:test:unit -- identity
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

### 阶段 3：Knowledge 迁入

- 迁入 `knowledge-server/src/knowledge` 到 `domains/knowledge`。
- 新 `/api/knowledge/*` 承载 frontend-facing knowledge API。
- legacy `agent-server/src/knowledge` 去重：能合并就迁，不能立刻迁的放 `compat/` 并标注退出条件。
- 前端 knowledge 的 base URL 改向唯一后端。

验证：

```bash
pnpm --dir apps/backend/agent-server turbo:test:unit -- knowledge
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

### 阶段 4：治理与外部命令加固

- Platform 写接口补权限。
- `RuntimeCentersService` 动态绑定逐步显式化。
- Remote skill install 改为 approval + `execFile` + 最小 env。
- `BACKEND_REMOTE_SKILL_INSTALL_ENABLED=false` 默认关闭。
- Database 配置改为显式 `BACKEND_PERSISTENCE`。

验证：

```bash
pnpm --dir apps/backend/agent-server turbo:test:unit -- runtime skills platform
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

### 阶段 5：数据库和迁移收口

- 合并 auth / knowledge / workflow schema 到 `infrastructure/database/migrations`。
- 关闭 TypeORM synchronize。
- JSON store 标注 local/dev 或迁移兼容。
- 加 migration/schema 回归。

验证：

```bash
pnpm --dir apps/backend/agent-server turbo:test:unit -- persistence repository
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

### 阶段 6：删除旧 app 与文档收口

- 删除 `apps/backend/auth-server` 与 `apps/backend/knowledge-server`，或先归档为 deprecated 后再删。
- 更新根 scripts、turbo、pnpm workspace、docs/contracts/api、docs/integration。
- 清理所有“auth-server / knowledge-server canonical 服务”的旧描述。
- 同步更新 `pnpm-lock.yaml`。
- 最终只保留 `apps/backend/agent-server` 一个 backend app。

最终验证：

```bash
pnpm build:lib
pnpm --dir apps/backend/agent-server build
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/backend/agent-server test
pnpm check:docs
```

## 11. 文档更新与清理

必须更新：

- `docs/apps/backend/agent-server/agent-server-overview.md`
- `docs/apps/backend/agent-server/README.md`
- `docs/integration/frontend-backend-integration.md`
- `docs/contracts/api/identity.md`
- `docs/contracts/api/knowledge.md`
- `docs/contracts/api/agent-admin.md`
- `docs/contracts/api/tool-execution.md`

必须清理：

- 删除或改写 `auth-server`、`knowledge-server` 被描述为 canonical 独立服务的内容。
- 清理错误路径，例如旧 `knowledge/database/knowledge-schema.sql` 这类漂移说明。
- 所有 compat controller 必须在文档写清退出条件。

## 12. 测试要求

- Identity：login、refresh rotation、logout、current principal、role/permission policy、legacy route alias。
- Platform：所有写接口无 token 返回 401，无权限返回 403，有权限成功。
- Knowledge：repository contract、upload/storage adapter、RAG facade、legacy route alias、Identity principal 权限校验。
- Database：memory 默认、postgres opt-in、prod missing DB fail fast、migration schema 回归。
- External process：remote skill install 默认关闭、需要审批、使用 `execFile` args、最小 env、不记录 secret。
- Runtime centers：query/governance facade 显式方法与旧 controller 行为一致。

## 13. 风险与缓解

- 风险：一次性迁移三个后端容易造成范围过大。
  缓解：按六阶段推进，每阶段独立验证并保持服务可运行。
- 风险：旧前端路径断裂。
  缓解：保留 thin alias，先让新旧路径共用同一 schema/service。
- 风险：统一 Identity 破坏 knowledge 权限。
  缓解：先建立 principal/permission contract，再迁 controller。
- 风险：删除旧 app 前文档和脚本仍引用旧服务。
  缓解：阶段 6 必须执行过时文档扫描和 workspace 脚本清理。
- 风险：remote skill install 供应链入口过宽。
  缓解：默认关闭、审批前置、allowlist/trust policy、`execFile`、最小 env、审计记录。

## 14. 下一步

用户批准本设计文档后，进入 implementation plan。计划应先处理阶段 1 和阶段 2，确保统一后端骨架和 Identity 权限门禁先落地，再迁 Knowledge 和外部命令治理。
