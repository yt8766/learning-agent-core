# docs 目录规范

状态：current
文档类型：index
适用范围：`docs/`
最后核对：2026-04-22

本目录用于沉淀仓库级规范、模块文档、联调结论与后续 AI 接手所需上下文。

如果想先搞清楚仓库当前各目录在做什么，先看：

- [目录地图](/docs/repo-directory-overview.md)
- [apps 目录说明](/docs/apps-overview.md)
- [packages 目录说明](/docs/packages-overview.md)
- [data 目录说明](/docs/data-overview.md)

当前高优先级入口：

- [项目规范总览](/docs/project-conventions.md)
- [AI / 包交接文档入口](/docs/context/README.md)
- [Runtime 分层 ADR](/docs/runtime/runtime-layering-adr.md)
- [目录地图](/docs/repo-directory-overview.md)
- [packages 目录说明](/docs/packages-overview.md)
- [Packages 分层与职责矩阵](/docs/packages-overview.md#按包职责矩阵)
- [目录聚合入口分级](/docs/packages-overview.md#目录聚合入口分级)
- [Packages 阶段收官报告](/docs/core/package-finalization-report.md)
- [Compat 入口收缩候选](/docs/core/package-compat-sunset-candidates.md)
- [Packages 分层与依赖约定](/docs/package-architecture-guidelines.md)
- [API 文档目录](/docs/api/README.md)
- [前后端集成链路](/docs/integration/frontend-backend-integration.md)
- [本地联调指南](/docs/local-development-guide.md)

本目录主文档：

- 仓库阅读入口：[repo-directory-overview.md](/docs/repo-directory-overview.md)
- 全局规范入口：[project-conventions.md](/docs/project-conventions.md)
- API 契约入口：[api/README.md](/docs/api/README.md)
- 跨模块集成链路：[integration/frontend-backend-integration.md](/docs/integration/frontend-backend-integration.md)
- AI / 包交接入口：[context/README.md](/docs/context/README.md)

按需参考入口：

- [历史归档目录](/docs/archive/README.md)
- [Docs 重构计划（已归档）](/docs/archive/docs-refactor-plan.md)
- [测试覆盖率基线](/docs/evals/testing-coverage-baseline.md)

## 0.1 阅读路径

如果你是第一次接手这个仓库，推荐按下面顺序读：

1. 先看“仓库现在是什么”：
   - [目录地图](/docs/repo-directory-overview.md)
   - [apps 目录说明](/docs/apps-overview.md)
   - [packages 目录说明](/docs/packages-overview.md)
2. 再看“全局规则是什么”：
   - [项目规范总览](/docs/project-conventions.md)
   - [Runtime 分层 ADR](/docs/runtime/runtime-layering-adr.md)
   - [Packages 分层与依赖约定](/docs/package-architecture-guidelines.md)
   - [Packages 分层与职责矩阵](/docs/packages-overview.md#按包职责矩阵)
   - [目录聚合入口分级](/docs/packages-overview.md#目录聚合入口分级)
   - [Packages 阶段收官报告](/docs/core/package-finalization-report.md)
   - [Compat 入口收缩候选](/docs/core/package-compat-sunset-candidates.md)
   - [测试规范](/docs/test-conventions.md)
3. 如果你要改具体模块：
   - 先看交接入口：[docs/context/README.md](/docs/context/README.md)
   - 后端：先看 [docs/backend/README.md](/docs/backend/README.md)
   - 前端：先看 [docs/frontend/README.md](/docs/frontend/README.md)
   - 前端 chat：再看 [docs/frontend/agent-chat/README.md](/docs/frontend/agent-chat/README.md)
   - 前端 admin：再看 [docs/frontend/agent-admin/README.md](/docs/frontend/agent-admin/README.md)
   - API 契约：先看 [docs/api/README.md](/docs/api/README.md)
   - runtime / session / graph：先看 [docs/runtime/README.md](/docs/runtime/README.md)
   - root 级 agents：先看 [docs/agents/README.md](/docs/agents/README.md)
   - 运行时技能：先看 [docs/skill-runtime/README.md](/docs/skill-runtime/README.md)
   - 跨模块联调：先看 [docs/integration/README.md](/docs/integration/README.md)
   - 运行时质量与评测：先看 [docs/evals/README.md](/docs/evals/README.md)
4. 只有在需要追迁移背景时，再看：
   - [历史归档目录](/docs/archive/README.md)

## 0. 元信息规则

每篇文档头部默认包含这四行：

- `状态`
- `文档类型`
- `适用范围`
- `最后核对`

推荐类型：

- `index`
  - 目录入口与阅读导航
- `architecture`
  - 长期架构方向
- `overview`
  - 当前目录或模块概览
- `convention`
  - 规范、约束、治理规则
- `guide`
  - 上手、联调、迁移、使用指导
- `integration`
  - 跨模块对接与协议链路
- `reference`
  - 事实说明、边界说明、专题资料
- `evaluation`
  - 评测、验证、质量基建说明
- `baseline`
  - 带明确时间点的快照基线，不代表实时状态
- `plan`
  - 阶段性计划与执行清单
- `history`
  - 历史迁移资料，保留参考价值但不作为当前宿主
- `archive`
  - 归档文档，不再按当前实现维护

推荐状态：

- `current`
- `completed`
- `snapshot`
- `history`
- `archive`

## 1. 放置规则

文档默认按模块归档到 `docs/<module>/`。

对于 `packages/*`，默认按包名建立独立目录；已删除包的历史迁移文档保留在对应历史目录：

- 已删除的 `packages/agent-core` 历史迁移档案 -> `docs/archive/agent-core/`
- `packages/config` -> `docs/config/`
- `packages/core` -> `docs/core/`
- `packages/evals` -> `docs/evals/`
- `packages/memory` -> `docs/memory/`
- 已删除的 `packages/model` 历史说明 -> `docs/archive/model/`
- `packages/platform-runtime` -> `docs/platform-runtime/`
- `packages/report-kit` -> `docs/report-kit/`
- `packages/runtime` -> `docs/runtime/`
- `packages/shared` -> `docs/shared/`
- `packages/skill-runtime` -> `docs/skill-runtime/`
- `packages/templates` -> `docs/templates/`
- `packages/tools` -> `docs/tools/`

应用与跨模块目录继续使用：

- `docs/backend/`
- `docs/frontend/agent-chat/`
- `docs/frontend/agent-admin/`
- `docs/integration/`
- `docs/agents/`
- `docs/archive/`

`docs/` 根目录只保留以下内容：

- 架构总览
- 全局规范
- 跨模块共享约定
- 不适合归属到单一模块的总说明

不要再把新的模块专项文档直接平铺到 `docs/` 根目录。

## 2. 更新规则

以后每次完成功能、修复缺陷、调整链路、补充联调结论或确认新的实现约束后，必须同步更新文档。

最低要求：

1. 代码改动完成
2. 相关验证完成
3. 文档同步完成

缺少第 3 步，不应视为真正交付完成。

## 3. 文档内容要求

文档优先写“当前真实实现”，不要只写理想设计。

建议至少包含：

- 入口与模块边界
- 真实链路与事件
- 关键开关、缓存策略、模型路由或约束
- 已踩过的坑、误判点、回归风险
- 后续 AI 接手时应优先阅读的位置

## 4. 过时文档清理

每次写新文档或更新功能时，都要顺手检查相关旧文档是否已经过时。

处理原则：

- 明显失效且无保留价值：直接删除
- 仍有部分参考价值但内容过期：明确标注过时并补充正确入口
- 同主题多份冲突文档：合并或清理，避免知识分叉

禁止长期保留互相矛盾的文档。

## 5. 推荐做法

- 改一个模块，就优先更新该模块自己的 `docs/<module>/README.md`
- 改一个 `package`，就优先更新对应的 `docs/<package>/README.md`
- 新增专项说明时，尽量同时补对应模块目录下的索引
- 如果是跨模块链路，优先写到 `docs/integration/`
- 计划、基线、迁移快照不要伪装成长期规范；应通过 `文档类型` 与 `状态` 明确标识
- 历史资料统一收进 `docs/archive/`，不要继续和当前实现文档混放
- 运行 `pnpm check:docs`，至少确认元信息、目录索引、旧路径引用和本地 Markdown 链接没有回归
- 新增文档时优先使用 `pnpm new:doc docs/<module>/<name>.md` 生成标准骨架，再补内容
- 在最终交付说明里明确列出这次更新了哪些文档、清理了哪些旧文档
- 目录级 `README.md` 默认至少回答三件事：先读哪篇、改动前看哪篇、该目录的主文档是谁
