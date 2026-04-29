# Daily Tech Briefing in Intel Engine

状态：current  
文档类型：reference  
适用范围：`agents/intel-engine/src/runtime/briefing`  
最后核对：2026-04-29

Daily Tech Intelligence Briefing 是 `agents/intel-engine` 的默认能力。

## 边界

- `agents/intel-engine` 负责 briefing category config、情报采集、MCP/web search 补充发现、去重、ranking、本地化、Lark delivery、run/history/feedback/schedule storage。
- `apps/backend/agent-server` 只负责 HTTP/BFF、Nest wiring、force-run、feedback、runs 查询、权限审计和错误映射。
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
