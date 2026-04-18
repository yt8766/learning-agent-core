# adapters Provider 扩展 SDK 指南

状态：current
文档类型：convention
适用范围：`packages/adapters`、`packages/config`
最后核对：2026-04-18

本文档说明 `@agent/adapters` 作为 SDK 时，开发者如何扩展模型与 Provider。

## 1. 先区分两类扩展

### 配置型扩展

适用于：

- 只是新增一个模型服务
- 协议兼容现有 Provider
- 不需要自定义 stream 解析或特殊 object generation 逻辑

这类扩展优先只改配置，不要求新增类或新增 Provider 文件。

### 协议型扩展

适用于：

- 新服务协议不兼容现有 Provider
- 鉴权方式、请求体、流式协议或错误语义明显不同
- 需要独立 Provider 行为

这类扩展必须实现 `LlmProvider` contract，并通过 `customFactories` 注册。

## 2. 稳定 contract

当前稳定 contract 宿主：

- `packages/adapters/src/providers/llm/base/llm-provider.types.ts`

开发者自定义 Provider 时必须实现：

- `supportedModels()`
- `isConfigured()`
- `generateText(...)`
- `streamText(...)`
- `generateObject(...)`

推荐使用 `class` 实现，因为 Provider 往往需要持有 config、client 和私有 helper。  
但 SDK 不强制实现形式必须是 `class`；只要最终对象满足 `LlmProvider` contract 即可。

模型能力声明当前推荐优先复用：

- `MODEL_CAPABILITIES`
- `createModelCapabilities(...)`

而不是在自定义 Provider 中散写 `['text', 'tool-call']` 这类字符串字面量。

当调用方需要显式约束模型能力时，可以通过 `GenerateTextOptions.requiredCapabilities` 传入能力要求；当前 routed provider 会在选模时跳过不满足能力约束的模型。
此外，`generateText`、`streamText`、`generateObject` 这三条主路径默认都会附带基础 `text` 能力要求，所以 runtime 不会把普通文本生成请求路由到仅支持 embedding 之类的模型上。
如果调用方设置了 `thinking: true`，SDK 还会自动补充 `thinking` 能力要求，这样路由层可以优先筛掉不支持深度思考模式的模型。

## 3. 注册方式

当前推荐通过 runtime factory 注册：

```ts
createDefaultRuntimeLlmProvider({
  settings,
  customFactories: [
    {
      type: 'anthropic',
      create(config) {
        return new AnthropicProvider(config);
      }
    }
  ]
});
```

这里的 `customFactories` 是 SDK 暴露给开发者的主要扩展入口。
对外推荐优先使用 `createLlmProviderFactory(...)`，而不是手写对象字面量再自行维护类型。

### 最小代码示例：协议型扩展

```ts
import { createDefaultRuntimeLlmProvider, createLlmProviderFactory } from '@agent/adapters';

const anthropicFactory = createLlmProviderFactory({
  type: 'anthropic-custom',
  create(config) {
    return new AnthropicProvider(config);
  }
});

const llm = createDefaultRuntimeLlmProvider({
  settings,
  customFactories: [anthropicFactory]
});
```

仓库里还有一条可直接参考的 smoke 示例：

- [packages/adapters/test/sdk-custom-provider-smoke.test.ts](/packages/adapters/test/sdk-custom-provider-smoke.test.ts)
- [packages/adapters/test/fixtures/custom-http-provider.fixture.ts](/packages/adapters/test/fixtures/custom-http-provider.fixture.ts)
- [custom-provider-example.md](/docs/adapters/custom-provider-example.md)

## 4. 什么时候只改配置

如果开发者接入的是 OpenAI-compatible 模型服务，优先只配置：

- `providers[].id`
- `providers[].type`
- `providers[].baseUrl`
- `providers[].apiKey`
- `providers[].models`
- `providers[].roleModels`
- `routing`

不建议为每个新模型单独写一个 Provider 类。

### 最小代码示例：配置型扩展

```ts
const settings = {
  providers: [
    {
      id: 'deepseek',
      type: 'openai-compatible',
      displayName: 'DeepSeek',
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseUrl: 'https://api.deepseek.com/v1',
      models: ['deepseek-chat', 'deepseek-reasoner'],
      roleModels: {
        manager: 'deepseek-reasoner',
        research: 'deepseek-chat',
        executor: 'deepseek-chat',
        reviewer: 'deepseek-reasoner'
      }
    }
  ],
  routing: {
    manager: { primary: 'deepseek/deepseek-reasoner' },
    research: { primary: 'deepseek/deepseek-chat' }
  }
};
```

这类扩展默认复用内建 `OpenAICompatibleProvider`，不需要新增 Provider 实现。

## 5. 什么时候写 Provider

只有当下面这些差异存在时，才建议新增 Provider：

- 请求结构不兼容 OpenAI-compatible
- 流式返回增量解析不同
- 结构化对象输出行为不同
- 供应商特有参数较多
- 错误包装和 usage 读取需要特殊处理

此时建议：

- 在 `packages/adapters/src/providers/llm/<vendor>/` 新增实现
- 必要时在 `packages/adapters/src/chat/` 新增 vendor 专属 factory
- 通过 `customFactories` 或默认 factory 注册机制接入 runtime

## 6. 当前扩展点

当前已提供：

- `createLlmProviderFactory(...)`
- `LlmProviderFactory`
- `LlmProviderFactoryRegistry`
- `registerDefaultLlmProviderFactories(...)`
- `createDefaultRuntimeLlmProvider({ customFactories })`
- 内建 `AnthropicProvider`

这意味着：

- SDK 内建 Provider 继续通过默认 factory 注册
- 开发者自定义 Provider 不需要修改内部 `if/else`
- 当前 Anthropic 已经是内建专用 Provider，可直接通过 `type: 'anthropic'` + 配置接入

## 7. 推荐验证

新增自定义 Provider 或 factory 后，至少补：

- factory registry 单测
- runtime provider factory 装配测试
- provider 行为单测
- 文档更新

## 8. 当前建议

优先顺序固定为：

1. 先判断是不是配置型扩展
2. 能复用内建协议时，不要新增 Provider 类
3. 只有协议差异明显时，才新增 Provider 并通过 `customFactories` 注册
