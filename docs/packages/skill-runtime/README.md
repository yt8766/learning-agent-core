# skill-runtime 文档目录

状态：current
文档类型：index
适用范围：`docs/packages/skill-runtime/`
最后核对：2026-04-26

本目录用于沉淀 `packages/skill-runtime` 相关文档。

这里描述的是运行时技能资产，不是仓库级 `.agents/skills/*` 代理技能文档。

包边界：

- 职责：
  - skill manifest schema
  - runtime skill registry
  - skill draft repository / service
  - source sync
  - install receipt / integrity / artifact materialization
  - trust / compatibility / availability 基础判断
  - approved draft 到 install / intake candidate 的稳定投影
- 允许：
  - registry
  - draft store
  - manifest loader
  - source catalog
  - installer / receipt
  - lifecycle policy
- 禁止：
  - `.agents/skills/*` 仓库代理技能说明
  - agent graph
  - tool executor 主流程
  - memory / search 主链编排
- 依赖方向：
  - 只依赖 `@agent/config`、`@agent/core` 和必要第三方库
  - 由 `@agent/runtime`、`apps/*` 或 admin/lab 相关能力消费
- 公开入口：
  - 根入口：`@agent/skill-runtime`
  - `src/contracts/skill-runtime-facade.ts` 当前作为包根稳定导出的 facade contract
  - 当前真实宿主：
    - `src/drafts/repository.ts`
    - `src/drafts/service.ts`
    - `src/registry/skill-registry.ts`
    - `src/sources/agent-skill-loader.ts`
    - `src/catalog/skill-card-listing.ts`
    - `src/install/skill-auto-install.ts`
    - `src/install/skill-artifact-fetcher.ts`
    - `src/install/remote-skill-install-paths.ts`
    - `src/sources/skill-search-resolution.ts`
    - `src/drafts/repository.ts`
    - `src/drafts/install-candidate.ts`
  - `@agent/skill-runtime` 根入口当前先通过 `contracts/skill-runtime-facade.ts` 导出上述 canonical host；legacy 根文件 `src/skill-registry.ts` 与 `src/agent-skill-loader.ts` 已删除
  - backend 的 `runtime/domain/skills/runtime-skill-card-listing.ts`、`runtime/domain/skills/runtime-skill-auto-install.ts` 与 `runtime/domain/skills/runtime-skill-search-resolution.ts` 当前只保留 compat re-export

约定：

- `packages/skill-runtime` 的专项文档统一放在 `docs/packages/skill-runtime/`
- 新增 skill source、manifest 字段、install 流程或 lifecycle policy 后，需同步更新本目录文档
- 不要再把运行时技能文档混写进 `docs/skills/*`

## Agent Workspace / Skill Flywheel 下一阶段

`packages/skill-runtime` 当前已承载 Skill Flywheel 的 in-memory / file-backed draft repository 与 `SkillDraftService` MVP 语义。下一阶段生产化应继续在本包内强化 persistent draft store 边界，而不是让 backend controller 或 frontend 依赖具体存储：

- Draft repository 可替换为数据库或外部持久实现，但必须保留 create、list、approve、reject、promote、retire、reuse stats、高风险 evidence gate 和相反终态冲突语义。
- File-backed repository 已保存 draft body、sourceTaskId、evidence refs、risk level 和 reuse stats；后续生产化还需要补 decision history、sessionId、install candidate / receipt 关联和 lifecycle 状态。
- Approve draft 只代表进入 Skill Lab / Skill Source Center 治理链路；正式安装、manifest 校验、trust policy、compatibility、receipt、rollback 和 marketplace/source 同步仍由 install lifecycle 承接。
- Approved draft 进入 Skill Lab / install intake 前必须先走 `buildSkillDraftInstallCandidate(draft)` 投影；该纯函数只接受 `active` / `trusted` draft，并只输出 `title`、`description`、`bodyMarkdown`、`requiredTools`、`requiredConnectors`、`sourceTaskId`、`sourceEvidenceIds`、`riskLevel`、`confidence`、`reuseStats` 白名单字段。
- `SkillArtifactFetcher` 已支持 `entry: "workspace-draft:<draftId>"`。它会从 `data/skills/drafts/workspace-drafts.json` 读取 `active` / `trusted` draft，在 staging 目录生成 `SKILL.md` 与 `manifest.json`，再交给既有 install lifecycle promote 到安装目录。
- Install candidate 不携带 repository 内部字段、审批人、workspaceId、authorId、时间戳、source vendor payload 或 raw metadata；后续 backend / frontend 只能消费投影结果，不应直接复用 `SkillDraftRecord` 作为 install/intake payload。
- Workspace projection 只能读取 draft / install 摘要，不应读取 repository 内部索引、raw metadata、source credential 或 marketplace response。

当前文档：

- [package-structure-guidelines.md](/docs/packages/skill-runtime/package-structure-guidelines.md)

## Skill Draft Repository

`packages/skill-runtime/src/drafts/repository.ts` 当前提供两个 draft repository：

- `InMemorySkillDraftRepository`：测试和短生命周期进程使用。
- `FileSkillDraftRepository`：将 `SkillDraftRecord[]` 持久化到调用方传入的 JSON 文件路径。

`FileSkillDraftRepository` 在首次读取时会初始化空数组文件；写入时先在同目录写临时文件，再通过 `rename` 替换目标文件，避免直接半写目标 JSON。持久化前会按 `SkillDraftRecord` 稳定字段白名单克隆记录，不把运行时临时字段、原始模型 metadata 或 provider payload 追加进 draft JSON。

当前受限于本轮改动范围未新增包依赖，文件仓库使用 Node `fs/promises` 完成安全写入；如果后续允许调整 `packages/skill-runtime/package.json`，可再按仓库默认偏好切换为显式声明的 `fs-extra`。
