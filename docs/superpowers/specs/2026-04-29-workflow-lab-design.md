# Workflow Lab 设计文档

**日期**：2026-04-29  
**状态**：已批准，待实现  
**范围**：agent-admin 新增"工作流实验室"页面，支持触发工作流运行、实时 SSE 节点轨迹、查看历史记录

---

## 1. 背景与目标

在 agent-admin 后台中新增一个 LangSmith 风格的工作流可视化页面（Workflow Lab），让运营/开发人员能够：

1. 从注册表中选择一个工作流（如 `company-live`）
2. 填写参数表单并触发新运行
3. 实时查看每个节点的执行状态、耗时、输入/输出 JSON
4. 回溯历史运行记录（持久化到 PostgreSQL）

---

## 2. 整体架构

```
┌──────────────────────────────────────────────────────────────┐
│  agent-admin 前端                                             │
│                                                              │
│  workflowRegistry ──► WorkflowLabPage (三栏)                  │
│    company-live        ├── WorkflowSidebar (左，220px)        │
│    (data-report...)    │     ├── WorkflowList                 │
│                        │     └── RunHistoryList               │
│                        ├── NodeTimelinePanel (中，flex-1)     │
│                        │     ├── RunHeader + WorkflowRunForm  │
│                        │     └── NodeTimeline (SSE 驱动)      │
│                        └── NodeDetailPanel (右，320px)        │
│                              (nodeId/status/ms/input/output)  │
│                                    ↕ EventSource              │
└──────────────────────────────────────────────────────────────┘
                              ↕ HTTP / SSE
┌──────────────────────────────────────────────────────────────┐
│  agent-server 后端                                            │
│                                                              │
│  WorkflowRunController                                       │
│    POST /api/workflow-runs              → 启动运行             │
│    GET  /api/workflow-runs/:id/stream   → SSE 节点轨迹         │
│    GET  /api/workflow-runs             → 历史列表              │
│    GET  /api/workflow-runs/:id          → 单次运行详情          │
│                   ↓                                          │
│  WorkflowRunService                                          │
│    ├── WorkflowDispatcher (workflowId → domain service)      │
│    │     'company-live' → executeCompanyLiveGraph()          │
│    │     (后续可注册更多)                                     │
│    └── WorkflowRunRepository (TypeORM + PostgreSQL)          │
│          WorkflowRun entity                                  │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. 后端设计

### 3.1 新增模块

```
apps/backend/agent-server/src/workflow-runs/
├── workflow-runs.module.ts
├── workflow-runs.controller.ts
├── workflow-runs.service.ts
├── workflow-runs.dto.ts
├── workflow-dispatcher.ts
├── entities/
│   └── workflow-run.entity.ts
└── repositories/
    └── workflow-run.repository.ts
```

### 3.2 WorkflowRun Entity（TypeORM + PostgreSQL）

```ts
@Entity('workflow_runs')
export class WorkflowRun {
  @PrimaryColumn()
  id: string; // nanoid

  @Column()
  workflowId: string; // 'company-live' | ...

  @Column()
  status: 'pending' | 'running' | 'completed' | 'failed';

  @Column('bigint')
  startedAt: number; // epoch ms

  @Column('bigint', { nullable: true })
  completedAt: number | null;

  @Column('jsonb', { nullable: true })
  inputData: Record<string, unknown>; // 启动参数

  @Column('jsonb', { nullable: true })
  traceData: TraceNode[] | null; // 完成后的节点轨迹
}
```

数据库连接通过 `.env` 环境变量配置（`DATABASE_URL` 或 `DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME`），在 `AppModule` 中通过 `TypeOrmModule.forRoot()` 装载。

### 3.3 HTTP 端点

| 方法 | 路径                            | 说明                                          |
| ---- | ------------------------------- | --------------------------------------------- |
| POST | `/api/workflow-runs`            | 创建并启动运行，返回 `{ runId }`              |
| GET  | `/api/workflow-runs/:id/stream` | SSE 流，持续推送 node-complete / run-complete |
| GET  | `/api/workflow-runs`            | 分页历史列表，支持 `?workflowId=` 过滤        |
| GET  | `/api/workflow-runs/:id`        | 单次运行详情（含完整 traceData）              |

### 3.4 SSE 事件格式

```
# 节点完成事件
event: node-complete
data: {
  "nodeId": "generateAudio",
  "status": "succeeded" | "failed",
  "durationMs": 12,
  "input": { ... },
  "output": { ... }
}

# 运行完成事件
event: run-complete
data: {
  "runId": "xxx",
  "status": "completed" | "failed",
  "totalMs": 230
}

# 错误事件
event: run-error
data: {
  "runId": "xxx",
  "error": "..."
}
```

### 3.5 WorkflowDispatcher

```ts
// 注册表 Map，新增工作流只需添加一条
const DISPATCHERS: Record<string, WorkflowHandler> = {
  'company-live': (input, onNodeComplete) => executeCompanyLiveGraph(input, { onNodeComplete })
};
```

`executeCompanyLiveGraph` 需新增 `options.onNodeComplete` 回调参数：每个节点完成时调用，传入 nodeId、status、durationMs、input、output。这是本次改动中对 graph 层的唯一侵入点。

---

## 4. 前端设计

### 4.1 workflowRegistry

```ts
// src/features/workflow-lab/registry/workflow.registry.ts
export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  formSchema: ZodSchema;          // 自动渲染动态表单
  mapFormToPayload: (values: unknown) => unknown;
}

export const workflowRegistry: WorkflowDefinition[] = [
  {
    id: 'company-live',
    name: '直播内容生成',
    description: '生成音频、图片、视频 bundle',
    formSchema: companyLiveFormSchema,
    mapFormToPayload: (v) => ({ ... }),
  },
];
```

注册新工作流：在 registry 数组中加一条，无需修改页面组件。

### 4.2 组件结构

```
src/features/workflow-lab/
├── registry/
│   ├── workflow.registry.ts
│   └── company-live-form.schema.ts
├── components/
│   ├── WorkflowSidebar.tsx          (左栏)
│   │   ├── WorkflowList.tsx
│   │   └── RunHistoryList.tsx
│   ├── NodeTimelinePanel.tsx        (中栏)
│   │   ├── WorkflowRunForm.tsx      (动态表单)
│   │   └── NodeTimeline.tsx         (节点卡片序列)
│   └── NodeDetailPanel.tsx         (右栏)
├── hooks/
│   └── useWorkflowStream.ts        (SSE 订阅)
├── api/
│   └── workflow-runs.api.ts        (axios 调用)
└── WorkflowLabPage.tsx             (页面入口)
```

### 4.3 useWorkflowStream hook

```ts
function useWorkflowStream(runId: string | null) {
  const [nodes, setNodes] = useState<NodeTraceItem[]>([]);
  const [runStatus, setRunStatus] = useState<RunStatus>('idle');

  useEffect(() => {
    if (!runId) return;
    const es = new EventSource(`/api/workflow-runs/${runId}/stream`);
    es.addEventListener('node-complete', e => {
      setNodes(prev => [...prev, JSON.parse(e.data)]);
    });
    es.addEventListener('run-complete', e => {
      setRunStatus(JSON.parse(e.data).status);
      es.close();
    });
    return () => es.close();
  }, [runId]);

  return { nodes, runStatus };
}
```

### 4.4 导航集成

- `DashboardPageKey` 新增 `'workflowLab'`
- `NAV_ITEMS` 新增 `{ key: 'workflowLab', label: '工作流实验室', icon: FlaskConical }`
- `dashboard-center-content.tsx` 新增 `case 'workflowLab': return <WorkflowLabPage />`

### 4.5 样式规范

- 明亮风格，白底 + 浅灰边框卡片
- 与 agent-admin 现有 shadcn/ui + Tailwind 一致
- 选中工作流：浅蓝背景 `bg-blue-50 border-blue-200`
- 节点状态颜色：succeeded → green-600，running → blue-500（+脉冲动画），failed → red-600，pending → gray-400

---

## 5. graph 层改造

**目标**：让 `executeCompanyLiveGraph` 支持逐节点回调，以便 SSE 流式推送。

**改动范围**：

1. `agents/company-live/src/graphs/company-live.graph.ts`：在每个节点的 invoke 后，调用 `options?.onNodeComplete?.(result)`
2. `agents/company-live/src/runtime/company-live-domain-runtime.ts`：`executeCompanyLiveGraph(input, options?)` 新增可选 `options` 参数
3. `agents/company-live/src/index.ts`：导出更新后的签名

**向后兼容**：`options` 为可选，不传时行为与现在完全一致，已有测试不受影响。

---

## 6. 数据库配置

### 6.1 本地开发：Docker PostgreSQL

在仓库根目录新建 `docker-compose.dev.yml`：

```yaml
version: '3.9'
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
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

启动命令：`docker compose -f docker-compose.dev.yml up -d`

### 6.2 环境变量（`.env`）

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=postgres
DB_NAME=agent_db
```

**AppModule** 中通过 `TypeOrmModule.forRoot({ type: 'postgres', ... })` 装载。

### 6.3 迁移策略

开发阶段使用 `synchronize: true` 自动同步 schema；生产阶段应切换为 TypeORM migrations。

---

## 7. 测试策略

| 层级        | 测试内容                                                              |
| ----------- | --------------------------------------------------------------------- |
| Unit        | WorkflowDispatcher 路由逻辑、WorkflowRunRepository CRUD               |
| Spec        | WorkflowRun entity schema 解析、SSE event JSON 格式                   |
| Integration | POST → SSE stream → run-complete 全链路                               |
| Frontend    | useWorkflowStream hook（mock EventSource）、workflowRegistry 类型校验 |

---

## 8. 实现优先级

1. **后端**：TypeORM 接入 + WorkflowRun entity + WorkflowRunController 基础端点
2. **Graph 改造**：`executeCompanyLiveGraph` 加 `onNodeComplete` 回调
3. **后端 SSE**：WorkflowRunService 订阅 graph 事件并推送 SSE
4. **前端**：workflowRegistry + WorkflowLabPage 三栏布局
5. **前端 SSE**：useWorkflowStream hook + NodeTimeline 实时更新
6. **历史记录**：RunHistoryList + 回放已完成运行的 traceData

---

## 9. 不在本次范围内

- WebSocket 双向通信（SSE 已足够）
- data-report 工作流注册（预留扩展点，本次只实现 company-live）
- 运行取消（cancel）功能
- 生产环境 TypeORM migration 脚本
- 多租户隔离
