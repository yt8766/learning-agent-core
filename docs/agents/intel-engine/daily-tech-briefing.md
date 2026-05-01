# Daily Tech Briefing in Intel Engine

状态：current  
文档类型：reference  
适用范围：`agents/intel-engine/src/runtime/briefing`  
最后核对：2026-04-30

Daily Tech Intelligence Briefing 的当前真实宿主是 `agents/intel-engine/src/runtime/briefing/*`。历史 backend 落点 `apps/backend/agent-server/src/runtime/briefings/*` 已删除；不要在 backend 恢复 briefing 主逻辑或 compat re-export 双轨。

## 边界

- `agents/intel-engine` 负责 briefing category config、情报采集、MCP/web search 补充发现、去重、ranking、本地化、Lark delivery、run/history/feedback/schedule storage。
- `apps/backend/agent-server` 只负责 HTTP/BFF、Nest wiring、force-run、feedback、runs 查询、权限审计、错误映射和 `RuntimeIntelBriefingFacade` 这类 BFF adapter。
- `packages/runtime` 不承载 briefing 业务主逻辑。

## 存储

短期继续使用仓库根级 JSON 路径，保持历史兼容：

```text
data/runtime/briefings/daily-tech-briefing-runs.json
data/runtime/briefings/daily-tech-briefing-history.json
data/runtime/briefings/daily-tech-briefing-schedule-state.json
data/runtime/briefings/daily-tech-briefing-feedback.json
data/runtime/briefings/raw/
data/runtime/schedules/daily-tech-briefing-<category>.json
```

## 测试

briefing 领域测试放在 `agents/intel-engine/test/runtime/briefing`。Backend 只保留 controller 和 BFF adapter smoke。

`agents/intel-engine/tsconfig.types.json` 的 declaration build 必须继承 workspace 根 `paths`，不要覆盖
`baseUrl` 或清空 `paths`；否则干净 CI 中 `pnpm test:demo:affected` 可能在 `@agent/core` 尚未产出 build
types 时解析失败。`agents/intel-engine/test/tsconfig-types.test.ts` 固定覆盖这条约束。
