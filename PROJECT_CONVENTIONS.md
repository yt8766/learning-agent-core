# 项目规范总览

请优先查看以下文档：

- [AGENTS](./AGENTS.md)
- [README](./README.md)
- [GitHub Flow 规范](./docs/github-flow.md)
- [后端规范](./docs/backend-conventions.md)
- [前端规范](./docs/frontend-conventions.md)
- [模板示例](./docs/project-templates.md)
- [测试规范](./docs/test-conventions.md)

总原则：

- 前端双应用分离：`agent-chat` 与 `agent-admin`
- `agent-chat` 采用 OpenClaw 模态，作为前线作战面
- `agent-admin` 作为平台控制台，承载六大中心
- 仓库级代理技能统一放在 `skills/*/SKILL.md`
- `packages/skills` 只承载运行时 skill 领域，不承载 Codex/Claude 技能说明
- 后端单 API + 独立 worker
- Agent 保持单包 `packages/agent-core`，但内部按 `models / agents / session / graph / runtime / types` 分层
- 本地运行数据统一放仓库根级 `data/`
- 规范以文档为主，少量根级配置为辅
