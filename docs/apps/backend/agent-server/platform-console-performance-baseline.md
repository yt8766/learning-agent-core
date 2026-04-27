# Platform Console Performance Baseline

状态：snapshot
文档类型：baseline
适用范围：`apps/backend/agent-server`、`/api/platform/console?days=30`
最后核对：2026-04-19

本文件记录 `GET /api/platform/console?days=30` 的当前性能基线、预算口径与建议验收流程。

相关入口：

- [runtime-module-notes.md](/docs/apps/backend/agent-server/runtime-module-notes.md)
- [agent-admin.md](/docs/contracts/api/agent-admin.md)
- [runtime.md](/docs/contracts/api/runtime.md)
- [frontend-backend-integration.md](/docs/integration/frontend-backend-integration.md)
- [platform-console-staging-acceptance-template.md](/docs/apps/backend/agent-server/platform-console-staging-acceptance-template.md)

## 1. 当前口径

当前链路分三层观察：

- 用户侧请求耗时
  - 以真实 HTTP 请求测得的 wall-clock duration 为准
- 服务端聚合耗时
  - 以 `diagnostics.timingsMs.total` 为准
- 日志趋势健康度
  - 以 `GET /platform/console/log-analysis?days=7` 返回的 `summary` 为准

## 2. 默认预算

当前默认预算如下：

- HTTP request `p95 <= 1000ms`
- server `diagnostics.timingsMs.total p95 <= 1000ms`
- log trend `fresh aggregate p95 <= 600ms`
- log trend `slow p95 <= 1200ms`
- log trend `slow count = 0`

说明：

- 前两条用于“本次环境、本次部署、当前数据量”的即时验证
- 后三条用于趋势治理，避免只靠单次压测宣布优化完成

## 3. 推荐命令

在本地或测试环境启动 backend 后，可直接运行：

```bash
pnpm exec tsx apps/backend/agent-server/scripts/measure-platform-console.ts \
  --url http://127.0.0.1:3000/api/platform/console?days=30 \
  --iterations 5 \
  --warmup 1
```

如果需要自定义预算：

```bash
pnpm exec tsx apps/backend/agent-server/scripts/measure-platform-console.ts \
  --url http://127.0.0.1:3000/api/platform/console?days=30 \
  --iterations 7 \
  --warmup 2 \
  --request-p95-budget 900 \
  --server-total-p95-budget 900
```

如果需要供 CI 或其他脚本消费，可追加 `--json`。

如果要直接比较整包 `console` 与轻量 `console-shell`，优先运行：

```bash
pnpm exec tsx apps/backend/agent-server/scripts/measure-platform-console-variants.ts \
  --baseline-label console \
  --baseline-url http://127.0.0.1:3000/api/platform/console?days=30 \
  --current-label console-shell \
  --current-url http://127.0.0.1:3000/api/platform/console-shell?days=30 \
  --iterations 5 \
  --warmup 1
```

这条命令会分别输出两组 report，并附带一段 `console-shell vs console` 的对比结论，适合直接验证“拆分后摘要接口是否显著更快”。

如果已经保留了一份旧报告，可直接对比：

```bash
pnpm exec tsx apps/backend/agent-server/scripts/measure-platform-console.ts \
  --url http://127.0.0.1:3000/api/platform/console?days=30 \
  --iterations 5 \
  --warmup 1 \
  --baseline-json /tmp/platform-console-baseline.json \
  --report-output /tmp/platform-console-current.json \
  --compare-output /tmp/platform-console-comparison.json
```

建议先用 `--json > /tmp/platform-console-baseline.json` 保存“优化前”结果，再在优化后复跑并传入 `--baseline-json`；如果后续要继续生成验收草稿，优先同时传入 `--report-output` 与 `--compare-output`，避免手工拆 stdout。

如果希望一次性产出 current / comparison / log-analysis / acceptance markdown，优先使用单入口脚本：

```bash
pnpm exec tsx apps/backend/agent-server/scripts/run-platform-console-acceptance.ts \
  --base-url https://staging.example.com \
  --output-dir /tmp/platform-console-acceptance \
  --baseline-json /tmp/platform-console-baseline.json \
  --reviewer <your-name> \
  --version <branch-or-build> \
  --goal "验证 platform console 优化结果"
```

如果需要分步调试，仍可按下面的细粒度命令执行：

```bash
pnpm exec tsx apps/backend/agent-server/scripts/fetch-platform-console-log-analysis.ts \
  --base-url https://staging.example.com \
  --days 7 \
  --output /tmp/platform-console-log-analysis.json

pnpm exec tsx apps/backend/agent-server/scripts/render-platform-console-acceptance.ts \
  --current-json /tmp/platform-console-current.json \
  --comparison-json /tmp/platform-console-comparison.json \
  --log-analysis-json /tmp/platform-console-log-analysis.json \
  --backend-url https://staging.example.com \
  --reviewer <your-name> \
  --version <branch-or-build> \
  --goal "验证 platform console 优化结果" \
  --baseline-json /tmp/platform-console-baseline.json \
  --output /tmp/platform-console-acceptance.md
```

## 4. 结果解读

`measure-platform-console.ts` 会输出：

- `request duration`
  - `avg / p50 / p95 / min / max`
- `server total`
  - 来自响应 `diagnostics.timingsMs.total`
- `cache statuses`
  - 观察 `hit / miss / deduped` 分布
- `Budget status`
  - 任一预算越界时返回 `failed`，脚本退出码为 `1`
- `comparison`
  - 传入 `--baseline-json` 后，会额外输出 baseline 与 current 的 `request p95`、`server total p95`、`cache hit rate` 对比，以及 `improved / regressed / unchanged` 判定
- `acceptance markdown`
  - 结合 current benchmark、comparison JSON 与 `log-analysis` JSON，可通过 `render-platform-console-acceptance.ts` 直接生成 staging 验收草稿

解读建议：

- 首次 `miss` 偏高是允许的，但 warmup 之后仍持续高于预算，需要继续排查
- 如果 `request p95` 明显高于 `server total p95`，优先检查网关、反向代理、浏览器或网络链路
- 如果 `server total p95` 高于预算，但 cache status 大多为 `hit`，说明不是冷缓存问题，而是聚合主链仍有同步慢段
- 如果压测通过但 `log-analysis` 仍长期 `warning / critical`，说明环境存在间歇性抖动，不能只看单次好结果

## 5. 推荐验收流程

建议按以下顺序做验收：

1. 先运行一次 `POST /platform/console/refresh-metrics?days=30`，确保 persisted snapshot 处于较新状态
2. 运行 `measure-platform-console.ts`，记录 request / server total 的 `p50 / p95`
3. 查看 `GET /platform/console/log-analysis?days=7`，确认 `summary.status` 至少恢复到 `healthy`
4. 在 `agent-admin` Dashboard 中确认：
   - 顶部 `Platform Console diagnostics` badge 显示合理
   - “控制台趋势”卡片不再持续显示严重或预警

## 6. 后续扩展建议

如果后续要把这条链路继续纳入 CI 或回归门槛，优先沿这条路线推进：

- 把 `measure-platform-console.ts` 挂到环境级 smoke job，而不是单元测试
- 给 staging 数据量定义固定样本窗口，避免不同环境拿不同数据量直接对比
- 如果未来需要并发压力验证，再单独补 `concurrency` 参数；不要把当前串行基线脚本直接演化成复杂压测平台
