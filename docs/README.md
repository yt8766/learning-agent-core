# docs 目录规范

状态：current
文档类型：index
适用范围：`docs/`
最后核对：2026-04-26

本目录用于沉淀仓库级规范、模块文档、接口契约、联调结论、AI 接手上下文、工作流记录与历史归档。

当前 `docs/` 根目录只保留本文件；其他文档必须进入下列一级目录。

当前文档：

- [架构文档](./architecture/README.md)
- [仓库地图](./maps/README.md)
- [研发与工程规范](./conventions/README.md)
- [应用文档](./apps/README.md)
- [Packages 文档](./packages/README.md)
- [智能体文档](./agents/README.md)
- [代理技能文档](./skills/README.md)
- [契约文档](./contracts/README.md)
- [联调文档](./integration/README.md)
- [QA 导航](./qa/README.md)
- [Evals 导航](./evals/README.md)
- [AI 对接上下文](./context/README.md)
- [工作流记录](./workflows/README.md)
- [历史归档](./archive/README.md)

## 阅读路径

第一次接手仓库时，推荐按下面顺序读：

1. [仓库目录概览](./maps/repo-directory-overview.md)
2. [架构总览](./architecture/ARCHITECTURE.md)
3. [项目规范总览](./conventions/project-conventions.md)
4. [AI 总交接文档](./context/ai-handoff.md)
5. [API 文档目录](./contracts/api/README.md)
6. [前后端集成链路](./integration/frontend-backend-integration.md)
7. [验证体系规范](./packages/evals/verification-system-guidelines.md)

改具体模块时：

- 改 `apps/*`：先看 [apps 文档目录](./apps/README.md)
- 改 `packages/*`：先看 [packages 文档目录](./packages/README.md)
- 改 `agents/*`：先看 [agents 文档目录](./agents/README.md)
- 改仓库代理技能 `.agents/skills/*`：先看 [skills 文档目录](./skills/README.md)
- 改接口、SSE、DTO 或 tool result：先看 [契约文档目录](./contracts/README.md)
- 改跨模块联调链路：先看 [integration 文档目录](./integration/README.md)
- 需要 AI 接手背景：先看 [context 交接目录](./context/README.md)

## 一级目录职责

- `architecture/`
  - 全局架构、长期边界、核心工作流与架构 ADR。
- `maps/`
  - 仓库目录地图、应用地图、包地图、数据地图与系统业务流概览。
- `conventions/`
  - 研发规范、工程约束、GitHub Flow、本地联调、模板和 prompt 规范。
- `apps/`
  - 应用层文档，尽量镜像真实 `apps/` 目录。
- `packages/`
  - 包级文档，必须镜像真实 `packages/` 目录。
- `agents/`
  - root 级 `agents/*` 文档。
- `skills/`
  - 仓库代理技能 `.agents/skills/*` 文档。
- `contracts/`
  - API / SSE / DTO / tool result 等稳定契约。
- `integration/`
  - 跨模块、前后端和端到端联调链路。
- `qa/`
  - 仓库级 QA、验证与质量门槛导航。
- `evals/`
  - 仓库级评测导航；包级 evals 实现文档仍在 `packages/evals/`。
- `context/`
  - AI 对接、包交接和 Agent 交接文档。
- `workflows/`
  - 当前仍可参考的工作流记录、执行流转说明和计划索引。
- `archive/`
  - 历史文档、迁移台账与不再代表当前实现的资料。

## 放置规则

文档默认按真实宿主或用途归档：

- `apps/backend/agent-server/*` -> `docs/apps/backend/agent-server/`
- `apps/worker/*` -> `docs/apps/backend/worker/`
- `apps/frontend/agent-chat/*` -> `docs/apps/frontend/agent-chat/`
- `apps/frontend/agent-admin/*` -> `docs/apps/frontend/agent-admin/`
- `apps/llm-gateway/*` -> `docs/apps/frontend/llm-gateway/`
- `packages/<pkg>/*` -> `docs/packages/<pkg>/`
- `agents/<agent>/*` -> `docs/agents/<agent>/`
- `.agents/skills/*` -> `docs/skills/`
- 跨模块契约 -> `docs/contracts/`
- 跨模块联调 -> `docs/integration/`
- AI handoff -> `docs/context/`
- 历史资料 -> `docs/archive/`

`docs/packages/` 必须与真实 `packages/` 目录保持一一对应。已删除包的历史资料不要继续放在 `docs/packages/`，应进入 `docs/archive/`。

## 元信息规则

每篇文档头部默认包含四行：

- `状态`
- `文档类型`
- `适用范围`
- `最后核对`

推荐状态：

- `current`
- `completed`
- `snapshot`
- `history`
- `archive`

推荐类型：

- `index`
- `architecture`
- `overview`
- `convention`
- `guide`
- `integration`
- `reference`
- `evaluation`
- `baseline`
- `plan`
- `history`
- `archive`
- `template`
- `note`

## 更新规则

每次完成功能、修复缺陷、调整链路、补充联调结论或确认新的实现约束后，必须同步更新相关文档。

最低要求：

1. 代码改动完成
2. 相关验证完成
3. 文档同步完成

缺少文档同步，不应视为真正交付完成。

## 清理规则

每次写新文档或更新功能时，都要顺手检查相关旧文档是否过时：

- 明显失效且无保留价值：删除
- 仍有参考价值但内容过期：标注过时并补正确入口
- 同主题多份冲突文档：合并或清理

不要长期保留互相矛盾的文档。

## 验证

文档改动至少运行：

```bash
pnpm check:docs
```

该命令会检查元信息、目录索引和本地 Markdown 链接。
