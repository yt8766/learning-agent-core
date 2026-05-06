# Knowledge Agent Flow Admin Sync Implementation Plan

状态：completed
文档类型：plan
适用范围：`apps/frontend/knowledge`、`apps/frontend/agent-admin`、`apps/backend/agent-server`、`packages/knowledge`、`packages/core`
最后核对：2026-05-04

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `/Users/dev/Downloads/app` 的知识库与智能代理体验转化为本仓库的 `apps/frontend/knowledge` 产品工作台能力，并同步补齐 `apps/frontend/agent-admin` 的知识治理视角。

**Architecture:** `apps/frontend/knowledge` 承载知识库使用者与运营者的核心体验：知识库、文档、上传、RAG 对话、智能代理流程画布。`apps/frontend/agent-admin` 承载治理体验：知识健康、ingestion 来源、检索诊断、证据与 agent 使用链路，不复制 knowledge 产品页。跨前端共享的 DTO 先落稳定 contract，再由各自 UI adapter 转换成 Ant Design 或 shadcn/radix 组件可消费的 view model。

**Tech Stack:** TypeScript, React 19, Vite, Ant Design 6, Ant Design X, shadcn/radix UI, Tailwind CSS, `@xyflow/react`, `@agent/knowledge`, `@agent/core`, Zod, Vitest, React Testing Library, pnpm workspace.

---

## Execution Status

状态：计划已实现并已暂存，等待提交。Task 1 已独立提交为 `76ea58b1 feat: define knowledge agent flow contract`；Task 2-8 的实现、测试、文档和 lockfile 更新已在当前 index 中暂存。

已完成范围：

- Task 2-4：`apps/frontend/knowledge` 新增 agent flow API boundary、React Flow 智能代理页、知识库筛选和文档拖拽上传体验。
- Task 5：`packages/core` 新增 `KnowledgeGovernanceProjection` schema-first contract，并补脱敏边界测试。
- Task 6：`apps/frontend/agent-admin` 新增知识治理中心、React Flow 治理链路图、dashboard 导航/API 接线。
- Task 7：`apps/backend/agent-server` 暴露 `GET /api/platform/knowledge/governance` 的安全 MVP projection。
- Task 8：更新 knowledge、agent-admin 与 API 索引文档。

验证结论：

- 聚焦 contract/frontend/backend 测试、三端 TypeScript 检查、`pnpm build:lib` 和 `pnpm --dir apps/backend/agent-server build` 已通过。
- `pnpm check:docs` 仍被无关未暂存文件 `docs/apps/backend/agent-server/chat-api.md` 缺少文档元信息阻断；本计划新增的 `knowledge-admin-governance.md` 已修正为 `状态：current` / `文档类型：reference` 后不再报错。
- 计划中 `pnpm --dir apps/frontend/agent-admin exec vitest run ../../apps/frontend/agent-admin/test/pages/knowledge-governance` 与 `pnpm --dir apps/backend/agent-server exec vitest run test/platform/knowledge-governance.controller.spec.ts` 在当前 Vitest 配置下匹配不到测试文件；已用可匹配的 workspace-root / package-relative 命令完成真实验证。

---

## Source Context

- 参考项目：`/Users/dev/Downloads/app`
  - `src/pages/KnowledgeBase.tsx`：知识库列表、搜索、类型过滤、新建弹窗、上传视觉。
  - `src/pages/AgentFlow.tsx`：手写节点画布，提供智能代理流程的产品语义；实现上不能直接复用，应改用 React Flow。
  - `design.md`：知识库表格、Agent Flow canvas、右侧属性面板的视觉描述。
- 本仓库目标项目：
  - `apps/frontend/knowledge`：知识库产品工作台，使用 Ant Design / Ant Design X。
  - `apps/frontend/agent-admin`：后台治理控制台，使用 shadcn/radix 风格组件。
- 现有 contract 与文档入口：
  - `docs/contracts/api/knowledge.md`
  - `docs/contracts/api/knowledge-ingestion.md`
  - `docs/apps/frontend/knowledge/knowledge-frontend.md`
  - `docs/apps/frontend/agent-admin/README.md`

## Scope Check

本计划覆盖两个前端，但它们不是两个独立产品重写：

- `knowledge` 本轮做产品体验增强和智能代理流程画布。
- `agent-admin` 本轮做知识治理投影与治理画布入口。
- 后端只新增或扩展必要的稳定 projection contract；不做真实网页抓取、不引入 vendor raw payload、不绕过现有 `knowledge-server` canonical API。
- 参考项目的 mock 数据、手写 SVG 连线、framer-motion 动画和硬编码颜色不直接迁移。

## File Structure

### Stable Contracts and Docs

- Modify: `docs/contracts/api/knowledge.md`
  - 记录 knowledge 前端新增的 `agent-flow` 读写接口、节点 schema、执行预检语义。
- Create: `docs/contracts/api/knowledge-admin-governance.md`
  - 记录 admin 侧知识治理 projection：健康、ingestion、检索诊断、agent 使用链路。
- Modify: `packages/knowledge/src/contracts/knowledge-agent-flow.ts`
  - 新增 knowledge agent flow schema/type，供 `apps/frontend/knowledge` 消费。
- Modify: `packages/knowledge/src/index.ts`
  - 导出 agent flow contract。
- Modify: `packages/core/src/contracts/knowledge-service/knowledge-service.schemas.ts`
  - 增加 admin 侧可复用的治理 projection schema。
- Modify: `packages/core/src/contracts/knowledge-service/knowledge-service.types.ts`
  - 从 schema 推导治理 projection 类型。
- Modify: `packages/core/src/contracts/knowledge-service/index.ts`
  - 导出治理 projection。

### Knowledge Frontend

- Modify: `apps/frontend/knowledge/package.json`
  - 新增 `@xyflow/react`。
- Modify: `apps/frontend/knowledge/src/app/App.tsx`
  - 新增 `/agent-flow` 路由。
- Modify: `apps/frontend/knowledge/src/app/layout/app-shell.tsx`
  - 新增“智能代理”导航项。
- Modify: `apps/frontend/knowledge/src/api/knowledge-api-provider.tsx`
  - 增加 agent flow API 方法。
- Modify: `apps/frontend/knowledge/src/api/knowledge-api-client.ts`
  - 实现真实 API 路径。
- Modify: `apps/frontend/knowledge/src/api/mock-knowledge-api-client.ts`
  - 实现 mock agent flow 数据。
- Create: `apps/frontend/knowledge/src/types/agent-flow.ts`
  - 前端 agent flow view 类型。
- Create: `apps/frontend/knowledge/src/hooks/use-knowledge-agent-flow.ts`
  - 读取、编辑、保存、运行 agent flow draft。
- Create: `apps/frontend/knowledge/src/pages/agent-flow/agent-flow-page.tsx`
  - 页面容器。
- Create: `apps/frontend/knowledge/src/pages/agent-flow/agent-flow-canvas.tsx`
  - React Flow 画布。
- Create: `apps/frontend/knowledge/src/pages/agent-flow/agent-flow-node.tsx`
  - 自定义节点组件。
- Create: `apps/frontend/knowledge/src/pages/agent-flow/agent-flow-toolbar.tsx`
  - 运行、保存、添加节点工具栏。
- Create: `apps/frontend/knowledge/src/pages/agent-flow/agent-flow-properties-panel.tsx`
  - 右侧属性面板。
- Modify: `apps/frontend/knowledge/src/pages/knowledge-bases/knowledge-bases-page.tsx`
  - 参考 app 的搜索/类型过滤体验，转换成 Ant Design 写法。
- Modify: `apps/frontend/knowledge/src/pages/documents/documents-page.tsx`
  - 强化上传 modal 的拖拽上传和状态展示。
- Modify: `apps/frontend/knowledge/src/styles/knowledge-pro.css`
  - 增加 agent flow canvas 的容器、mini map、属性面板样式。

### Agent Admin Frontend

- Modify: `apps/frontend/agent-admin/package.json`
  - 新增 `@xyflow/react`。
- Modify: `apps/frontend/agent-admin/src/hooks/admin-dashboard/admin-dashboard-constants.ts`
  - 增加 `knowledgeGovernance` 页面 key 和标题。
- Modify: `apps/frontend/agent-admin/src/pages/dashboard/dashboard-center-content.tsx`
  - 接入知识治理中心。
- Modify: `apps/frontend/agent-admin/src/api/admin-api-platform.ts`
  - 增加读取知识治理 projection 的 API 方法。
- Create: `apps/frontend/agent-admin/src/pages/knowledge-governance/knowledge-governance-panel.tsx`
  - 知识治理中心页面容器。
- Create: `apps/frontend/agent-admin/src/pages/knowledge-governance/knowledge-governance-types.ts`
  - admin 前端本地 view 类型。
- Create: `apps/frontend/agent-admin/src/pages/knowledge-governance/knowledge-governance-summary.tsx`
  - 健康、索引、失败 job、检索指标摘要。
- Create: `apps/frontend/agent-admin/src/pages/knowledge-governance/knowledge-governance-flow-canvas.tsx`
  - React Flow 治理链路图。
- Create: `apps/frontend/agent-admin/src/pages/knowledge-governance/knowledge-governance-node.tsx`
  - 治理节点组件。
- Create: `apps/frontend/agent-admin/src/pages/knowledge-governance/knowledge-governance-diagnostics.tsx`
  - provider health、ingestion warning、retrieval diagnostics 明细。
- Modify: `docs/apps/frontend/agent-admin/README.md`
  - 加入知识治理中心说明。

### Tests

- Create: `packages/knowledge/test/knowledge-agent-flow-contracts.test.ts`
- Create: `packages/core/test/knowledge-governance-contracts.test.ts`
- Create: `apps/frontend/knowledge/test/knowledge-agent-flow-page.test.tsx`
- Modify: `apps/frontend/knowledge/test/app-render.test.tsx`
- Modify: `apps/frontend/knowledge/test/knowledge-production-workflows.test.tsx`
- Create: `apps/frontend/agent-admin/test/pages/knowledge-governance/knowledge-governance-panel.test.tsx`
- Create: `apps/frontend/agent-admin/test/pages/knowledge-governance/knowledge-governance-flow-canvas.test.tsx`
- Modify: `apps/frontend/agent-admin/test/pages/runtime-overview/components/runtime-knowledge-summary-card.test.tsx` if existing assertions overlap with new governance projection.

## Task 1: Define Knowledge Agent Flow Contract

**Files:**

- Modify: `docs/contracts/api/knowledge.md`
- Create: `packages/knowledge/src/contracts/knowledge-agent-flow.ts`
- Modify: `packages/knowledge/src/index.ts`
- Test: `packages/knowledge/test/knowledge-agent-flow-contracts.test.ts`

- [ ] **Step 1: Write the failing contract test**

Create `packages/knowledge/test/knowledge-agent-flow-contracts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  KnowledgeAgentFlowSchema,
  KnowledgeAgentFlowNodeSchema,
  KnowledgeAgentFlowRunRequestSchema
} from '../src/contracts/knowledge-agent-flow';

describe('knowledge agent flow contracts', () => {
  it('parses a RAG agent flow with retrieval and answer nodes', () => {
    const parsed = KnowledgeAgentFlowSchema.parse({
      id: 'flow_default_rag',
      name: '默认 RAG 智能代理',
      description: '用户输入经过意图识别、知识检索、生成和引用输出。',
      version: 1,
      status: 'draft',
      nodes: [
        {
          id: 'input',
          type: 'input',
          label: '用户输入',
          position: { x: 80, y: 180 },
          config: {}
        },
        {
          id: 'retrieve',
          type: 'knowledge_retrieve',
          label: '知识检索',
          position: { x: 360, y: 120 },
          config: {
            retrievalMode: 'hybrid',
            knowledgeBaseIds: ['kb_1']
          }
        },
        {
          id: 'answer',
          type: 'llm_generate',
          label: '生成回答',
          position: { x: 640, y: 180 },
          config: {
            modelProfileId: 'knowledge-rag'
          }
        }
      ],
      edges: [
        { id: 'edge_input_retrieve', source: 'input', target: 'retrieve' },
        { id: 'edge_retrieve_answer', source: 'retrieve', target: 'answer' }
      ],
      createdAt: '2026-05-04T00:00:00.000Z',
      updatedAt: '2026-05-04T00:00:00.000Z'
    });

    expect(parsed.nodes).toHaveLength(3);
    expect(parsed.edges[1]?.target).toBe('answer');
  });

  it('rejects unsupported node types before they reach the UI', () => {
    expect(() =>
      KnowledgeAgentFlowNodeSchema.parse({
        id: 'crawler',
        type: 'web_crawler',
        label: '网页抓取',
        position: { x: 0, y: 0 },
        config: {}
      })
    ).toThrow();
  });

  it('parses run requests with JSON-safe input only', () => {
    const parsed = KnowledgeAgentFlowRunRequestSchema.parse({
      flowId: 'flow_default_rag',
      input: {
        message: '总结一下产品文档',
        knowledgeBaseIds: ['kb_1']
      }
    });

    expect(parsed.input.message).toBe('总结一下产品文档');
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/knowledge-agent-flow-contracts.test.ts
```

Expected: FAIL with an import error for `../src/contracts/knowledge-agent-flow`.

- [ ] **Step 3: Add the schema-first contract**

Create `packages/knowledge/src/contracts/knowledge-agent-flow.ts`:

```ts
import { z } from 'zod';

const JsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
type JsonPrimitive = z.infer<typeof JsonPrimitiveSchema>;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([JsonPrimitiveSchema, z.array(JsonValueSchema), z.record(z.string(), JsonValueSchema)])
);

export const KnowledgeAgentFlowNodeTypeSchema = z.enum([
  'input',
  'intent_classify',
  'knowledge_retrieve',
  'rerank',
  'llm_generate',
  'approval_gate',
  'connector_action',
  'output'
]);

export const KnowledgeAgentFlowNodePositionSchema = z.object({
  x: z.number(),
  y: z.number()
});

export const KnowledgeAgentFlowNodeSchema = z.object({
  id: z.string().min(1),
  type: KnowledgeAgentFlowNodeTypeSchema,
  label: z.string().min(1),
  description: z.string().optional(),
  position: KnowledgeAgentFlowNodePositionSchema,
  config: z.record(z.string(), JsonValueSchema).default({})
});

export const KnowledgeAgentFlowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  label: z.string().optional()
});

export const KnowledgeAgentFlowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  version: z.number().int().positive(),
  status: z.enum(['draft', 'active', 'archived']),
  nodes: z.array(KnowledgeAgentFlowNodeSchema),
  edges: z.array(KnowledgeAgentFlowEdgeSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const KnowledgeAgentFlowListResponseSchema = z.object({
  items: z.array(KnowledgeAgentFlowSchema)
});

export const KnowledgeAgentFlowSaveRequestSchema = KnowledgeAgentFlowSchema.pick({
  name: true,
  description: true,
  nodes: true,
  edges: true
}).extend({
  id: z.string().min(1).optional()
});

export const KnowledgeAgentFlowRunRequestSchema = z.object({
  flowId: z.string().min(1),
  input: z.object({
    message: z.string().min(1),
    knowledgeBaseIds: z.array(z.string().min(1)).default([])
  })
});

export const KnowledgeAgentFlowRunResponseSchema = z.object({
  runId: z.string().min(1),
  status: z.enum(['queued', 'running', 'completed', 'failed']),
  traceId: z.string().optional(),
  message: z.string().optional()
});

export type KnowledgeAgentFlowNodeType = z.infer<typeof KnowledgeAgentFlowNodeTypeSchema>;
export type KnowledgeAgentFlowNode = z.infer<typeof KnowledgeAgentFlowNodeSchema>;
export type KnowledgeAgentFlowEdge = z.infer<typeof KnowledgeAgentFlowEdgeSchema>;
export type KnowledgeAgentFlow = z.infer<typeof KnowledgeAgentFlowSchema>;
export type KnowledgeAgentFlowListResponse = z.infer<typeof KnowledgeAgentFlowListResponseSchema>;
export type KnowledgeAgentFlowSaveRequest = z.infer<typeof KnowledgeAgentFlowSaveRequestSchema>;
export type KnowledgeAgentFlowRunRequest = z.infer<typeof KnowledgeAgentFlowRunRequestSchema>;
export type KnowledgeAgentFlowRunResponse = z.infer<typeof KnowledgeAgentFlowRunResponseSchema>;
```

- [ ] **Step 4: Export the contract**

Modify `packages/knowledge/src/index.ts` by adding:

```ts
export * from './contracts/knowledge-agent-flow';
```

- [ ] **Step 5: Document the API contract**

In `docs/contracts/api/knowledge.md`, add a new section after the Chat Lab/RAG sections:

```md
## Agent Flow

Agent Flow 是 `apps/frontend/knowledge` 的智能代理流程画布。它只保存项目自定义节点契约，不保存 React Flow vendor 对象，不保存浏览器事件、函数、class 实例或第三方 SDK payload。

| Method | Path                                 | Request                         | Response                         | 权限                     |
| ------ | ------------------------------------ | ------------------------------- | -------------------------------- | ------------------------ |
| GET    | `/knowledge/agent-flows`             | none                            | `KnowledgeAgentFlowListResponse` | authenticated user       |
| POST   | `/knowledge/agent-flows`             | `KnowledgeAgentFlowSaveRequest` | `KnowledgeAgentFlow`             | owner, admin, maintainer |
| PUT    | `/knowledge/agent-flows/:flowId`     | `KnowledgeAgentFlowSaveRequest` | `KnowledgeAgentFlow`             | owner, admin, maintainer |
| POST   | `/knowledge/agent-flows/:flowId/run` | `KnowledgeAgentFlowRunRequest`  | `KnowledgeAgentFlowRunResponse`  | authenticated user       |

节点类型固定为：`input`、`intent_classify`、`knowledge_retrieve`、`rerank`、`llm_generate`、`approval_gate`、`connector_action`、`output`。新增节点类型必须先更新 `@agent/knowledge` schema，再更新前端节点 palette 与测试。
```

- [ ] **Step 6: Verify the contract test passes**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/knowledge-agent-flow-contracts.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add docs/contracts/api/knowledge.md packages/knowledge/src/contracts/knowledge-agent-flow.ts packages/knowledge/src/index.ts packages/knowledge/test/knowledge-agent-flow-contracts.test.ts
git commit -m "feat: define knowledge agent flow contract"
```

## Task 2: Add Knowledge Frontend Agent Flow API Boundary

**Files:**

- Modify: `apps/frontend/knowledge/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/frontend/knowledge/src/types/agent-flow.ts`
- Modify: `apps/frontend/knowledge/src/types/api.ts`
- Modify: `apps/frontend/knowledge/src/api/knowledge-api-provider.tsx`
- Modify: `apps/frontend/knowledge/src/api/knowledge-api-client.ts`
- Modify: `apps/frontend/knowledge/src/api/mock-knowledge-api-client.ts`
- Test: `apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts`

- [ ] **Step 1: Install React Flow for the knowledge frontend**

Run:

```bash
pnpm --dir apps/frontend/knowledge add @xyflow/react
```

Expected: `apps/frontend/knowledge/package.json` contains `@xyflow/react`, and `pnpm-lock.yaml` changes.

- [ ] **Step 2: Write failing API path tests**

Append to `apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts`:

```ts
it('lists knowledge agent flows through the canonical knowledge API', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(
      JSON.stringify({
        items: [
          {
            id: 'flow_default_rag',
            name: '默认 RAG 智能代理',
            description: '',
            version: 1,
            status: 'draft',
            nodes: [],
            edges: [],
            createdAt: '2026-05-04T00:00:00.000Z',
            updatedAt: '2026-05-04T00:00:00.000Z'
          }
        ]
      }),
      { status: 200 }
    )
  );
  const client = createKnowledgeApiClient({
    baseUrl: 'http://127.0.0.1:3020/api',
    getAccessToken: () => 'access-token',
    fetchImpl: fetcher
  });

  await client.listAgentFlows();

  expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3020/api/knowledge/agent-flows');
  expect(fetcher.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ method: 'GET' }));
});

it('runs a knowledge agent flow with a JSON-safe input payload', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(JSON.stringify({ runId: 'run_1', status: 'queued', traceId: 'trace_1' }), { status: 200 })
    );
  const client = createKnowledgeApiClient({
    baseUrl: 'http://127.0.0.1:3020/api',
    getAccessToken: () => 'access-token',
    fetchImpl: fetcher
  });

  await client.runAgentFlow('flow_default_rag', {
    flowId: 'flow_default_rag',
    input: {
      message: '检索产品资料',
      knowledgeBaseIds: ['kb_1']
    }
  });

  expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3020/api/knowledge/agent-flows/flow_default_rag/run');
  expect(fetcher.mock.calls[0]?.[1]).toEqual(
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        flowId: 'flow_default_rag',
        input: {
          message: '检索产品资料',
          knowledgeBaseIds: ['kb_1']
        }
      })
    })
  );
});
```

- [ ] **Step 3: Run the failing tests**

Run:

```bash
pnpm --dir apps/frontend/knowledge test -- knowledge-real-api-paths.test.ts
```

Expected: FAIL because `listAgentFlows()` and `runAgentFlow()` do not exist.

- [ ] **Step 4: Add frontend type exports**

Create `apps/frontend/knowledge/src/types/agent-flow.ts`:

```ts
import type {
  KnowledgeAgentFlow,
  KnowledgeAgentFlowListResponse,
  KnowledgeAgentFlowRunRequest,
  KnowledgeAgentFlowRunResponse,
  KnowledgeAgentFlowSaveRequest
} from '@agent/knowledge';

export type AgentFlowRecord = KnowledgeAgentFlow;
export type AgentFlowListResponse = KnowledgeAgentFlowListResponse;
export type AgentFlowSaveRequest = KnowledgeAgentFlowSaveRequest;
export type AgentFlowRunRequest = KnowledgeAgentFlowRunRequest;
export type AgentFlowRunResponse = KnowledgeAgentFlowRunResponse;
```

Modify `apps/frontend/knowledge/src/types/api.ts`:

```ts
export type * from './agent-flow';
```

- [ ] **Step 5: Extend the API provider interface**

Modify `apps/frontend/knowledge/src/api/knowledge-api-provider.tsx` imports:

```ts
import type {
  AgentFlowListResponse,
  AgentFlowRecord,
  AgentFlowRunRequest,
  AgentFlowRunResponse,
  AgentFlowSaveRequest
} from '../types/api';
```

Add methods to `KnowledgeFrontendApi`:

```ts
listAgentFlows(): Promise<AgentFlowListResponse>;
saveAgentFlow(input: AgentFlowSaveRequest): Promise<AgentFlowRecord>;
updateAgentFlow(flowId: string, input: AgentFlowSaveRequest): Promise<AgentFlowRecord>;
runAgentFlow(flowId: string, input: AgentFlowRunRequest): Promise<AgentFlowRunResponse>;
```

- [ ] **Step 6: Implement the real client methods**

Modify `apps/frontend/knowledge/src/api/knowledge-api-client.ts` by adding methods to `KnowledgeApiClient`:

```ts
async listAgentFlows(): Promise<AgentFlowListResponse> {
  return this.request<AgentFlowListResponse>('/knowledge/agent-flows');
}

async saveAgentFlow(input: AgentFlowSaveRequest): Promise<AgentFlowRecord> {
  return this.request<AgentFlowRecord>('/knowledge/agent-flows', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

async updateAgentFlow(flowId: string, input: AgentFlowSaveRequest): Promise<AgentFlowRecord> {
  return this.request<AgentFlowRecord>(`/knowledge/agent-flows/${encodeURIComponent(flowId)}`, {
    method: 'PUT',
    body: JSON.stringify(input)
  });
}

async runAgentFlow(flowId: string, input: AgentFlowRunRequest): Promise<AgentFlowRunResponse> {
  return this.request<AgentFlowRunResponse>(`/knowledge/agent-flows/${encodeURIComponent(flowId)}/run`, {
    method: 'POST',
    body: JSON.stringify(input)
  });
}
```

If `knowledge-api-client.ts` does not already import these types, add:

```ts
import type {
  AgentFlowListResponse,
  AgentFlowRecord,
  AgentFlowRunRequest,
  AgentFlowRunResponse,
  AgentFlowSaveRequest
} from '../types/api';
```

- [ ] **Step 7: Implement mock client methods**

Modify `apps/frontend/knowledge/src/api/mock-knowledge-api-client.ts`:

```ts
private agentFlows: AgentFlowRecord[] = [
  {
    id: 'flow_default_rag',
    name: '默认 RAG 智能代理',
    description: '用户输入经过意图识别、知识检索、生成和引用输出。',
    version: 1,
    status: 'draft',
    nodes: [
      { id: 'input', type: 'input', label: '用户输入', position: { x: 80, y: 180 }, config: {} },
      {
        id: 'retrieve',
        type: 'knowledge_retrieve',
        label: '知识检索',
        position: { x: 360, y: 120 },
        config: { retrievalMode: 'hybrid' }
      },
      {
        id: 'answer',
        type: 'llm_generate',
        label: '生成回答',
        position: { x: 640, y: 180 },
        config: { modelProfileId: 'knowledge-rag' }
      },
      { id: 'output', type: 'output', label: '引用输出', position: { x: 920, y: 180 }, config: {} }
    ],
    edges: [
      { id: 'edge_input_retrieve', source: 'input', target: 'retrieve' },
      { id: 'edge_retrieve_answer', source: 'retrieve', target: 'answer' },
      { id: 'edge_answer_output', source: 'answer', target: 'output' }
    ],
    createdAt: '2026-05-04T00:00:00.000Z',
    updatedAt: '2026-05-04T00:00:00.000Z'
  }
];

async listAgentFlows(): Promise<AgentFlowListResponse> {
  return { items: this.agentFlows };
}

async saveAgentFlow(input: AgentFlowSaveRequest): Promise<AgentFlowRecord> {
  const now = new Date().toISOString();
  const created: AgentFlowRecord = {
    id: input.id ?? `flow_${Date.now()}`,
    name: input.name,
    description: input.description,
    version: 1,
    status: 'draft',
    nodes: input.nodes,
    edges: input.edges,
    createdAt: now,
    updatedAt: now
  };
  this.agentFlows = [created, ...this.agentFlows];
  return created;
}

async updateAgentFlow(flowId: string, input: AgentFlowSaveRequest): Promise<AgentFlowRecord> {
  const current = this.agentFlows.find(item => item.id === flowId);
  if (!current) {
    throw new Error('agent_flow_not_found');
  }
  const updated: AgentFlowRecord = {
    ...current,
    name: input.name,
    description: input.description,
    nodes: input.nodes,
    edges: input.edges,
    version: current.version + 1,
    updatedAt: new Date().toISOString()
  };
  this.agentFlows = this.agentFlows.map(item => (item.id === flowId ? updated : item));
  return updated;
}

async runAgentFlow(flowId: string, input: AgentFlowRunRequest): Promise<AgentFlowRunResponse> {
  return {
    runId: `run_${flowId}_${Date.now()}`,
    status: input.input.message ? 'queued' : 'failed',
    traceId: `trace_${flowId}`
  };
}
```

Also import:

```ts
import type {
  AgentFlowListResponse,
  AgentFlowRecord,
  AgentFlowRunRequest,
  AgentFlowRunResponse,
  AgentFlowSaveRequest
} from '../types/api';
```

- [ ] **Step 8: Verify frontend API tests pass**

Run:

```bash
pnpm --dir apps/frontend/knowledge test -- knowledge-real-api-paths.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```bash
git add apps/frontend/knowledge/package.json pnpm-lock.yaml apps/frontend/knowledge/src/types/agent-flow.ts apps/frontend/knowledge/src/types/api.ts apps/frontend/knowledge/src/api/knowledge-api-provider.tsx apps/frontend/knowledge/src/api/knowledge-api-client.ts apps/frontend/knowledge/src/api/mock-knowledge-api-client.ts apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts
git commit -m "feat: add knowledge agent flow api boundary"
```

## Task 3: Build Knowledge Frontend React Flow Page

**Files:**

- Modify: `apps/frontend/knowledge/src/app/App.tsx`
- Modify: `apps/frontend/knowledge/src/app/layout/app-shell.tsx`
- Create: `apps/frontend/knowledge/src/hooks/use-knowledge-agent-flow.ts`
- Create: `apps/frontend/knowledge/src/pages/agent-flow/agent-flow-page.tsx`
- Create: `apps/frontend/knowledge/src/pages/agent-flow/agent-flow-canvas.tsx`
- Create: `apps/frontend/knowledge/src/pages/agent-flow/agent-flow-node.tsx`
- Create: `apps/frontend/knowledge/src/pages/agent-flow/agent-flow-toolbar.tsx`
- Create: `apps/frontend/knowledge/src/pages/agent-flow/agent-flow-properties-panel.tsx`
- Modify: `apps/frontend/knowledge/src/styles/knowledge-pro.css`
- Test: `apps/frontend/knowledge/test/knowledge-agent-flow-page.test.tsx`
- Test: `apps/frontend/knowledge/test/app-render.test.tsx`

- [ ] **Step 1: Write the failing page test**

Create `apps/frontend/knowledge/test/knowledge-agent-flow-page.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { KnowledgeApiProvider, type KnowledgeFrontendApi } from '../src/api/knowledge-api-provider';
import { AgentFlowPage } from '../src/pages/agent-flow/agent-flow-page';

function createApi(): KnowledgeFrontendApi {
  return {
    getDashboardOverview: vi.fn(),
    listKnowledgeBases: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    listEmbeddingModels: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    listDocuments: vi.fn(),
    uploadKnowledgeFile: vi.fn(),
    createDocumentFromUpload: vi.fn(),
    getDocument: vi.fn(),
    getLatestDocumentJob: vi.fn(),
    listDocumentChunks: vi.fn(),
    uploadDocument: vi.fn(),
    reprocessDocument: vi.fn(),
    deleteDocument: vi.fn(),
    listRagModelProfiles: vi.fn(),
    listConversations: vi.fn(),
    listConversationMessages: vi.fn(),
    chat: vi.fn(),
    streamChat: vi.fn(),
    createFeedback: vi.fn(),
    listEvalDatasets: vi.fn(),
    listEvalRuns: vi.fn(),
    listEvalRunResults: vi.fn(),
    compareEvalRuns: vi.fn(),
    getObservabilityMetrics: vi.fn(),
    listTraces: vi.fn(),
    getTrace: vi.fn(),
    listAgentFlows: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'flow_default_rag',
          name: '默认 RAG 智能代理',
          description: '默认流程',
          version: 1,
          status: 'draft',
          nodes: [
            { id: 'input', type: 'input', label: '用户输入', position: { x: 80, y: 180 }, config: {} },
            { id: 'retrieve', type: 'knowledge_retrieve', label: '知识检索', position: { x: 360, y: 120 }, config: {} }
          ],
          edges: [{ id: 'edge_input_retrieve', source: 'input', target: 'retrieve' }],
          createdAt: '2026-05-04T00:00:00.000Z',
          updatedAt: '2026-05-04T00:00:00.000Z'
        }
      ]
    }),
    saveAgentFlow: vi.fn(),
    updateAgentFlow: vi.fn(),
    runAgentFlow: vi.fn().mockResolvedValue({ runId: 'run_1', status: 'queued', traceId: 'trace_1' })
  };
}

describe('AgentFlowPage', () => {
  it('renders the flow canvas and can queue a run', async () => {
    const api = createApi();

    render(
      <KnowledgeApiProvider client={api}>
        <AgentFlowPage />
      </KnowledgeApiProvider>
    );

    expect(await screen.findByText('智能代理')).toBeInTheDocument();
    expect(screen.getByText('用户输入')).toBeInTheDocument();
    expect(screen.getByText('知识检索')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '运行流程' }));

    await waitFor(() => {
      expect(api.runAgentFlow).toHaveBeenCalledWith('flow_default_rag', {
        flowId: 'flow_default_rag',
        input: {
          message: '验证知识库智能代理流程',
          knowledgeBaseIds: []
        }
      });
    });
    expect(screen.getByText('run_1')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the failing page test**

Run:

```bash
pnpm --dir apps/frontend/knowledge test -- knowledge-agent-flow-page.test.tsx
```

Expected: FAIL because `AgentFlowPage` does not exist.

- [ ] **Step 3: Add the agent flow hook**

Create `apps/frontend/knowledge/src/hooks/use-knowledge-agent-flow.ts`:

```ts
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useKnowledgeApi } from '../api/knowledge-api-provider';
import type { AgentFlowRecord, AgentFlowRunResponse, AgentFlowSaveRequest } from '../types/api';

export function useKnowledgeAgentFlow() {
  const api = useKnowledgeApi();
  const [flows, setFlows] = useState<AgentFlowRecord[]>([]);
  const [activeFlowId, setActiveFlowId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastRun, setLastRun] = useState<AgentFlowRunResponse | null>(null);

  const activeFlow = useMemo(() => flows.find(flow => flow.id === activeFlowId) ?? flows[0], [activeFlowId, flows]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listAgentFlows();
      setFlows(result.items);
      setActiveFlowId(current => current ?? result.items[0]?.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error(String(caught)));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveFlow = useCallback(
    async (input: AgentFlowSaveRequest) => {
      setSaving(true);
      setError(null);
      try {
        const saved = input.id ? await api.updateAgentFlow(input.id, input) : await api.saveAgentFlow(input);
        setFlows(current => {
          const exists = current.some(item => item.id === saved.id);
          return exists ? current.map(item => (item.id === saved.id ? saved : item)) : [saved, ...current];
        });
        setActiveFlowId(saved.id);
        return saved;
      } catch (caught) {
        setError(caught instanceof Error ? caught : new Error(String(caught)));
        return null;
      } finally {
        setSaving(false);
      }
    },
    [api]
  );

  const runFlow = useCallback(async () => {
    if (!activeFlow) {
      return null;
    }
    setRunning(true);
    setError(null);
    try {
      const result = await api.runAgentFlow(activeFlow.id, {
        flowId: activeFlow.id,
        input: {
          message: '验证知识库智能代理流程',
          knowledgeBaseIds: []
        }
      });
      setLastRun(result);
      return result;
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error(String(caught)));
      return null;
    } finally {
      setRunning(false);
    }
  }, [activeFlow, api]);

  return {
    activeFlow,
    activeFlowId,
    error,
    flows,
    lastRun,
    loading,
    reload,
    runFlow,
    running,
    saveFlow,
    saving,
    setActiveFlowId
  };
}
```

- [ ] **Step 4: Add the custom node component**

Create `apps/frontend/knowledge/src/pages/agent-flow/agent-flow-node.tsx`:

```tsx
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Badge, Space, Typography } from 'antd';
import {
  ApiOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  FilterOutlined,
  MessageOutlined,
  RobotOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';

import type { KnowledgeAgentFlowNodeType } from '@agent/knowledge';

const iconByType: Record<KnowledgeAgentFlowNodeType, React.ReactNode> = {
  approval_gate: <SafetyCertificateOutlined />,
  connector_action: <ApiOutlined />,
  input: <MessageOutlined />,
  intent_classify: <BranchesOutlined />,
  knowledge_retrieve: <DatabaseOutlined />,
  llm_generate: <RobotOutlined />,
  output: <CheckCircleOutlined />,
  rerank: <FilterOutlined />
};

const labelByType: Record<KnowledgeAgentFlowNodeType, string> = {
  approval_gate: '审批门',
  connector_action: '连接器动作',
  input: '输入',
  intent_classify: '意图识别',
  knowledge_retrieve: '知识检索',
  llm_generate: '模型生成',
  output: '输出',
  rerank: '重排'
};

export interface AgentFlowNodeData extends Record<string, unknown> {
  label: string;
  type: KnowledgeAgentFlowNodeType;
  description?: string;
}

export const AgentFlowNode = memo(function AgentFlowNode({ data, selected }: NodeProps) {
  const nodeData = data as AgentFlowNodeData;

  return (
    <div className={`knowledge-agent-flow-node ${selected ? 'is-selected' : ''}`}>
      <Handle position={Position.Left} type="target" />
      <Space align="start">
        <span className="knowledge-agent-flow-node-icon">{iconByType[nodeData.type]}</span>
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{nodeData.label}</Typography.Text>
          <Badge count={labelByType[nodeData.type]} style={{ backgroundColor: '#eef4ff', color: '#1677ff' }} />
          {nodeData.description ? (
            <Typography.Text type="secondary" className="knowledge-agent-flow-node-description">
              {nodeData.description}
            </Typography.Text>
          ) : null}
        </Space>
      </Space>
      <Handle position={Position.Right} type="source" />
    </div>
  );
});
```

- [ ] **Step 5: Add the React Flow canvas**

Create `apps/frontend/knowledge/src/pages/agent-flow/agent-flow-canvas.tsx`:

```tsx
import { useMemo } from 'react';
import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node, type NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { AgentFlowRecord } from '../../types/api';
import { AgentFlowNode, type AgentFlowNodeData } from './agent-flow-node';

const nodeTypes: NodeTypes = {
  agentFlowNode: AgentFlowNode
};

export function AgentFlowCanvas({
  flow,
  selectedNodeId,
  onSelectNode
}: {
  flow: AgentFlowRecord;
  selectedNodeId?: string;
  onSelectNode: (nodeId?: string) => void;
}) {
  const nodes = useMemo<Node<AgentFlowNodeData>[]>(
    () =>
      flow.nodes.map(node => ({
        id: node.id,
        type: 'agentFlowNode',
        position: node.position,
        selected: selectedNodeId === node.id,
        data: {
          description: node.description,
          label: node.label,
          type: node.type
        }
      })),
    [flow.nodes, selectedNodeId]
  );

  const edges = useMemo<Edge[]>(
    () =>
      flow.edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        label: edge.label,
        animated: true
      })),
    [flow.edges]
  );

  return (
    <div className="knowledge-agent-flow-canvas" data-testid="knowledge-agent-flow-canvas">
      <ReactFlow
        edges={edges}
        fitView
        nodes={nodes}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        onPaneClick={() => onSelectNode(undefined)}
      >
        <Background />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
```

- [ ] **Step 6: Add toolbar and properties panel**

Create `apps/frontend/knowledge/src/pages/agent-flow/agent-flow-toolbar.tsx`:

```tsx
import { Button, Select, Space, Tag, Typography } from 'antd';
import { PlayCircleOutlined, SaveOutlined } from '@ant-design/icons';

import type { AgentFlowRecord, AgentFlowRunResponse } from '../../types/api';

export function AgentFlowToolbar({
  activeFlowId,
  flows,
  lastRun,
  running,
  saving,
  onFlowChange,
  onRun,
  onSave
}: {
  activeFlowId?: string;
  flows: AgentFlowRecord[];
  lastRun: AgentFlowRunResponse | null;
  running: boolean;
  saving: boolean;
  onFlowChange: (flowId: string) => void;
  onRun: () => void;
  onSave: () => void;
}) {
  return (
    <div className="knowledge-agent-flow-toolbar">
      <Space wrap>
        <Select
          aria-label="选择智能代理流程"
          options={flows.map(flow => ({ label: flow.name, value: flow.id }))}
          style={{ minWidth: 240 }}
          value={activeFlowId}
          onChange={onFlowChange}
        />
        <Button icon={<PlayCircleOutlined />} loading={running} onClick={onRun} type="primary">
          运行流程
        </Button>
        <Button icon={<SaveOutlined />} loading={saving} onClick={onSave}>
          保存草稿
        </Button>
        {lastRun ? <Tag color={lastRun.status === 'failed' ? 'error' : 'processing'}>{lastRun.runId}</Tag> : null}
      </Space>
      <Typography.Text type="secondary">流程保存项目自定义节点契约，不保存 React Flow vendor 对象。</Typography.Text>
    </div>
  );
}
```

Create `apps/frontend/knowledge/src/pages/agent-flow/agent-flow-properties-panel.tsx`:

```tsx
import { Card, Descriptions, Empty, Tag, Typography } from 'antd';

import type { AgentFlowRecord } from '../../types/api';

export function AgentFlowPropertiesPanel({
  flow,
  selectedNodeId
}: {
  flow?: AgentFlowRecord;
  selectedNodeId?: string;
}) {
  const node = flow?.nodes.find(item => item.id === selectedNodeId);

  if (!flow || !node) {
    return (
      <Card className="knowledge-agent-flow-properties" title="节点配置">
        <Empty description="选择一个节点查看配置" />
      </Card>
    );
  }

  return (
    <Card className="knowledge-agent-flow-properties" title="节点配置">
      <Descriptions column={1} size="small">
        <Descriptions.Item label="节点 ID">
          <Typography.Text code>{node.id}</Typography.Text>
        </Descriptions.Item>
        <Descriptions.Item label="节点名称">{node.label}</Descriptions.Item>
        <Descriptions.Item label="节点类型">
          <Tag>{node.type}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="配置">
          <pre className="knowledge-agent-flow-config">{JSON.stringify(node.config, null, 2)}</pre>
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
}
```

- [ ] **Step 7: Add the page container**

Create `apps/frontend/knowledge/src/pages/agent-flow/agent-flow-page.tsx`:

```tsx
import { useState } from 'react';
import { Card, Spin, Typography } from 'antd';

import { useKnowledgeAgentFlow } from '../../hooks/use-knowledge-agent-flow';
import { PageSection } from '../shared/ui';
import { AgentFlowCanvas } from './agent-flow-canvas';
import { AgentFlowPropertiesPanel } from './agent-flow-properties-panel';
import { AgentFlowToolbar } from './agent-flow-toolbar';

export function AgentFlowPage() {
  const {
    activeFlow,
    activeFlowId,
    error,
    flows,
    lastRun,
    loading,
    runFlow,
    running,
    saveFlow,
    saving,
    setActiveFlowId
  } = useKnowledgeAgentFlow();
  const [selectedNodeId, setSelectedNodeId] = useState<string>();

  return (
    <PageSection subTitle="编排知识检索、重排、生成、审批和输出节点" title="智能代理">
      {error ? <Typography.Text type="danger">{error.message}</Typography.Text> : null}
      {loading ? <Spin /> : null}
      <AgentFlowToolbar
        activeFlowId={activeFlowId}
        flows={flows}
        lastRun={lastRun}
        running={running}
        saving={saving}
        onFlowChange={setActiveFlowId}
        onRun={() => {
          void runFlow();
        }}
        onSave={() => {
          if (activeFlow) {
            void saveFlow({
              id: activeFlow.id,
              name: activeFlow.name,
              description: activeFlow.description,
              nodes: activeFlow.nodes,
              edges: activeFlow.edges
            });
          }
        }}
      />
      {activeFlow ? (
        <div className="knowledge-agent-flow-layout">
          <Card className="knowledge-agent-flow-card">
            <AgentFlowCanvas flow={activeFlow} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} />
          </Card>
          <AgentFlowPropertiesPanel flow={activeFlow} selectedNodeId={selectedNodeId} />
        </div>
      ) : null}
    </PageSection>
  );
}
```

- [ ] **Step 8: Wire navigation and route**

Modify `apps/frontend/knowledge/src/app/layout/app-shell.tsx`:

```tsx
import { ApartmentOutlined } from '@ant-design/icons';

export type KnowledgeView =
  | 'overview'
  | 'knowledgeBases'
  | 'documents'
  | 'agentFlow'
  | 'chatLab'
  | 'observability'
  | 'evals'
  | 'settings'
  | 'accountSettings';

const viewByMenuKey: Record<string, KnowledgeView> = {
  agentFlow: 'agentFlow',
  chatLab: 'chatLab',
  documents: 'documents',
  evals: 'evals',
  knowledgeBases: 'knowledgeBases',
  observability: 'observability',
  overview: 'overview',
  settings: 'settings',
  accountSettings: 'accountSettings'
};

const navItems: MenuProps['items'] = [
  { icon: <HomeOutlined />, key: 'overview', label: '总览' },
  { icon: <DatabaseOutlined />, key: 'knowledgeBases', label: '知识库' },
  { icon: <FileTextOutlined />, key: 'documents', label: '文档' },
  { icon: <ApartmentOutlined />, key: 'agentFlow', label: '智能代理' },
  { icon: <MessageOutlined />, key: 'chatLab', label: '对话实验室' },
  { icon: <MonitorOutlined />, key: 'observability', label: '观测中心' },
  { icon: <ExperimentOutlined />, key: 'evals', label: '评测中心' },
  { icon: <SettingOutlined />, key: 'settings', label: '设置' }
];
```

Modify the screen-reader text in the same file so it contains `智能代理`.

Modify `apps/frontend/knowledge/src/app/App.tsx`:

```tsx
import { AgentFlowPage } from '../pages/agent-flow/agent-flow-page';

// inside routes
<Route element={<AgentFlowPage />} path="agent-flow" />;

export const pathByView: Record<KnowledgeView, string> = {
  accountSettings: '/account/settings',
  agentFlow: '/agent-flow',
  chatLab: '/chat-lab',
  documents: '/documents',
  evals: '/evals',
  knowledgeBases: '/knowledge-bases',
  observability: '/observability',
  overview: '/',
  settings: '/settings'
};
```

- [ ] **Step 9: Add CSS**

Append to `apps/frontend/knowledge/src/styles/knowledge-pro.css`:

```css
.knowledge-agent-flow-toolbar {
  align-items: center;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
  padding: 12px;
}

.knowledge-agent-flow-layout {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1fr) 320px;
  min-height: 620px;
}

.knowledge-agent-flow-card .ant-card-body {
  height: 620px;
  padding: 0;
}

.knowledge-agent-flow-canvas {
  background:
    radial-gradient(circle at 1px 1px, #d9d9d9 1px, transparent 0) 0 0 / 18px 18px,
    #fafafa;
  height: 100%;
  overflow: hidden;
}

.knowledge-agent-flow-node {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgb(15 23 42 / 8%);
  min-width: 180px;
  padding: 12px;
}

.knowledge-agent-flow-node.is-selected {
  border-color: #1677ff;
  box-shadow: 0 0 0 3px rgb(22 119 255 / 14%);
}

.knowledge-agent-flow-node-icon {
  align-items: center;
  background: #eef4ff;
  border-radius: 8px;
  color: #1677ff;
  display: inline-flex;
  height: 32px;
  justify-content: center;
  width: 32px;
}

.knowledge-agent-flow-node-description {
  display: block;
  max-width: 180px;
}

.knowledge-agent-flow-properties {
  min-width: 0;
}

.knowledge-agent-flow-config {
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 12px;
  max-height: 240px;
  overflow: auto;
  padding: 10px;
  white-space: pre-wrap;
}

@media (max-width: 1024px) {
  .knowledge-agent-flow-layout {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 10: Verify page tests pass**

Run:

```bash
pnpm --dir apps/frontend/knowledge test -- knowledge-agent-flow-page.test.tsx app-render.test.tsx
```

Expected: PASS.

- [ ] **Step 11: Commit**

Run:

```bash
git add apps/frontend/knowledge/src/app/App.tsx apps/frontend/knowledge/src/app/layout/app-shell.tsx apps/frontend/knowledge/src/hooks/use-knowledge-agent-flow.ts apps/frontend/knowledge/src/pages/agent-flow apps/frontend/knowledge/src/styles/knowledge-pro.css apps/frontend/knowledge/test/knowledge-agent-flow-page.test.tsx apps/frontend/knowledge/test/app-render.test.tsx
git commit -m "feat: add knowledge agent flow workspace"
```

## Task 4: Upgrade Knowledge Bases and Upload UX

**Files:**

- Modify: `apps/frontend/knowledge/src/pages/knowledge-bases/knowledge-bases-page.tsx`
- Modify: `apps/frontend/knowledge/src/pages/documents/documents-page.tsx`
- Modify: `apps/frontend/knowledge/src/pages/documents/document-upload-panel.tsx`
- Modify: `apps/frontend/knowledge/src/styles/knowledge-pro.css`
- Test: `apps/frontend/knowledge/test/knowledge-production-workflows.test.tsx`
- Test: `apps/frontend/knowledge/test/knowledge-upload-flow.test.tsx`

- [ ] **Step 1: Add failing knowledge base filter test**

Append to `apps/frontend/knowledge/test/knowledge-production-workflows.test.tsx`:

```tsx
it('filters knowledge bases by keyword and health state', async () => {
  const api = createKnowledgeApi({
    knowledgeBases: [
      {
        id: 'kb_product',
        workspaceId: 'workspace_1',
        name: '产品技术文档库',
        description: '产品资料',
        tags: ['技术'],
        visibility: 'workspace',
        status: 'active',
        documentCount: 12,
        chunkCount: 120,
        readyDocumentCount: 11,
        failedDocumentCount: 1,
        health: {
          knowledgeBaseId: 'kb_product',
          status: 'ready',
          documentCount: 12,
          searchableDocumentCount: 11,
          chunkCount: 120,
          failedJobCount: 1,
          providerHealth: { embedding: 'ok', generation: 'ok', keyword: 'ok', vector: 'ok' },
          warnings: []
        },
        createdBy: 'user_1',
        createdAt: '2026-05-04T00:00:00.000Z',
        updatedAt: '2026-05-04T00:00:00.000Z'
      },
      {
        id: 'kb_sales',
        workspaceId: 'workspace_1',
        name: '销售资料库',
        description: '销售资料',
        tags: ['销售'],
        visibility: 'workspace',
        status: 'active',
        documentCount: 4,
        chunkCount: 24,
        readyDocumentCount: 2,
        failedDocumentCount: 2,
        health: {
          knowledgeBaseId: 'kb_sales',
          status: 'degraded',
          documentCount: 4,
          searchableDocumentCount: 2,
          chunkCount: 24,
          failedJobCount: 2,
          providerHealth: { embedding: 'degraded', generation: 'ok', keyword: 'ok', vector: 'degraded' },
          warnings: [{ code: 'failed_jobs', message: '存在失败入库任务' }]
        },
        createdBy: 'user_1',
        createdAt: '2026-05-04T00:00:00.000Z',
        updatedAt: '2026-05-04T00:00:00.000Z'
      }
    ]
  });

  render(
    <KnowledgeApiProvider client={api}>
      <KnowledgeBasesPage />
    </KnowledgeApiProvider>
  );

  expect(await screen.findByText('产品技术文档库')).toBeInTheDocument();
  await userEvent.type(screen.getByPlaceholderText('搜索知识库'), '销售');
  await userEvent.click(screen.getByRole('button', { name: 'degraded' }));

  expect(screen.queryByText('产品技术文档库')).not.toBeInTheDocument();
  expect(screen.getByText('销售资料库')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm --dir apps/frontend/knowledge test -- knowledge-production-workflows.test.tsx
```

Expected: FAIL because the search placeholder and health filter buttons do not exist.

- [ ] **Step 3: Implement keyword and health filters in KnowledgeBasesPage**

Modify `apps/frontend/knowledge/src/pages/knowledge-bases/knowledge-bases-page.tsx`:

```tsx
const healthFilters = ['all', 'ready', 'indexing', 'degraded', 'empty', 'error'] as const;
type HealthFilter = (typeof healthFilters)[number];

function matchesKnowledgeBaseFilter(record: KnowledgeBase, keyword: string, healthFilter: HealthFilter) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  const matchesKeyword =
    !normalizedKeyword ||
    record.name.toLowerCase().includes(normalizedKeyword) ||
    record.description?.toLowerCase().includes(normalizedKeyword) ||
    record.tags.some(tag => tag.toLowerCase().includes(normalizedKeyword));
  const matchesHealth = healthFilter === 'all' || record.health?.status === healthFilter;
  return matchesKeyword && matchesHealth;
}
```

Inside `KnowledgeBasesPage`, add state and filtered data:

```tsx
const [keyword, setKeyword] = useState('');
const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');
const filteredKnowledgeBases = knowledgeBases.filter(record =>
  matchesKnowledgeBaseFilter(record, keyword, healthFilter)
);
```

Replace the `PageSection` extra with:

```tsx
extra={
  <Space wrap>
    <Input.Search
      allowClear
      onChange={event => setKeyword(event.target.value)}
      placeholder="搜索知识库"
      style={{ width: 260 }}
      value={keyword}
    />
    <Space.Compact>
      {healthFilters.map(filter => (
        <Button
          key={filter}
          onClick={() => setHealthFilter(filter)}
          type={healthFilter === filter ? 'primary' : 'default'}
        >
          {filter}
        </Button>
      ))}
    </Space.Compact>
    <Button icon={<PlusOutlined />} onClick={() => setCreateOpen(true)} type="primary">
      新建知识库
    </Button>
  </Space>
}
```

Change table `dataSource`:

```tsx
dataSource = { filteredKnowledgeBases };
```

- [ ] **Step 4: Add drag upload affordance to DocumentsPage modal**

Modify `apps/frontend/knowledge/src/pages/documents/documents-page.tsx` imports:

```tsx
import { InboxOutlined } from '@ant-design/icons';
import { Upload } from 'antd';
```

Replace the modal upload button with:

```tsx
<Upload.Dragger
  accept=".md,.markdown,.txt,text/markdown,text/plain"
  beforeUpload={file => {
    if (selectedKnowledgeBaseId && selectedEmbeddingModelId) {
      void upload.upload(file).then(uploaded => {
        if (uploaded) {
          setUploadModalOpen(false);
          void reload();
        }
      });
    }
    return false;
  }}
  disabled={!selectedKnowledgeBaseId || !selectedEmbeddingModelId || uploadBusy}
  maxCount={1}
  showUploadList={false}
>
  <p className="ant-upload-drag-icon">
    <InboxOutlined />
  </p>
  <p className="ant-upload-text">拖拽 Markdown/TXT 到此处</p>
  <p className="ant-upload-hint">文件会先上传到后端，再创建文档入库任务。</p>
</Upload.Dragger>
```

Keep the hidden file input only if another test still depends on `aria-label="选择上传文档"`; otherwise remove `fileInputRef` and `handleFileChange`.

- [ ] **Step 5: Verify tests pass**

Run:

```bash
pnpm --dir apps/frontend/knowledge test -- knowledge-production-workflows.test.tsx knowledge-upload-flow.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/frontend/knowledge/src/pages/knowledge-bases/knowledge-bases-page.tsx apps/frontend/knowledge/src/pages/documents/documents-page.tsx apps/frontend/knowledge/src/pages/documents/document-upload-panel.tsx apps/frontend/knowledge/src/styles/knowledge-pro.css apps/frontend/knowledge/test/knowledge-production-workflows.test.tsx apps/frontend/knowledge/test/knowledge-upload-flow.test.tsx
git commit -m "feat: refine knowledge operations workspace"
```

## Task 5: Define Agent Admin Knowledge Governance Projection

**Files:**

- Create: `docs/contracts/api/knowledge-admin-governance.md`
- Modify: `packages/core/src/contracts/knowledge-service/knowledge-service.schemas.ts`
- Modify: `packages/core/src/contracts/knowledge-service/knowledge-service.types.ts`
- Modify: `packages/core/src/contracts/knowledge-service/index.ts`
- Test: `packages/core/test/knowledge-governance-contracts.test.ts`

- [ ] **Step 1: Write the failing core contract test**

Create `packages/core/test/knowledge-governance-contracts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { KnowledgeGovernanceProjectionSchema } from '../src/contracts/knowledge-service';

describe('knowledge governance projection contract', () => {
  it('parses admin governance summary without raw vendor payloads', () => {
    const parsed = KnowledgeGovernanceProjectionSchema.parse({
      summary: {
        knowledgeBaseCount: 3,
        documentCount: 42,
        readyDocumentCount: 38,
        failedJobCount: 2,
        warningCount: 1
      },
      providerHealth: [
        { provider: 'embedding', status: 'ok', warningCount: 0 },
        { provider: 'vector', status: 'degraded', warningCount: 1, reason: 'vector provider latency high' }
      ],
      ingestionSources: [
        {
          id: 'source_uploads',
          label: '用户上传',
          sourceType: 'user-upload',
          status: 'active',
          indexedDocumentCount: 12,
          failedDocumentCount: 1
        }
      ],
      retrievalDiagnostics: [
        {
          id: 'diag_latest',
          query: '产品资料',
          retrievalMode: 'hybrid',
          hitCount: 8,
          totalCount: 12,
          failedRetrieverCount: 0
        }
      ],
      agentUsage: [
        {
          agentId: 'company-live',
          agentLabel: '公司直播专员',
          knowledgeBaseIds: ['kb_1'],
          recentRunCount: 4,
          evidenceCount: 9
        }
      ],
      updatedAt: '2026-05-04T00:00:00.000Z'
    });

    expect(parsed.summary.knowledgeBaseCount).toBe(3);
    expect(parsed.agentUsage[0]?.agentId).toBe('company-live');
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm exec vitest run packages/core/test/knowledge-governance-contracts.test.ts
```

Expected: FAIL because `KnowledgeGovernanceProjectionSchema` is not exported.

- [ ] **Step 3: Add schema and inferred types**

Modify `packages/core/src/contracts/knowledge-service/knowledge-service.schemas.ts`:

```ts
export const KnowledgeGovernanceSummarySchema = z.object({
  knowledgeBaseCount: z.number().int().nonnegative(),
  documentCount: z.number().int().nonnegative(),
  readyDocumentCount: z.number().int().nonnegative(),
  failedJobCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative()
});

export const KnowledgeGovernanceProviderHealthSchema = z.object({
  provider: z.enum(['embedding', 'vector', 'keyword', 'generation']),
  status: KnowledgeProviderHealthStatusSchema,
  warningCount: z.number().int().nonnegative(),
  reason: z.string().optional()
});

export const KnowledgeGovernanceIngestionSourceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  sourceType: z.string().min(1),
  status: z.enum(['active', 'paused', 'failed', 'unknown']),
  indexedDocumentCount: z.number().int().nonnegative(),
  failedDocumentCount: z.number().int().nonnegative()
});

export const KnowledgeGovernanceRetrievalDiagnosticSchema = z.object({
  id: z.string().min(1),
  query: z.string().min(1),
  retrievalMode: z.string().min(1),
  hitCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  failedRetrieverCount: z.number().int().nonnegative()
});

export const KnowledgeGovernanceAgentUsageSchema = z.object({
  agentId: z.string().min(1),
  agentLabel: z.string().min(1),
  knowledgeBaseIds: z.array(z.string().min(1)),
  recentRunCount: z.number().int().nonnegative(),
  evidenceCount: z.number().int().nonnegative()
});

export const KnowledgeGovernanceProjectionSchema = z.object({
  summary: KnowledgeGovernanceSummarySchema,
  providerHealth: z.array(KnowledgeGovernanceProviderHealthSchema),
  ingestionSources: z.array(KnowledgeGovernanceIngestionSourceSchema),
  retrievalDiagnostics: z.array(KnowledgeGovernanceRetrievalDiagnosticSchema),
  agentUsage: z.array(KnowledgeGovernanceAgentUsageSchema),
  updatedAt: z.string().datetime()
});
```

If `KnowledgeProviderHealthStatusSchema` is not in `packages/core`, add:

```ts
export const KnowledgeProviderHealthStatusSchema = z.enum(['ok', 'degraded', 'unconfigured']);
```

Modify `packages/core/src/contracts/knowledge-service/knowledge-service.types.ts`:

```ts
(KnowledgeGovernanceAgentUsageSchema,
  KnowledgeGovernanceIngestionSourceSchema,
  KnowledgeGovernanceProjectionSchema,
  KnowledgeGovernanceProviderHealthSchema,
  KnowledgeGovernanceRetrievalDiagnosticSchema,
  KnowledgeGovernanceSummarySchema);
```

Add types:

```ts
export type KnowledgeGovernanceSummary = z.infer<typeof KnowledgeGovernanceSummarySchema>;
export type KnowledgeGovernanceProviderHealth = z.infer<typeof KnowledgeGovernanceProviderHealthSchema>;
export type KnowledgeGovernanceIngestionSource = z.infer<typeof KnowledgeGovernanceIngestionSourceSchema>;
export type KnowledgeGovernanceRetrievalDiagnostic = z.infer<typeof KnowledgeGovernanceRetrievalDiagnosticSchema>;
export type KnowledgeGovernanceAgentUsage = z.infer<typeof KnowledgeGovernanceAgentUsageSchema>;
export type KnowledgeGovernanceProjection = z.infer<typeof KnowledgeGovernanceProjectionSchema>;
```

- [ ] **Step 4: Document admin governance API**

Create `docs/contracts/api/knowledge-admin-governance.md`:

```md
# Knowledge Admin Governance API

状态：planned
文档类型：reference
适用范围：`apps/frontend/agent-admin`、`apps/backend/agent-server`、`packages/core`
最后核对：2026-05-04

`agent-admin` 的知识治理中心只消费 redacted projection，不消费 knowledge-server raw repository records、vendor response、SDK error、向量数据库 raw payload 或未脱敏文档内容。

## Endpoint

| Method | Path                                 | Response                        | 权限  |
| ------ | ------------------------------------ | ------------------------------- | ----- |
| GET    | `/api/platform/knowledge/governance` | `KnowledgeGovernanceProjection` | admin |

## Projection

`KnowledgeGovernanceProjection` 由 `@agent/core` 的 `KnowledgeGovernanceProjectionSchema` 定义。字段包括：

- `summary`：知识库、文档、ready 文档、失败 job、warning 数。
- `providerHealth`：embedding、vector、keyword、generation 的健康投影。
- `ingestionSources`：user-upload、catalog-sync、connector-manifest、web-curated 等来源摘要。
- `retrievalDiagnostics`：最近检索诊断摘要，只展示 query、mode、hit/total、失败 retriever 数。
- `agentUsage`：agent 使用知识库和 evidence 的治理摘要。

## Error Semantics

- `401 auth_unauthorized`：未登录。
- `403 auth_forbidden`：非 admin 用户。
- `500 internal_error`：projection 聚合失败。错误响应必须脱敏。
```

- [ ] **Step 5: Verify contract tests pass**

Run:

```bash
pnpm exec vitest run packages/core/test/knowledge-governance-contracts.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add docs/contracts/api/knowledge-admin-governance.md packages/core/src/contracts/knowledge-service/knowledge-service.schemas.ts packages/core/src/contracts/knowledge-service/knowledge-service.types.ts packages/core/src/contracts/knowledge-service/index.ts packages/core/test/knowledge-governance-contracts.test.ts
git commit -m "feat: define knowledge governance projection"
```

## Task 6: Build Agent Admin Knowledge Governance Center

**Files:**

- Modify: `apps/frontend/agent-admin/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/frontend/agent-admin/src/hooks/admin-dashboard/admin-dashboard-constants.ts`
- Modify: `apps/frontend/agent-admin/src/pages/dashboard/dashboard-center-content.tsx`
- Modify: `apps/frontend/agent-admin/src/api/admin-api-platform.ts`
- Create: `apps/frontend/agent-admin/src/pages/knowledge-governance/knowledge-governance-types.ts`
- Create: `apps/frontend/agent-admin/src/pages/knowledge-governance/knowledge-governance-panel.tsx`
- Create: `apps/frontend/agent-admin/src/pages/knowledge-governance/knowledge-governance-summary.tsx`
- Create: `apps/frontend/agent-admin/src/pages/knowledge-governance/knowledge-governance-flow-canvas.tsx`
- Create: `apps/frontend/agent-admin/src/pages/knowledge-governance/knowledge-governance-node.tsx`
- Create: `apps/frontend/agent-admin/src/pages/knowledge-governance/knowledge-governance-diagnostics.tsx`
- Test: `apps/frontend/agent-admin/test/pages/knowledge-governance/knowledge-governance-panel.test.tsx`
- Test: `apps/frontend/agent-admin/test/pages/knowledge-governance/knowledge-governance-flow-canvas.test.tsx`

- [ ] **Step 1: Install React Flow for agent-admin**

Run:

```bash
pnpm --dir apps/frontend/agent-admin add @xyflow/react
```

Expected: `apps/frontend/agent-admin/package.json` contains `@xyflow/react`, and `pnpm-lock.yaml` changes.

- [ ] **Step 2: Write failing panel test**

Create `apps/frontend/agent-admin/test/pages/knowledge-governance/knowledge-governance-panel.test.tsx`:

```tsx
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { KnowledgeGovernancePanel } from '../../../src/pages/knowledge-governance/knowledge-governance-panel';

const projection = {
  summary: {
    knowledgeBaseCount: 3,
    documentCount: 42,
    readyDocumentCount: 38,
    failedJobCount: 2,
    warningCount: 1
  },
  providerHealth: [
    { provider: 'embedding', status: 'ok', warningCount: 0 },
    { provider: 'vector', status: 'degraded', warningCount: 1, reason: 'vector provider latency high' }
  ],
  ingestionSources: [
    {
      id: 'source_uploads',
      label: '用户上传',
      sourceType: 'user-upload',
      status: 'active',
      indexedDocumentCount: 12,
      failedDocumentCount: 1
    }
  ],
  retrievalDiagnostics: [
    {
      id: 'diag_latest',
      query: '产品资料',
      retrievalMode: 'hybrid',
      hitCount: 8,
      totalCount: 12,
      failedRetrieverCount: 0
    }
  ],
  agentUsage: [
    {
      agentId: 'company-live',
      agentLabel: '公司直播专员',
      knowledgeBaseIds: ['kb_1'],
      recentRunCount: 4,
      evidenceCount: 9
    }
  ],
  updatedAt: '2026-05-04T00:00:00.000Z'
};

describe('KnowledgeGovernancePanel', () => {
  it('renders governance summary and diagnostics', () => {
    const html = renderToString(
      <KnowledgeGovernancePanel projection={projection} loading={false} onRefresh={vi.fn()} />
    );

    expect(html).toContain('知识治理');
    expect(html).toContain('知识库');
    expect(html).toContain('42');
    expect(html).toContain('用户上传');
    expect(html).toContain('公司直播专员');
  });
});
```

- [ ] **Step 3: Write failing canvas test**

Create `apps/frontend/agent-admin/test/pages/knowledge-governance/knowledge-governance-flow-canvas.test.tsx`:

```tsx
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { KnowledgeGovernanceFlowCanvas } from '../../../src/pages/knowledge-governance/knowledge-governance-flow-canvas';

describe('KnowledgeGovernanceFlowCanvas', () => {
  it('renders source, index, retrieval, evidence and agent governance nodes', () => {
    const html = renderToString(
      <KnowledgeGovernanceFlowCanvas
        projection={{
          summary: {
            knowledgeBaseCount: 1,
            documentCount: 2,
            readyDocumentCount: 2,
            failedJobCount: 0,
            warningCount: 0
          },
          providerHealth: [],
          ingestionSources: [
            {
              id: 'source_uploads',
              label: '用户上传',
              sourceType: 'user-upload',
              status: 'active',
              indexedDocumentCount: 2,
              failedDocumentCount: 0
            }
          ],
          retrievalDiagnostics: [],
          agentUsage: [
            {
              agentId: 'company-live',
              agentLabel: '公司直播专员',
              knowledgeBaseIds: ['kb_1'],
              recentRunCount: 1,
              evidenceCount: 2
            }
          ],
          updatedAt: '2026-05-04T00:00:00.000Z'
        }}
      />
    );

    expect(html).toContain('用户上传');
    expect(html).toContain('索引');
    expect(html).toContain('检索诊断');
    expect(html).toContain('证据');
    expect(html).toContain('公司直播专员');
  });
});
```

- [ ] **Step 4: Run failing tests**

Run:

```bash
pnpm --dir apps/frontend/agent-admin exec vitest run ../../apps/frontend/agent-admin/test/pages/knowledge-governance
```

Expected: FAIL because knowledge governance files do not exist.

- [ ] **Step 5: Add admin local types**

Create `apps/frontend/agent-admin/src/pages/knowledge-governance/knowledge-governance-types.ts`:

```ts
import type { KnowledgeGovernanceProjection } from '@agent/core';

export type AdminKnowledgeGovernanceProjection = KnowledgeGovernanceProjection;
```

- [ ] **Step 6: Add API method**

Modify `apps/frontend/agent-admin/src/api/admin-api-platform.ts`:

```ts
import type { KnowledgeGovernanceProjection } from '@agent/core';
import { request } from './admin-api-core';

export function getKnowledgeGovernanceProjection() {
  return request<KnowledgeGovernanceProjection>('/platform/knowledge/governance');
}
```

If the file already imports `request`, reuse the existing import and only add the function/type import.

- [ ] **Step 7: Add summary component**

Create `apps/frontend/agent-admin/src/pages/knowledge-governance/knowledge-governance-summary.tsx`:

```tsx
import { DashboardMetricGrid } from '@/components/dashboard-center-shell';
import type { AdminKnowledgeGovernanceProjection } from './knowledge-governance-types';

export function KnowledgeGovernanceSummary({ projection }: { projection: AdminKnowledgeGovernanceProjection }) {
  return (
    <DashboardMetricGrid
      columns="md:grid-cols-2 xl:grid-cols-5"
      items={[
        { label: '知识库', value: projection.summary.knowledgeBaseCount },
        { label: '文档', value: projection.summary.documentCount },
        { label: 'Ready 文档', value: projection.summary.readyDocumentCount },
        { label: '失败 Job', value: projection.summary.failedJobCount },
        { label: 'Warnings', value: projection.summary.warningCount }
      ]}
    />
  );
}
```

- [ ] **Step 8: Add governance node and canvas**

Create `apps/frontend/agent-admin/src/pages/knowledge-governance/knowledge-governance-node.tsx`:

```tsx
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Badge } from '@/components/ui/badge';

export interface KnowledgeGovernanceNodeData extends Record<string, unknown> {
  label: string;
  detail: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
}

export const KnowledgeGovernanceNode = memo(function KnowledgeGovernanceNode({ data }: NodeProps) {
  const nodeData = data as KnowledgeGovernanceNodeData;
  const variant = nodeData.tone === 'danger' ? 'destructive' : nodeData.tone === 'success' ? 'success' : 'outline';

  return (
    <div className="min-w-44 rounded-xl border border-border/70 bg-card px-4 py-3 shadow-sm">
      <Handle position={Position.Left} type="target" />
      <div className="grid gap-2">
        <p className="text-sm font-semibold text-foreground">{nodeData.label}</p>
        <p className="text-xs text-muted-foreground">{nodeData.detail}</p>
        <Badge variant={variant}>{nodeData.tone}</Badge>
      </div>
      <Handle position={Position.Right} type="source" />
    </div>
  );
});
```

Create `apps/frontend/agent-admin/src/pages/knowledge-governance/knowledge-governance-flow-canvas.tsx`:

```tsx
import { useMemo } from 'react';
import { Background, Controls, ReactFlow, type Edge, type Node, type NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { AdminKnowledgeGovernanceProjection } from './knowledge-governance-types';
import { KnowledgeGovernanceNode, type KnowledgeGovernanceNodeData } from './knowledge-governance-node';

const nodeTypes: NodeTypes = {
  knowledgeGovernance: KnowledgeGovernanceNode
};

export function KnowledgeGovernanceFlowCanvas({ projection }: { projection: AdminKnowledgeGovernanceProjection }) {
  const firstSource = projection.ingestionSources[0];
  const firstAgent = projection.agentUsage[0];
  const hasWarning = projection.summary.warningCount > 0 || projection.summary.failedJobCount > 0;

  const nodes = useMemo<Node<KnowledgeGovernanceNodeData>[]>(
    () => [
      {
        id: 'source',
        type: 'knowledgeGovernance',
        position: { x: 0, y: 120 },
        data: {
          label: firstSource?.label ?? '知识来源',
          detail: firstSource ? `${firstSource.sourceType} · failed ${firstSource.failedDocumentCount}` : '暂无来源',
          tone: firstSource?.failedDocumentCount ? 'warning' : 'success'
        }
      },
      {
        id: 'index',
        type: 'knowledgeGovernance',
        position: { x: 260, y: 120 },
        data: {
          label: '索引',
          detail: `${projection.summary.readyDocumentCount}/${projection.summary.documentCount} ready`,
          tone: hasWarning ? 'warning' : 'success'
        }
      },
      {
        id: 'retrieval',
        type: 'knowledgeGovernance',
        position: { x: 520, y: 120 },
        data: {
          label: '检索诊断',
          detail: `${projection.retrievalDiagnostics.length} recent diagnostics`,
          tone: projection.retrievalDiagnostics.some(item => item.failedRetrieverCount > 0) ? 'warning' : 'neutral'
        }
      },
      {
        id: 'evidence',
        type: 'knowledgeGovernance',
        position: { x: 780, y: 40 },
        data: {
          label: '证据',
          detail: `${firstAgent?.evidenceCount ?? 0} evidence records`,
          tone: 'neutral'
        }
      },
      {
        id: 'agent',
        type: 'knowledgeGovernance',
        position: { x: 780, y: 200 },
        data: {
          label: firstAgent?.agentLabel ?? 'Agent 使用',
          detail: `${firstAgent?.recentRunCount ?? 0} recent runs`,
          tone: 'neutral'
        }
      }
    ],
    [firstAgent, firstSource, hasWarning, projection.retrievalDiagnostics.length, projection.summary]
  );

  const edges = useMemo<Edge[]>(
    () => [
      { id: 'source-index', source: 'source', target: 'index', animated: true },
      { id: 'index-retrieval', source: 'index', target: 'retrieval', animated: true },
      { id: 'retrieval-evidence', source: 'retrieval', target: 'evidence', animated: true },
      { id: 'retrieval-agent', source: 'retrieval', target: 'agent', animated: true }
    ],
    []
  );

  return (
    <div className="h-[420px] overflow-hidden rounded-xl border border-border/70 bg-background">
      <ReactFlow edges={edges} fitView nodes={nodes} nodeTypes={nodeTypes}>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
```

- [ ] **Step 9: Add diagnostics component**

Create `apps/frontend/agent-admin/src/pages/knowledge-governance/knowledge-governance-diagnostics.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AdminKnowledgeGovernanceProjection } from './knowledge-governance-types';

export function KnowledgeGovernanceDiagnostics({ projection }: { projection: AdminKnowledgeGovernanceProjection }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Provider Health</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {projection.providerHealth.map(item => (
            <div key={item.provider} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <span className="text-sm text-foreground">{item.provider}</span>
              <Badge variant={item.status === 'ok' ? 'success' : 'warning'}>{item.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Ingestion Sources</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {projection.ingestionSources.map(item => (
            <div key={item.id} className="rounded-lg border px-3 py-2">
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground">
                {item.sourceType} · indexed {item.indexedDocumentCount} · failed {item.failedDocumentCount}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Agent Usage</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {projection.agentUsage.map(item => (
            <div key={item.agentId} className="rounded-lg border px-3 py-2">
              <p className="text-sm font-medium text-foreground">{item.agentLabel}</p>
              <p className="text-xs text-muted-foreground">
                runs {item.recentRunCount} · evidence {item.evidenceCount}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 10: Add panel component**

Create `apps/frontend/agent-admin/src/pages/knowledge-governance/knowledge-governance-panel.tsx`:

```tsx
import { Button } from '@/components/ui/button';
import { DashboardCenterShell, DashboardEmptyState } from '@/components/dashboard-center-shell';
import { KnowledgeGovernanceDiagnostics } from './knowledge-governance-diagnostics';
import { KnowledgeGovernanceFlowCanvas } from './knowledge-governance-flow-canvas';
import { KnowledgeGovernanceSummary } from './knowledge-governance-summary';
import type { AdminKnowledgeGovernanceProjection } from './knowledge-governance-types';

export function KnowledgeGovernancePanel({
  loading,
  projection,
  onRefresh
}: {
  loading: boolean;
  projection?: AdminKnowledgeGovernanceProjection | null;
  onRefresh: () => void;
}) {
  return (
    <DashboardCenterShell
      title="知识治理"
      description="治理知识库健康、ingestion 来源、检索诊断、证据链和 agent 使用情况。"
      count={projection?.summary.knowledgeBaseCount ?? 0}
      actions={
        <Button type="button" size="sm" variant="outline" onClick={onRefresh} disabled={loading}>
          刷新
        </Button>
      }
    >
      {!projection ? <DashboardEmptyState message={loading ? '正在加载知识治理投影。' : '暂无知识治理投影。'} /> : null}
      {projection ? (
        <div className="grid gap-6">
          <KnowledgeGovernanceSummary projection={projection} />
          <KnowledgeGovernanceFlowCanvas projection={projection} />
          <KnowledgeGovernanceDiagnostics projection={projection} />
        </div>
      ) : null}
    </DashboardCenterShell>
  );
}
```

- [ ] **Step 11: Wire dashboard page key**

Modify `apps/frontend/agent-admin/src/hooks/admin-dashboard/admin-dashboard-constants.ts`:

```ts
export const PAGE_KEYS: DashboardPageKey[] = [
  'runtime',
  'approvals',
  'learning',
  'workspace',
  'memory',
  'profiles',
  'evals',
  'archives',
  'skills',
  'evidence',
  'connectors',
  'skillSources',
  'companyAgents',
  'knowledgeGovernance',
  'workflowLab'
];

export const PAGE_TITLES = {
  ...ADMIN_RUNTIME_PAGE_TITLES,
  knowledgeGovernance: '知识治理',
  memory: '记忆中枢',
  profiles: '画像中枢',
  workflowLab: '工作流实验室'
} satisfies Record<DashboardPageKey, string>;
```

If `DashboardPageKey` is a union derived elsewhere, add `'knowledgeGovernance'` to that schema/type first and update its test.

- [ ] **Step 12: Wire dashboard content**

Modify `apps/frontend/agent-admin/src/pages/dashboard/dashboard-center-content.tsx` imports:

```tsx
import { getKnowledgeGovernanceProjection } from '@/api/admin-api-platform';
import { KnowledgeGovernancePanel } from '@/pages/knowledge-governance/knowledge-governance-panel';
import type { KnowledgeGovernanceProjection } from '@agent/core';
```

Add local state near the top of `renderDashboardCenter` is not possible because it is not a component. Instead, create a nested component below `WorkspaceDashboardCenter`:

```tsx
function KnowledgeGovernanceDashboardCenter() {
  const [projection, setProjection] = useState<KnowledgeGovernanceProjection | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      setProjection(await getKnowledgeGovernanceProjection());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return <KnowledgeGovernancePanel projection={projection} loading={loading} onRefresh={refresh} />;
}
```

Add switch case:

```tsx
case 'knowledgeGovernance':
  return <KnowledgeGovernanceDashboardCenter />;
```

- [ ] **Step 13: Verify admin tests pass**

Run:

```bash
pnpm --dir apps/frontend/agent-admin exec vitest run ../../apps/frontend/agent-admin/test/pages/knowledge-governance
```

Expected: PASS.

- [ ] **Step 14: Commit**

Run:

```bash
git add apps/frontend/agent-admin/package.json pnpm-lock.yaml apps/frontend/agent-admin/src/hooks/admin-dashboard/admin-dashboard-constants.ts apps/frontend/agent-admin/src/pages/dashboard/dashboard-center-content.tsx apps/frontend/agent-admin/src/api/admin-api-platform.ts apps/frontend/agent-admin/src/pages/knowledge-governance apps/frontend/agent-admin/test/pages/knowledge-governance
git commit -m "feat: add admin knowledge governance center"
```

## Task 7: Backend Projection Adapter for Agent Admin

**Files:**

- Create: `apps/backend/agent-server/src/platform/knowledge-governance.controller.ts`
- Create: `apps/backend/agent-server/src/runtime/services/runtime-knowledge-governance.service.ts`
- Modify: `apps/backend/agent-server/src/platform/platform.module.ts`
- Test: `apps/backend/agent-server/test/platform/knowledge-governance.controller.spec.ts`

- [ ] **Step 1: Write failing backend controller test**

Create `apps/backend/agent-server/test/platform/knowledge-governance.controller.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { KnowledgeGovernanceProjectionSchema } from '@agent/core';
import { RuntimeKnowledgeGovernanceService } from '../../src/runtime/services/runtime-knowledge-governance.service';

describe('RuntimeKnowledgeGovernanceService', () => {
  it('builds a redacted governance projection', async () => {
    const service = new RuntimeKnowledgeGovernanceService();
    const projection = await service.getProjection();

    const parsed = KnowledgeGovernanceProjectionSchema.parse(projection);
    expect(parsed.summary.knowledgeBaseCount).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(parsed)).not.toContain('apiKey');
    expect(JSON.stringify(parsed)).not.toContain('rawResponse');
  });
});
```

- [ ] **Step 2: Run the failing backend test**

Run:

```bash
pnpm --dir apps/backend/agent-server exec vitest run test/platform/knowledge-governance.controller.spec.ts
```

Expected: FAIL because `RuntimeKnowledgeGovernanceService` does not exist.

- [ ] **Step 3: Implement the projection service**

Create `apps/backend/agent-server/src/runtime/services/runtime-knowledge-governance.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { KnowledgeGovernanceProjection } from '@agent/core';

@Injectable()
export class RuntimeKnowledgeGovernanceService {
  async getProjection(): Promise<KnowledgeGovernanceProjection> {
    return {
      summary: {
        knowledgeBaseCount: 0,
        documentCount: 0,
        readyDocumentCount: 0,
        failedJobCount: 0,
        warningCount: 0
      },
      providerHealth: [
        { provider: 'embedding', status: 'unconfigured', warningCount: 0 },
        { provider: 'vector', status: 'unconfigured', warningCount: 0 },
        { provider: 'keyword', status: 'unconfigured', warningCount: 0 },
        { provider: 'generation', status: 'unconfigured', warningCount: 0 }
      ],
      ingestionSources: [],
      retrievalDiagnostics: [],
      agentUsage: [],
      updatedAt: new Date().toISOString()
    };
  }
}
```

This is a safe MVP projection. In a later task, wire real aggregates from runtime center and knowledge-server; do not read raw vector store records in the controller.

- [ ] **Step 4: Add controller**

Create `apps/backend/agent-server/src/platform/knowledge-governance.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';
import { KnowledgeGovernanceProjectionSchema } from '@agent/core';

import { RuntimeKnowledgeGovernanceService } from '../runtime/services/runtime-knowledge-governance.service';

@Controller('platform/knowledge')
export class KnowledgeGovernanceController {
  constructor(private readonly service: RuntimeKnowledgeGovernanceService) {}

  @Get('governance')
  async getGovernance() {
    return KnowledgeGovernanceProjectionSchema.parse(await this.service.getProjection());
  }
}
```

- [ ] **Step 5: Wire module**

Modify `apps/backend/agent-server/src/platform/platform.module.ts`:

```ts
import { KnowledgeGovernanceController } from './knowledge-governance.controller';
import { RuntimeKnowledgeGovernanceService } from '../runtime/services/runtime-knowledge-governance.service';

@Module({
  controllers: [KnowledgeGovernanceController],
  providers: [RuntimeKnowledgeGovernanceService]
})
export class PlatformModule {}
```

Preserve existing controllers/providers in the arrays and append these entries.

- [ ] **Step 6: Verify backend test passes**

Run:

```bash
pnpm --dir apps/backend/agent-server exec vitest run test/platform/knowledge-governance.controller.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/backend/agent-server/src/platform/knowledge-governance.controller.ts apps/backend/agent-server/src/runtime/services/runtime-knowledge-governance.service.ts apps/backend/agent-server/src/platform/platform.module.ts apps/backend/agent-server/test/platform/knowledge-governance.controller.spec.ts
git commit -m "feat: expose knowledge governance projection"
```

## Task 8: Documentation and Final Verification

**Files:**

- Modify: `docs/apps/frontend/knowledge/knowledge-frontend.md`
- Modify: `docs/apps/frontend/agent-admin/README.md`
- Modify: `docs/apps/frontend/agent-admin/overview.md`
- Modify: `docs/contracts/api/README.md`

- [ ] **Step 1: Update knowledge frontend docs**

Add to `docs/apps/frontend/knowledge/knowledge-frontend.md` under “页面工作流”:

```md
- `AgentFlowPage`：读取 `listAgentFlows()` 展示智能代理流程画布。画布使用 `@xyflow/react`，但持久化时只保存 `@agent/knowledge` 的 `KnowledgeAgentFlow` contract，不保存 React Flow vendor 对象。默认节点类型包括输入、意图识别、知识检索、重排、模型生成、审批门、连接器动作和输出。运行流程调用 `/knowledge/agent-flows/:flowId/run`，返回 run id 与 trace id 后只展示稳定状态，不展示 raw provider payload。
```

- [ ] **Step 2: Update agent-admin docs**

Add to `docs/apps/frontend/agent-admin/README.md` current implementation list:

```md
- `src/pages/knowledge-governance`
  - 知识治理中心，展示知识库健康、provider health、ingestion 来源、检索诊断、证据与 agent 使用链路。该页面只消费 `KnowledgeGovernanceProjection`，不得读取 raw knowledge-server repository records、vendor response 或未脱敏文档内容。
```

Add to `docs/apps/frontend/agent-admin/overview.md`:

```md
## Knowledge Governance

知识治理中心是 admin 侧治理入口，不是 `apps/frontend/knowledge` 的产品页复制。它聚合知识库健康、索引/ingestion 状态、retrieval diagnostics、evidence 和 agent usage，用于排查运行时是否能安全、可追溯地使用知识。
```

- [ ] **Step 3: Update API docs index**

Modify `docs/contracts/api/README.md` to include:

```md
- Knowledge Admin Governance: `knowledge-admin-governance.md`
```

- [ ] **Step 4: Run focused verification**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/knowledge-agent-flow-contracts.test.ts packages/core/test/knowledge-governance-contracts.test.ts
pnpm --dir apps/frontend/knowledge test -- knowledge-agent-flow-page.test.tsx knowledge-real-api-paths.test.ts knowledge-production-workflows.test.tsx knowledge-upload-flow.test.tsx
pnpm --dir apps/frontend/agent-admin exec vitest run ../../apps/frontend/agent-admin/test/pages/knowledge-governance
pnpm --dir apps/backend/agent-server exec vitest run test/platform/knowledge-governance.controller.spec.ts
pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit
pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm check:docs
```

Expected: all commands PASS.

- [ ] **Step 5: Run package-level verification for touched packages**

Run:

```bash
pnpm build:lib
pnpm --dir apps/backend/agent-server build
```

Expected: both commands PASS. If either command fails from an unrelated existing red light, capture the error, keep the focused verification results, and document the blocker in the delivery note.

- [ ] **Step 6: Commit docs and verification updates**

Run:

```bash
git add docs/apps/frontend/knowledge/knowledge-frontend.md docs/apps/frontend/agent-admin/README.md docs/apps/frontend/agent-admin/overview.md docs/contracts/api/README.md
git commit -m "docs: document knowledge agent flow governance"
```

## Self-Review

- Spec coverage:
  - `apps/frontend/knowledge`：Task 1-4 覆盖 contract、API boundary、React Flow 智能代理页、知识库筛选与上传体验。
  - `apps/frontend/agent-admin`：Task 5-7 覆盖治理 projection、React Flow 治理中心、后端 projection endpoint。
  - 文档与验证：Task 8 覆盖 knowledge/admin/API 文档和受影响验证。
- Placeholder scan:
  - 本计划不使用 TBD/TODO/implement later。
  - 每个新增文件都有明确代码骨架。
  - 每个测试步骤都有命令和期望结果。
- Type consistency:
  - `KnowledgeAgentFlow*` 类型从 `@agent/knowledge` schema 推导。
  - `KnowledgeGovernanceProjection` 从 `@agent/core` schema 推导。
  - 前端本地类型仅做 alias 或 view model，不重新定义长期公共 contract。

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-04-knowledge-agent-flow-admin-sync.md`. Two execution options:

1. **Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
