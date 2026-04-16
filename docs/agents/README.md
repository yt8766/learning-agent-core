# agents 文档目录

状态：current
文档类型：index
适用范围：`docs/agents/`
最后核对：2026-04-16

本目录用于沉淀 root 级 `agents/*` 的专项文档。

放置规则：

- agent 专项 graph、flow、类型、运行时 facade 的说明优先放这里
- 不把运行时基础包文档混进来；`packages/*` 仍放各自模块目录
- 只要某个 `agents/<domain>` 开始承载稳定 graph 或稳定领域类型，就应补对应 `docs/agents/<domain>/README.md` 或专题文档

当前文档：

- [data-report 文档目录](/Users/dev/Desktop/learning-agent-core/docs/agents/data-report/README.md)
- [data-report 类型导出说明](/Users/dev/Desktop/learning-agent-core/docs/agents/data-report/type-barrel-notes.md)

后续建议：

- `agents/supervisor` 补 `README` 或 graph/flow 专题说明
- `agents/coder`、`agents/reviewer` 一旦不再只是占位，也应补对应文档
