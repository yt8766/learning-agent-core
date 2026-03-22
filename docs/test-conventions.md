# 测试规范

适用范围（当前阶段）：

- `apps/backend/agent-server`
- `packages/*`

当前阶段暂不作为默认测试范围：

- `apps/worker`
- `apps/frontend/agent-chat`
- `apps/frontend/agent-admin`

## 1. 测试框架

- 项目统一使用 `Vitest`
- 根配置文件为 [vitest.config.mjs](../vitest.config.mjs)
- 默认采用根级统一配置，不为每个子项目重复维护一套测试配置
- 当前默认测试环境为 `node`

说明：

- 第一阶段先把后端和共享包测试跑通
- 前端组件测试、worker 测试后续再逐步补齐

## 2. 测试文件命名

统一使用以下命名之一：

- `*.test.ts`
- `*.spec.ts`

推荐：

- 逻辑单测优先使用 `*.test.ts`
- 场景型测试可使用 `*.spec.ts`

示例：

- `packages/agent-core/src/session-coordinator.test.ts`
- `packages/memory/src/runtime-state-repository.test.ts`
- `apps/backend/agent-server/src/chat/chat.service.test.ts`

## 3. 目录规范

测试文件默认与源码同目录放置：

- 便于就近维护
- 便于一起重构
- 便于通过根级 `Vitest` 统一收集

示例：

- `src/session-coordinator.ts`
- `src/session-coordinator.test.ts`

不建议第一版新增独立 `__tests__` 目录，除非测试文件数量明显增多。

## 4. 测试分层建议

### 后端

优先补这些：

- `service` 业务逻辑
- `runtime` 编排逻辑
- `chat` 会话链路
- `memory / rule / skill` 文件仓储逻辑
- `approval` 判定逻辑

不建议第一版重点投入：

- `controller` 的低价值样板测试
- 纯 DTO 空壳测试

### packages

优先补这些共享核心：

- `agent-core`
- `memory`
- `tools`
- `shared` 中的重要纯函数或 schema
- `config` 中的重要路径与配置解析逻辑

## 5. 编写原则

- 一个测试文件只测一个明确对象
- 一个 `describe` 对应一个模块或函数
- 一个 `it` 只验证一个行为结果
- 优先测输入输出，不过度依赖内部实现细节
- 测试名称使用中文或清晰英文都可以，但同一文件保持一致

推荐结构：

```ts
import { describe, expect, it } from 'vitest';

import { createThing } from './create-thing';

describe('createThing', () => {
  it('在输入合法时返回结果', () => {
    const result = createThing('ok');

    expect(result).toBeDefined();
  });
});
```

## 6. Mock 规则

- 只 mock 当前测试真正依赖的外部边界
- 优先 mock：
  - 网络请求
  - 文件写入
  - 时间
  - 随机值
  - 大模型调用
- 尽量不要 mock 自己正在测试的核心逻辑

建议：

- LLM provider、sandbox executor、repository 这类边界对象优先做替身
- 单测不要真的调用线上模型或真实外部 API

## 7. 本地数据与测试隔离

- 测试不要直接写入仓库正式运行数据
- 正式运行数据统一放根级 `data/`
- 测试如果需要落盘，使用临时目录或独立测试路径

推荐：

- 使用 `os.tmpdir()` 或测试专用目录
- 测试结束后清理临时数据

禁止：

- 把测试数据写到 `apps/backend/agent-server/data`
- 把测试数据写到正式 `data/runtime/tasks-state.json`

## 8. 命令规范

统一使用根级命令：

- `pnpm test`
- `pnpm test:watch`

说明：

- `pnpm test` 对应一次性运行
- `pnpm test:watch` 对应开发时持续监听
- 当前这两个命令只覆盖后端和 `packages/*`

## 9. 当前推荐补测顺序

建议按这个顺序推进：

1. `packages/config` 的路径解析与根 `data/` 定位
2. `packages/memory` 的文件读写与容错
3. `packages/agent-core` 的 session / task 同步逻辑
4. `packages/tools` 的审批与工具选择逻辑
5. `apps/backend/agent-server` 的 chat service 和 runtime service

## 10. 当前阶段不建议做的事

- 不要一开始就给每个子项目拆独立 `vitest.config.mjs`
- 不要先补大量快照测试
- 不要先做过重的 e2e 体系
- 不要让测试依赖真实模型、真实审批、真实生产数据
- 不要把前端测试和后端/包测试混在第一阶段一起推进
