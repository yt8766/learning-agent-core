# 提示词规范

状态：current
文档类型：convention
适用范围：`packages/runtime`、`agents/*`、`packages/adapters` 中进入模型的提示词资产
最后核对：2026-04-15

这份规范只回答一个问题：当前仓库里，提示词应该如何组织，才能既稳定又可演进。

## 1. 适用范围

本文适用于：

- `packages/runtime/src/flows/**/prompts/*`
- `agents/*/src/flows/**/prompts/*`
- `packages/adapters/src/prompts/*`
- 需要进入模型的系统提示词、结构化输出提示词、few-shot 示例与提示词格式化 helper

本文不适用于：

- 前端展示文案
- `service` / `controller` 内联字符串
- 只在测试里临时拼的 mock 文本

## 2. 为什么这样组织

提示词在这个仓库里不是“写一段长字符串”这么简单，它和这些东西一起构成可运行合同：

- 模型选择
- schema 约束
- JSON 安全附加
- 重试反馈
- 评测回归

所以提示词规范优先追求：

- 可定位：知道提示词放在哪
- 可校验：知道输出要满足什么结构
- 可复用：知道哪些段落应进入共享 helper
- 可回归：知道改完如何验证

不采用“每个节点各写各的长 prompt”的原因也很明确：这种方式短期快，长期一定会把角色语义、输出格式和安全约束写散。

## 3. 放置规则

提示词默认贴近真实宿主放置：

- runtime 主链提示词：`packages/runtime/src/flows/<domain>/prompts/`
- 专项 agent 提示词：`agents/<domain>/src/flows/<domain>/prompts/`
- 跨宿主共享的 JSON 安全附加：`packages/adapters/src/prompts/`
- 通用结构化模板 helper：`packages/adapters/src/structured-output/` 或对应宿主的 `src/utils/prompts/`

不要再把长系统提示词散落到：

- `graph.ts`
- `workflow.ts`
- `service.ts`
- `controller.ts`

为什么这样优化：提示词需要和节点、schema、解析策略一起演进，离实现太远时最容易过期。  
为什么不选“统一集中到一个 prompts 大目录”：因为不同 graph / flow 的提示词演进速度不同，强行集中只会增加跨域耦合。

## 4. 结构化输出约束

只要节点期望稳定 JSON 契约，就必须同时满足：

- 提示词明确声明输出目标
- `schemas/` 下有显式 schema
- 调用走带重试的结构化入口

默认要求：

- 不要只靠 `JSON.parse` + 手写 `if`
- 不要让模型自己猜字段名
- 不要把兼容逻辑堆在后处理里，而前面的 prompt 没说清

当前推荐方式：

- 优先复用 [packages/adapters/src/structured-output/prompt-template.ts](/packages/adapters/src/structured-output/prompt-template.ts)
- 所有结构化输出默认追加 [packages/adapters/src/prompts/json-safety-prompt.ts](/packages/adapters/src/prompts/json-safety-prompt.ts)
- 优先使用 `buildStructuredPrompt(..., json: true)`、`appendJsonSafetyToMessages` 或同等封装

为什么这样优化：结构化失败通常不是单一 prompt 问题，而是“提示词 + schema + 重试反馈”没有成套。  
为什么不选“只强化 schema，不管 prompt”：因为 schema 只能兜底，不能替代模型侧的清晰指令。

## 5. 提示词内容规则

推荐最小骨架：

1. 角色是谁
2. 当前任务是什么
3. 可用上下文有哪些
4. 必须遵守的边界是什么
5. 输出格式是什么

默认约束：

- 先写职责，再写任务，再写输出
- 术语要与仓库当前架构一致，优先使用 `supervisor / ministry / workflow / evidence / learning`
- 避免把实现细节、日志格式、历史兼容字段全部塞进主提示词
- 如果同一段规则会被多个节点复用，应提炼到共享 helper，而不是复制粘贴

不推荐做法：

- 用超长系统提示词替代明确 schema
- 在一个 prompt 里同时塞规划、研究、执行、审查、交付所有角色
- 把“失败后怎么补救”完全留给后处理，不写进提示词或重试反馈

## 6. Few-shot 与示例

Few-shot 只在这两种情况优先考虑：

- 输出格式稳定但模型容易漏字段
- 某个角色边界容易漂移，示例能显著降低误判

默认规则：

- 示例数量保持最小，能用 1 个就不要先上 3 个
- 示例必须和当前 schema 同步更新
- 示例不要硬编码过时宿主路径、旧目录或旧角色命名

为什么这样优化：few-shot 是强约束工具，不是装饰品。  
为什么不选“所有关键节点都加示例”：因为示例一多，维护成本和过期概率会一起上升。

## 7. 评测与回归

提示词改动后，至少要选一种可证明检查：

- 节点级 unit test
- 结构化输出 parse 回归
- integration 测试
- prompt regression

当前回归入口：

- [docs/evals/promptfoo-regression.md](/docs/evals/promptfoo-regression.md)
- [docs/evals/prompt-regression-and-thresholds.md](/docs/evals/prompt-regression-and-thresholds.md)
- [packages/evals/promptfoo/ministry-prompts.promptfooconfig.yaml](/packages/evals/promptfoo/ministry-prompts.promptfooconfig.yaml)

为什么这样优化：提示词是行为代码，改了就应该有回归证明。  
为什么不选“只靠人工看回答感觉更好了”：因为人工主观判断无法稳定防回归。

## 8. 继续阅读

- [架构总览](/docs/ARCHITECTURE.md)
- [LangGraph 应用结构规范](/docs/langgraph-app-structure-guidelines.md)
- [前后端对接文档](/docs/integration/frontend-backend-integration.md)
- [验证体系规范](/docs/evals/verification-system-guidelines.md)
