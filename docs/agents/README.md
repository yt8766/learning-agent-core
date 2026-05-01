# agents 文档目录

状态：current
文档类型：index
适用范围：`docs/agents/`
最后核对：2026-04-18

本目录用于沉淀 root 级 `agents/*` 的专项文档。

放置规则：

- agent 专项 graph、flow、类型、运行时 facade 的说明优先放这里
- 不把运行时基础包文档混进来；`packages/*` 仍放各自模块目录
- 只要某个 `agents/<domain>` 开始承载稳定 graph 或稳定领域类型，就应补对应 `docs/agents/<domain>/README.md` 或专题文档

当前文档：

- [supervisor 文档目录](/docs/agents/supervisor/README.md)
- [supervisor 包结构规范](/docs/agents/supervisor/package-structure-guidelines.md)
- [data-report 文档目录](/docs/agents/data-report/README.md)
- [data-report 包结构规范](/docs/agents/data-report/package-structure-guidelines.md)
- [data-report 类型导出说明](/docs/agents/data-report/type-barrel-notes.md)
- [company-live 文档目录](/docs/agents/company-live/README.md)
- [coder 文档目录](/docs/agents/coder/README.md)
- [coder 包结构规范](/docs/agents/coder/package-structure-guidelines.md)
- [reviewer 文档目录](/docs/agents/reviewer/README.md)
- [reviewer 包结构规范](/docs/agents/reviewer/package-structure-guidelines.md)

补充说明：

- `agents/*` 当前都已经不是占位目录
- root 级 `agents/*` 默认通过 `@agent/runtime` 消费共享 agent foundation 与 runtime facade；不直接依赖 `packages/runtime/src/*` 或 `runtime/agent-bridges/*`
- 后续涉及 graph / flow / root export 调整时，应同步更新对应 `docs/agents/<domain>/*`
