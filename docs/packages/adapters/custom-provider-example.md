# adapters 自定义 Provider 示例

状态：current
文档类型：convention
适用范围：`packages/adapters`
最后核对：2026-04-18

本文档给出一条最小可复制的“协议型扩展”示例，演示开发者如何为 `@agent/adapters` 接入一个自定义 HTTP Provider。

## 1. 目标

希望达成的效果是：

- 自定义 Provider 实现 `LlmProvider`
- 通过 `createLlmProviderFactory(...)` 构造 factory
- 通过 `createDefaultRuntimeLlmProvider({ customFactories })` 注册到 runtime
- 通过 `routing` 命中该 Provider

## 2. 最小 Provider 实现

仓库中的最小样板在这里：

- [packages/adapters/test/fixtures/custom-http-provider.fixture.ts](/packages/adapters/test/fixtures/custom-http-provider.fixture.ts)

它演示了最小需要实现的几项能力：

- `supportedModels()`
- `isConfigured()`
- `generateText(...)`
- `streamText(...)`
- `generateObject(...)`

这个 fixture 是 smoke 级样板，不代表生产环境实现的完整性；真实 Provider 通常还要补：

- 错误包装
- usage 读取
- 鉴权头处理
- stream 增量解析
- 结构化输出兼容策略

## 3. 最小注册示例

```ts
import { createDefaultRuntimeLlmProvider, createLlmProviderFactory } from '@agent/adapters';

const llm = createDefaultRuntimeLlmProvider({
  settings: {
    providers: [
      {
        id: 'custom-http',
        type: 'custom-http',
        displayName: 'Custom HTTP',
        models: ['custom-http-chat'],
        roleModels: {
          manager: 'custom-http-chat'
        }
      }
    ],
    routing: {
      manager: { primary: 'custom-http/custom-http-chat' }
    }
  },
  customFactories: [
    createLlmProviderFactory({
      type: 'custom-http',
      create(config) {
        return new CustomHttpProvider(config);
      }
    })
  ]
});
```

这段代码展示的是 SDK 使用者最小需要理解的四件事：

1. `providers[].type` 与 factory 的 `type` 必须一致
2. `providers[].id` 是 routing 使用的 provider 标识
3. `routing` 通过 `providerId/modelId` 命中自定义 Provider
4. runtime 不需要修改内部源码，只通过 `customFactories` 注入扩展

## 4. 最小 smoke 参考

可直接运行的 smoke 参考在这里：

- [packages/adapters/test/sdk-custom-provider-smoke.test.ts](/packages/adapters/test/sdk-custom-provider-smoke.test.ts)

这条测试完整覆盖了：

- factory 创建
- runtime 装配
- routing 命中
- `generateText(...)`
- `supportedModels()`

如果后续要补新的协议型 Provider，建议先复制这条 smoke，再替换成真实 Provider 实现。

## 5. 什么时候不该写自定义 Provider

如果你接的是 OpenAI-compatible 模型服务，不要先写自定义 Provider。

优先方式是：

- 直接配置 `type: 'openai-compatible'`
- 补 `baseUrl`
- 补 `apiKey`
- 补 `models`
- 补 `roleModels`
- 补 `routing`

只有当请求结构、流式协议、鉴权方式、usage 读取或结构化输出行为明显不同，才值得新增自定义 Provider。
