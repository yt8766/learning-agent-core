# Runtime Concurrency Helpers

状态：current
文档类型：reference
适用范围：`packages/runtime`
最后核对：2026-05-01

`@agent/runtime` 提供 `runWithConcurrency`，用于 agent 运行期的批量异步任务执行。它的职责是控制并发上限、保留输入顺序、汇总成功与失败结果，并向 worker 透传取消信号。它不承载具体 agent 业务逻辑、prompt、graph wiring 或 HTTP 传输语义。

## 入口

```ts
import { runWithConcurrency } from '@agent/runtime';
```

如果调用方希望只依赖并发子路径，也可以使用：

```ts
import { runWithConcurrency } from '@agent/runtime/concurrency';
```

源码入口：

- `packages/runtime/src/runtime/concurrency/run-with-concurrency.ts`
- `packages/runtime/src/runtime/concurrency/index.ts`

## 行为约定

- `maxConcurrency` 会向下取整，并被归一化为至少 `1`。
- 实际 worker 数不会超过 `items.length`。
- 每个 worker 内部串行执行；整体并发来自固定数量 worker 共享领取任务。
- `results` 按输入下标写回，失败或未领取的任务位置为 `undefined`。
- `settled` 按输入顺序记录已尝试任务的 `fulfilled` 或 `rejected` 结果。
- 默认 `stopOnError: false`，单个任务失败不会阻止其他 worker 继续领取任务。
- 设置 `stopOnError: true` 后，首次失败会阻止后续新任务被领取；已经在运行中的任务仍会自然收尾。
- 传入 `AbortSignal` 后，取消发生时不再领取新任务；已传给 worker 的任务是否中断由 worker 自身尊重 `context.signal` 决定。

## 推荐用法

```ts
const outcome = await runWithConcurrency(
  urls,
  async (url, index, context) => {
    const response = await fetch(url, { signal: context.signal });
    if (!response.ok) {
      throw new Error(`Fetch failed at index ${index}: ${response.status}`);
    }
    return response.json();
  },
  {
    maxConcurrency: 3,
    stopOnError: false,
    signal: abortController.signal
  }
);
```

调用方应根据 `outcome.fulfilledCount`、`outcome.rejectedCount` 和 `outcome.cancelled` 决定是否继续主链、进入审批恢复、记录 evidence，或向用户展示部分失败。

## 边界

`runWithConcurrency` 是 runtime 执行原语，不是稳定 DTO contract；因此它放在 `packages/runtime`，不放在 `packages/core`。如果后续出现跨 runtime、tools、backend 的一组独立执行原语，再评估是否抽成独立包。
