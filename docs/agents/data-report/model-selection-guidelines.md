# data-report 选模收敛说明

状态：current
文档类型：convention
适用范围：`agents/data-report`、`apps/backend/agent-server/src/chat/chat-report-schema.helpers.ts`
最后核对：2026-04-18

## 背景

`agents/data-report` 过去在多个节点里直接写死了具体 model id，例如 `GLM-4.7-FlashX`、`glm-5.1`、`glm-4.7-flash`。这会带来两个问题：

- 切换 provider 后，这些 model id 可能根本不存在
- 同一条 graph 中不同节点需要“快模型 / 重模型”，但不应该让节点自己认识厂商型号

## 当前规则

现在 `data-report` 统一采用“语义化 selector -> 运行时解析”的方式选模。

- 节点策略只声明：
  - `tier: fast | balanced | quality`
  - 可选 `role: manager | research | executor | reviewer`
  - 可选 `preferredModelIds`
- 真正的 model id 由运行时根据当前 `llm.supportedModels()` 和后端传入的偏好一起解析
- 显式 `dto.modelId` 仍然优先级最高，会直接覆盖节点默认策略

## 默认语义

- `fast`
  - 用于分析、patch intent、轻量 schema 片段生成
  - 优先命中 `flash / turbo / highspeed / mini / airx / air / haiku` 等低延迟型号
- `quality`
  - 用于 schema spec、复杂 section/schema patch
  - 优先命中 `glm-5* / m2.7 / m2.5 / opus / sonnet / pro / max / thinking` 等重推理型号
- `preferredModelIds`
  - 由后端把当前 runtime profile、provider 路由、预算 fallback 等上下文压成候选提示
  - 如果当前 provider 确实支持这些型号，就优先使用这些候选

## 改动约束

后续如果继续扩展 `agents/data-report` 选模，遵守以下规则：

- 不要在节点文件里再直接写死具体厂商 model id
- 新节点优先复用现有 selector 语义，不要自己发明 `fast-lite`、`super-heavy` 之类新层级
- 如果某条链路必须绑定具体型号，优先在应用装配层传 `preferredModelIds` 或显式 `modelId`
- 如果新增 provider 且现有关键字启发式不够，需要补到统一的 model selection helper，而不是在单个节点局部兜底

## 关键入口

- 语义策略定义：`agents/data-report/src/flows/data-report-json/model-policy.ts`
- 通用解析 helper：`agents/data-report/src/utils/model-selection.ts`
- 后端运行时偏好注入：`apps/backend/agent-server/src/chat/chat-report-schema.helpers.ts`
