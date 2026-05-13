# config 包结构规范

状态：current
文档类型：convention
适用范围：`packages/config`
最后核对：2026-04-18

本文档说明 `packages/config` 如何参考 `packages/core` 的治理方式，形成“稳定配置边界 + 真实加载实现”的结构。

## 1. 目标定位

`packages/config` 不是简单的 env 读取目录。

它应承载：

- settings schema
- runtime profile
- 默认策略
- 路径与存储布局
- 配置加载与标准化 facade

## 2. 推荐结构

```text
packages/config/
├─ src/
│  ├─ contracts/
│  ├─ schemas/
│  ├─ profiles/
│  ├─ policies/
│  ├─ loaders/
│  ├─ briefings/
│  ├─ shared/
│  ├─ utils/
│  └─ index.ts
├─ test/
└─ package.json
```

各目录语义：

- `contracts/`
  - settings facade、profile contract、公开配置读取边界
- `schemas/`
  - settings/profile/policy schema
- `profiles/`
  - `platform`、`company`、`personal`、`cli`
- `policies/`
  - budget/source/approval/path 等默认策略
- `loaders/`
  - env resolver、settings loader、normalizer
- `briefings/`
  - 配置驱动的 briefing / digest 构造
- `shared/`
  - 默认值、字段映射、路径常量
- `utils/`
  - 轻量解析 helper

## 3. 允许内容

- profile 定义
- settings schema
- feature flags
- storage/path policy
- budget/source/approval 默认策略
- 配置标准化与 facade

## 4. 禁止内容

- graph、flow、agent 业务编排
- tool executor
- repository
- provider 实例创建
- runtime orchestration

## 5. 当前收敛策略

本轮已先完成第一批物理收敛，以下文件已经是正式宿主：

- `src/contracts/settings-facade.ts`
- `src/schemas/settings.types.ts`
- `src/profiles/runtime-profile-overrides.ts`
- `src/policies/runtime-policy-defaults.ts`
- `src/loaders/settings-loader.ts`
- `src/loaders/settings-paths.ts`
- `src/shared/settings-defaults.ts`
- `src/utils/settings-helpers.ts`

根目录与 `src/settings/*` 下保留的历史入口目前只承担兼容职责：

- `src/settings.ts`
- `src/settings/index.ts`

其中：

- `src/settings.ts`
- `src/settings/index.ts`

当前保留为人工可读聚合入口。

旧 `src/briefings/daily-tech-briefing.ts` 已随 Daily Tech Briefing 下线删除；不要在 `packages/config` 恢复
`dailyTechBriefing` settings 字段。Tech & AI Intelligence 频道、schema 与运行策略应落在 `@agent/core`
intelligence contract、`agents/intel-engine` 与 backend `RuntimeIntelligenceRunService`。

补充：

- 包根 `src/index.ts` 当前先通过 `src/contracts/settings-facade.ts` 暴露稳定导出
- 这样 `contracts/` 负责“对外稳定边界”，`settings.ts` / `settings/index.ts` 负责“人工可读聚合入口”，两者职责不再混在一起

以下纯 compat re-export 已删除：

- `src/runtime/daily-tech-briefing.ts`
- `src/runtime/settings-loader.ts`
- `src/runtime/settings-paths.ts`
- `src/settings/settings.defaults.ts`
- `src/settings/settings.helpers.ts`
- `src/settings/settings.loader.ts`
- `src/settings/settings-paths.ts`
- `src/settings/daily-tech-briefing.ts`
- `src/settings/settings.types.ts`

后续应继续拆到更完整的目标结构：

1. `contracts/`
2. 如有新增 profile / policy 变体，继续优先落到 `profiles/`、`policies/`
3. `src/settings.ts` / `src/settings/index.ts` 当前默认作为人工可读聚合入口长期保留；只有当仓库统一决定取消这层聚合导入策略时才重新评估

补充：

- `runtime/` 不再作为 config 新实现的默认宿主，旧 wrapper 也已删除
- 后续新增 loader 默认进入 `loaders/`
- 后续新增 briefing / digest 构造默认进入 `briefings/`

## 6. 继续阅读

- [config 文档目录](/docs/packages/config/README.md)
- [Runtime Profiles](/docs/packages/config/runtime-profiles.md)
- [Packages 分层与依赖约定](/docs/conventions/package-architecture-guidelines.md)
