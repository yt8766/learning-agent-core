# Release Checklist

## 构建

- `pnpm build:lib`
- `pnpm --dir apps/backend/agent-server build`
- `pnpm --dir apps/frontend/agent-chat build`
- `pnpm --dir apps/frontend/agent-admin build`

## 类型检查

- `pnpm exec tsc -p packages/shared/tsconfig.json --noEmit`
- `pnpm exec tsc -p packages/agent-core/tsconfig.json --noEmit`
- `pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit`
- `pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit`
- `pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit`

## 主链路

- 新建会话不会造成整页刷新感
- 聊天消息可以继续发送、取消、恢复
- 审批仍在消息中完成
- Evidence、Learning、Think、ThoughtChain 仍可见
- `agent-admin` 六大中心还能正常展示

## 高风险变更

- 审批、Reject with feedback、Recover 语义未破坏
- LearningFlow 没有回退成纯候选展示
- MCP 没有绕过 risk / approval / trust 语义

## 结论输出

- 可发布
- 可发布但有残余风险
- 不建议发布
