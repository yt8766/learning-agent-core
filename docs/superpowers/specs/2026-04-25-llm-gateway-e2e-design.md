# LLM Gateway E2E Test Design

状态：snapshot
文档类型：note
适用范围：`apps/llm-gateway`
最后核对：2026-04-25

## 1. 背景

`apps/llm-gateway` 当前已有 service、route handler、provider adapter、rate limit、usage、admin auth 等宿主内测试。现有测试能证明核心函数和 Next route handler 的局部行为，但还缺少一个从真实 HTTP 边界出发的端到端验证层。

本设计为 llm-gateway 后端新增容器化 E2E 测试。E2E 测试应单独启动测试栈，注入固定测试数据，通过 HTTP 验证后台登录与 OpenAI-compatible API 行为，测试完成后自动关闭容器并清理测试数据。

## 2. 目标

- 使用独立 Docker Compose 测试栈，不复用本地开发 PostgreSQL 容器、端口或数据卷。
- 支持容器 runner 和宿主机 runner 两种入口，其中容器 runner 是 CI 权威入口。
- 通过固定 seed 数据验证管理员登录、API Key、模型权限、预算或限流、非流式 chat completion 和流式 SSE。
- 默认使用 mock provider，不访问真实 OpenAI、MiniMax 或 MiMo 上游。
- 测试结束后自动 `down -v`，失败时也清理容器和 volume。
- 将 E2E 从普通 unit / integration / workspace smoke 中隔离，避免根级默认验证被 Docker 环境硬依赖阻断。

## 3. 非目标

- 不把真实 OpenAI、MiniMax、MiMo 请求放进默认 E2E。
- 不新增 Playwright UI E2E；本轮只覆盖后端 HTTP 链路。
- 不把 E2E 默认塞进根级 `pnpm verify`。
- 不复用 `apps/llm-gateway/docker-compose.yml` 的本地开发数据库 volume。
- 不引入公开注册、多租户、复杂账单或 provider policy engine。

## 4. 推荐方案

采用双入口 E2E，容器 runner 为权威入口，本地 runner 为调试入口。

测试栈由三个服务组成：

- `llm-gateway-e2e-postgres`：PostgreSQL 16，一次性测试数据库，带 healthcheck。
- `llm-gateway-e2e-app`：运行 `apps/llm-gateway`，连接 E2E PostgreSQL，并使用测试专用 env。
- `llm-gateway-e2e-runner`：执行 seed 与 HTTP E2E specs，在 compose 网络内访问 `llm-gateway-e2e-app`。

CI 默认执行容器 runner。本地开发可执行宿主机 runner，复用同一批 E2E specs，以便快速排障。

## 5. 文件结构

新增或调整文件建议如下：

```text
apps/llm-gateway/
  docker-compose.e2e.yml
  Dockerfile.e2e
  scripts/
    run-e2e.mjs
  test/e2e/
    fixtures.ts
    seed.ts
    wait-for-gateway.ts
    llm-gateway-http.e2e-spec.ts
```

`test/e2e/**/*.e2e-spec.ts` 不使用 `*.int-spec.ts` 命名。当前根级 Vitest 配置已排除 `**/e2e/**`，该命名能避免 Docker E2E 被普通 `pnpm test`、`pnpm test:unit` 或 `pnpm test:integration` 误触发。

## 6. 数据 Seed

E2E seed 分为数据库 seed 和 provider seed。

数据库 seed：

- 管理员 owner：用于验证 `POST /api/admin/auth/login`、`refresh`、`change-password` 或 `logout`。
- `e2e-valid-full` API Key：可访问 `gpt-main`，限额充足。
- `e2e-model-limited` API Key：不能访问目标模型，用于验证 `MODEL_NOT_ALLOWED`。
- `e2e-budget-low` 或 `e2e-rate-low` API Key：用于验证预算或限流错误。
- 模型配置：
  - `gpt-main -> mock/mock-gpt-main`
  - `minimax-main -> mock/mock-minimax-main`
  - 可选 disabled model，用于模型不可用错误路径。

Provider seed：

- 默认不调用真实上游。
- E2E app 通过测试 env 进入 mock provider runtime。
- Mock provider 固定返回稳定文本、稳定 token usage 和稳定 SSE chunk，确保 CI 结果可重复。

## 7. E2E 覆盖范围

第一版 E2E 控制在小而稳定的后端闭环：

- `GET /api/v1/models`：valid key 只能看到授权模型。
- `GET /api/v1/key`：返回 key 状态、限额和今日用量。
- `POST /api/v1/chat/completions` 非流式：返回 OpenAI-compatible JSON，并写入 usage 或 request log。
- `POST /api/v1/chat/completions` 流式：返回 `text/event-stream`，包含 chunk，并以 `data: [DONE]` 结束。
- 鉴权与权限错误：覆盖 missing / invalid key、disabled 或 revoked key、model not allowed。
- 管理员登录链路：覆盖 login、refresh、change password 或 logout 的最小闭环。
- 预算或限流错误：至少覆盖一个 `BUDGET_EXCEEDED` 或 `RATE_LIMITED`。

## 8. 命令入口

`apps/llm-gateway/package.json` 建议新增：

```json
{
  "scripts": {
    "test:e2e": "node scripts/run-e2e.mjs --runner=container",
    "test:e2e:local": "node scripts/run-e2e.mjs --runner=host",
    "test:e2e:up": "docker compose -f docker-compose.e2e.yml up -d llm-gateway-e2e-postgres llm-gateway-e2e-app",
    "test:e2e:down": "docker compose -f docker-compose.e2e.yml down -v --remove-orphans"
  }
}
```

`test:e2e` 语义：

1. 使用唯一 compose project name 启动 E2E stack。
2. 执行 `docker compose -f docker-compose.e2e.yml up --build --abort-on-container-exit --exit-code-from llm-gateway-e2e-runner llm-gateway-e2e-runner`。
3. 以 runner 退出码作为命令退出码。
4. 在 finally 中执行 `docker compose -f docker-compose.e2e.yml down -v --remove-orphans`。

`test:e2e:local` 语义：

1. 启动 E2E Postgres 与 E2E app。
2. 在宿主机执行同一批 `test/e2e/**/*.e2e-spec.ts`。
3. 默认测试结束后清理。
4. 支持 `--keep-up` 调试参数，保留容器现场供手工 `curl` 或数据库排查。

## 9. 失败排障与清理

E2E runner 必须保证失败可诊断、结束可清理：

- 每次运行生成唯一 compose project name，例如 `llm-gateway-e2e-<timestamp>`，避免并发冲突。
- 失败时打印 app container logs、Postgres health/status、runner 最后请求的 URL、status 与 response body 摘要。
- 默认无论成功或失败都清理容器和 volume。
- 调试模式允许 `--keep-up` 保留测试栈。
- 测试临时产物写入 `artifacts/llm-gateway-e2e/` 或 `/tmp`，不写入源码目录。

## 10. CI 接入

第一阶段 E2E 不并入根级 `pnpm verify`。推荐新增独立 `llm-gateway-e2e` job，并按路径触发：

- `apps/llm-gateway/**`
- `docs/integration/llm-gateway-*`
- E2E compose、Dockerfile、runner 脚本或 seed 相关文件

该 job 执行：

```bash
pnpm --dir apps/llm-gateway test:e2e
```

等 E2E 在 CI 中稳定后，再评估是否接入 affected 验证体系。即使未来接入，也应保持它与普通 `test:integration` 分离。

## 11. 文档更新

实施时需要同步更新：

- 新增 `docs/integration/llm-gateway-e2e.md`，记录 E2E 栈、命令、seed、调试和 CI 边界。
- 更新 `docs/integration/README.md`，加入 E2E 文档入口。
- 若修改开发 compose、env example 或 package scripts，需要同步更新 `docs/integration/llm-gateway-postgres-login.md`，并明确它仍只面向本地开发数据库。

## 12. 验收标准

- `pnpm --dir apps/llm-gateway test:e2e` 能从零启动 compose 栈、seed 测试数据、跑完 HTTP E2E，并自动关闭容器与删除 volume。
- `pnpm --dir apps/llm-gateway test:e2e:local` 能复用同一批 specs 做本地调试。
- 默认 E2E 不需要真实 provider key，不访问真实 LLM 网络。
- 覆盖 `models`、`key`、`chat completions` 三个 OpenAI-compatible 外部接口。
- 覆盖 admin auth 最小闭环。
- 覆盖至少一个鉴权错误、一个模型权限错误、一个预算或限流错误。
- E2E 不被根级普通 Vitest integration 自动误触发。

## 13. 后续实施顺序

实施计划应按以下顺序展开：

1. 先补 E2E lifecycle 脚本和 compose 栈骨架。
2. 再补 app 测试 runtime/env 与 mock provider seed。
3. 再补数据库 seed 与 HTTP specs。
4. 再接入 package scripts 和可选 CI job。
5. 最后更新 integration 文档并跑受影响验证。
