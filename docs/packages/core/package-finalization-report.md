# Packages 阶段收官报告

状态：current
文档类型：reference
适用范围：`packages/*`、`agents/*` 的包边界、稳定 facade、目录聚合入口、真实宿主盘点
最后核对：2026-04-18

本文档用于给后续 AI 或人类维护者一个“当前已经收敛到哪里”的事实快照。

本文不再讨论理想结构，而是明确回答四个问题：

1. 这个包当前的稳定消费出口是什么
2. 这个包当前保留了哪些稳定 facade
3. 这个包当前保留了哪些目录聚合入口
4. 这个包当前的真实宿主目录在哪里

## 1. 判定口径

本文统一按三类入口看待当前源码：

- 稳定 facade
  - 面向包外长期消费的稳定边界
  - 典型形态是包根 `src/index.ts` 或 `contracts/*-facade.ts`
- 目录聚合入口
  - 为了目录语义、局部分组、同域导入收口而保留的 `index.ts`
  - 不等于过渡 compat
- 真实宿主
  - 当前真正承接实现、逻辑、领域规则的目录或文件

补充：

- 本文不把 `packages/core` 的分层方式当作其他包的模板
- 其他包的判断标准永远是“真实宿主是否清楚”，而不是“有没有照着 core 搭目录”

## 2. 总表

| 包/目录               | 稳定消费出口                | 当前稳定 facade                                                                                   | 当前目录聚合入口                                                                                                                                                                 | 当前真实宿主                                                                                                     |
| --------------------- | --------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `packages/core`       | `@agent/core`               | 包根 `src/index.ts` 与各领域 `index.ts`                                                           | 大量领域 `index.ts`，属于 schema/type 分组                                                                                                                                       | `src/*` 各领域 schema/types/helpers                                                                              |
| `packages/runtime`    | `@agent/runtime`            | 包根 `src/index.ts`、`src/contracts/*`                                                            | `flows/approval/index.ts`、`flows/learning/index.ts`、`flows/ministries/index.ts`                                                                                                | `graphs/`、`flows/`、`session/`、`governance/`、`orchestration/`、`bridges/`、`runtime/`                         |
| `packages/adapters`   | `@agent/adapters`           | 包根 `src/index.ts`、`contracts/llm-provider.ts`                                                  | `chat/index.ts`、`embeddings/index.ts`                                                                                                                                           | `runtime/`、`llm/`、`providers/`、`embeddings/runtime-embedding-provider.ts`、`shared/`、`utils/`                |
| `packages/config`     | `@agent/config`             | 包根 `src/index.ts`、`contracts/settings-facade.ts`、人工可读 `settings.ts` / `settings/index.ts` | `settings/index.ts` 属于人工可读聚合，不是 compat                                                                                                                                | `schemas/`、`profiles/`、`policies/`、`loaders/`、`briefings/`、`shared/`、`utils/`                              |
| `packages/memory`     | `@agent/memory`             | 包根 `src/index.ts`、`contracts/memory-repository.ts`、`contracts/memory-search-service.ts`       | `repositories/index.ts`、`search/index.ts`、`vector/index.ts`、`embeddings/index.ts`                                                                                             | `repositories/`、`search/`、`vector/`、`embeddings/`、`normalization/`、`governance/`                            |
| `packages/tools`      | `@agent/tools`              | 包根 `src/index.ts`、`contracts/tool-registry.ts`、`contracts/tool-risk-classifier.ts`            | `approval/index.ts`、`connectors/index.ts`、`filesystem/index.ts`、`mcp/index.ts`、`registry/index.ts`、`runtime-governance/index.ts`、`sandbox/index.ts`、`scheduling/index.ts` | `definitions/`、`executors/`、`approval/`、`registry/`、`sandbox/`、`transports/`、`scaffold/`、`mcp/*registry*` |
| `packages/skill`      | `@agent/skill`              | 包根 `src/index.ts`、`contracts/skill-facade.ts`                                                  | 当前主要保留包根聚合，不额外依赖大量目录聚合层                                                                                                                                   | `registry/`、`sources/`、`catalog/`、`install/`、`policies/`                                                     |
| `packages/evals`      | `@agent/evals`              | 包根 `src/index.ts`、`contracts/evals-facade.ts`                                                  | 当前主要保留包根聚合                                                                                                                                                             | `benchmarks/`、`regressions/`、`quality-gates/`                                                                  |
| `packages/report-kit` | `@agent/report-kit`         | 包根 `src/index.ts`、`contracts/data-report-facade.ts`                                            | 当前主要保留包根聚合                                                                                                                                                             | `blueprints/`、`scaffold/`、`assembly/`、`writers/`、`shared/`                                                   |
| `packages/templates`  | `@agent/templates`          | 包根 `src/index.ts`、`contracts/template-definitions.ts`                                          | 当前以包根聚合为主                                                                                                                                                               | `registries/`、`starters/`、`scaffolds/`、`reports/`、`contracts/`                                               |
| `agents/supervisor`   | `@agent/agents-supervisor`  | 包根 `src/index.ts`                                                                               | `flows/supervisor/index.ts`、`flows/delivery/index.ts`                                                                                                                           | `bootstrap/`、`graphs/`、`workflows/`、`flows/supervisor/`、`flows/delivery/`                                    |
| `agents/data-report`  | `@agent/agents-data-report` | 包根 `src/index.ts`                                                                               | `flows/data-report/index.ts`、`flows/data-report-json/index.ts`、`types/index.ts` 及其 `nodes/ prompts/ schemas/` 分组 `index.ts`                                                | `graphs/`、`flows/data-report/`、`flows/data-report-json/`、`types/`                                             |
| `agents/coder`        | `@agent/agents-coder`       | 包根 `src/index.ts`                                                                               | 当前主要保留包根聚合                                                                                                                                                             | `flows/chat/`、`flows/ministries/`                                                                               |
| `agents/reviewer`     | `@agent/agents-reviewer`    | 包根 `src/index.ts`                                                                               | 当前主要保留包根聚合                                                                                                                                                             | `flows/chat/`、`flows/ministries/`                                                                               |

## 3. 已完成的关键收敛

本阶段已经完成的关键动作：

- 删除 legacy 根文件 compat
  - `packages/config/src/settings/settings.*`
  - `packages/evals/src/benchmarks.ts`、`src/evaluators.ts`
  - `packages/skill/src/skill-registry.ts`、`src/agent-skill-loader.ts`
  - `packages/report-kit/src/data-report-*.ts`
  - `packages/tools/src/tool-registry.ts`、`src/tool-risk-classifier.ts`
  - `packages/adapters/src/chat/*`、`src/providers/*`、`src/retry/*`、`src/support/*`、`src/utils/model-fallback.ts`、`src/llm/runtime-provider-factory.ts`
- 删除源目录内纯 compat wrapper
  - `packages/config/src/runtime/*`
  - `packages/evals/src/prompt-regression/evaluators.ts`
  - `packages/runtime/src/runtime/agent-bridges/*`
  - `packages/runtime/src/graphs/main/main.graph.ts`
  - `packages/runtime/src/graphs/main/main-graph-runtime-modules.ts`
  - `packages/tools/src/*/*-tool-definitions.ts` 旧 wrapper
  - `packages/tools/src/mcp/*.ts` 旧 transport wrapper
  - `packages/tools/src/watchdog/index.ts`
  - `packages/memory/src/shared/memory-record-helpers.ts`
  - `packages/memory/src/repositories/memory-repository-governance.ts`
  - `packages/tools/src/filesystem/filesystem-executor.ts`
  - `packages/tools/src/connectors/connectors-executor.ts`
- 明确 facade 与真实宿主分离
  - `config`：`contracts/settings-facade.ts`
  - `skill`：`contracts/skill-facade.ts`
  - `evals`：`contracts/evals-facade.ts`
  - `report-kit`：`contracts/data-report-facade.ts`

## 4. 当前仍应长期保留的入口

以下入口当前默认应长期保留，不进入下一轮删除队列：

- `packages/config/src/contracts/settings-facade.ts`
- `packages/config/src/settings.ts`
- `packages/config/src/settings/index.ts`
- `packages/memory/src/contracts/memory-repository.ts`
- `packages/memory/src/contracts/memory-search-service.ts`
- `packages/tools/src/contracts/tool-registry.ts`
- `packages/tools/src/contracts/tool-risk-classifier.ts`
- `packages/adapters/src/contracts/llm-provider.ts`
- `packages/skill/src/contracts/skill-facade.ts`
- `packages/evals/src/contracts/evals-facade.ts`
- `packages/report-kit/src/contracts/data-report-facade.ts`

原因：

- 它们承担稳定 facade 或人工可读聚合职责
- 删除它们不会提升真实宿主清晰度，反而会让消费边界变模糊

## 5. 当前仍应保留的目录聚合入口

以下入口默认也不应按“compat 清理”处理：

- `packages/tools/src/approval/index.ts`
- `packages/tools/src/connectors/index.ts`
- `packages/tools/src/filesystem/index.ts`
- `packages/tools/src/mcp/index.ts`
- `packages/tools/src/registry/index.ts`
- `packages/tools/src/runtime-governance/index.ts`
- `packages/tools/src/sandbox/index.ts`
- `packages/tools/src/scheduling/index.ts`
- `packages/memory/src/repositories/index.ts`
- `packages/memory/src/search/index.ts`
- `packages/memory/src/vector/index.ts`
- `packages/memory/src/embeddings/index.ts`
- `packages/runtime/src/flows/approval/index.ts`
- `packages/runtime/src/flows/learning/index.ts`
- `packages/runtime/src/flows/ministries/index.ts`
- `agents/data-report/src/flows/data-report/index.ts`
- `agents/data-report/src/flows/data-report-json/index.ts`
- `agents/data-report/src/types/index.ts`

原因：

- 它们主要承担目录语义聚合，而不是历史兼容
- 当前没有证据说明删除它们能进一步提升边界清晰度

## 6. 下一阶段的判断规则

如果后续还要继续收缩，默认按下面顺序判断：

1. 这是不是稳定 facade
2. 这是不是目录聚合入口
3. 它是否掩盖了真实宿主没有物理落位
4. 删除后是否会让导入边界更清楚，而不是更隐晦

只有同时满足下面条件，才进入下一轮删除候选：

- 不是稳定 facade
- 不是必要的目录聚合入口
- 没有生产源码依赖
- 删除后可以让真实宿主更直接暴露

## 7. 建议阅读顺序

1. [Packages 目录说明](/docs/maps/packages-overview.md)
2. [Packages 分层与依赖约定](/docs/conventions/package-architecture-guidelines.md)
3. [Compat 入口收缩候选](/docs/packages/core/package-compat-sunset-candidates.md)
4. 本文
5. 各包自己的 `docs/packages/<pkg>/package-structure-guidelines.md`
