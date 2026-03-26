# 项目规范总览

请优先查看以下文档：

- [AGENTS](./AGENTS.md)
- [README](./README.md)
- [架构总览](./docs/ARCHITECTURE.md)
- [前后端对接文档](./docs/frontend-backend-integration.md)
- [GitHub Flow 规范](./docs/github-flow.md)
- [后端规范](./docs/backend-conventions.md)
- [前端规范](./docs/frontend-conventions.md)
- [模板示例](./docs/project-templates.md)
- [测试规范](./docs/test-conventions.md)

总原则：

- 前端双应用分离：`agent-chat` 与 `agent-admin`
- `agent-chat` 采用 OpenClaw 模态，作为前线作战面
- `agent-admin` 作为平台控制台，承载六大中心
- 系统主线是开发自治，按“Human / Supervisor / 六部”方向演进
- 仓库级代理技能统一放在 `skills/*/SKILL.md`
- `packages/skills` 只承载运行时 skill 领域，不承载 Codex/Claude 技能说明
- 后端单 API + 独立 worker
- `packages/agent-core` 优先按 `adapters / flows / governance / graphs / runtime / session / shared / workflows / types` 分层
- 本地运行数据统一放仓库根级 `data/`
- 规范以文档为主，少量根级配置为辅

补充约束：

- 新设计优先采用 `supervisor / ministry / workflow / evidence / learning` 语义
- 共享类型里仍存在 `manager / research / executor / reviewer` 等兼容字段时，文档应显式标注“过渡兼容”，不要把旧模型继续当成目标架构
- 涉及 `packages/*` 的改动，优先执行 `pnpm build:lib`，再验证应用层
- 最低类型检查以 `AGENTS.md` 中列出的五条 `tsc --noEmit` 为准
- 前端 `apps/frontend/*/src` 下手写源码文件单文件不得超过 400 行，超过必须拆分组件、hooks、adapters、constants 或 types
- 如果需要清理磁盘空间，默认只允许清理仓库内可重建内容，例如构建产物、临时缓存、日志和测试生成文件
- 禁止为了释放磁盘空间删除用户的 Google Chrome 登录状态、浏览器 profile、Cookie、Local Storage 或会话数据
- 特别是不要触碰以下目录：
  - `~/Library/Application Support/Google/Chrome`
  - `~/Library/Caches/Google/Chrome`
- 根级清理脚本如果涉及文件删除，必须内置这两条路径的显式保护，不允许通过参数绕过
