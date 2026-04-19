# Platform Console Staging Acceptance Template

状态：current
文档类型：template
适用范围：`apps/backend/agent-server`、staging `/api/platform/console?days=30` 验收
最后核对：2026-04-19

本模板用于记录 `GET /api/platform/console?days=30` 在 staging 或预发布环境中的验收结果。

相关入口：

- [platform-console-performance-baseline.md](/docs/backend/platform-console-performance-baseline.md)
- [runtime-module-notes.md](/docs/backend/runtime-module-notes.md)
- [frontend-backend-integration.md](/docs/integration/frontend-backend-integration.md)

补充说明：

- 如果不想手工填写，优先直接运行 `apps/backend/agent-server/scripts/run-platform-console-acceptance.ts` 一次性产出 current / comparison / `log-analysis` / acceptance markdown
- 如果只想分步调试，也可以先生成 benchmark / comparison / `log-analysis` JSON，再运行 `apps/backend/agent-server/scripts/render-platform-console-acceptance.ts` 自动产出一份 Markdown 草稿

## 1. 验收背景

- 验收日期：
- 验收人：
- 环境：
- 分支 / 版本：
- 本次目标：
  - 例如：验证缓存优化、snapshot 预热、趋势卡片、日志趋势健康度

## 2. 前置条件

- backend URL：
- 是否先执行 `POST /platform/console/refresh-metrics?days=30`：
- 数据窗口是否固定为 `days=30`：
- 是否保留“优化前” baseline JSON：
- baseline JSON 路径：
- 当前报告输出路径：

## 3. 执行命令

优化前基线：

```bash
pnpm exec tsx apps/backend/agent-server/scripts/measure-platform-console.ts \
  --url <staging-url>/api/platform/console?days=30 \
  --iterations 5 \
  --warmup 1 \
  --json > /tmp/platform-console-baseline.json
```

优化后复测：

```bash
pnpm exec tsx apps/backend/agent-server/scripts/measure-platform-console.ts \
  --url <staging-url>/api/platform/console?days=30 \
  --iterations 5 \
  --warmup 1 \
  --baseline-json /tmp/platform-console-baseline.json \
  --report-output /tmp/platform-console-current.json \
  --compare-output /tmp/platform-console-comparison.json
```

趋势检查：

```bash
pnpm exec tsx apps/backend/agent-server/scripts/fetch-platform-console-log-analysis.ts \
  --base-url <staging-url> \
  --days 7 \
  --output /tmp/platform-console-log-analysis.json
```

变体对比：

```bash
pnpm exec tsx apps/backend/agent-server/scripts/measure-platform-console-variants.ts \
  --baseline-label console \
  --baseline-url <staging-url>/api/platform/console?days=30 \
  --current-label console-shell \
  --current-url <staging-url>/api/platform/console-shell?days=30 \
  --iterations 5 \
  --warmup 1 \
  --output /tmp/platform-console-variants.json
```

## 4. 结果记录

即时基线：

- request p50：
- request p95：
- server total p50：
- server total p95：
- cache statuses：
- Budget status：

与 baseline 对比：

- comparison status：
- request p95 delta：
- server total p95 delta：
- cache hit rate delta：
- highlights：

趋势检查：

- `summary.status`：
- `summary.reasons[0]`：
- `fresh aggregate p95`：
- `slow p95`：
- `slow count`：

`console-shell` 对比：

- baseline label：
- current label：
- shell request p95：
- shell server total p95：
- `console-shell vs console` comparison status：
- `console-shell` highlights：

控制面观察：

- 顶部 `Platform Console diagnostics` badge：
- “控制台趋势”卡片状态：
- 是否仍出现严重或预警：

## 5. 判定结论

- 是否通过：
- 结论摘要：
  - 例如：`request p95` 与 `server total p95` 均低于预算，趋势恢复 `healthy`，通过
  - 例如：即时压测通过，但 `slow count` 仍大于 `0`，暂不通过

## 6. 异常与备注

- 是否存在偶发抖动：
- 是否存在网关 / 代理 / 浏览器缓存干扰：
- 是否存在样本量不足：
- 后续动作：
  - 例如：补 24h 趋势观察、加大 iterations、排查 connector 冷启动、复查日志慢段
