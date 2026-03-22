# 项目规范总览

请优先查看以下文档：

- [README](./README.md)
- [后端规范](./docs/backend-conventions.md)
- [前端规范](./docs/frontend-conventions.md)
- [模板示例](./docs/project-templates.md)
- [测试规范](./docs/test-conventions.md)

总原则：

- 前端双应用分离：`agent-chat` 与 `agent-admin`
- 后端单 API + 独立 worker
- Agent 保持单包 `packages/agent-core`，但内部按 `models / agents / session / graph / runtime / types` 分层
- 本地运行数据统一放仓库根级 `data/`
- 规范以文档为主，少量根级配置为辅
