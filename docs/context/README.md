# Context 交接目录

状态：current
文档类型：index
适用范围：`docs/context/*`
最后核对：2026-04-19

本目录专门沉淀“接手上下文”，用于帮助后续 AI 或开发者快速理解当前仓库、当前包边界，以及改动前应先看的主文档。

本目录主文档：

- 总交接入口：[ai-handoff.md](/docs/context/ai-handoff.md)

优先入口：

- 总交接文档：[ai-handoff.md](/docs/context/ai-handoff.md)
- 仓库级目录说明：[repo-directory-overview.md](/docs/maps/repo-directory-overview.md)
- 包职责总览：[packages-overview.md](/docs/maps/packages-overview.md)
- 项目规范总览：[project-conventions.md](/docs/conventions/project-conventions.md)

## 阅读顺序

1. 先看 [ai-handoff.md](/docs/context/ai-handoff.md)，建立仓库级上下文。
2. 再看目标包对应的交接文档，确认真实宿主、边界和验证方式。
3. 最后进入该包自己的 `README / package-structure-guidelines / integration` 文档继续下钻。

## packages 交接文档

- [adapters-package-handoff.md](/docs/context/adapters-package-handoff.md)
- [agent-kit-package-handoff.md](/docs/context/agent-kit-package-handoff.md)
- [config-package-handoff.md](/docs/context/config-package-handoff.md)
- [core-package-handoff.md](/docs/context/core-package-handoff.md)
- [evals-package-handoff.md](/docs/context/evals-package-handoff.md)
- [knowledge-package-handoff.md](/docs/context/knowledge-package-handoff.md)
- [memory-package-handoff.md](/docs/context/memory-package-handoff.md)
- [platform-runtime-package-handoff.md](/docs/context/platform-runtime-package-handoff.md)
- [report-kit-package-handoff.md](/docs/context/report-kit-package-handoff.md)
- [runtime-package-handoff.md](/docs/context/runtime-package-handoff.md)
- [skill-runtime-package-handoff.md](/docs/context/skill-runtime-package-handoff.md)
- [templates-package-handoff.md](/docs/context/templates-package-handoff.md)
- [tools-package-handoff.md](/docs/context/tools-package-handoff.md)

## agents 交接文档

- [supervisor-agent-handoff.md](/docs/context/supervisor-agent-handoff.md)
- [data-report-agent-handoff.md](/docs/context/data-report-agent-handoff.md)
- [coder-agent-handoff.md](/docs/context/coder-agent-handoff.md)
- [reviewer-agent-handoff.md](/docs/context/reviewer-agent-handoff.md)

## 使用约束

- 本目录写“当前真实实现”和“接手注意事项”，不替代正式架构文档。
- 某个包边界、入口或验证方式发生变化时，应同步更新该包交接文档与总交接文档。
- 如果某个包已有更细的模块文档，交接文档应优先链接过去，不要复制出第二份长期规范。
