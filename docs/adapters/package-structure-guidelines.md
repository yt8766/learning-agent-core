# adapters 包结构规范

状态：current
文档类型：convention
适用范围：`packages/adapters`
最后核对：2026-04-18

本文档说明 `packages/adapters` 如何按“稳定 adapter 边界 + provider 实现 + 工厂装配 + 输出安全”收敛目录结构。

## 1. 目标定位

`packages/adapters` 负责把外部模型与嵌入能力翻译成系统内部稳定可消费的接口。

它不是：

- agent 业务 prompt 宿主
- graph 编排层
- runtime orchestration 层

## 2. 推荐结构

```text
packages/adapters/
├─ src/
│  ├─ contracts/
│  ├─ chat/
│  ├─ embeddings/
│  ├─ factories/
│  ├─ providers/
│  ├─ prompts/
│  ├─ retry/
│  ├─ structured-output/
│  ├─ support/
│  ├─ utils/
│  └─ index.ts
├─ test/
└─ package.json
```

各目录语义：

- `contracts/`
  - 对外稳定 contract facade；当前 `contracts/llm-provider.ts` 只保留 compat，canonical host 为 `contracts/llm/index.ts`
- `chat/`
  - 包根稳定聊天入口，同时承载 chat model factory 的真实实现
- `embeddings/`
  - 包根稳定 embedding 入口，同时承载 embedding factory 的真实实现
- `factories/`
  - 当前只保留 `runtime/` 子域，承载 runtime provider wiring
- `providers/`
  - 供应商实现、provider routing、factory registry、semantic cache contract 等 LLM adapter 宿主
- `prompts/`
  - 共享 JSON safety prompt 等 adapter 级提示词资产
- `retry/`
  - LLM retry、reactive retry 等失败恢复能力
- `structured-output/`
  - structured prompt builder、safe generate object 等结构化输出安全层
- `support/`
  - URL normalize 这类底层支撑 helper
- `utils/`
  - 当前仅保留 `model-fallback` 一类纯工具；不再作为通用收纳目录扩张

## 3. 当前收敛策略

本轮采用“新宿主目录 + 稳定入口 compat 保留”的方式完成物理收敛，而不是继续停留在 `runtime/ + llm/ + shared/ + utils/` 混排状态。

为什么采用这套结构：

- 需要明确区分“稳定入口”、“工厂装配”、“provider 实现”、“结构化输出安全”
- 需要避免 `utils/` 与 `shared/` 继续吸附语义明确的实现
- 需要让新增 provider 时优先新增实现点，而不是回到单一 `llm/` 目录继续堆文件

当前已落地：

- `chat/*`
  - 作为 chat model factory 的真实宿主
- `factories/runtime/default-runtime-llm-provider.factory.ts`
  - 作为 runtime provider wiring 的真实宿主
- `providers/llm/factories/*`
  - 作为 SDK 级 provider factory contract、registry 与默认 factory 注册宿主
- `embeddings/*`
  - 作为 embedding model / runtime embedding provider 的真实宿主
- `providers/llm/base/llm-provider.types.ts`
  - 作为 LLM contract helper 与 JSON instruction 的真实宿主
- `contracts/llm-provider.ts`
  - 仅保留稳定 facade re-export，便于 contract-first 导入
- `chat/index.ts`、`embeddings/index.ts`
  - 仅保留稳定入口聚合
- `prompts/json-safety-prompt.ts`
  - 作为 JSON safety prompt 的真实宿主
- `retry/*` 与 `structured-output/*`
  - 分别收口重试策略和结构化输出安全能力

为什么不再采用其他结构：

- 不继续采用 `runtime/ + llm/ + shared/ + utils/`：
  - 因为它会把工厂、供应商实现、共享提示、输出安全再次混排
- 不采用“全部按 vendor 一级分组”：
  - 因为 structured output、retry、embedding runtime wiring 不属于单一 vendor
- 不采用 `domain / application / infrastructure`：
  - 因为 `packages/adapters` 本身已经是防腐层宿主，再套一层 clean architecture 会增加维护成本

## 4. 继续阅读

- [adapters 文档目录](/docs/adapters/README.md)
- [Provider 扩展 SDK 指南](/docs/adapters/provider-extension-sdk-guidelines.md)
- [Packages 分层与依赖约定](/docs/package-architecture-guidelines.md)
