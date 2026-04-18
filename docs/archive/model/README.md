# model 历史说明

状态：archive
文档类型：archive
适用范围：已删除的 `packages/model`
最后核对：2026-04-17

`packages/model` 已于 2026-04-17 删除。

删除原因：

- chat model factory、embedding factory、provider base-url normalize 与相关接入能力已统一收口到 `@agent/adapters`
- `@agent/model` 在删除前已退化为 compat re-export，继续保留独立包已无实际价值

当前正确入口：

- 模型/provider/embedding 装配与适配：`@agent/adapters`

后续约束：

- 新代码不要再新增 `@agent/model` 导入
- 相关实现文档优先更新到 `docs/packages-overview.md`、`docs/package-architecture-guidelines.md` 与 `docs/project-conventions.md`
