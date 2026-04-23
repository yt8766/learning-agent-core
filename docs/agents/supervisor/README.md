# supervisor 文档目录

状态：current
文档类型：index
适用范围：`agents/supervisor`
最后核对：2026-04-18

本目录用于沉淀 `agents/supervisor` 的专项文档。

当前文档：

- [package-structure-guidelines.md](/docs/agents/supervisor/package-structure-guidelines.md)

当前职责：

- supervisor 主控公开入口
- workflow preset / workflow route / specialist routing
- bootstrap skill 列表与 subgraph descriptor
- supervisor planning / dispatch / delivery 相关 flow
- `LibuRouterMinistry`、`HubuSearchMinistry`、`LibuDocsMinistry` 的真实宿主
- 不再代持 `coder` / `reviewer` / `data-report` 的实现类导出；跨 agent 装配统一经 `packages/platform-runtime`
- `SupervisorPlan` 的子任务现在可以显式声明 `requiredCapabilities`，不再只靠 dispatch 后处理补 capability 线索
- `LibuRouterMinistry.plan()` 与 `supervisor-plan-node` 现在能直接读取结构化 specialist route hints，而不是只从自由文本 `taskContext` 猜测规划方向
- fallback / plan normalization 现在会对 candidate richness 与 capability gap 做出不同规划反应，而不是始终输出同一份三段式默认票拟
- planner strategy 已被显式固化为 contract：首辅会把当前规划态记录为 `default`、`capability-gap` 或 `rich-candidates`，供 runtime checkpoint、runtime center 和 admin 详情面板直接消费
- planning stage 生成的 dispatch 指令会把官方 specialist / counselor 线索和 `requiredCapabilities` 一起压进 `dispatches` 记录，供 runtime checkpoint、runtime center projection 与 recover 直接复用
- 根入口导出的 bootstrap registry、workflow route/preset 与 main-route graph 已有专门 root export 测试锁定

优先阅读：

1. [package-structure-guidelines.md](/docs/agents/supervisor/package-structure-guidelines.md)
2. [架构总览](/docs/ARCHITECTURE.md)
3. [LangGraph 应用结构规范](/docs/langgraph-app-structure-guidelines.md)
