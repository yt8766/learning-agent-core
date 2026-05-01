# Workflow Lab Implementation Plan

状态：completed
文档类型：plan
适用范围：`apps/frontend/agent-admin`、`apps/backend/agent-server`、本地 PostgreSQL
最后核对：2026-04-30

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 agent-admin 中新增"工作流实验室"页面，支持触发 company-live 工作流运行、实时 SSE 节点轨迹流式显示、PostgreSQL 历史记录。

**Architecture:** 后端新增通用 `WorkflowRunModule`（TypeORM + PostgreSQL），通过 `WorkflowDispatcher` 路由到各 domain graph；graph 层新增可选 `onNodeComplete` 回调；前端三栏布局（工作流列表 + 节点时间线 + 节点详情），EventSource 订阅 SSE 流式更新。

**Tech Stack:** NestJS (@nestjs/typeorm, typeorm, pg), PostgreSQL (Docker), RxJS Subject, EventSource, shadcn/ui, Tailwind CSS 4, lucide-react, React 19

**Spec:** `docs/superpowers/specs/2026-04-29-workflow-lab-design.md`

## Execution Status — 2026-04-30

**Implementation:** Task 1–15 的代码路径已落地并接线。后端 `WorkflowRunsModule`、PostgreSQL TypeORM entity/repository/service/controller、company-live `onNodeComplete`、agent-admin Workflow Lab registry/API/hook/三栏页面/导航入口均已实现。原先误放在 `src/workflow-runs/` 下的 service spec 已迁移到 `apps/backend/agent-server/test/workflow-runs/`，确保 Vitest 会真实收集。

**Runtime smoke:** 本地 Docker Compose PostgreSQL 已确认 `healthy`；`PORT=3001 pnpm --dir apps/backend/agent-server start:dev` 可启动并映射 `/api/workflow-runs` 路由。已通过 curl 验证：

- `GET /api/health` 返回 `{"status":"ok"}`。
- `POST /api/workflow-runs` 可创建 `company-live` run。
- `GET /api/workflow-runs?workflowId=company-live` 可查到历史记录。
- `GET /api/workflow-runs/:id` 可返回 `inputData` 与四个节点 `traceData`。
- `GET /api/workflow-runs/:id/stream` 可返回 `node-complete` 与 `run-complete` SSE 事件。

**Targeted verification passed:**

- `pnpm --dir /Users/dev/Desktop/learning-agent-core exec vitest run --config vitest.config.js apps/frontend/agent-admin/test/features/workflow-lab/useWorkflowStream.test.ts` — 10 tests passed.
- `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/workflow-runs/workflow-runs.service.spec.ts` — 4 tests passed.
- `pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit --pretty false` — passed.
- `pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit --pretty false` — passed.
- `pnpm exec prettier --check ...` for touched Workflow Lab/backend spec files — passed.

**Full verification:** initial `pnpm verify` passed docs, prettier, eslint, typecheck, and spec tests, then failed in `test:unit` because existing intel-engine/backend intel tests could not open `better-sqlite3`: installed native module was compiled for `NODE_MODULE_VERSION 137`, while current Node requires `NODE_MODULE_VERSION 127`. This was resolved on 2026-04-30 by running `pnpm rebuild better-sqlite3`. The previously failing intel-engine/backend intel tests passed afterward, and a fresh full `pnpm verify` completed successfully.

**Known variance from this original plan:** the local PostgreSQL compose file now lives at `docker-compose.yml`; `docker-compose.dev.yml` is deleted in the current workspace. The effective service is healthy and maps port `5432`.

---

## File Map

### 新建文件（后端）

- `docker-compose.yml` — Docker PostgreSQL 本地开发
- `.env.example` — 数据库环境变量示例
- `apps/backend/agent-server/src/workflow-runs/entities/workflow-run.entity.ts` — TypeORM entity
- `apps/backend/agent-server/src/workflow-runs/repositories/workflow-run.repository.ts` — DB CRUD
- `apps/backend/agent-server/src/workflow-runs/workflow-runs.dto.ts` — StartWorkflowRunDto
- `apps/backend/agent-server/src/workflow-runs/workflow-dispatcher.ts` — workflowId → graph 路由
- `apps/backend/agent-server/src/workflow-runs/workflow-runs.service.ts` — 编排 + SSE Subject 桥接
- `apps/backend/agent-server/src/workflow-runs/workflow-runs.controller.ts` — HTTP + @Sse 端点
- `apps/backend/agent-server/src/workflow-runs/workflow-runs.module.ts` — NestJS 模块
- `apps/backend/agent-server/test/workflow-runs/workflow-runs.service.spec.ts` — service 单测（满足 check-backend-structure 要求）

### 修改文件（后端）

- `apps/backend/agent-server/src/app.module.ts` — 注册 TypeOrmModule + WorkflowRunsModule
- `apps/backend/agent-server/package.json` — 添加 @nestjs/typeorm, typeorm, pg 依赖

### 修改文件（graph 层）

- `agents/company-live/src/graphs/company-live.graph.ts` — 新增可选 options.onNodeComplete 回调
- `agents/company-live/src/index.ts` — 导出 CompanyLiveGraphOptions 类型
- `agents/company-live/test/company-live-graph.test.ts` — 补充 progressCallback 回归测试

### 新建文件（前端）

- `apps/frontend/agent-admin/src/features/workflow-lab/registry/workflow.registry.ts` — 工作流注册表
- `apps/frontend/agent-admin/src/features/workflow-lab/api/workflow-runs.api.ts` — axios 调用层
- `apps/frontend/agent-admin/src/features/workflow-lab/hooks/useWorkflowStream.ts` — SSE hook
- `apps/frontend/agent-admin/src/features/workflow-lab/components/WorkflowList.tsx` — 左栏：工作流列表
- `apps/frontend/agent-admin/src/features/workflow-lab/components/RunHistoryList.tsx` — 左栏：历史运行
- `apps/frontend/agent-admin/src/features/workflow-lab/components/WorkflowSidebar.tsx` — 左栏容器
- `apps/frontend/agent-admin/src/features/workflow-lab/components/WorkflowRunForm.tsx` — 中栏：参数表单
- `apps/frontend/agent-admin/src/features/workflow-lab/components/NodeTimeline.tsx` — 中栏：节点时间线
- `apps/frontend/agent-admin/src/features/workflow-lab/components/NodeTimelinePanel.tsx` — 中栏容器
- `apps/frontend/agent-admin/src/features/workflow-lab/components/NodeDetailPanel.tsx` — 右栏
- `apps/frontend/agent-admin/src/features/workflow-lab/WorkflowLabPage.tsx` — 页面入口（三栏布局）
- `apps/frontend/agent-admin/test/features/workflow-lab/useWorkflowStream.test.ts` — hook 测试

### 修改文件（前端）

- `apps/frontend/agent-admin/src/types/admin/tasking.ts` — DashboardPageKey 添加 'workflowLab'
- `apps/frontend/agent-admin/src/components/app-sidebar.tsx` — NAV_ITEMS 添加工作流实验室
- `apps/frontend/agent-admin/src/pages/dashboard/dashboard-center-content.tsx` — 添加 workflowLab case

---

## Task 1: 基础设施 — Docker + 后端依赖安装

**Files:**

- Create: `docker-compose.yml`
- Create: `.env.example`
- Modify: `apps/backend/agent-server/package.json` (via pnpm add)

- [ ] **Step 1: 创建 docker-compose.yml**

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: agent_db
    ports:
      - '5432:5432'
    volumes:
      - ./db/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 3s
      retries: 5
```

- [ ] **Step 2: 创建 .env.example**

```
# .env.example — 复制为 .env 并按需修改
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=postgres
DB_NAME=agent_db
```

- [ ] **Step 3: 启动 PostgreSQL**

```bash
docker compose up -d postgres
# 等待健康检查通过
sleep 5
docker compose ps postgres
```

Expected: `agent_db` container 状态为 `healthy`

- [ ] **Step 4: 安装后端依赖**

```bash
pnpm add --filter apps/backend/agent-server @nestjs/typeorm typeorm pg
```

Expected: `apps/backend/agent-server/package.json` 新增三个依赖；`pnpm-lock.yaml` 自动更新

- [ ] **Step 5: 验证安装成功**

```bash
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit 2>&1 | head -20
```

Expected: 无新 TS 错误（可能有既有错误，只要不是新引入的）

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml .env.example apps/backend/agent-server/package.json pnpm-lock.yaml
git commit -m "chore: add docker postgres and typeorm deps for workflow-runs"
```

---

## Task 2: WorkflowRun Entity + TypeORM 配置

**Files:**

- Create: `apps/backend/agent-server/src/workflow-runs/entities/workflow-run.entity.ts`
- Modify: `apps/backend/agent-server/src/app.module.ts`

- [ ] **Step 1: 创建 WorkflowRun entity**

```ts
// apps/backend/agent-server/src/workflow-runs/entities/workflow-run.entity.ts
import { Column, Entity, PrimaryColumn } from 'typeorm';

import type { CompanyLiveNodeTrace } from '@agent/core';

export type WorkflowRunStatus = 'pending' | 'running' | 'completed' | 'failed';

@Entity('workflow_runs')
export class WorkflowRun {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @Column({ type: 'varchar', length: 128 })
  workflowId: string;

  @Column({ type: 'varchar', length: 32 })
  status: WorkflowRunStatus;

  @Column({ type: 'bigint' })
  startedAt: number;

  @Column({ type: 'bigint', nullable: true })
  completedAt: number | null;

  @Column({ type: 'jsonb', nullable: true })
  inputData: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  traceData: CompanyLiveNodeTrace[] | null;
}
```

- [ ] **Step 2: 在 AppModule 中注册 TypeOrmModule**

在 `apps/backend/agent-server/src/app.module.ts` 顶部添加 import：

```ts
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowRun } from './workflow-runs/entities/workflow-run.entity';
```

在 `@Module({ imports: [ ... ] })` 数组的第一项添加：

```ts
TypeOrmModule.forRoot({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASS ?? 'postgres',
  database: process.env.DB_NAME ?? 'agent_db',
  entities: [WorkflowRun],
  synchronize: process.env.NODE_ENV !== 'production',
}),
```

- [ ] **Step 3: 类型检查**

```bash
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit 2>&1 | head -30
```

Expected: 只有既有错误，无新 TS 错误

- [ ] **Step 4: Commit**

```bash
git add apps/backend/agent-server/src/workflow-runs/entities/workflow-run.entity.ts \
        apps/backend/agent-server/src/app.module.ts
git commit -m "feat(workflow-runs): add WorkflowRun entity and typeorm setup"
```

---

## Task 3: WorkflowRunRepository

**Files:**

- Create: `apps/backend/agent-server/src/workflow-runs/repositories/workflow-run.repository.ts`

- [ ] **Step 1: 创建 repository**

```ts
// apps/backend/agent-server/src/workflow-runs/repositories/workflow-run.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { CompanyLiveNodeTrace } from '@agent/core';

import { WorkflowRun } from '../entities/workflow-run.entity';
import type { WorkflowRunStatus } from '../entities/workflow-run.entity';

export interface CreateRunInput {
  id: string;
  workflowId: string;
  inputData: Record<string, unknown>;
}

@Injectable()
export class WorkflowRunRepository {
  constructor(
    @InjectRepository(WorkflowRun)
    private readonly repo: Repository<WorkflowRun>
  ) {}

  async create(input: CreateRunInput): Promise<WorkflowRun> {
    const run = this.repo.create({
      id: input.id,
      workflowId: input.workflowId,
      status: 'running' as WorkflowRunStatus,
      startedAt: Date.now(),
      completedAt: null,
      inputData: input.inputData,
      traceData: null
    });
    return this.repo.save(run);
  }

  async complete(id: string, traceData: CompanyLiveNodeTrace[]): Promise<void> {
    await this.repo.update(id, {
      status: 'completed',
      completedAt: Date.now(),
      traceData
    });
  }

  async fail(id: string): Promise<void> {
    await this.repo.update(id, {
      status: 'failed',
      completedAt: Date.now()
    });
  }

  async findById(id: string): Promise<WorkflowRun | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByWorkflowId(workflowId: string, limit = 20): Promise<WorkflowRun[]> {
    return this.repo.find({
      where: { workflowId },
      order: { startedAt: 'DESC' },
      take: limit
    });
  }

  async findAll(limit = 50): Promise<WorkflowRun[]> {
    return this.repo.find({ order: { startedAt: 'DESC' }, take: limit });
  }
}
```

- [ ] **Step 2: 类型检查**

```bash
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit 2>&1 | grep "workflow-run"
```

Expected: 无错误输出

- [ ] **Step 3: Commit**

```bash
git add apps/backend/agent-server/src/workflow-runs/repositories/workflow-run.repository.ts
git commit -m "feat(workflow-runs): add WorkflowRunRepository with CRUD methods"
```

---

## Task 4: Graph 层 onNodeComplete 回调（TDD）

**Files:**

- Modify: `agents/company-live/src/graphs/company-live.graph.ts`
- Modify: `agents/company-live/src/index.ts`
- Modify: `agents/company-live/test/company-live-graph.test.ts`

- [ ] **Step 1: 先写失败测试（Red）**

在 `agents/company-live/test/company-live-graph.test.ts` 中添加：

```ts
describe('executeCompanyLiveGraph with progressCallback', () => {
  it('calls onNodeComplete for each completed node', async () => {
    const registry = createCompanyLiveStubRegistry();
    const brief = makeStubBrief();
    const completed: string[] = [];

    await executeCompanyLiveGraph(brief, registry, {
      onNodeComplete: trace => {
        completed.push(trace.nodeId);
      }
    });

    expect(completed).toEqual(['generateAudio', 'generateImage', 'generateVideo', 'assembleBundle']);
  });

  it('backward compatible: works without options', async () => {
    const registry = createCompanyLiveStubRegistry();
    const brief = makeStubBrief();
    const result = await executeCompanyLiveGraph(brief, registry);
    expect(result.trace).toHaveLength(4);
  });
});
```

- [ ] **Step 2: 运行测试验证 Red**

```bash
pnpm --filter @agent/agents-company-live test 2>&1 | grep -E "PASS|FAIL|Error|onNodeComplete"
```

Expected: 报错 `Expected 3 arguments, but got 3` 或类似 TS 错误，或测试失败

- [ ] **Step 3: 在 company-live.graph.ts 中添加 options 参数**

```ts
// agents/company-live/src/graphs/company-live.graph.ts
import type { CompanyLiveContentBrief, CompanyLiveGenerateResult, CompanyLiveNodeTrace } from '@agent/core';
import type { MediaProviderRegistry } from '@agent/runtime';

import { assembleBundleNode, generateAudioNode, generateImageNode, generateVideoNode } from '../flows/media/nodes';
import type { CompanyLiveGraphState } from '../flows/media/nodes';

export interface CompanyLiveGraphOptions {
  onNodeComplete?: (trace: CompanyLiveNodeTrace) => void;
}

export async function executeCompanyLiveGraph(
  brief: CompanyLiveContentBrief,
  registry: MediaProviderRegistry,
  options?: CompanyLiveGraphOptions
): Promise<CompanyLiveGenerateResult> {
  let state: CompanyLiveGraphState = {
    brief,
    audioAsset: null,
    imageAsset: null,
    videoAsset: null,
    bundle: null,
    trace: []
  };

  const audioUpdate = await generateAudioNode(state, registry);
  state = { ...state, ...audioUpdate, trace: audioUpdate.trace ?? state.trace };
  const audioTrace = state.trace[state.trace.length - 1];
  if (audioTrace) options?.onNodeComplete?.(audioTrace);

  const imageUpdate = await generateImageNode(state, registry);
  state = { ...state, ...imageUpdate, trace: imageUpdate.trace ?? state.trace };
  const imageTrace = state.trace[state.trace.length - 1];
  if (imageTrace) options?.onNodeComplete?.(imageTrace);

  const videoUpdate = await generateVideoNode(state, registry);
  state = { ...state, ...videoUpdate, trace: videoUpdate.trace ?? state.trace };
  const videoTrace = state.trace[state.trace.length - 1];
  if (videoTrace) options?.onNodeComplete?.(videoTrace);

  const bundleUpdate = assembleBundleNode(state);
  state = { ...state, ...bundleUpdate, trace: bundleUpdate.trace ?? state.trace };
  const bundleTrace = state.trace[state.trace.length - 1];
  if (bundleTrace) options?.onNodeComplete?.(bundleTrace);

  if (!state.bundle) {
    throw new Error('company-live graph: assembleBundle produced no bundle');
  }

  return { bundle: state.bundle, trace: state.trace };
}
```

- [ ] **Step 4: 更新 index.ts 导出 CompanyLiveGraphOptions**

```ts
// agents/company-live/src/index.ts — 在现有导出后追加：
export type { CompanyLiveGraphOptions } from './graphs/company-live.graph';
```

- [ ] **Step 5: 运行测试验证 Green**

```bash
pnpm --filter @agent/agents-company-live test 2>&1 | grep -E "PASS|FAIL|✓|✗"
```

Expected: 所有测试通过（包括新增的 progressCallback 测试）

- [ ] **Step 6: Commit**

```bash
git add agents/company-live/src/graphs/company-live.graph.ts \
        agents/company-live/src/index.ts \
        agents/company-live/test/company-live-graph.test.ts
git commit -m "feat(company-live): add onNodeComplete progressCallback to executeCompanyLiveGraph"
```

---

## Task 5: WorkflowDispatcher + DTO

**Files:**

- Create: `apps/backend/agent-server/src/workflow-runs/workflow-runs.dto.ts`
- Create: `apps/backend/agent-server/src/workflow-runs/workflow-dispatcher.ts`

- [ ] **Step 1: 创建 StartWorkflowRunDto**

```ts
// apps/backend/agent-server/src/workflow-runs/workflow-runs.dto.ts
export class StartWorkflowRunDto {
  workflowId: string;
  input: Record<string, unknown>;
}
```

- [ ] **Step 2: 创建 WorkflowDispatcher**

```ts
// apps/backend/agent-server/src/workflow-runs/workflow-dispatcher.ts
import { Injectable, NotFoundException } from '@nestjs/common';

import type { CompanyLiveGenerateResult, CompanyLiveNodeTrace } from '@agent/core';
import { createCompanyLiveStubRegistry, executeCompanyLiveGraph } from '@agent/agents-company-live';

import { parseCompanyLiveGenerateDto } from '../company-live/company-live.dto';

export type WorkflowResult = CompanyLiveGenerateResult;
export type NodeCompleteCallback = (trace: CompanyLiveNodeTrace) => void;

@Injectable()
export class WorkflowDispatcher {
  async dispatch(
    workflowId: string,
    input: Record<string, unknown>,
    onNodeComplete: NodeCompleteCallback
  ): Promise<WorkflowResult> {
    if (workflowId === 'company-live') {
      const brief = parseCompanyLiveGenerateDto(input);
      const registry = createCompanyLiveStubRegistry();
      return executeCompanyLiveGraph(brief, registry, { onNodeComplete });
    }
    throw new NotFoundException(`Unknown workflowId: ${workflowId}`);
  }

  listWorkflowIds(): string[] {
    return ['company-live'];
  }
}
```

- [ ] **Step 3: 类型检查**

```bash
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit 2>&1 | grep "workflow-dispatcher\|workflow-runs.dto"
```

Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add apps/backend/agent-server/src/workflow-runs/workflow-runs.dto.ts \
        apps/backend/agent-server/src/workflow-runs/workflow-dispatcher.ts
git commit -m "feat(workflow-runs): add StartWorkflowRunDto and WorkflowDispatcher"
```

---

## Task 6: WorkflowRunService（SSE Subject 桥接）

**Files:**

- Create: `apps/backend/agent-server/src/workflow-runs/workflow-runs.service.ts`

- [ ] **Step 1: 创建 WorkflowRunService**

```ts
// apps/backend/agent-server/src/workflow-runs/workflow-runs.service.ts
import { Injectable } from '@nestjs/common';
import { EMPTY, Observable, Subject, from, merge, of } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';

import type { CompanyLiveNodeTrace } from '@agent/core';

import { WorkflowRunRepository } from './repositories/workflow-run.repository';
import { WorkflowDispatcher } from './workflow-dispatcher';

export interface NodeCompleteEvent {
  type: 'node-complete';
  nodeId: string;
  status: string;
  durationMs: number;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

export interface RunCompleteEvent {
  type: 'run-complete';
  runId: string;
  status: string;
  totalMs: number;
}

export interface RunErrorEvent {
  type: 'run-error';
  runId: string;
  error: string;
}

export type WorkflowStreamEvent = NodeCompleteEvent | RunCompleteEvent | RunErrorEvent;

@Injectable()
export class WorkflowRunService {
  private readonly subjects = new Map<string, Subject<WorkflowStreamEvent>>();

  constructor(
    private readonly repository: WorkflowRunRepository,
    private readonly dispatcher: WorkflowDispatcher
  ) {}

  async startRun(workflowId: string, input: Record<string, unknown>): Promise<string> {
    const runId = crypto.randomUUID();
    const subject = new Subject<WorkflowStreamEvent>();
    this.subjects.set(runId, subject);

    await this.repository.create({ id: runId, workflowId, inputData: input });

    void this.executeAsync(runId, workflowId, input, subject);

    return runId;
  }

  streamRun(runId: string): Observable<{ data: string; type: string }> {
    const subject = this.subjects.get(runId);

    if (subject) {
      return subject.asObservable().pipe(map(event => ({ data: JSON.stringify(event), type: event.type })));
    }

    // Run already finished — replay from DB
    return from(this.repository.findById(runId)).pipe(
      mergeMap(run => {
        if (!run) return EMPTY;
        const traceEvents: WorkflowStreamEvent[] = (run.traceData ?? []).map(
          (t: CompanyLiveNodeTrace) =>
            ({
              type: 'node-complete',
              nodeId: t.nodeId,
              status: t.status,
              durationMs: t.durationMs,
              input: t.inputSnapshot,
              output: t.outputSnapshot
            }) as NodeCompleteEvent
        );
        const completeEvent: WorkflowStreamEvent = {
          type: 'run-complete',
          runId,
          status: run.status,
          totalMs: run.completedAt ? run.completedAt - run.startedAt : 0
        };
        return of(...traceEvents, completeEvent);
      }),
      map(event => ({ data: JSON.stringify(event), type: event.type }))
    );
  }

  async listRuns(
    workflowId?: string
  ): Promise<Array<{ id: string; workflowId: string; status: string; startedAt: number; completedAt: number | null }>> {
    const runs = workflowId ? await this.repository.findByWorkflowId(workflowId) : await this.repository.findAll();
    return runs.map(r => ({
      id: r.id,
      workflowId: r.workflowId,
      status: r.status,
      startedAt: r.startedAt,
      completedAt: r.completedAt
    }));
  }

  async getRun(id: string) {
    return this.repository.findById(id);
  }

  private async executeAsync(
    runId: string,
    workflowId: string,
    input: Record<string, unknown>,
    subject: Subject<WorkflowStreamEvent>
  ): Promise<void> {
    const startedAt = Date.now();
    try {
      const result = await this.dispatcher.dispatch(workflowId, input, (trace: CompanyLiveNodeTrace) => {
        subject.next({
          type: 'node-complete',
          nodeId: trace.nodeId,
          status: trace.status,
          durationMs: trace.durationMs,
          input: trace.inputSnapshot,
          output: trace.outputSnapshot
        });
      });

      await this.repository.complete(runId, result.trace);

      subject.next({
        type: 'run-complete',
        runId,
        status: 'completed',
        totalMs: Date.now() - startedAt
      });
      subject.complete();
    } catch (err) {
      subject.next({
        type: 'run-error',
        runId,
        error: err instanceof Error ? err.message : String(err)
      });
      subject.complete();
      await this.repository.fail(runId);
    } finally {
      this.subjects.delete(runId);
    }
  }
}
```

- [ ] **Step 2: 类型检查**

```bash
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit 2>&1 | grep "workflow-runs.service"
```

Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add apps/backend/agent-server/src/workflow-runs/workflow-runs.service.ts
git commit -m "feat(workflow-runs): add WorkflowRunService with SSE Subject bridge"
```

---

## Task 7: WorkflowRunController

**Files:**

- Create: `apps/backend/agent-server/src/workflow-runs/workflow-runs.controller.ts`

- [ ] **Step 1: 创建 Controller**

```ts
// apps/backend/agent-server/src/workflow-runs/workflow-runs.controller.ts
import { Body, Controller, Get, NotFoundException, Param, Post, Query, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';

import { StartWorkflowRunDto } from './workflow-runs.dto';
import { WorkflowRunService } from './workflow-runs.service';

@Controller('workflow-runs')
export class WorkflowRunController {
  constructor(private readonly service: WorkflowRunService) {}

  @Post()
  async startRun(@Body() dto: StartWorkflowRunDto): Promise<{ runId: string }> {
    const runId = await this.service.startRun(dto.workflowId, dto.input);
    return { runId };
  }

  @Get()
  async listRuns(@Query('workflowId') workflowId?: string) {
    return this.service.listRuns(workflowId);
  }

  @Get(':id')
  async getRun(@Param('id') id: string) {
    const run = await this.service.getRun(id);
    if (!run) throw new NotFoundException(`Run ${id} not found`);
    return run;
  }

  @Sse(':id/stream')
  streamRun(@Param('id') id: string): Observable<{ data: string; type: string }> {
    return this.service.streamRun(id);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/agent-server/src/workflow-runs/workflow-runs.controller.ts
git commit -m "feat(workflow-runs): add WorkflowRunController with SSE endpoint"
```

---

## Task 8: 模块装配 + backend structure check 测试

**Files:**

- Create: `apps/backend/agent-server/src/workflow-runs/workflow-runs.module.ts`
- Create: `apps/backend/agent-server/test/workflow-runs/workflow-runs.service.spec.ts`
- Modify: `apps/backend/agent-server/src/app.module.ts`

- [ ] **Step 1: 创建 WorkflowRunsModule**

```ts
// apps/backend/agent-server/src/workflow-runs/workflow-runs.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkflowRun } from './entities/workflow-run.entity';
import { WorkflowRunRepository } from './repositories/workflow-run.repository';
import { WorkflowRunController } from './workflow-runs.controller';
import { WorkflowRunService } from './workflow-runs.service';
import { WorkflowDispatcher } from './workflow-dispatcher';

@Module({
  imports: [TypeOrmModule.forFeature([WorkflowRun])],
  controllers: [WorkflowRunController],
  providers: [WorkflowRunService, WorkflowRunRepository, WorkflowDispatcher]
})
export class WorkflowRunsModule {}
```

- [ ] **Step 2: 在 app.module.ts 中注册 WorkflowRunsModule**

在现有 `import { WorkflowRun }` 之后追加：

```ts
import { WorkflowRunsModule } from './workflow-runs/workflow-runs.module';
```

在 `imports` 数组末尾追加 `WorkflowRunsModule`：

```ts
(CompanyLiveModule, WorkflowRunsModule);
```

- [ ] **Step 3: 写 service spec 测试（满足 check-backend-structure 要求）**

```ts
// apps/backend/agent-server/test/workflow-runs/workflow-runs.service.spec.ts
import { WorkflowDispatcher } from '../../src/workflow-runs/workflow-dispatcher';
import { WorkflowRunRepository } from '../../src/workflow-runs/repositories/workflow-run.repository';
import { WorkflowRunService } from '../../src/workflow-runs/workflow-runs.service';

describe('WorkflowRunService', () => {
  let service: WorkflowRunService;
  let repository: Partial<WorkflowRunRepository>;
  let dispatcher: Partial<WorkflowDispatcher>;

  beforeEach(() => {
    repository = {
      create: jest.fn().mockResolvedValue({}),
      complete: jest.fn().mockResolvedValue(undefined),
      fail: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockResolvedValue(null),
      findByWorkflowId: jest.fn().mockResolvedValue([]),
      findAll: jest.fn().mockResolvedValue([])
    };
    dispatcher = {
      dispatch: jest.fn().mockResolvedValue({ bundle: {}, trace: [] })
    };
    service = new WorkflowRunService(repository as WorkflowRunRepository, dispatcher as WorkflowDispatcher);
  });

  it('startRun creates a run record and returns a runId string', async () => {
    const runId = await service.startRun('company-live', { briefId: 'b1', targetPlatform: 'douyin' });
    expect(typeof runId).toBe('string');
    expect(runId.length).toBeGreaterThan(0);
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ workflowId: 'company-live' }));
  });

  it('listRuns delegates to repository.findAll when no workflowId', async () => {
    await service.listRuns();
    expect(repository.findAll).toHaveBeenCalled();
  });

  it('listRuns delegates to repository.findByWorkflowId when workflowId provided', async () => {
    await service.listRuns('company-live');
    expect(repository.findByWorkflowId).toHaveBeenCalledWith('company-live');
  });

  it('streamRun returns observable for existing runId', () => {
    const obs = service.streamRun('non-existent-run');
    expect(obs).toBeDefined();
    expect(typeof obs.subscribe).toBe('function');
  });
});
```

- [ ] **Step 4: 运行 backend service spec 测试**

```bash
pnpm --filter apps/backend/agent-server test test/workflow-runs/workflow-runs.service.spec.ts 2>&1 | grep -E "PASS|FAIL|✓|✗|Tests:"
```

Expected: `PASS` 且 4 个测试全通过

- [ ] **Step 5: 类型检查全量**

```bash
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit 2>&1 | grep -v "^$" | head -20
```

Expected: 无新增 TS 错误

- [ ] **Step 6: Commit**

```bash
git add apps/backend/agent-server/src/workflow-runs/workflow-runs.module.ts \
        apps/backend/agent-server/src/app.module.ts \
        apps/backend/agent-server/test/workflow-runs/workflow-runs.service.spec.ts
git commit -m "feat(workflow-runs): wire WorkflowRunsModule into AppModule, add service spec"
```

---

## Task 9: 前端类型 + API 层

**Files:**

- Modify: `apps/frontend/agent-admin/src/types/admin/tasking.ts`
- Create: `apps/frontend/agent-admin/src/features/workflow-lab/api/workflow-runs.api.ts`

- [ ] **Step 1: 在 DashboardPageKey 中添加 'workflowLab'**

在 `apps/frontend/agent-admin/src/types/admin/tasking.ts` 中，将：

```ts
export type DashboardPageKey =
  | 'runtime'
  ...
  | 'profiles';
```

改为（在 `'profiles'` 后追加）：

```ts
  | 'profiles'
  | 'workflowLab';
```

- [ ] **Step 2: 定义前端共享类型（inline 在 api 文件中）**

```ts
// apps/frontend/agent-admin/src/features/workflow-lab/api/workflow-runs.api.ts
import { request } from '@/api/admin-api-core';

export interface StartWorkflowRunRequest {
  workflowId: string;
  input: Record<string, unknown>;
}

export interface StartWorkflowRunResponse {
  runId: string;
}

export interface WorkflowRunRecord {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'pending';
  startedAt: number;
  completedAt: number | null;
}

export interface WorkflowRunDetail extends WorkflowRunRecord {
  inputData: Record<string, unknown> | null;
  traceData: WorkflowNodeTrace[] | null;
}

export interface WorkflowNodeTrace {
  nodeId: string;
  status: 'succeeded' | 'failed' | 'skipped';
  durationMs: number;
  inputSnapshot: Record<string, unknown>;
  outputSnapshot: Record<string, unknown>;
  errorMessage?: string;
}

export async function startWorkflowRun(req: StartWorkflowRunRequest): Promise<StartWorkflowRunResponse> {
  return request<StartWorkflowRunResponse>('/workflow-runs', {
    method: 'POST',
    body: JSON.stringify(req)
  });
}

export async function listWorkflowRuns(workflowId?: string): Promise<WorkflowRunRecord[]> {
  const qs = workflowId ? `?workflowId=${encodeURIComponent(workflowId)}` : '';
  return request<WorkflowRunRecord[]>(`/workflow-runs${qs}`);
}

export async function getWorkflowRun(id: string): Promise<WorkflowRunDetail> {
  return request<WorkflowRunDetail>(`/workflow-runs/${id}`);
}
```

- [ ] **Step 3: 类型检查**

```bash
pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit 2>&1 | grep "tasking\|workflow-runs.api" | head -10
```

Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/agent-admin/src/types/admin/tasking.ts \
        apps/frontend/agent-admin/src/features/workflow-lab/api/workflow-runs.api.ts
git commit -m "feat(workflow-lab): add DashboardPageKey and workflow-runs api layer"
```

---

## Task 10: useWorkflowStream Hook（TDD）

**Files:**

- Create: `apps/frontend/agent-admin/src/features/workflow-lab/hooks/useWorkflowStream.ts`
- Create: `apps/frontend/agent-admin/test/features/workflow-lab/useWorkflowStream.test.ts`

- [ ] **Step 1: 先写失败测试（Red）**

```ts
// apps/frontend/agent-admin/test/features/workflow-lab/useWorkflowStream.test.ts
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useWorkflowStream } from '../../../src/features/workflow-lab/hooks/useWorkflowStream';

class MockEventSource {
  url: string;
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
  onopen: (() => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  readyState = 0;
  CONNECTING = 0;
  OPEN = 1;
  CLOSED = 2;
  static instances: MockEventSource[] = [];

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, handler: (e: MessageEvent) => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }

  close() {
    this.readyState = this.CLOSED;
  }

  emit(type: string, data: unknown) {
    const event = new MessageEvent(type, { data: JSON.stringify(data) });
    (this.listeners[type] ?? []).forEach(h => h(event));
  }
}

describe('useWorkflowStream', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts with empty nodes and idle status', () => {
    const { result } = renderHook(() => useWorkflowStream(null));
    expect(result.current.nodes).toEqual([]);
    expect(result.current.runStatus).toBe('idle');
  });

  it('appends nodes when node-complete events arrive', async () => {
    const { result } = renderHook(() => useWorkflowStream('run-123'));

    await act(async () => {
      const es = MockEventSource.instances[0];
      es.emit('node-complete', {
        nodeId: 'generateAudio',
        status: 'succeeded',
        durationMs: 12,
        input: {},
        output: {}
      });
    });

    expect(result.current.nodes).toHaveLength(1);
    expect(result.current.nodes[0].nodeId).toBe('generateAudio');
  });

  it('sets runStatus to "completed" on run-complete event', async () => {
    const { result } = renderHook(() => useWorkflowStream('run-123'));

    await act(async () => {
      const es = MockEventSource.instances[0];
      es.emit('run-complete', { runId: 'run-123', status: 'completed', totalMs: 100 });
    });

    expect(result.current.runStatus).toBe('completed');
  });

  it('closes EventSource on unmount', () => {
    const { unmount } = renderHook(() => useWorkflowStream('run-abc'));
    const es = MockEventSource.instances[0];
    unmount();
    expect(es.readyState).toBe(es.CLOSED);
  });
});
```

- [ ] **Step 2: 运行测试验证 Red**

```bash
pnpm --filter apps/frontend/agent-admin test test/features/workflow-lab/useWorkflowStream.test.ts 2>&1 | grep -E "PASS|FAIL|Cannot find module"
```

Expected: 模块找不到错误（hook 文件不存在）

- [ ] **Step 3: 实现 useWorkflowStream hook**

```ts
// apps/frontend/agent-admin/src/features/workflow-lab/hooks/useWorkflowStream.ts
import { useEffect, useState } from 'react';

import type { WorkflowNodeTrace } from '../api/workflow-runs.api';

export type RunStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface StreamNodeEvent extends WorkflowNodeTrace {
  receivedAt: number;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3000/api';

export function useWorkflowStream(runId: string | null) {
  const [nodes, setNodes] = useState<StreamNodeEvent[]>([]);
  const [runStatus, setRunStatus] = useState<RunStatus>('idle');

  useEffect(() => {
    if (!runId) {
      setNodes([]);
      setRunStatus('idle');
      return;
    }

    setNodes([]);
    setRunStatus('running');

    const es = new EventSource(`${API_BASE}/workflow-runs/${runId}/stream`);

    es.addEventListener('node-complete', (e: MessageEvent) => {
      const data = JSON.parse(e.data as string) as WorkflowNodeTrace;
      setNodes(prev => [...prev, { ...data, receivedAt: Date.now() }]);
    });

    es.addEventListener('run-complete', (e: MessageEvent) => {
      const data = JSON.parse(e.data as string) as { status: string };
      setRunStatus(data.status === 'completed' ? 'completed' : 'failed');
      es.close();
    });

    es.addEventListener('run-error', () => {
      setRunStatus('failed');
      es.close();
    });

    return () => {
      es.close();
    };
  }, [runId]);

  return { nodes, runStatus };
}
```

- [ ] **Step 4: 运行测试验证 Green**

```bash
pnpm --filter apps/frontend/agent-admin test test/features/workflow-lab/useWorkflowStream.test.ts 2>&1 | grep -E "PASS|FAIL|Tests:"
```

Expected: PASS，4 个测试全通过

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/agent-admin/src/features/workflow-lab/hooks/useWorkflowStream.ts \
        apps/frontend/agent-admin/test/features/workflow-lab/useWorkflowStream.test.ts
git commit -m "feat(workflow-lab): add useWorkflowStream hook with SSE integration"
```

---

## Task 11: workflowRegistry

**Files:**

- Create: `apps/frontend/agent-admin/src/features/workflow-lab/registry/workflow.registry.ts`

- [ ] **Step 1: 创建 WorkflowFieldDef 类型和 workflowRegistry**

```ts
// apps/frontend/agent-admin/src/features/workflow-lab/registry/workflow.registry.ts

export interface WorkflowFieldDef {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select';
  required?: boolean;
  defaultValue?: string | number;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  fields: WorkflowFieldDef[];
  mapFormToPayload: (values: Record<string, string | number>) => Record<string, unknown>;
}

export const workflowRegistry: WorkflowDefinition[] = [
  {
    id: 'company-live',
    name: '直播内容生成',
    description: '生成音频、图片、视频 bundle，适用于电商直播场景',
    fields: [
      {
        name: 'briefId',
        label: 'Brief ID',
        type: 'text',
        required: true,
        placeholder: 'e.g. brief-2024-001',
        defaultValue: 'demo-brief-001'
      },
      {
        name: 'targetPlatform',
        label: '目标平台',
        type: 'select',
        required: true,
        defaultValue: 'douyin',
        options: [
          { value: 'douyin', label: '抖音' },
          { value: 'kuaishou', label: '快手' },
          { value: 'taobao', label: '淘宝直播' },
          { value: 'bilibili', label: 'B站' }
        ]
      },
      {
        name: 'script',
        label: '直播脚本',
        type: 'text',
        required: false,
        placeholder: '输入直播脚本（可选）',
        defaultValue: '欢迎来到我们的直播间，今天给大家带来超值好货！'
      },
      {
        name: 'requestedBy',
        label: '请求人',
        type: 'text',
        required: false,
        placeholder: 'e.g. user-001',
        defaultValue: 'admin'
      }
    ],
    mapFormToPayload: values => ({
      briefId: values.briefId,
      targetPlatform: values.targetPlatform,
      script: values.script ?? '',
      requestedBy: values.requestedBy ?? 'admin'
    })
  }
];
```

- [ ] **Step 2: 类型检查**

```bash
pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit 2>&1 | grep "workflow.registry" | head -5
```

Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/agent-admin/src/features/workflow-lab/registry/workflow.registry.ts
git commit -m "feat(workflow-lab): add pluggable workflowRegistry with company-live definition"
```

---

## Task 12: WorkflowSidebar（左栏）

**Files:**

- Create: `apps/frontend/agent-admin/src/features/workflow-lab/components/WorkflowList.tsx`
- Create: `apps/frontend/agent-admin/src/features/workflow-lab/components/RunHistoryList.tsx`
- Create: `apps/frontend/agent-admin/src/features/workflow-lab/components/WorkflowSidebar.tsx`

- [ ] **Step 1: 创建 WorkflowList**

```tsx
// apps/frontend/agent-admin/src/features/workflow-lab/components/WorkflowList.tsx
import { Play } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { WorkflowDefinition } from '../registry/workflow.registry';

interface WorkflowListProps {
  workflows: WorkflowDefinition[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function WorkflowList({ workflows, selectedId, onSelect }: WorkflowListProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 px-1">工作流</p>
      {workflows.map(wf => (
        <button
          key={wf.id}
          onClick={() => onSelect(wf.id)}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors text-left w-full',
            selectedId === wf.id
              ? 'bg-blue-50 border border-blue-200 text-blue-700 font-medium'
              : 'text-slate-600 hover:bg-slate-100 border border-transparent'
          )}
        >
          <Play className="h-3.5 w-3.5 flex-shrink-0" />
          <div className="min-w-0">
            <div className="truncate font-medium">{wf.name}</div>
            <div className="text-xs text-slate-400 truncate">{wf.id}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 创建 RunHistoryList**

```tsx
// apps/frontend/agent-admin/src/features/workflow-lab/components/RunHistoryList.tsx
import { CheckCircle, Clock, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { WorkflowRunRecord } from '../api/workflow-runs.api';

interface RunHistoryListProps {
  runs: WorkflowRunRecord[];
  selectedRunId: string | null;
  onSelect: (runId: string) => void;
}

function StatusIcon({ status }: { status: WorkflowRunRecord['status'] }) {
  if (status === 'completed') return <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />;
  if (status === 'failed') return <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />;
  return <Clock className="h-3.5 w-3.5 text-blue-400 flex-shrink-0 animate-spin" />;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function RunHistoryList({ runs, selectedRunId, onSelect }: RunHistoryListProps) {
  if (runs.length === 0) {
    return (
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 px-1">历史运行</p>
        <p className="text-xs text-slate-400 px-1">暂无历史记录</p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 px-1">历史运行</p>
      <div className="flex flex-col gap-1">
        {runs.map(run => {
          const totalMs = run.completedAt ? run.completedAt - run.startedAt : null;
          return (
            <button
              key={run.id}
              onClick={() => onSelect(run.id)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors text-left w-full',
                selectedRunId === run.id
                  ? 'bg-blue-50 border border-blue-200'
                  : 'hover:bg-slate-50 border border-transparent'
              )}
            >
              <StatusIcon status={run.status} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-slate-700 font-mono">{run.id.slice(0, 8)}</div>
                <div className="text-slate-400">{totalMs !== null ? formatMs(totalMs) : '运行中…'}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 创建 WorkflowSidebar**

```tsx
// apps/frontend/agent-admin/src/features/workflow-lab/components/WorkflowSidebar.tsx
import type { WorkflowRunRecord } from '../api/workflow-runs.api';
import type { WorkflowDefinition } from '../registry/workflow.registry';
import { RunHistoryList } from './RunHistoryList';
import { WorkflowList } from './WorkflowList';

interface WorkflowSidebarProps {
  workflows: WorkflowDefinition[];
  selectedWorkflowId: string | null;
  onSelectWorkflow: (id: string) => void;
  runs: WorkflowRunRecord[];
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
}

export function WorkflowSidebar({
  workflows,
  selectedWorkflowId,
  onSelectWorkflow,
  runs,
  selectedRunId,
  onSelectRun
}: WorkflowSidebarProps) {
  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 border-r border-slate-200 bg-white">
      <WorkflowList workflows={workflows} selectedId={selectedWorkflowId} onSelect={onSelectWorkflow} />
      <RunHistoryList runs={runs} selectedRunId={selectedRunId} onSelect={onSelectRun} />
    </div>
  );
}
```

- [ ] **Step 4: 类型检查**

```bash
pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit 2>&1 | grep "WorkflowSidebar\|WorkflowList\|RunHistory" | head -5
```

Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/agent-admin/src/features/workflow-lab/components/WorkflowList.tsx \
        apps/frontend/agent-admin/src/features/workflow-lab/components/RunHistoryList.tsx \
        apps/frontend/agent-admin/src/features/workflow-lab/components/WorkflowSidebar.tsx
git commit -m "feat(workflow-lab): add WorkflowSidebar with WorkflowList and RunHistoryList"
```

---

## Task 13: 中栏 — WorkflowRunForm + NodeTimeline

**Files:**

- Create: `apps/frontend/agent-admin/src/features/workflow-lab/components/WorkflowRunForm.tsx`
- Create: `apps/frontend/agent-admin/src/features/workflow-lab/components/NodeTimeline.tsx`
- Create: `apps/frontend/agent-admin/src/features/workflow-lab/components/NodeTimelinePanel.tsx`

- [ ] **Step 1: 创建 WorkflowRunForm（动态字段渲染）**

```tsx
// apps/frontend/agent-admin/src/features/workflow-lab/components/WorkflowRunForm.tsx
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import type { WorkflowDefinition } from '../registry/workflow.registry';

interface WorkflowRunFormProps {
  workflow: WorkflowDefinition;
  onSubmit: (payload: Record<string, unknown>) => void;
  isRunning: boolean;
}

export function WorkflowRunForm({ workflow, onSubmit, isRunning }: WorkflowRunFormProps) {
  const [values, setValues] = useState<Record<string, string | number>>(() =>
    Object.fromEntries(workflow.fields.map(f => [f.name, f.defaultValue ?? '']))
  );

  function handleChange(name: string, value: string | number) {
    setValues(prev => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(workflow.mapFormToPayload(values));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
      <p className="text-sm font-semibold text-slate-700">运行参数</p>
      {workflow.fields.map(field => (
        <div key={field.name} className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">
            {field.label}
            {field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          {field.type === 'select' ? (
            <select
              value={String(values[field.name] ?? '')}
              onChange={e => handleChange(field.name, e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {(field.options ?? []).map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.type === 'number' ? 'number' : 'text'}
              value={String(values[field.name] ?? '')}
              onChange={e =>
                handleChange(field.name, field.type === 'number' ? Number(e.target.value) : e.target.value)
              }
              placeholder={field.placeholder}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          )}
        </div>
      ))}
      <Button type="submit" disabled={isRunning} className="mt-1 w-full">
        {isRunning ? '运行中…' : '▶ 运行'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: 创建 NodeTimeline**

```tsx
// apps/frontend/agent-admin/src/features/workflow-lab/components/NodeTimeline.tsx
import { CheckCircle, Circle, Clock, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { StreamNodeEvent } from '../hooks/useWorkflowStream';
import type { RunStatus } from '../hooks/useWorkflowStream';

interface NodeTimelineProps {
  nodes: StreamNodeEvent[];
  runStatus: RunStatus;
  onSelectNode: (node: StreamNodeEvent) => void;
  selectedNodeId: string | null;
}

function NodeStatusIcon({ status }: { status: string }) {
  if (status === 'succeeded') return <CheckCircle className="h-4 w-4 text-green-500" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 text-red-500" />;
  if (status === 'running') return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
  return <Circle className="h-4 w-4 text-slate-300" />;
}

function statusBg(status: string) {
  if (status === 'succeeded') return 'bg-green-50 border-green-200';
  if (status === 'failed') return 'bg-red-50 border-red-200';
  if (status === 'running') return 'bg-blue-50 border-blue-200';
  return 'bg-slate-50 border-slate-200';
}

export function NodeTimeline({ nodes, runStatus, onSelectNode, selectedNodeId }: NodeTimelineProps) {
  if (nodes.length === 0 && runStatus === 'idle') {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-slate-400">填写参数后点击「运行」开始</div>
    );
  }

  return (
    <div className="flex flex-col gap-2 py-2">
      {nodes.map((node, i) => (
        <div key={`${node.nodeId}-${i}`} className="flex flex-col gap-0">
          <button
            onClick={() => onSelectNode(node)}
            className={cn(
              'flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors text-left',
              statusBg(node.status),
              selectedNodeId === node.nodeId ? 'ring-2 ring-blue-300' : 'hover:opacity-90'
            )}
          >
            <NodeStatusIcon status={node.status} />
            <div className="flex-1 min-w-0">
              <span className="font-medium text-slate-800">{node.nodeId}</span>
              <span className="ml-2 text-xs text-slate-400">{node.durationMs}ms</span>
            </div>
            {node.status === 'succeeded' && <span className="text-xs text-green-600 font-medium">✓ 成功</span>}
            {node.status === 'failed' && <span className="text-xs text-red-600 font-medium">✗ 失败</span>}
          </button>
          {i < nodes.length - 1 && <div className="w-px h-4 bg-slate-200 mx-auto" />}
        </div>
      ))}
      {runStatus === 'running' && (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-400">
          <Clock className="h-4 w-4 text-blue-400 animate-spin" />
          <span>等待下一个节点…</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 创建 NodeTimelinePanel（中栏容器）**

```tsx
// apps/frontend/agent-admin/src/features/workflow-lab/components/NodeTimelinePanel.tsx
import { ScrollArea } from '@/components/ui/scroll-area';

import type { WorkflowRunRecord } from '../api/workflow-runs.api';
import type { StreamNodeEvent, RunStatus } from '../hooks/useWorkflowStream';
import type { WorkflowDefinition } from '../registry/workflow.registry';
import { NodeTimeline } from './NodeTimeline';
import { WorkflowRunForm } from './WorkflowRunForm';

interface NodeTimelinePanelProps {
  selectedWorkflow: WorkflowDefinition | null;
  nodes: StreamNodeEvent[];
  runStatus: RunStatus;
  activeRunId: string | null;
  selectedNodeId: string | null;
  onStartRun: (payload: Record<string, unknown>) => void;
  onSelectNode: (node: StreamNodeEvent) => void;
}

export function NodeTimelinePanel({
  selectedWorkflow,
  nodes,
  runStatus,
  activeRunId,
  selectedNodeId,
  onStartRun,
  onSelectNode
}: NodeTimelinePanelProps) {
  if (!selectedWorkflow) {
    return <div className="flex items-center justify-center h-full text-sm text-slate-400">请从左侧选择一个工作流</div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-slate-800">{selectedWorkflow.name}</h2>
          {activeRunId && <span className="text-xs font-mono text-slate-400">run: {activeRunId.slice(0, 8)}</span>}
        </div>
        <p className="text-xs text-slate-500">{selectedWorkflow.description}</p>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden gap-0">
        <div className="p-4 border-b border-slate-100">
          <WorkflowRunForm workflow={selectedWorkflow} onSubmit={onStartRun} isRunning={runStatus === 'running'} />
        </div>

        <ScrollArea className="flex-1 p-4">
          <NodeTimeline
            nodes={nodes}
            runStatus={runStatus}
            onSelectNode={onSelectNode}
            selectedNodeId={selectedNodeId}
          />
        </ScrollArea>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 类型检查**

```bash
pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit 2>&1 | grep "NodeTimeline\|WorkflowRunForm\|NodeTimelinePanel" | head -10
```

Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/agent-admin/src/features/workflow-lab/components/WorkflowRunForm.tsx \
        apps/frontend/agent-admin/src/features/workflow-lab/components/NodeTimeline.tsx \
        apps/frontend/agent-admin/src/features/workflow-lab/components/NodeTimelinePanel.tsx
git commit -m "feat(workflow-lab): add WorkflowRunForm, NodeTimeline, NodeTimelinePanel"
```

---

## Task 14: NodeDetailPanel（右栏）

**Files:**

- Create: `apps/frontend/agent-admin/src/features/workflow-lab/components/NodeDetailPanel.tsx`

- [ ] **Step 1: 创建 NodeDetailPanel**

```tsx
// apps/frontend/agent-admin/src/features/workflow-lab/components/NodeDetailPanel.tsx
import { CheckCircle, XCircle } from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';

import type { StreamNodeEvent } from '../hooks/useWorkflowStream';

interface NodeDetailPanelProps {
  node: StreamNodeEvent | null;
}

function JsonBlock({ label, data }: { label: string; data: Record<string, unknown> }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <pre className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs font-mono text-slate-700 overflow-x-auto whitespace-pre-wrap break-words">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export function NodeDetailPanel({ node }: NodeDetailPanelProps) {
  if (!node) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-400 p-4 text-center">
        点击中栏节点
        <br />
        查看输入/输出详情
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">节点</p>
          <p className="text-base font-semibold text-slate-800 font-mono">{node.nodeId}</p>
        </div>

        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
          {node.status === 'succeeded' ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          <div>
            <span className={`text-sm font-medium ${node.status === 'succeeded' ? 'text-green-700' : 'text-red-700'}`}>
              {node.status === 'succeeded' ? '成功' : '失败'}
            </span>
            <span className="text-xs text-slate-400 ml-2">{node.durationMs}ms</span>
          </div>
        </div>

        <JsonBlock label="输入" data={node.inputSnapshot} />
        <JsonBlock label="输出" data={node.outputSnapshot} />

        {node.errorMessage && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-1">错误信息</p>
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 font-mono">
              {node.errorMessage}
            </p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/agent-admin/src/features/workflow-lab/components/NodeDetailPanel.tsx
git commit -m "feat(workflow-lab): add NodeDetailPanel for node input/output inspection"
```

---

## Task 15: WorkflowLabPage + 导航集成

**Files:**

- Create: `apps/frontend/agent-admin/src/features/workflow-lab/WorkflowLabPage.tsx`
- Modify: `apps/frontend/agent-admin/src/components/app-sidebar.tsx`
- Modify: `apps/frontend/agent-admin/src/pages/dashboard/dashboard-center-content.tsx`

- [ ] **Step 1: 创建 WorkflowLabPage（三栏布局）**

```tsx
// apps/frontend/agent-admin/src/features/workflow-lab/WorkflowLabPage.tsx
import { useCallback, useEffect, useState } from 'react';

import type { WorkflowRunRecord } from './api/workflow-runs.api';
import { listWorkflowRuns, startWorkflowRun } from './api/workflow-runs.api';
import { NodeDetailPanel } from './components/NodeDetailPanel';
import { NodeTimelinePanel } from './components/NodeTimelinePanel';
import { WorkflowSidebar } from './components/WorkflowSidebar';
import type { StreamNodeEvent } from './hooks/useWorkflowStream';
import { useWorkflowStream } from './hooks/useWorkflowStream';
import { workflowRegistry } from './registry/workflow.registry';

export function WorkflowLabPage() {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(workflowRegistry[0]?.id ?? null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<StreamNodeEvent | null>(null);
  const [runs, setRuns] = useState<WorkflowRunRecord[]>([]);

  const { nodes, runStatus } = useWorkflowStream(activeRunId);

  const selectedWorkflow = workflowRegistry.find(w => w.id === selectedWorkflowId) ?? null;

  const loadRuns = useCallback(async () => {
    if (!selectedWorkflowId) return;
    try {
      const data = await listWorkflowRuns(selectedWorkflowId);
      setRuns(data);
    } catch {
      // silently ignore
    }
  }, [selectedWorkflowId]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    if (runStatus === 'completed' || runStatus === 'failed') {
      void loadRuns();
    }
  }, [runStatus, loadRuns]);

  async function handleStartRun(payload: Record<string, unknown>) {
    if (!selectedWorkflowId) return;
    try {
      setSelectedNode(null);
      const { runId } = await startWorkflowRun({
        workflowId: selectedWorkflowId,
        input: payload
      });
      setActiveRunId(runId);
      setSelectedRunId(runId);
    } catch (err) {
      console.error('Failed to start run:', err);
    }
  }

  function handleSelectRun(runId: string) {
    setSelectedRunId(runId);
    setSelectedNode(null);
    // If the run is not the current active run, show it as a completed view
    if (runId !== activeRunId) {
      setActiveRunId(runId);
    }
  }

  return (
    <div className="flex h-full overflow-hidden bg-white rounded-lg border border-slate-200">
      {/* Left: workflow list + history */}
      <div className="w-[220px] flex-shrink-0">
        <WorkflowSidebar
          workflows={workflowRegistry}
          selectedWorkflowId={selectedWorkflowId}
          onSelectWorkflow={id => {
            setSelectedWorkflowId(id);
            setActiveRunId(null);
            setSelectedNode(null);
          }}
          runs={runs}
          selectedRunId={selectedRunId}
          onSelectRun={handleSelectRun}
        />
      </div>

      {/* Middle: run form + node timeline */}
      <div className="flex-1 border-r border-slate-200 overflow-hidden">
        <NodeTimelinePanel
          selectedWorkflow={selectedWorkflow}
          nodes={nodes}
          runStatus={runStatus}
          activeRunId={activeRunId}
          selectedNodeId={selectedNode?.nodeId ?? null}
          onStartRun={payload => void handleStartRun(payload)}
          onSelectNode={setSelectedNode}
        />
      </div>

      {/* Right: node detail */}
      <div className="w-[320px] flex-shrink-0 overflow-hidden">
        <NodeDetailPanel node={selectedNode} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 在 app-sidebar.tsx 中添加 workflowLab 导航项**

在 `app-sidebar.tsx` 顶部的 lucide-react import 中，追加 `Workflow`：

```ts
import {
  BookMarked,
  BookOpen,
  BrainCircuit,
  Building2,
  Cable,
  ChevronDown,
  ClipboardCheck,
  Database,
  FlaskConical,
  FolderKanban,
  IdCard,
  Radar,
  Settings2,
  SquareTerminal,
  Users,
  Workflow
} from 'lucide-react';
```

在 `NAV_ITEMS` 数组中，在 `companyAgents` 条目之后追加：

```ts
{
  key: 'workflowLab' as DashboardPageKey,
  label: '工作流实验室',
  description: '触发工作流、实时节点轨迹与历史运行记录',
  icon: Workflow
}
```

- [ ] **Step 3: 在 dashboard-center-content.tsx 中注册 workflowLab case**

在顶部 import 中追加：

```ts
import { WorkflowLabPage } from '@/features/workflow-lab/WorkflowLabPage';
```

在 `switch (dashboard.page)` 的 `case 'companyAgents':` 之后追加（在 `default:` 之前）：

```ts
    case 'workflowLab':
      return <WorkflowLabPage />;
```

- [ ] **Step 4: 类型检查（全量前端）**

```bash
pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit 2>&1 | grep -v "^$" | head -20
```

Expected: 无新增 TS 错误

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/agent-admin/src/features/workflow-lab/WorkflowLabPage.tsx \
        apps/frontend/agent-admin/src/components/app-sidebar.tsx \
        apps/frontend/agent-admin/src/pages/dashboard/dashboard-center-content.tsx
git commit -m "feat(workflow-lab): add WorkflowLabPage and navigation integration"
```

---

## Task 16: 全量验证

- [ ] **Step 1: 运行所有单元测试**

```bash
pnpm verify 2>&1 | tail -30
```

Expected: 通过（或仅有既有 blocker）

- [ ] **Step 2: 如有 pnpm verify 之外的 blocker，分别运行最低检查**

```bash
pnpm exec tsc -p packages/runtime/tsconfig.json --noEmit 2>&1 | grep -c "error" || echo "0 errors"
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit 2>&1 | grep -c "error" || echo "0 errors"
pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit 2>&1 | grep -c "error" || echo "0 errors"
```

Expected: 各自 0 新增错误

- [ ] **Step 3: 启动后端验证**

```bash
# 确保 .env 存在（从 .env.example 复制）
cp .env.example .env 2>/dev/null || true
# 确保 PostgreSQL 已启动
docker compose up -d postgres
# 启动后端
pnpm --filter apps/backend/agent-server start:dev &
sleep 5
# 测试接口
curl -s -X POST http://localhost:3000/api/workflow-runs \
  -H "Content-Type: application/json" \
  -d '{"workflowId":"company-live","input":{"briefId":"test-001","targetPlatform":"douyin","script":"测试直播脚本"}}' \
  | python3 -m json.tool
```

Expected: 返回 `{ "runId": "..." }`

- [ ] **Step 4: 测试 SSE 流**

```bash
RUN_ID=$(curl -s -X POST http://localhost:3000/api/workflow-runs \
  -H "Content-Type: application/json" \
  -d '{"workflowId":"company-live","input":{"briefId":"test-sse-01","targetPlatform":"douyin"}}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['runId'])")
echo "runId: $RUN_ID"
curl -N http://localhost:3000/api/workflow-runs/$RUN_ID/stream 2>/dev/null | head -20
```

Expected: 看到 4 条 `event: node-complete` + 1 条 `event: run-complete`

- [ ] **Step 5: 测试历史查询**

```bash
curl -s http://localhost:3000/api/workflow-runs?workflowId=company-live | python3 -m json.tool | head -20
```

Expected: 返回历史运行记录 JSON 数组（包含刚才运行的记录）

- [ ] **Step 6: 最终 Commit（如有遗漏变更）**

```bash
git add -A && git status
# 确认无多余变更后
git commit -m "feat(workflow-lab): complete workflow lab e2e integration" --allow-empty
```

---

## 验收标准

1. ✅ `POST /api/workflow-runs` 返回 runId
2. ✅ `GET /api/workflow-runs/:id/stream` 推送 node-complete × 4 + run-complete × 1
3. ✅ `GET /api/workflow-runs?workflowId=company-live` 返回 PostgreSQL 历史记录
4. ✅ agent-admin 左侧导航出现「工作流实验室」
5. ✅ 三栏布局正确渲染，节点时间线实时更新
6. ✅ 点击历史运行可回放节点轨迹
7. ✅ 点击节点显示右栏 JSON 详情
8. ✅ `pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit` 无新错误
9. ✅ `pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit` 无新错误
10. ✅ backend structure check: `workflow-runs.service.spec.ts` 存在且通过
