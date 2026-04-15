# Data 目录说明

状态：current
适用范围：`data/*`
最后核对：2026-04-14

`data/` 放本地运行数据，不放源码。

当前目录职责：

- `data/runtime`
  - 运行态持久化数据，例如任务状态、briefings、schedules、缓存衍生物
- `data/memory`
  - 本地 memory / rule / 相关存储
- `data/knowledge`
  - 知识检索链路的 catalog、sources、chunks、vectors、ingestion 产物
- `data/skills`
  - 运行时技能安装、稳定区、实验区和安装回执

约束：

- 这是运行时产物目录，不要把业务源码、长期设计文档或手写实现放进来
- 修改路径策略时，优先同步更新 `@agent/config` 和相关文档

建议阅读：

- [README](/Users/dev/Desktop/learning-agent-core/README.md)
- [config 文档目录](/Users/dev/Desktop/learning-agent-core/docs/config/README.md)
- [Runtime State Machine](/Users/dev/Desktop/learning-agent-core/docs/runtime-state-machine.md)
