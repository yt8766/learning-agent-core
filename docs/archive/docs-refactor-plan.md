# Docs 重构计划

状态：completed
文档类型：plan
适用范围：`docs/`
最后核对：2026-04-15

说明：本计划已完成，现作为文档治理历史清单保留，不再代表当前待办列表。

本文件用于整理当前仓库文档仍可优化的空间，并给出可直接执行的收口清单。

## 1. 目标

当前文档体系已经补上了基础目录地图，但仍存在以下问题：

- 部分历史报告型文档仍放在 `docs/` 根目录，容易误导后续 AI
- 多个模块目录只有 `README` 索引，没有真实专题文档
- 规范文档、当前实现文档、阶段性报告文档混在一起
- 个别文档内容与当前真实目录结构不完全一致

这轮重构目标不是“文档越多越好”，而是让后续接手者能快速判断：

- 当前真实实现是什么
- 哪些文档是规范
- 哪些文档只是历史参考
- 每个模块优先读哪里

## 2. 立即处理

### 2.1 归档历史报告

- [x] 新建 `docs/archive/agent-core/archive/`
- [x] 移动 `docs/agent-core-structure-report.md` 到 `docs/archive/agent-core/archive/agent-core-structure-report.md`
- [x] 移动 `docs/flow-prompt-schema-optimization-report.md` 到 `docs/archive/agent-core/archive/flow-prompt-schema-optimization-report.md`
- [x] 给两篇文档头部补充：
  - `状态：archive`
  - `说明：历史阶段报告，不代表当前实现`
- [x] 在 `docs/archive/agent-core/README.md` 增加“历史归档文档”索引

### 2.2 修正文档和现状不一致

- [x] 更新 `docs/conventions/local-development-guide.md` 中与当前 `data/*` 目录不一致的描述
- [x] 重写 `docs/conventions/project-template-guidelines.md` 中过时的 `agent-core` 目录模板
- [x] 核对 `docs/conventions/frontend-conventions.md` 与当前 `agent-chat`、`agent-admin` 的 `src/features/*` 目录
- [x] 核对 `docs/conventions/backend-conventions.md` 与当前 `apps/backend/agent-server/src/runtime/*` 的实际结构

### 2.3 收拢 `docs/` 根目录

- [x] 将 `docs/frontend-backend-integration.md` 迁到 `docs/integration/frontend-backend-integration.md`
- [x] 将 `docs/testing-coverage-baseline.md` 迁到 `docs/packages/evals/testing-coverage-baseline.md`
- [x] 更新 `docs/README.md` 中的索引路径
- [x] 更新 `README.md` 中相关入口链接

## 3. 本周补齐

### 3.1 给空壳模块补真实专题文档

优先补这些文档：

- [x] `docs/packages/config/runtime-profiles.md`
- [x] `docs/packages/memory/storage-and-search.md`
- [x] `docs/model/provider-and-fallback.md`
- [x] `docs/packages/tools/runtime-governance-and-sandbox.md`
- [x] `docs/packages/report-kit/data-report-pipeline.md`
- [x] `docs/skills/runtime-skills-vs-repo-skills.md`
- [x] `docs/packages/templates/template-registry-and-usage.md`
- [x] `docs/packages/evals/prompt-regression-and-thresholds.md`

### 3.2 给索引页补“当前专题列表”

- [x] 更新 `docs/packages/config/README.md`
- [x] 更新 `docs/packages/memory/README.md`
- [x] 更新 `docs/model/README.md`
- [x] 更新 `docs/packages/tools/README.md`
- [x] 更新 `docs/packages/report-kit/README.md`
- [x] 更新 `docs/skills/README.md`
- [x] 更新 `docs/packages/templates/README.md`
- [x] 更新 `docs/packages/evals/README.md`

## 4. 后续拆分

### 4.1 拆大文档

- [x] 将前后端联调文档拆成：
  - `docs/integration/chat-session-sse.md`（历史路径；当前 API 契约已迁到 `docs/contracts/api/agent-chat.md`）
  - `docs/integration/runtime-centers-api.md`（历史路径；当前 API 契约已拆到 `docs/contracts/api/agent-admin.md` 与 `docs/contracts/api/runtime.md`）
  - `docs/integration/approval-recovery.md`（历史路径；当前 API 契约已迁到 `docs/contracts/api/approvals.md`）
- [x] 将架构文档拆成：
  - `docs/architecture/ARCHITECTURE.md` 只保留长期方向
  - `docs/archive/agent-core/runtime-current-state.md`
  - `docs/maps/system-flow-current-state.md`
- [x] 将测试文档拆成：
  - `docs/conventions/test-conventions.md`
  - `docs/packages/evals/testing-coverage-baseline.md`
  - `docs/packages/evals/prompt-regression-and-thresholds.md`

### 4.2 清理命名

- [x] 规范类文档统一使用 `*-conventions.md` / `*-guidelines.md`
- [x] 当前实现类文档统一使用 `*-overview.md` / `*-current-state.md`
- [x] 历史类文档统一放 `archive/` 或明确标记 `archive`
- [x] 阶段性快照类文档在标题或文件名中显式带日期或 `baseline`

## 5. 治理机制

### 5.1 统一文档模板

后续新增模块文档建议固定包含以下部分：

- 文档目的
- 当前入口
- 目录职责
- 主链路
- 风险点
- 继续阅读

### 5.2 文档状态头

建议给重要文档统一增加头部元信息：

```md
状态：current
适用范围：packages/agent-core
最后核对：2026-04-14
```

历史文档建议改成：

```md
状态：archive
说明：历史阶段报告，不代表当前实现
```

### 5.3 交付规则

以后每次功能交付都应明确说明：

- 更新了哪些文档
- 清理了哪些旧文档
- 后续 AI 应优先阅读哪些文档

## 6. 推荐执行顺序

1. 历史报告归档
2. `docs/` 根目录文档迁移
3. `config / memory / tools / report-kit / skills` 五篇专题文档
4. 大文档拆分
5. 模板与状态标记统一

## 7. 后续 AI 优先阅读

- `README.md`
- `docs/README.md`
- `docs/maps/repo-directory-overview.md`
- `docs/docs-refactor-plan.md`
- 对应模块自己的 `README` 与专题文档
