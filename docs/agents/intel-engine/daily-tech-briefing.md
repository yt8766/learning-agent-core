# Daily Tech Briefing in Intel Engine

状态：current  
文档类型：reference  
适用范围：`agents/intel-engine/src/runtime/briefing`  
最后核对：2026-05-08

Daily Tech Intelligence Briefing 的当前真实宿主是 `agents/intel-engine/src/runtime/briefing/*`。历史 backend 落点 `apps/backend/agent-server/src/runtime/briefings/*` 已删除；不要在 backend 恢复 briefing 主逻辑或 compat re-export 双轨。

## 边界

- `agents/intel-engine` 负责 briefing category config、情报采集、MCP/web search 补充发现、去重、ranking、本地化、Lark delivery、run/history/feedback/schedule storage。
- `apps/backend/agent-server` 只负责 HTTP/BFF、Nest wiring、force-run、feedback、runs 查询、权限审计、错误映射和 `RuntimeIntelBriefingFacade` 这类 BFF adapter。
- `packages/runtime` 不承载 briefing 业务主逻辑。

## 存储

briefing 存储已经从 root `data/runtime` 迁到 intel-owned storage repository。生产调用必须通过
`RuntimeTechBriefingContext.briefingStorage` 注入宿主 storage；未显式注入时，默认 file repository
落到当前 workspace 的 `profile-storage/platform/intel-engine/briefing`，不再写 root `data/*`、
`data/runtime/briefings` 或 `data/runtime/schedules`。

默认 file repository 路径：

```text
profile-storage/platform/intel-engine/briefing/daily-tech-briefing-runs.json
profile-storage/platform/intel-engine/briefing/daily-tech-briefing-history.json
profile-storage/platform/intel-engine/briefing/daily-tech-briefing-schedule-state.json
profile-storage/platform/intel-engine/briefing/daily-tech-briefing-feedback.json
profile-storage/platform/intel-engine/briefing/raw/
profile-storage/platform/intel-engine/briefing/locks/scheduled-runs/
profile-storage/platform/intel-engine/briefing/schedules/daily-tech-briefing-<category>.json
```

代码边界：

- `briefing-storage-repository.ts` 定义 `BriefingStorageRepository`，提供 file / memory 实现，并保留
  `PostgresReadyBriefingStorageRepository` 类型别名，后续 PostgreSQL adapter 只需实现同一接口。
- `briefing-storage.ts` 是兼容 facade，旧函数签名仍可使用，但内部统一委托 repository；新增生产路径应优先传入
  `BriefingStorageRepository`，不要直接拼接持久化路径。
- `briefing.service.ts` 的 scheduled 入口会按 `分类集合 + 分钟 slot` 写入
  `locks/scheduled-runs/*.lock`，用于阻止多个 backend/Bree 实例在同一分钟重复执行同一分类并重复发送 Lark。
- `briefing-paths.ts` 只描述 intel-owned storage 的文件布局，不再提供 root `data/runtime` 路径。

## 测试

briefing 领域测试放在 `agents/intel-engine/test/runtime/briefing`。Backend 只保留 controller 和 BFF adapter smoke。

`agents/intel-engine/tsconfig.types.json` 的 declaration build 必须继承 workspace 根 `paths`，不要覆盖
`baseUrl` 或清空 `paths`；否则干净 CI 中 `pnpm test:demo:affected` 可能在 `@agent/core` 尚未产出 build
types 时解析失败。`agents/intel-engine/test/tsconfig-types.test.ts` 固定覆盖这条约束。
