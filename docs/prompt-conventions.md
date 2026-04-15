# 提示词规范

状态：current
适用范围：提示词工程规范
最后核对：2026-04-14

适用范围：

- `packages/agent-core/src/flows/**/prompts/*.ts`
- `packages/agent-core/src/shared/prompts/*.ts`
- 需要进入模型的结构化系统提示词、用户提示词、评估模板

这份规范不追求“提示词越长越好”，而是要求提示词在当前项目里足够稳定、可测试、可迭代。

它吸收了 `RCT`、few-shot、step-back、CoT、ReAct、结构化输出和提示评估的一些通用经验，但只保留对本项目真正有用的部分：

- 不照搬教程式模板
- 不把所有技巧一次性塞进一个 prompt
- 不为了“高级”而牺牲主链稳定性

## 1. 目标

本项目不是普通聊天机器人，而是面向开发自治的多 Agent 系统。提示词设计应优先服务这些目标：

- 让 `Supervisor / 六部` 的职责边界更清晰
- 让结构化输出更稳定，方便后端解析和治理
- 让提示词可以被评估、回归和小步优化
- 避免为了“显得聪明”而过度设计 prompt

补充一条默认认识：

- prompt 不是单独存在的文本，它和 `model / temperature / top-p / top-k / max tokens / schema / fallback` 一起构成一个“可运行合同”

## 2. 默认方法：RCT

当前项目默认使用 `RCT` 作为 prompt 最小骨架：

- `Role`
  - 当前节点是谁
  - 应该站在什么职责视角输出
- `Context`
  - 当前任务背景、输入数据、限制条件、目标受众
- `Task`
  - 这一轮具体要完成什么
  - 输出格式和约束是什么

不要求每个 prompt 都机械写成教程模板，但语义上必须覆盖这三层。

推荐写法：

```text
你是<角色>。

【任务目标】
<这一轮要完成什么>

【输入说明】
- <会收到什么>

【决策规则】
- <如何判断>

【输出要求】
- <输出格式和限制>
```

项目里优先复用 [prompt-template.ts](/Users/dev/Desktop/learning-agent-core/packages/agent-core/src/shared/prompts/prompt-template.ts) 的结构化模板，而不是每个节点自己发明格式。

## 3. 先选哪种提示方式

这个项目里不需要“技巧大全”，只需要一个够用的选择顺序。

默认顺序：

1. 先写清 `Role + Context + Task`
2. 如果输出要进主链，先定 `schema`
3. 如果结构容易漂移，再补 `2~3` 条 few-shot
4. 如果任务本身需要分阶段判断，再补“先检查、再判断、再输出”
5. 只有确实要调用外部工具或多步搜索时，才进入 ReAct / workflow 级设计

简单理解：

- 大多数 prompt 问题，先靠 `RCT + schema-first + 更具体的输出要求` 解决
- 不是先上 CoT、ToT、APE 之类复杂技巧

## 4. 输出配置也是合同的一部分

不要只写 prompt 文本，不管模型配置。对这个项目来说，配置要跟任务类型一起选。

### 4.1 结构化节点默认配置倾向

适用：

- 户部研究
- 刑部审查
- 路由分类
- Learning candidate 抽取

建议：

- `temperature`: 默认低温，优先 `0 ~ 0.2`
- `top-p / top-k`: 没有明确收益时，保持 provider 默认或低自由度
- `max tokens`: 够放下合法对象即可，不为自由长文预留太多空间

原因：

- 这类节点目标是稳定、可解析、可复现
- 不是追求“有创意”

### 4.2 面向用户的总结 / 交付

适用：

- 礼部交付整理
- 最终答复
- direct reply

建议：

- 可以比结构化节点更自然
- 但仍要在 prompt 里明确篇幅、语气、受众
- 需要事实稳定时，仍然优先低温

### 4.3 推理类任务

适用：

- 审查判定
- 约束核对
- 多条件筛选

建议：

- 推理为主、答案明确时，优先低温，接近 `0`
- 不要一边要求“严谨判定”，一边给高自由度采样

### 4.4 一个重要原则

限制 `max tokens` 只会截断，不会自动让回答更简洁。

如果你想要短输出，必须在 prompt 里明确写：

- 用一句话
- 限 3 条
- 仅输出 JSON
- 不输出额外解释

## 5. 不同场景怎么用

### 5.1 Ministry 结构化节点

适用：

- 户部研究
- 刑部审查
- 工部工具选择
- 吏部路由/规划

要求：

- 明确 ministry 角色，不要只写“你是一个 AI 助手”
- Context 里必须写清输入字段
- Task 里必须写清结构化输出要求
- 优先配合 `zod schema + generateObject`

推荐：

- 在 prompt 中写字段填充规则
- 明确 `contractVersion`
- 明确禁止输出 Markdown、解释性废话

不推荐：

- 让支撑专家输出长篇自由文本，再让主链二次猜测
- 把角色、规则、输出限制混成一段大白话

额外建议：

- 结构化节点默认把“输出格式”写成正向指令，而不是堆大量“不要”
- 能写成字段填充规则，就不要写成模糊风格要求
- 对 classification / routing 任务，few-shot 样例里要混合类别，不要同类连排

### 5.2 Direct Reply / Chat 场景

适用：

- 普通聊天
- 不进入完整工作流的 direct-reply

要求：

- 重点控制语气、对象、篇幅
- 不必过度结构化
- 不必强上 few-shot

推荐：

- 明确受众
- 明确回答粒度
- 明确是否需要引用来源

### 5.3 Delivery / Summary 场景

适用：

- 礼部交付整理
- 最终答复总结

要求：

- 明确总结面向谁
- 明确保留哪些信息、去掉哪些信息
- 避免重复复述 trace 和 evidence

推荐：

- 优先“结论 + 关键依据 + 下一步”
- 如果面向用户，不回放内部思维链
- 如果面向 Telegram 等渠道，额外控制长度和分段

### 5.4 Learning / Scrubber / Governance 场景

适用：

- 经验评估
- 规则冲突判定
- skill 治理建议

要求：

- 明确判断标准
- 明确高风险时走保守策略
- 输出必须能进入后续治理流，而不是只给一段评价

## 6. 何时用 Few-shot

只有在下面几类问题上，才建议引入少样本：

- 输出格式容易漂移
- 字段含义容易混淆
- 同一类输入需要稳定映射到固定结构

推荐场景：

- `SpecialistFinding`
- `CritiqueResult`
- 路由/分类/标签提取
- Learning candidate 抽取

不推荐场景：

- 普通闲聊
- 一次性自由生成文案
- 输入变化很大、few-shot 反而会误导模型的任务

few-shot 数量建议：

- 默认 `2~3` 条
- 不要为了“更稳”堆到很长
- 样例要覆盖边界，而不是只重复同一种正例

补充规则：

- 样例要比说明更像“合同示范”，不要写成散文
- 样例里不要混入与当前 schema 无关的历史字段
- 样例更新要跟 `schema` 版本一起看，避免 example 漂移

### 6.1 data-report-json 额外规范

适用：

- `agents/data-report/src/flows/data-report-json/prompts/generate-report-page-prompt.ts`
- `agents/data-report/src/flows/data-report-json/prompts/generate-report-page-part-prompt.ts`
- `agents/data-report/src/flows/data-report-json/prompts/generate-report-page-spec-prompt.ts`

强制要求：

- 每个进入模型的 prompt 都至少提供 `1` 个明确示例，不能只有抽象规则
- system prompt 必须包含“输出示例”，展示目标 JSON 结构或关键片段
- user prompt 必须包含“需求示例”，告诉模型什么样的自然语言需求是合格输入
- 示例必须使用当前 schema 仍然合法的字段名、block 名和 key 命名，不允许放过期结构
- 如果 prompt 负责局部片段，示例也必须缩到对应片段，不要给整页 schema 造成噪音

推荐做法：

- 优先给最小可工作的示例，而不是超长大样本
- 对 table.columns、filterSchema、sections.blocks 这类最容易漂移的结构，示例要尽量贴近真实产物
- 需求示例要同时包含标题、接口、筛选项、字段和期望布局，避免模型只学到单一句式

如果是分类任务，再加一条：

- few-shot 样例顺序里混合不同类别，不要形成隐含排序偏置

## 7. 何时用 Step-back / 逐步思考

本项目需要的是“分步骤完成任务”，不是把完整内部推理都展示给用户。

### 7.1 默认做法：隐藏式步骤化

推荐：

- 让模型先检查条件，再输出结果
- 让模型先归纳证据，再下结论
- 让模型先判断阻断项，再决定 `approve / revise / block`

推荐表达：

- `请先检查输入是否满足以下条件，再输出结果。`
- `请按步骤完成：先归纳，再判断，最后输出 JSON。`
- `请先识别风险与约束，再给最终结论。`

推荐用法：

- 在 prompt 中要求模型先做检查点拆解，再输出结果
- 对复杂判断要求“先核对条件，再给结论”
- 对多约束任务要求“先筛选，再汇总”

不推荐表达：

- 为所有任务都加“请详细展示你的完整思维链”
- 让模型输出冗长中间过程，污染主链响应

### 7.2 何时用 Step-back

只有在下面两类任务里，才建议用 step-back：

- 规划类：Supervisor 做大任务拆解前，需要先抽象目标和约束
- 创意探索类：例如礼部整理方案时，先抽象“应该保留哪些信息维度”

不推荐用于：

- 已经有明确 schema 的结构化节点
- 只需要抽取、分类、映射的简单任务

原则：

- step-back 是为了先建立“判断框架”
- 不是为了把 prompt 变长

### 7.3 何时用 CoT

只在“答案依赖显式推理”时使用，例如：

- 刑部判断是否 `block`
- 多个来源有冲突时做保守判定
- 规则冲突和恢复建议生成

项目内做法：

- 优先让模型“先完成检查步骤，再给结论”
- 不要求模型向最终用户暴露完整推理文本
- 如果输出要进结构化对象，结论字段必须独立于推理描述

配置建议：

- CoT 类任务优先低温，通常接近 `0`

### 7.4 何时不用 ToT / Self-consistency / APE

这几类技巧不是禁止，但默认不进主链。

默认不做：

- 为普通 ministry prompt 引入 ToT
- 为主链每次调用做多样本自一致投票
- 在运行时在线做自动提示工程

除非满足以下条件之一：

- 某个高价值判定任务经过验证，单次输出明显不稳
- 有离线评估证明复杂技巧显著提升质量
- 额外成本与时延在当前链路可接受

## 8. ReAct 在本项目里的位置

ReAct 不是“给普通 prompt 加一句 think and act”。

在本项目里，它应该体现在：

- workflow / orchestrator 层的工具调用策略
- 兵部 / 户部的检索与执行环节
- 带 trace、审批、recover 的可观察动作

不推荐：

- 在纯结构化提取 prompt 里假装 ReAct
- 让单个 prompt 同时承担推理、行动、工具路由和总结

一句话理解：

- 能用静态上下文解决的问题，不要强行做 ReAct
- 需要外部检索、工具执行、搜索迭代时，再进入 ReAct 语义

## 9. 项目内 4 条硬规则

1. 结构化节点优先 `schema-first`

- 先定义 schema
- 再写 prompt
- 最后写调用逻辑

2. 提示词里要写“职责”，不要只写“能力”

- 好：`你是刑部审查官，负责识别阻断风险与修订要求`
- 差：`你是一个很懂风控的 AI`

3. 上下文要写“输入边界”，不要默认模型自己猜

- 输入有哪些字段
- 哪些字段可信
- 哪些字段只是参考

4. 输出要求必须与消费方一致

- 给 `generateObject` 的 prompt，必须显式要求结构化对象
- 给用户看的回复，必须说明受众、语气、篇幅

## 10. 白皮书经验在本项目里的收敛版最佳实践

1. 优先用正向指令，不堆否定约束

- 好：`只输出符合 Schema 的 JSON`
- 差：`不要输出 markdown，不要解释，不要废话，不要分析，不要...`

2. 尽量简洁，但不能丢关键信息

- 简洁不是短，而是结构清楚、没有无效背景

3. 对输出要具体

- 写清字段
- 写清长度
- 写清是否引用来源
- 写清受众

4. prompt 要可变量化

- 城市名、时间锚点、任务目标、可用来源、contractVersion 都应来自变量
- 不要在模板里硬编码业务实例

5. 结构化任务优先 JSON / schema

- 尤其是提取、分类、排序、审查、治理场景

6. 记录 prompt 尝试

- prompt 文本
- model
- temperature
- top-p / top-k
- token limit
- 输出样例
- 是否通过

7. 模型变更时重跑评估

- prompt 不是写完就结束
- provider / model 变化后要复测稳定性

## 11. 反模式

下面这些写法在当前项目中应避免：

- 超长单段 prompt，没有角色/输入/规则/输出分层
- 同一个 prompt 同时承担“聊天 + 规划 + 审查 + 总结”
- 明明有 schema，还让模型主要输出自然语言长文
- 让主链依赖“模型自己理解 contractVersion”
- 为了保险，把所有教程里的技巧一次性全塞进去

新增几个典型反模式：

- 只改 prompt 文本，不记录模型与采样配置
- 明明是确定性分类任务，却用高温
- 想要短输出，却只靠 `max tokens` 截断
- 把 CoT 直接暴露给用户，导致答复臃肿
- 把 ReAct 当成普通文案技巧，而不是工作流能力

## 12. 评估与回归

prompt 改动默认不是“拍脑袋上线”，而是应该能被回归。

最低要求：

- 重要 prompt 至少保留代表性输入样例
- 能比较不同 prompt 版本的稳定性
- 结构化输出要校验 schema 合法率

推荐做法：

- 用 [ministry-prompts.promptfooconfig.yaml](/Users/dev/Desktop/learning-agent-core/packages/evals/promptfoo/ministry-prompts.promptfooconfig.yaml) 维护关键场景回归
- 用 `promptfoo` 比较 prompt 版本、模型版本和关键输入
- 对关键结构化节点记录：
  - parse success rate
  - safe fallback rate
  - 输出字段漂移情况

## 13. 项目内 Prompt 记录模板

对重要 prompt，建议至少记录这些字段：

- `name`
- `goal`
- `model`
- `temperature`
- `topP`
- `topK`
- `maxTokens`
- `prompt`
- `expected shape`
- `eval samples`
- `result`

如果是 RAG / research 节点，再额外记录：

- 查询词
- 来源范围
- 时间锚点
- 引用策略

## 14. 推荐模板

### 14.1 Ministry 结构化模板

```text
你是<某部角色>。

【任务目标】
基于输入，输出可被主链直接消费的结构化结果。

【输入说明】
- 你会收到：<字段列表>
- 这些输入中，<哪些是主要依据>

【决策规则】
- 优先<规则 1>
- 如果存在冲突，优先<规则 2>
- 信息不足时，采用保守策略

【字段填充规则】
- contractVersion 固定为 <xxx>
- summary 使用中文，简洁明确
- blockingIssues / constraints 仅保留真正影响执行的内容

【输出要求】
- 只输出符合 Schema 的 JSON
- 不输出 Markdown
- 不输出额外解释
```

### 14.2 面向用户的答复模板

```text
你是<角色>。

【上下文】
- 用户当前处于<场景>
- 目标受众是<对象>

【任务】
- 回答用户问题
- 先给结论，再补关键依据

【输出要求】
- 使用中文
- 控制在<长度>
- 不重复罗列内部执行细节
```

### 14.3 审查 / 判定模板

```text
你是刑部审查官。

【任务目标】
基于输入判断本轮结果应通过、修订还是阻断。

【输入说明】
- 你会收到任务目标、候选结果、关键证据、已知约束

【检查步骤】
1. 先识别是否存在阻断风险
2. 再识别是否存在可修订问题
3. 最后给出结论与原因

【输出要求】
- 只输出符合 Schema 的 JSON
- 结论字段必须明确
- 不输出额外解释
```

## 9. 最小检查清单

提交 prompt 前，至少检查：

- [ ] 是否写清了角色职责
- [ ] 是否写清了输入边界
- [ ] 是否写清了任务目标
- [ ] 是否写清了输出格式
- [ ] 是否真的需要 few-shot
- [ ] 是否真的需要逐步思考
- [ ] 是否和消费方 schema / UI / workflow 对齐

## 10. 评估建议

当前项目建议用 `promptfoo` 做“小样本回归”，但不要一开始就铺很大的评测矩阵。

先从最小集合开始：

- 2 个 prompt 版本
- 1~2 个模型
- 3~5 条代表性输入
- 1 个结构断言
- 1 个质量 rubric

建议优先评估这些 prompt：

- 户部研究摘要
- 刑部审查结论
- 礼部交付总结
- route / finding 类结构化 prompt

仓库已提供一个最小模板：

- [packages/evals/promptfoo/ministry-prompts.promptfooconfig.yaml](/Users/dev/Desktop/learning-agent-core/packages/evals/promptfoo/ministry-prompts.promptfooconfig.yaml)
- [docs/evals/promptfoo-regression.md](/Users/dev/Desktop/learning-agent-core/docs/evals/promptfoo-regression.md)

## 11. 渐进式优化策略

本项目里的 prompt 优化默认按下面顺序进行：

1. 先补清角色、上下文、任务
2. 再补输出格式和字段规则
3. 再决定是否增加 few-shot
4. 最后才考虑更复杂的评估和自动迭代

不要反过来做。

如果一个 prompt 还没有把输入边界和输出合同写清楚，就不要先上复杂 rubric 或多角色自优化。
