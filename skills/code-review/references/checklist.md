# Code Review Checklist

## 通用

- 改动是否改变了现有对外语义
- 是否引入未处理的异常路径
- 是否存在明显死代码或重复逻辑
- 是否破坏已有命名和目录边界

## 前端

- 是否影响消息主链渲染
- 审批、Evidence、Learning、Think、ThoughtChain 是否仍可见
- 是否引入整页刷新感、状态闪烁或重复请求
- 是否有错误的 loading / streaming 体验
- 是否有会话状态串线

## 后端

- session / task / checkpoint / event 语义是否一致
- cancel / recover / approval 是否仍可恢复
- 是否有新字段未进入 shared 类型
- 是否有控制器、服务、agent-core 三层语义不一致

## agent-core

- 是否破坏六部治理方向
- 是否把流程重新耦合回单一 orchestrator
- LearningFlow 是否还能继续沉淀 memory / rule / skill
- MCP 能力是否仍带 risk / approval / trust 语义

## 构建与包

- app 是否错误引用 `packages/*/src`
- `package.json` exports 是否仍指向 `build/*`
- `build:lib` 是否仍是串行执行
- `tsup` 入口是否只包含真实运行时 `.ts`

## 验证

- 是否需要运行 `pnpm build:lib`
- 是否需要运行对应 `tsc --noEmit`
- 是否需要运行特定测试
- 如果没跑，是否明确说明风险
