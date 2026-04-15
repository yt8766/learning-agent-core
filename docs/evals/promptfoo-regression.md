# Promptfoo 回归说明

状态：current
适用范围：`packages/evals/promptfoo`
最后核对：2026-04-14

这目录放的是“关键 prompt 的最小回归配置”，不是完整评测平台。

当前入口：

- [ministry-prompts.promptfooconfig.yaml](/Users/dev/Desktop/learning-agent-core/packages/evals/promptfoo/ministry-prompts.promptfooconfig.yaml)

## 当前覆盖

- 首辅规划
- 专家发现
- 户部研究
- 刑部审查
- 礼部交付

当前核心阻塞套件：

- `supervisor-plan`
- `specialist-finding`
- `hubu-research`
- `xingbu-review`
- `libu-delivery`

门槛：

- 核心套件成功率必须 `> 90%`
- 低于门槛时，`pnpm eval:prompts` 会直接失败
- 非核心探索性样例当前只生成报告，不阻塞

每类 prompt 都保留两版：

- `v1`：偏旧的基线写法
- `v2`：当前仓库采用的收紧版规范

这样做的目的不是追求“大而全”，而是让我们能对比：

- 结构化程度有没有变稳
- 规划和发现是否保持机器可读
- 角色职责有没有更清晰
- 礼部答复是不是更像最终用户可见交付

## 使用方式

如果本地已经安装 `promptfoo` 且配置了模型 key，可以在仓库根目录运行：

```bash
promptfoo eval -c packages/evals/promptfoo/ministry-prompts.promptfooconfig.yaml
```

如果要看可视化结果：

```bash
promptfoo view
```

如果使用仓库根脚本：

```bash
pnpm eval:prompts
```

这个脚本会优先尝试本地的 `promptfoo` 命令；如果没有安装，则自动回退到：

```bash
pnpm dlx promptfoo@latest
```

因此：

- 本地已全局安装 `promptfoo` 时，直接复用本地命令
- 本地未安装但有网络时，也可以直接运行
- 如果两者都不可用，会返回明确错误提示

当前约定会额外写出两份产物：

- `packages/evals/promptfoo/latest-promptfoo-results.json`
- `packages/evals/promptfoo/latest-summary.json`

其中 `latest-summary.json` 会被 admin 的 `Evals Center` 读取，用于展示最近一次 prompt 回归结果摘要。

## 维护规则

新增样例时，优先满足这些原则：

- 每个 ministry 保留 2~4 条代表性样例即可
- 样例优先覆盖真实主链风险点，不要堆泛化文案题
- 结构化节点优先断言合同字段、决策字段、是否暴露额外解释
- 礼部交付优先断言“是否像最终答复”，而不是只看字数

## 什么时候该扩评估

只有在下面情况才建议继续扩：

- prompt 改动频繁，输出明显漂移
- 模型版本切换，需要看回归
- 某条结构化链路频繁 fallback

不建议一开始就扩成大矩阵。
