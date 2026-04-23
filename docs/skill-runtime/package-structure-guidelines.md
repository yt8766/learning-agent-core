# skill-runtime 包结构规范

状态：current
文档类型：convention
适用范围：`packages/skill-runtime`
最后核对：2026-04-20

本文档说明 `packages/skill-runtime` 如何按“稳定边界先行”的方式维护当前目录结构，并继续收敛。

## 1. 目标定位

`packages/skill-runtime` 不是仓库级代理技能目录，也不是 skill loader 杂物层。

它的目标是承载“运行时技能资产治理”：

- 技能是什么
- 技能从哪来
- 技能现在是否可信、兼容、可用
- 技能如何被注册、安装、同步、索引

## 2. 推荐结构

```text
packages/skill-runtime/
├─ src/
│  ├─ contracts/
│  ├─ schemas/
│  ├─ registry/
│  ├─ sources/
│  ├─ install/
│  ├─ policies/
│  ├─ runtime/
│  ├─ shared/
│  ├─ utils/
│  └─ index.ts
├─ test/
└─ package.json
```

各目录语义：

- `contracts/`
  - skill registry/source/install 的稳定 contract
- `schemas/`
  - manifest、source、receipt、catalog 等长期结构
- `registry/`
  - registry、catalog service、manifest loader
- `sources/`
  - remote/local source reader、sync 与 source policy
- `install/`
  - installer、receipt、integrity check
- `policies/`
  - trust、compatibility、availability 等判定规则
- `runtime/`
  - 对外运行时 facade、registry runtime 装配
- `shared/`
  - manifest normalizer、catalog mapper 等带技能领域语义的共享资产
- `utils/`
  - 纯函数工具

## 3. 允许内容

- skill manifest schema
- skill source schema
- skill receipt / install metadata
- registry / catalog
- source sync
- trust / compatibility / availability policy

## 4. 禁止内容

- `skills/*/SKILL.md` 仓库级代理技能文档
- LangGraph graph
- agent orchestration
- tool executor 主流程
- memory / search 主链编排
- app 层 view model

## 5. 当前收敛策略

本轮已先完成最稳定入口的物理收敛：

- `src/contracts/skill-runtime-facade.ts`
- `src/registry/skill-registry.ts`
- `src/sources/agent-skill-loader.ts`

当前已落地：

- `src/catalog/skill-catalog.ts`
  - 已作为 skill catalog 读写与查询宿主
- `src/install/plugin-draft-publisher.ts`
  - 已作为插件草稿发布宿主
- `src/policies/skill-governance-policy.ts`
  - 已作为技能状态演进与执行结果裁决宿主
- `src/sources/skill-search-resolution.ts`
  - 已作为 skill search status / safety note / MCP recommendation 的 canonical host
  - backend 的 `runtime/domain/skills/runtime-skill-search-resolution.ts` 当前只保留 compat re-export
- `src/registry/skill-registry.ts`
  - 当前以装配层为主，不再自己承担当 catalog、install、policy 三类实现

补充：

- 包根 `src/index.ts` 当前先通过 `src/contracts/skill-runtime-facade.ts` 暴露稳定导出
- `contracts/` 负责对外稳定边界，`registry/` 与 `sources/` 继续承载真实实现

后续源码收敛优先顺序：

1. 继续补 `schemas/`
2. 将剩余平铺 helper 收敛到 `shared/`、`utils/`
3. 继续保持包根入口直接对 canonical host 导出，不重新引入 legacy 根文件

## 6. 继续阅读

- [skill-runtime 文档目录](/docs/skill-runtime/README.md)
- [Packages 分层与依赖约定](/docs/package-architecture-guidelines.md)
- [运行时技能与仓库代理技能边界](/docs/skills/runtime-skills-vs-repo-skills.md)
