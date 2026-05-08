# skill 包结构规范

状态：current
文档类型：convention
适用范围：`packages/skill`
最后核对：2026-05-08

本文档说明 `packages/skill` 如何按“稳定边界先行”的方式维护当前目录结构，并继续收敛。

## 1. 目标定位

`packages/skill` 不是仓库级代理技能目录，也不是 skill loader 杂物层。

它的目标是承载“运行时技能资产治理”：

- 技能是什么
- 技能从哪来
- 技能现在是否可信、兼容、可用
- 技能如何被注册、安装、同步、索引
- Skill Flywheel 产生的 draft 如何被保存、审批、进入 Skill Lab / install lifecycle

## 2. 推荐结构

```text
packages/skill/
├─ src/
│  ├─ contracts/
│  ├─ schemas/
│  ├─ drafts/
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
- `drafts/`
  - Skill Flywheel draft repository、decision service、reuse stats 和 persistent store adapter
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
- draft repository / service
- source sync
- trust / compatibility / availability policy

## 4. 禁止内容

- `.agents/skills/*/SKILL.md` 仓库级代理技能文档
- LangGraph graph
- agent orchestration
- tool executor 主流程
- memory / search 主链编排
- app 层 view model

## 5. 当前收敛策略

本轮已先完成最稳定入口的物理收敛：

- `src/contracts/skill-facade.ts`
- `src/registry/skill-registry.ts`
- `src/sources/agent-skill-loader.ts`

当前已落地：

- `src/drafts/repository.ts` 与 `src/drafts/service.ts`
  - 已作为 Skill Flywheel MVP 的 in-memory draft store 与决策语义宿主
  - persistent draft store 已通过 repository 边界接入；backend file-backed 路径装配在 `apps/backend/agent-server/src/runtime/skills/runtime-skill-storage.repository.ts`，不让 controller / frontend 依赖具体存储
- `src/repositories/skill-install.repository.ts`
  - 已提供 install receipt / installed record 的稳定 repository contract 与 in-memory 实现
  - backend runtime 写入 receipts / installed index 时必须通过该 contract，不再在 install service 内直接 fallback 到 root JSON
- `src/repositories/skill-source.repository.ts`
  - 已提供 source catalog 与 remote source cache repository contract
  - backend runtime 写入 remote source cache 时必须通过 `SkillSourceRemoteCacheRepository`
- `src/install/skill-artifact-fetcher.ts`
  - 已改为依赖 `SkillArtifactStorageRepository` 与 `SkillDraftRepository`
  - 不直接拼接 staging / drafts root 路径；backend 负责提供 file-backed storage facade
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

- 包根 `src/index.ts` 当前先通过 `src/contracts/skill-facade.ts` 暴露稳定导出
- `contracts/` 负责对外稳定边界，`registry/` 与 `sources/` 继续承载真实实现

后续源码收敛优先顺序：

1. 继续补 `schemas/`
2. 将剩余平铺 helper 收敛到 `shared/`、`utils/`
3. 继续保持包根入口直接对 canonical host 导出，不重新引入 legacy 根文件
4. 若迁移到数据库 / 对象存储，优先新增 backend repository 实现，不改动 service 调用方契约

## 6. 继续阅读

- [skill 文档目录](/docs/packages/skill/README.md)
- [Packages 分层与依赖约定](/docs/conventions/package-architecture-guidelines.md)
- [运行时技能与仓库代理技能边界](/docs/skills/runtime-skills-vs-repo-skills.md)
