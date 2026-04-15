# docs 目录规范

状态：current
适用范围：`docs/`
最后核对：2026-04-14

本目录用于沉淀仓库级规范、模块文档、联调结论与后续 AI 接手所需上下文。

如果想先搞清楚仓库当前各目录在做什么，先看：

- [目录地图](/Users/dev/Desktop/learning-agent-core/docs/repo-directory-overview.md)
- [apps 目录说明](/Users/dev/Desktop/learning-agent-core/docs/apps-overview.md)
- [packages 目录说明](/Users/dev/Desktop/learning-agent-core/docs/packages-overview.md)
- [data 目录说明](/Users/dev/Desktop/learning-agent-core/docs/data-overview.md)

当前高优先级入口：

- [项目规范总览](/Users/dev/Desktop/learning-agent-core/docs/project-conventions.md)
- [Docs 重构计划](/Users/dev/Desktop/learning-agent-core/docs/docs-refactor-plan.md)
- [前后端对接文档](/Users/dev/Desktop/learning-agent-core/docs/integration/frontend-backend-integration.md)
- [测试覆盖率基线](/Users/dev/Desktop/learning-agent-core/docs/evals/testing-coverage-baseline.md)

## 1. 放置规则

文档默认按模块归档到 `docs/<module>/`。

对于 `packages/*`，要求与 `agent-core` 保持一致，一律按包名建立独立目录：

- `packages/agent-core` -> `docs/agent-core/`
- `packages/config` -> `docs/config/`
- `packages/evals` -> `docs/evals/`
- `packages/memory` -> `docs/memory/`
- `packages/model` -> `docs/model/`
- `packages/report-kit` -> `docs/report-kit/`
- `packages/shared` -> `docs/shared/`
- `packages/skills` -> `docs/skills/`
- `packages/templates` -> `docs/templates/`
- `packages/tools` -> `docs/tools/`

应用与跨模块目录继续使用：

- `docs/backend/`
- `docs/frontend/agent-chat/`
- `docs/frontend/agent-admin/`
- `docs/integration/`

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
- 在最终交付说明里明确列出这次更新了哪些文档、清理了哪些旧文档
