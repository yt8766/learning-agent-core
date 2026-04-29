# Agent Server Slimming Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

状态：snapshot  
文档类型：plan  
适用范围：`apps/backend/agent-server`、`agents/intel-engine`  
最后核对：2026-04-29

**Goal:** 将 `agent-server` 收敛为 API Host + BFF + Composition Root，并把 Daily Tech Intelligence Briefing 直接迁入 `agents/intel-engine`。

**Architecture:** 先锁定文档和边界规则，再把 briefing 的类型、运行时、存储、采集、排序、投递和测试从 `apps/backend/agent-server/src/runtime/briefings` 迁到 `agents/intel-engine/src/runtime/briefing`。Backend 只保留 Nest controller、provider wiring、schedule trigger、runtime center BFF 和 API smoke；后续 compat/re-export 与 tools/review 命名清理按同一边界继续推进。

**Tech Stack:** TypeScript、NestJS、vitest、`@agent/agents-intel-engine`、`apps/backend/agent-server`、`pnpm check:docs`、`pnpm --dir agents/intel-engine test`、`pnpm --dir apps/backend/agent-server test:runtime`

---

## Scope Check

原 spec 覆盖多个子系统：backend 边界、briefing 迁移、compat 清理、centers/skills/tools 深水区、防回流检查。为避免一次改动过大，本计划把第一轮实施收敛为可交付闭环：

- 本轮完成文档边界落地。
- 本轮完成 `briefings -> agents/intel-engine` 迁移。
- 本轮把 backend BFF 和 schedule wiring 改成调用 intel engine facade。
- 本轮只记录 `tools/ review/` 命名方向，不执行目录重命名；目录重命名牵涉 API、测试和历史路径，单独开后续计划。
- 本轮只清理与 briefing 直接相关的 backend 残留；其他 `compat re-export`、centers、skills、tools 深水区单独开后续计划。

## 文件变更清单

| 操作 | 文件路径                                                                                                              | 职责                                                         |
| ---- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 修改 | `docs/apps/backend/agent-server/agent-server-overview.md`                                                             | 写入 backend 长期职责与 briefing 迁出结论                    |
| 修改 | `docs/apps/backend/agent-server/runtime-module-notes.md`                                                              | 标记 `runtime/briefings` 为待迁出历史落点和完成后的保留边界  |
| 修改 | `docs/integration/daily-tech-intelligence-briefing-design.md`                                                         | 记录当前历史落点与 intel-engine 长期目标入口                 |
| 新增 | `docs/agents/intel-engine/daily-tech-briefing.md`                                                                     | 记录 briefing 迁移目标、存储、测试和禁止回退规则             |
| 移动 | `apps/backend/agent-server/src/runtime/briefings/*.ts` -> `agents/intel-engine/src/runtime/briefing/*.ts`             | briefing 主逻辑真实宿主                                      |
| 新增 | `agents/intel-engine/src/runtime/briefing/index.ts`                                                                   | briefing facade/root export                                  |
| 修改 | `agents/intel-engine/src/index.ts`                                                                                    | 导出 briefing facade、service、types                         |
| 移动 | `apps/backend/agent-server/test/runtime/briefings/*.test.ts` -> `agents/intel-engine/test/runtime/briefing/*.test.ts` | briefing 单元测试迁到真实宿主                                |
| 新增 | `apps/backend/agent-server/src/runtime/core/runtime-intel-briefing-facade.ts`                                         | backend-only adapter，调用 `@agent/agents-intel-engine`      |
| 修改 | `apps/backend/agent-server/src/runtime/core/runtime-provider-factories.ts`                                            | 创建 intel briefing facade，替代 backend service 实例        |
| 修改 | `apps/backend/agent-server/src/runtime/runtime.module.ts`                                                             | provider token 从 backend briefing service 切到 facade       |
| 修改 | `apps/backend/agent-server/src/runtime/runtime.service.ts`                                                            | 兼容 facade 使用 intel briefing adapter                      |
| 修改 | `apps/backend/agent-server/src/runtime/schedules/runtime-schedule.service.ts`                                         | schedule 触发调用 intel briefing facade                      |
| 修改 | `apps/backend/agent-server/src/runtime/centers/runtime-centers*.ts`                                                   | briefing runs/status/feedback 读取切到 intel briefing facade |
| 修改 | `apps/backend/agent-server/src/platform/platform-briefings.controller.ts`                                             | 保持 API 不变，只委托 backend BFF/facade                     |
| 修改 | `apps/backend/agent-server/test/platform/platform-console-and-runtime.controller.spec.ts`                             | 保留 controller delegation smoke                             |
| 新增 | `apps/backend/agent-server/test/runtime/briefings/briefing-bff-facade.spec.ts`                                        | backend 只测试 BFF adapter，不再测试 briefing 领域规则       |

## Task 1：锁定文档边界

**Files:**

- Modify: `docs/apps/backend/agent-server/agent-server-overview.md`
- Modify: `docs/apps/backend/agent-server/runtime-module-notes.md`
- Modify: `docs/integration/daily-tech-intelligence-briefing-design.md`
- Create: `docs/agents/intel-engine/daily-tech-briefing.md`

- [ ] **Step 1：更新 backend overview**

在 `docs/apps/backend/agent-server/agent-server-overview.md` 的 runtime 边界段落补入以下内容：

```markdown
当前 backend 瘦身边界补充：

- `agent-server` 的长期定位是 API Host + BFF + Composition Root。
- `agent-server` 可以装配 runtime、暴露 HTTP/SSE、适配 Nest 错误语义和聚合 admin BFF response，但不作为稳定领域规则、agent 主链或业务子系统的真实宿主。
- Daily Tech Intelligence Briefing 当前代码历史落点仍是 `apps/backend/agent-server/src/runtime/briefings`；本轮计划目标和长期真实宿主是 `agents/intel-engine/src/runtime/briefing`。
- 迁移完成后，backend 只保留 `PlatformBriefingsController`、Nest provider wiring、force-run / feedback / runs 查询 API、权限审计和错误映射。
- 迁移完成前，不要新增 backend briefing 主逻辑；只允许做迁移所需适配。新增 briefing 采集源、分类、排序、本地化、投递、存储、反馈策略时，默认修改或迁入 `agents/intel-engine`，不要继续扩展 `apps/backend/agent-server/src/runtime/briefings`。
```

- [ ] **Step 2：更新 runtime module notes**

在 `docs/apps/backend/agent-server/runtime-module-notes.md` 的 `briefings/` 约束段落替换为：

```markdown
`briefings/` 迁移约束：

- Daily Tech Intelligence Briefing 当前代码历史落点仍是 `apps/backend/agent-server/src/runtime/briefings`，但这只是待迁出的过渡状态，不是长期 backend runtime 子模块。
- 本轮计划目标和长期真实宿主是 `agents/intel-engine/src/runtime/briefing`。
- 迁移完成前，不要新增 backend briefing 采集、去重、排序、本地化、投递、存储或反馈应用主逻辑；只允许保留迁移所需适配。
- 迁移完成后，backend 只允许保留调用 `@agent/agents-intel-engine` facade 的 BFF adapter、schedule trigger、controller delegation、error mapping 和 API smoke。
- 迁移完成后，`apps/backend/agent-server/src/runtime/briefings` 应删除；不得保留长期 compat 双轨。
```

- [ ] **Step 3：更新 integration 设计入口**

将 `docs/integration/daily-tech-intelligence-briefing-design.md` 中“当前真实实现”改为过渡态说明：当前代码历史落点仍是 backend `runtime/briefings`，Task 2/3 才创建并迁移到 intel-engine 入口。

```markdown
当前代码历史落点仍是 `apps/backend/agent-server/src/runtime/briefings/*`。这是待迁出的过渡状态，不代表 backend 是 briefing 领域长期宿主。

本轮计划目标和长期真实宿主是 `agents/intel-engine/src/runtime/briefing/*`：

- `agents/intel-engine/src/runtime/briefing/briefing.service.ts`
  - briefing orchestration facade，负责分类循环、抓取和投递编排。
- `agents/intel-engine/src/runtime/briefing/briefing-category-collector.ts`
  - feed、安全页、NVD 与 MCP supplemental search 的分类抓取入口。
- `agents/intel-engine/src/runtime/briefing/briefing-category-processor.ts`
  - 同轮合并、跨轮去重、分类限流、audit record 与 final status。
- `agents/intel-engine/src/runtime/briefing/briefing-schedule.ts`
  - category schedule、adaptive interval、lookback days 和 cron 计算。
- `agents/intel-engine/src/runtime/briefing/briefing-storage.ts`
  - schedules、runs、history、feedback、schedule state 的本地 JSON 存储。

迁移完成前，不要新增 backend briefing 主逻辑；只允许做迁移所需适配。迁移完成后，`apps/backend/agent-server` 只保留 HTTP/BFF、Nest wiring、force-run、feedback、runs 查询、权限审计和错误映射。
```

- [ ] **Step 4：新增 intel-engine briefing 文档**

创建 `docs/agents/intel-engine/daily-tech-briefing.md`：

````markdown
# Daily Tech Briefing in Intel Engine

状态：current  
文档类型：reference  
适用范围：`agents/intel-engine/src/runtime/briefing`  
最后核对：2026-04-29

Daily Tech Intelligence Briefing 的当前代码历史落点仍是 `apps/backend/agent-server/src/runtime/briefings/*`。本轮计划目标和长期真实宿主是 `agents/intel-engine/src/runtime/briefing/*`；迁移完成前，不要新增 backend briefing 主逻辑，只允许做迁移所需适配。

## 边界

- 迁移完成后，`agents/intel-engine` 负责 briefing category config、情报采集、MCP/web search 补充发现、去重、ranking、本地化、Lark delivery、run/history/feedback/schedule storage。
- 迁移完成后，`apps/backend/agent-server` 只负责 HTTP/BFF、Nest wiring、force-run、feedback、runs 查询、权限审计和错误映射。
- `packages/runtime` 不承载 briefing 业务主逻辑。

## 存储

短期继续使用仓库根级 JSON 路径，保持历史兼容：

```text
data/runtime/briefings/daily-tech-briefing-runs.json
data/runtime/briefings/daily-tech-briefing-history.json
data/runtime/briefings/daily-tech-briefing-schedule-state.json
data/runtime/briefings/daily-tech-briefing-feedback.json
data/runtime/briefings/raw/
data/runtime/schedules/daily-tech-briefing-<category>.json
```

## 测试

迁移完成后，briefing 领域测试放在 `agents/intel-engine/test/runtime/briefing`。Backend 只保留 controller 和 BFF adapter smoke。
````

- [ ] **Step 5：运行文档检查**

Run:

```bash
pnpm check:docs
```

Expected: `docs check passed`。

- [ ] **Step 6：Commit**

```bash
git add docs/apps/backend/agent-server/agent-server-overview.md docs/apps/backend/agent-server/runtime-module-notes.md docs/integration/daily-tech-intelligence-briefing-design.md docs/agents/intel-engine/daily-tech-briefing.md
git commit -m "docs: lock agent-server briefing ownership"
```

## Task 2：在 `agents/intel-engine` 建立 briefing facade

**Files:**

- Move: `apps/backend/agent-server/src/runtime/briefings/runtime-tech-briefing.types.ts` -> `agents/intel-engine/src/runtime/briefing/briefing.types.ts`
- Move: `apps/backend/agent-server/src/runtime/briefings/runtime-tech-briefing.service.ts` -> `agents/intel-engine/src/runtime/briefing/briefing.service.ts`
- Move: all remaining `apps/backend/agent-server/src/runtime/briefings/runtime-tech-briefing-*.ts` -> `agents/intel-engine/src/runtime/briefing/briefing-*.ts`
- Create: `agents/intel-engine/src/runtime/briefing/index.ts`
- Modify: `agents/intel-engine/src/index.ts`

- [ ] **Step 1：移动 briefing 源码**

Run:

```bash
mkdir -p agents/intel-engine/src/runtime/briefing
git mv apps/backend/agent-server/src/runtime/briefings/runtime-tech-briefing.types.ts agents/intel-engine/src/runtime/briefing/briefing.types.ts
git mv apps/backend/agent-server/src/runtime/briefings/runtime-tech-briefing.service.ts agents/intel-engine/src/runtime/briefing/briefing.service.ts
for file in apps/backend/agent-server/src/runtime/briefings/runtime-tech-briefing-*.ts; do target="agents/intel-engine/src/runtime/briefing/$(basename "$file" | sed 's/runtime-tech-briefing/briefing/')"; git mv "$file" "$target"; done
rmdir apps/backend/agent-server/src/runtime/briefings
```

Expected: `apps/backend/agent-server/src/runtime/briefings` 不再存在，`agents/intel-engine/src/runtime/briefing` 包含迁移后的文件。

- [ ] **Step 2：批量修正同目录 import 名称**

Run:

```bash
perl -0pi -e "s#'\\./runtime-tech-briefing#'./briefing#g; s#\"\\./runtime-tech-briefing#\"./briefing#g" agents/intel-engine/src/runtime/briefing/*.ts
```

Expected: `rg "runtime-tech-briefing" agents/intel-engine/src/runtime/briefing` 不再命中 import specifier。

- [ ] **Step 3：修正 service 的 core import 与 context contract**

在 `agents/intel-engine/src/runtime/briefing/briefing.service.ts` 保持 `@agent/core` import，不要反向绑定完整 `@agent/config`：

```ts
import { ActionIntent } from '@agent/core';
```

`RuntimeTechBriefingContext.settings` 使用 briefing runtime 需要的最小本地 contract：

```ts
export interface RuntimeTechBriefingContext {
  settings: {
    workspaceRoot: string;
    zhipuApiKey?: string;
    zhipuApiBaseUrl?: string;
    zhipuModels?: {
      manager: string;
      research: string;
      executor: string;
      reviewer: string;
    };
    providers?: unknown[];
    dailyTechBriefing: BriefingSettings;
  };
  ...
}
```

Expected: `agents/intel-engine` 不新增 `@agent/config` 依赖；backend composition root 负责把真实 settings 适配成该最小 context，避免配置包类型穿透到领域 runtime。

- [ ] **Step 4：创建 briefing barrel**

创建 `agents/intel-engine/src/runtime/briefing/index.ts`：

```ts
export { RuntimeTechBriefingService } from './briefing.service';
export type { RuntimeTechBriefingContext } from './briefing.service';
export {
  ensureDailyTechBriefingSchedules,
  listPersistedBriefingSchedules,
  saveDailyTechBriefingSchedule,
  readBriefingFeedback,
  readBriefingHistory,
  readBriefingScheduleState,
  readDailyTechBriefingRuns,
  saveBriefingScheduleState
} from './briefing-storage';
export { readDailyTechBriefingStatus } from './briefing-status';
export type {
  DailyTechBriefingScheduleRecord,
  DailyTechBriefingStatusRecord,
  TechBriefingCategory,
  TechBriefingCategoryResult,
  TechBriefingCategoryScheduleState,
  TechBriefingItem,
  TechBriefingRunRecord
} from './briefing.types';
```

- [ ] **Step 5：导出 public entrypoint**

在 `agents/intel-engine/src/index.ts` 增加：

```ts
export * from './runtime/briefing';
```

- [ ] **Step 6：运行 intel-engine typecheck**

Run:

```bash
pnpm --dir agents/intel-engine typecheck
```

Expected: PASS。

- [ ] **Step 7：Commit**

```bash
git add agents/intel-engine/src apps/backend/agent-server/src/runtime/briefings agents/intel-engine/package.json pnpm-lock.yaml
git commit -m "refactor(intel-engine): move briefing runtime into intel agent"
```

## Task 3：迁移 briefing 单元测试到 intel engine

**Files:**

- Move: `apps/backend/agent-server/test/runtime/briefings/*.test.ts` -> `agents/intel-engine/test/runtime/briefing/*.test.ts`

- [ ] **Step 1：移动测试文件**

Run:

```bash
mkdir -p agents/intel-engine/test/runtime/briefing
for file in apps/backend/agent-server/test/runtime/briefings/*.test.ts; do git mv "$file" "agents/intel-engine/test/runtime/briefing/$(basename "$file" | sed 's/runtime-tech-briefing/briefing/')"; done
rmdir apps/backend/agent-server/test/runtime/briefings
```

Expected: `agents/intel-engine/test/runtime/briefing` 包含所有 briefing 领域测试。

- [ ] **Step 2：修正测试 import**

Run:

```bash
perl -0pi -e "s#../../../src/runtime/briefings/runtime-tech-briefing#../../../src/runtime/briefing/briefing#g; s#../../src/runtime/briefings/runtime-tech-briefing#../../src/runtime/briefing/briefing#g" agents/intel-engine/test/runtime/briefing/*.ts
```

Expected: `rg "runtime/briefings|runtime-tech-briefing" agents/intel-engine/test/runtime/briefing` 不再命中。

- [ ] **Step 3：运行迁移后的测试**

Run:

```bash
pnpm --dir agents/intel-engine exec vitest run --config ../../vitest.config.js test/runtime/briefing
```

Expected: PASS。

- [ ] **Step 4：Commit**

```bash
git add agents/intel-engine/test apps/backend/agent-server/test/runtime/briefings
git commit -m "test(intel-engine): move briefing tests to intel agent"
```

## Task 4：让 backend 通过 intel briefing facade 调用

**Files:**

- Create: `apps/backend/agent-server/src/runtime/core/runtime-intel-briefing-facade.ts`
- Modify: `apps/backend/agent-server/src/runtime/core/runtime-provider-factories.ts`
- Modify: `apps/backend/agent-server/src/runtime/runtime.module.ts`
- Modify: `apps/backend/agent-server/src/runtime/runtime.service.ts`
- Modify: `apps/backend/agent-server/src/runtime/core/runtime-provider-factory-contexts.ts`

- [ ] **Step 1：新增 backend-only briefing facade**

创建 `apps/backend/agent-server/src/runtime/core/runtime-intel-briefing-facade.ts`：

```ts
import {
  RuntimeTechBriefingService,
  type RuntimeTechBriefingContext,
  type TechBriefingCategory
} from '@agent/agents-intel-engine';

export class RuntimeIntelBriefingFacade {
  private readonly service: RuntimeTechBriefingService;

  constructor(getContext: () => RuntimeTechBriefingContext) {
    this.service = new RuntimeTechBriefingService(getContext);
  }

  initializeSchedule() {
    return this.service.initializeSchedule();
  }

  runScheduled(now?: Date, categories?: TechBriefingCategory[]) {
    return this.service.runScheduled(now, categories);
  }

  forceRun(category: TechBriefingCategory, now?: Date) {
    return this.service.forceRun(category, now);
  }

  getStatus() {
    return this.service.getStatus();
  }
}
```

- [ ] **Step 2：更新 provider factory import**

在 `apps/backend/agent-server/src/runtime/core/runtime-provider-factories.ts` 中把 backend service import：

```ts
import { RuntimeTechBriefingService } from '../briefings/runtime-tech-briefing.service';
```

替换为：

```ts
import { RuntimeIntelBriefingFacade } from './runtime-intel-briefing-facade';
```

并将 `createRuntimeTechBriefingService` 改为：

```ts
export function createRuntimeIntelBriefingFacade(runtimeHost: RuntimeHost) {
  return new RuntimeIntelBriefingFacade(() => ({
    settings: runtimeHost.settings,
    fetchImpl: fetch,
    mcpClientManager: runtimeHost.mcpClientManager,
    translateText: input => runtimeHost.translateText(input)
  }));
}
```

如果 `RuntimeHost` 现在没有 `translateText` 窄方法，先把 `translateText` 字段省略，保持 existing service 的 fallback 行为；不要在 backend 内新增翻译主逻辑。

- [ ] **Step 3：更新 RuntimeModule provider token**

在 `apps/backend/agent-server/src/runtime/runtime.module.ts` 中替换 provider：

```ts
{
  provide: RuntimeIntelBriefingFacade,
  useFactory: (runtimeHost: RuntimeHost) => createRuntimeIntelBriefingFacade(runtimeHost),
  inject: [RuntimeHost]
}
```

同时把依赖 `RuntimeTechBriefingService` 的 factory 参数替换成 `RuntimeIntelBriefingFacade`。

- [ ] **Step 4：更新 context 类型**

在 `apps/backend/agent-server/src/runtime/core/runtime-provider-factory-contexts.ts`、`runtime-centers.types.ts`、`runtime-centers-context.ts` 中，将 briefing service 类型统一替换为：

```ts
import type { RuntimeIntelBriefingFacade } from './runtime-intel-briefing-facade';
```

对应 context 字段命名保持 `techBriefingService`，类型改为 `RuntimeIntelBriefingFacade`，避免扩大本轮改名面。

- [ ] **Step 5：运行 backend runtime 相关 typecheck**

Run:

```bash
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit --pretty false
```

Expected: PASS。

- [ ] **Step 6：Commit**

```bash
git add apps/backend/agent-server/src/runtime
git commit -m "refactor(backend): route briefing through intel facade"
```

## Task 5：切换 schedule、centers 和 runtime center status 读取

**Files:**

- Modify: `apps/backend/agent-server/src/runtime/schedules/runtime-schedule.service.ts`
- Modify: `apps/backend/agent-server/src/runtime/centers/runtime-centers-query.service.ts`
- Modify: `apps/backend/agent-server/src/runtime/centers/runtime-centers-observability.query-service.ts`
- Modify: `apps/backend/agent-server/src/runtime/centers/runtime-centers-runtime.query-service.ts`
- Modify: `apps/backend/agent-server/src/runtime/centers/runtime-runtime-center.ts`

- [ ] **Step 1：替换 schedule imports**

在 `runtime-schedule.service.ts` 中，将：

```ts
import type { RuntimeTechBriefingService } from '../briefings/runtime-tech-briefing.service';
import {
  ensureDailyTechBriefingSchedules,
  listPersistedBriefingSchedules,
  saveDailyTechBriefingSchedule
} from '../briefings/runtime-tech-briefing-storage';
import type { DailyTechBriefingScheduleRecord, TechBriefingCategory } from '../briefings/runtime-tech-briefing.types';
```

替换为：

```ts
import {
  ensureDailyTechBriefingSchedules,
  listPersistedBriefingSchedules,
  saveDailyTechBriefingSchedule,
  type DailyTechBriefingScheduleRecord,
  type TechBriefingCategory
} from '@agent/agents-intel-engine';

import type { RuntimeIntelBriefingFacade } from '../core/runtime-intel-briefing-facade';
```

并把 `techBriefingService: RuntimeTechBriefingService` 改为 `techBriefingService: RuntimeIntelBriefingFacade`。

- [ ] **Step 2：替换 centers query 类型 imports**

将所有来自 `../briefings/runtime-tech-briefing.types`、`../briefings/runtime-tech-briefing-status`、`../briefings/runtime-tech-briefing-storage` 的 import 改为 `@agent/agents-intel-engine`。

示例：

```ts
import { readDailyTechBriefingStatus, type TechBriefingCategory } from '@agent/agents-intel-engine';
```

- [ ] **Step 3：运行 targeted rg 检查**

Run:

```bash
rg "runtime/briefings|runtime-tech-briefing|../briefings" apps/backend/agent-server/src
```

Expected: no matches。

- [ ] **Step 4：运行 backend runtime 测试**

Run:

```bash
pnpm --dir apps/backend/agent-server test:runtime
```

Expected: PASS。

- [ ] **Step 5：Commit**

```bash
git add apps/backend/agent-server/src/runtime
git commit -m "refactor(backend): consume briefing from intel engine"
```

## Task 6：保留 backend BFF/API smoke，删除领域测试双轨

**Files:**

- Create: `apps/backend/agent-server/test/runtime/briefings/briefing-bff-facade.spec.ts`
- Modify: `apps/backend/agent-server/test/platform/platform-console-and-runtime.controller.spec.ts`
- Modify: `apps/backend/agent-server/test/platform/platform-controller.test-helpers.ts`

- [ ] **Step 1：新增 BFF facade smoke 测试**

创建 `apps/backend/agent-server/test/runtime/briefings/briefing-bff-facade.spec.ts`：

```ts
import { describe, expect, it, vi } from 'vitest';

import { RuntimeIntelBriefingFacade } from '../../../src/runtime/core/runtime-intel-briefing-facade';

describe('RuntimeIntelBriefingFacade', () => {
  it('delegates forceRun through the intel briefing service contract', async () => {
    const facade = new RuntimeIntelBriefingFacade(() => ({
      settings: {
        workspaceRoot: process.cwd(),
        dailyTechBriefing: {
          enabled: false,
          schedule: 'daily 11:00',
          duplicateWindowDays: 7,
          sendEmptyDigest: false,
          larkDigestMode: 'text',
          sourcePolicy: 'balanced'
        }
      } as never,
      fetchImpl: vi.fn() as never
    }));

    const run = await facade.forceRun('frontend-tech', new Date('2026-04-29T00:00:00.000Z'));

    expect(run.categories).toContain('frontend-tech');
  });
});
```

If the exact `BriefingSettings` shape requires additional existing fields, add the minimum fields reported by TypeScript and keep `enabled: false` so the test does not fetch external sources.

- [ ] **Step 2：确认 platform controller 测试仍只测 delegation**

在 `apps/backend/agent-server/test/platform/platform-console-and-runtime.controller.spec.ts` 中保留以下断言语义：

```ts
expect(briefingController.getBriefingRuns(7, 'general-security')).toEqual(
  expect.objectContaining({ scope: 'briefings' })
);
expect(briefingController.forceBriefingRun('backend-tech')).toEqual({ category: 'backend-tech', forced: true });
```

- [ ] **Step 3：运行 backend BFF 测试**

Run:

```bash
pnpm --dir apps/backend/agent-server exec vitest run --config ../../../vitest.config.js test/platform/platform-console-and-runtime.controller.spec.ts test/runtime/briefings/briefing-bff-facade.spec.ts
```

Expected: PASS。

- [ ] **Step 4：Commit**

```bash
git add apps/backend/agent-server/test
git commit -m "test(backend): keep briefing bff smoke coverage"
```

## Task 7：完成文档与残留检查

**Files:**

- Modify: `docs/apps/backend/agent-server/agent-server-overview.md`
- Modify: `docs/apps/backend/agent-server/runtime-module-notes.md`
- Modify: `docs/integration/daily-tech-intelligence-briefing-design.md`
- Modify: `docs/agents/intel-engine/daily-tech-briefing.md`

- [ ] **Step 1：检查 backend briefing 残留**

Run:

```bash
rg "runtime/briefings|runtime-tech-briefing|RuntimeTechBriefingService" apps/backend/agent-server/src apps/backend/agent-server/test docs/apps/backend docs/integration
```

Expected: backend 源码不再命中旧路径；docs 只允许在历史迁移说明中出现“旧路径已删除”。

- [ ] **Step 2：检查 intel engine 导出**

Run:

```bash
pnpm --dir agents/intel-engine typecheck
pnpm --dir agents/intel-engine test
```

Expected: both PASS。

- [ ] **Step 3：运行文档检查**

Run:

```bash
pnpm check:docs
```

Expected: `docs check passed`。

- [ ] **Step 4：Commit**

```bash
git add docs apps/backend/agent-server/src agents/intel-engine/src agents/intel-engine/test
git commit -m "docs: document intel briefing ownership"
```

## Task 8：最终验证

**Files:**

- No source edits in this task.

- [ ] **Step 1：Type**

Run:

```bash
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit --pretty false
pnpm --dir agents/intel-engine typecheck
```

Expected: both PASS。

- [ ] **Step 2：Unit**

Run:

```bash
pnpm --dir agents/intel-engine test
pnpm --dir apps/backend/agent-server test:runtime
```

Expected: both PASS。

- [ ] **Step 3：Build**

Run:

```bash
pnpm build:lib
pnpm --dir apps/backend/agent-server build
```

Expected: both PASS。

- [ ] **Step 4：Docs**

Run:

```bash
pnpm check:docs
```

Expected: PASS。

- [ ] **Step 5：Workspace verification**

Run:

```bash
pnpm verify
```

Expected: PASS. If blocked by unrelated existing red lights, capture the failing command, error summary, and whether it touches files changed by this plan.

- [ ] **Step 6：Final commit if verification only changed generated lock/build metadata**

If verification caused no file changes, skip this step. If `pnpm add` in Task 2 changed `pnpm-lock.yaml`, it should already be committed in Task 2.

```bash
git status --short
```

Expected: only unrelated pre-existing worktree changes remain.

## Implementation Notes

- Do not use `git worktree`.
- Do not stage unrelated existing changes in the checkout.
- Keep API paths under `PlatformBriefingsController` unchanged.
- Keep briefing storage paths under `data/runtime/briefings` and `data/runtime/schedules` unchanged in this migration.
- Do not introduce `packages/intel`.
- Do not move stable contracts into `packages/core` unless a concrete frontend/backend/agent multi-consumer schema is needed during implementation.
- If a moved file exceeds 400 lines and is modified beyond import path updates, split it in the same task before committing.

## Self-Review

- Spec coverage: this plan covers boundary docs, `briefings -> agents/intel-engine`, backend BFF retention, API compatibility, storage compatibility, tests, docs, and verification. Broad compat cleanup and tools/review directory rename are intentionally split into later plans.
- Placeholder scan: no placeholder patterns remain as implementation instructions.
- Type consistency: the plan consistently uses `RuntimeIntelBriefingFacade` as the backend adapter and `RuntimeTechBriefingService` as the intel engine domain service export.
