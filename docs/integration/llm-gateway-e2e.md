# LLM Gateway E2E 测试栈

状态：current
文档类型：integration
适用范围：`apps/llm-gateway`、Docker Compose E2E、后端 HTTP 契约
本主题主文档：`docs/integration/llm-gateway-e2e.md`
本文只覆盖：容器化 E2E 启动、seed、运行、排障和 CI 边界
最后核对：2026-04-25

## 1. 目标

`apps/llm-gateway` 的 E2E 测试使用独立 `docker-compose.e2e.yml`，启动 PostgreSQL、llm-gateway app 和测试 runner。该栈不复用根级本地开发 compose，不写入 `db/postgres`，测试结束后默认删除 volume 和本地 E2E 构建镜像。

## 2. 命令

```bash
pnpm --dir apps/llm-gateway test:e2e
pnpm --dir apps/llm-gateway test:e2e:local
pnpm --dir apps/llm-gateway test:e2e -- --keep-up
```

`test:e2e` 是 CI 权威入口，runner 在 compose 网络内访问 `http://llm-gateway-e2e-app:3000`。该入口不绑定宿主机端口，避免 CI 并发时抢占 `3100`。

`test:e2e:local` 用于本地调试，脚本会临时追加端口映射，宿主机通过 `http://127.0.0.1:3100` 访问 app。需要换端口时设置 `LLM_GATEWAY_E2E_PORT`。

## 3. Seed 数据

E2E seed 会创建：

- owner 管理员，用于 admin auth login / refresh。
- `e2e-valid-full` key，允许访问 `gpt-main` 与 `minimax-main`。
- `e2e-model-limited` key，只允许访问 `minimax-main`。
- `e2e-budget-low` key，用于预算错误。
- `e2e-disabled` key，用于禁用 key 错误。
- `gpt-main` 与 `minimax-main` mock 模型。

## 4. Provider 边界

默认 E2E 只使用 mock provider，不访问真实 OpenAI、MiniMax 或 MiMo，不需要真实 provider key。

## 5. 排障

失败时 `scripts/run-e2e.mjs` 会打印 app logs 和 compose 状态。需要保留现场时使用 `--keep-up`；此时脚本会保持 PostgreSQL 和 app 运行，并打印完整 cleanup 命令。默认 compose project 是 `llm-gateway-e2e`，需要并发调试时设置 `LLM_GATEWAY_E2E_PROJECT`。

调试完成后执行：

```bash
pnpm --dir apps/llm-gateway test:e2e:down
```

该命令会执行 `down -v --remove-orphans --rmi local`，同时清理容器、network、volume 与本次 compose 构建出的本地 app/runner 镜像。

## 6. CI 边界

E2E 不并入根级 `pnpm verify`。CI 应以独立 job 在 `apps/llm-gateway/**` 或 `docs/integration/llm-gateway-*` 改动时执行：

```bash
pnpm --dir apps/llm-gateway test:e2e
```
