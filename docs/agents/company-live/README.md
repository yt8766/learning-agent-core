# CompanyLive Agent

状态：current
文档类型：index
适用范围：`agents/company-live`
最后核对：2026-04-30

`agents/company-live` 当前是公司海外直播软件业务域的 MVP Agent 宿主。它不是通用媒体生成器；它先执行公司业务专业子 Agent，再把内容需求交给平台级 Audio / Image / Video 能力生成预览素材。

当前文档：

- 本文是 `agents/company-live` 的当前实现入口。

## 当前调试链路

入口：

- `executeCompanyLiveGraph(brief, registry, options)`：`agents/company-live/src/graphs/company-live.graph.ts`
- `options.onNodeComplete(trace)`：每个业务子 Agent 和媒体节点完成后都会回调，适合 workflow lab、SSE 或本地调试面板展示执行轨迹。

当前执行顺序固定为：

1. `growthAgent`
2. `operationsAgent`
3. `riskAgent`
4. `productAgent`
5. `financeAgent`
6. `supportAgent`
7. `contentAgent`
8. `intelligenceAgent`
9. `generateAudio`
10. `generateImage`
11. `generateVideo`
12. `assembleBundle`

## MVP 边界

8 个公司业务子 Agent 现在是 deterministic MVP 节点，落在：

- `agents/company-live/src/flows/company-live/nodes/business-agent-nodes.ts`

它们当前只输出可调试 trace：

- `nodeId`
- `domain`
- `summary`
- 输入 brief 的关键字段快照

这一版用于先打通可观察的横向调度链路。后续纵向增强时，再为每个子 Agent 补独立 prompt、schema、模型调用、业务数据来源和失败/跳过策略。

## 不能破坏的行为

- `ContentAgent` 不直接调用媒体 provider，只产生业务内容判断和素材需求上下文。
- Audio / Image / Video 仍是平台级专项 Agent / Domain 能力。
- MiniMax 等第三方 provider 不允许穿透进 `agents/company-live`。
- 所有节点都必须进入 `CompanyLiveNodeTrace`，确保调试面板能看到完整路径。

## 验证入口

受影响范围优先运行：

```bash
pnpm --filter @agent/agents-company-live test
pnpm --filter @agent/agents-company-live typecheck
```
