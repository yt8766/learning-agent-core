# Company Live MVP 端到端打通计划（含节点执行轨迹）

状态：completed
文档类型：plan
适用范围：`agents/company-live`、`apps/backend/agent-server`、`apps/frontend/agent-admin`
最后核对：2026-04-29

---

## 背景

`2026-04-27-media-provider-company-live-v1.md` 已完成合约边界层（core contracts、runtime provider interfaces、adapters/minimax stub、platform-runtime wiring、agents skeleton）。

但端到端流程**完全未打通**：没有 graph、没有后端 endpoint、没有前端触发入口，也没有节点级执行可见性。

本计划双目标：

1. 以 **stub transport（不需要真实 API key）** 打通从前端 → 后端 → agent graph → media providers → 返回结果的完整横向 MVP。
2. graph 执行时**内嵌节点轨迹输出**，前端展示每个节点的输入/输出状态 diff，达到 LangSmith-like 节点可见性。

---

## MVP 范围

### 横向目标（本计划必须完成的）

1. `agents/company-live` 有一个可执行的 graph，接收 `CompanyLiveContentBrief`，调用 audio/image/video stub provider，返回 `GeneratedMediaBundle` **+ 节点执行轨迹**。
2. 后端新增 `POST /company-live/generate` endpoint，接收 brief JSON，调用 graph，返回 bundle + trace JSON。
3. `agent-admin` 的 `company-agents` 页面新增：
   - "生成媒体素材"表单（填写简单 brief，触发 API）
   - bundle 结果展示
   - **节点轨迹面板**（每个节点的名称、耗时、输入 state、输出 state diff）

### 纵向排除（等用户确认流程通了再做）

- 真实 MiniMax HTTP 调用
- 异步轮询 worker / 任务状态追踪
- SSE 流式返回
- 审批门（voice clone 审批）
- 资产持久化到数据库
- Admin 完整媒体中心（Media Center）
- audio/image/video agent 各自独立的 graph
- 通用 Graph Studio（支持任意 graph 的交互式测试）

---

## 架构说明

```
[agent-admin 表单]
    ↓ POST /api/company-live/generate
[CompanyLiveController (NestJS)]
    ↓ companyLiveService.generate(brief)
[CompanyLiveService]
    ↓ executeCompanyLiveGraph(brief, registry)
[company-live.graph.ts]
    ├─ generateAudio node  → trace entry
    ├─ generateImage node  → trace entry
    ├─ generateVideo node  → trace entry
    └─ assembleBundle node → trace entry
→ { bundle: GeneratedMediaBundle, trace: CompanyLiveNodeTrace[] }
    ↑ 返回到前端，展示 bundle + 节点轨迹
```

---

## 节点轨迹数据结构

```ts
interface CompanyLiveNodeTrace {
  nodeId: string;
  status: 'succeeded' | 'failed' | 'skipped';
  durationMs: number;
  inputSnapshot: Record<string, unknown>;
  outputSnapshot: Record<string, unknown>;
  errorMessage?: string;
}

interface CompanyLiveGenerateResult {
  bundle: GeneratedMediaBundle;
  trace: CompanyLiveNodeTrace[];
}
```

---

## 接口定义（先于实现）

### POST /api/company-live/generate

请求体：`CompanyLiveContentBrief` JSON

响应体（200）：

```json
{
  "bundle": { "bundleId": "...", "script": "...", "assetRefs": [...], "reviewFindings": [], "riskWarnings": [], "evidenceRefs": [] },
  "trace": [
    { "nodeId": "generateAudio", "status": "succeeded", "durationMs": 12, "inputSnapshot": { "audioAssetRef": null }, "outputSnapshot": { "audioAssetRef": "asset-audio-stub-1" } },
    { "nodeId": "generateImage", "status": "succeeded", "durationMs": 8, "inputSnapshot": { "imageAssetRef": null }, "outputSnapshot": { "imageAssetRef": "asset-image-stub-1" } },
    { "nodeId": "generateVideo", "status": "succeeded", "durationMs": 15, "inputSnapshot": { "videoAssetRef": null }, "outputSnapshot": { "videoAssetRef": "asset-video-stub-1" } },
    { "nodeId": "assembleBundle", "status": "succeeded", "durationMs": 3, "inputSnapshot": { "audioAssetRef": "...", "imageAssetRef": "...", "videoAssetRef": "..." }, "outputSnapshot": { "bundleId": "...", "assetRefs": [...] } }
  ]
}
```

错误（400）：brief 校验失败。错误（500）：graph 执行异常。

---

## Task 1: 接口文档 + trace schema

- [ ] 创建 `docs/contracts/api/company-live-generate.md`
- [ ] 在 `packages/core` 新增 `CompanyLiveNodeTrace` + `CompanyLiveGenerateResult` schema
- [ ] 补充 parse 测试

## Task 2: company-live graph（含 trace 收集）

Graph state 包含：brief、audioAssetRef、imageAssetRef、videoAssetRef、bundle、trace[]

节点顺序：START → generateAudio → generateImage → generateVideo → assembleBundle → END

- [ ] Step 1: 写失败的 graph 测试（验证 trace 包含 4 个节点，status 均为 succeeded）
- [ ] Step 2: 实现 4 个节点（每节点追加 trace 条目）
- [ ] Step 3: 实现 graph wiring
- [ ] Step 4: 导出 `executeCompanyLiveGraph`
- [ ] Step 5: 测试通过

## Task 3: 后端 endpoint

- [ ] Step 1: 写失败的 controller 测试
- [ ] Step 2: 实现 DTO + service + controller + module
- [ ] Step 3: 注册到 app.module.ts
- [ ] Step 4: 测试通过 + typecheck

## Task 4: 前端表单 + 节点轨迹面板

- [ ] Step 1: API 客户端 `company-live.api.ts`
- [ ] Step 2: `CompanyLiveGenerateForm` 组件
- [ ] Step 3: `CompanyLiveBundleResult` 组件
- [ ] Step 4: `CompanyLiveNodeTrace` 组件（每节点展示 nodeId、status、durationMs、snapshot diff）
- [ ] Step 5: 嵌入 `CompanyAgentsPanel`
- [ ] Step 6: 组件测试 + typecheck

## Task 5: 验证 + 文档

- [ ] 所有相关测试通过
- [ ] typecheck（core、backend、agent-admin）
- [ ] 更新架构文档
- [ ] 提供 curl 验证命令

---

## 已知限制（MVP 刻意不做的）

- stub transport 不发真实 HTTP，assetRef 全是 mock 字符串
- trace 只记录字段级 snapshot，不含 LLM prompt/response
- 不支持 SSE、不持久化
- 通用 Graph Studio 留到后续
