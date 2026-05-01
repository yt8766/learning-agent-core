# LangSmith Studio Graph Mode 参考行为

状态：current
文档类型：reference
适用范围：`apps/frontend/agent-admin/src/features/workflow-lab`
最后核对：2026-04-30

## 参考入口

- 目标页面：`https://smith.langchain.com/o/1a6ff1f8-4440-4e63-b2fd-b92b0ef60e98/studio/connect?mode=graph`
- 访问结果：页面进入 LangSmith 登录 / 注册界面，未登录状态下无法直接观察目标组织的 Studio 图调试界面。未输入账号、密码或第三方登录信息。
- 可采信公开来源：
  - `https://docs.langchain.com/langsmith/studio`
  - `https://docs.langchain.com/langsmith/quick-start-studio`
  - `https://github.com/langchain-ai/langsmith-sdk`

## 可复用调试语义

LangSmith Studio Graph mode 的公开文档强调以下能力：

- 可视化 graph architecture。
- 运行并交互 agent。
- 查看运行过程中的节点遍历与中间状态。
- 连接 traces、evaluation、prompt engineering。
- 管理 assistants、threads、memory。
- 通过 time travel 调试 agent state。
- 可连接云端 / self-hosted graph，也可连接本地 Agent Server。

## 本地 Workflow Lab 对齐原则

本轮不做像素级复制，也不引入 LangSmith 账号或外部 SDK 依赖；只把 Graph mode 的关键调试结构收敛到 `agent-admin`：

- 中栏顶部保留运行参数，便于快速启动 run。
- 中栏新增 graph canvas，使用本地 `workflowRegistry.graph.nodes/edges` 渲染节点、边、运行状态与可选节点。
- graph canvas 下方保留原始 node timeline，作为事件流 ledger。
- 右栏继续承载选中节点的输入、输出、错误与耗时详情。
- 历史 trace 后续可复用同一 `StreamNodeEvent` 形态回灌到 graph canvas 与详情面板。

## 已知差异

- 未登录无法抓取 LangSmith Studio 真实组织页面的精确 CSS、布局尺寸和交互状态。
- 当前实现优先补齐调试信息架构，不做 LangSmith 品牌视觉克隆。
- 当前 graph canvas 是路径式拓扑调试器，不依赖第三方图布局库；后续如果节点规模变大，再评估 Mermaid / React Flow / Cytoscape 等 adapter 边界。
