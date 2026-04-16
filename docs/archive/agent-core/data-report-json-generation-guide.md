# data-report-json 生成链路说明

> 过时提醒（2026-04-15）：
> 本文档中的大量源码路径仍写成 `packages/agent-core/src/flows/data-report-json/*`。
> 当前真实实现已经迁到 `agents/data-report/src/flows/data-report-json/*` 与 `agents/data-report/src/graphs/data-report-json.graph.ts`。
> 后续修改请优先以新包路径为准；本文档其余内容只保留行为参考价值。

状态：history
文档类型：history
适用范围：`agents/data-report` data-report-json
最后核对：2026-04-15

本文档沉淀当前 `report-schema` / `data-report-json` 生成链路的实现背景，供后续 AI 和开发者继续迭代时参考。

相关范围：

- Agent graph：`agents/data-report/src/flows/data-report-json/*`
- 后端装配：`apps/backend/agent-server`
- 外部前端项目：`/Users/dev/Desktop/gosh_admin_fe`

## 1. 文档归档规则

本主题属于 `agent-core` 域，因此文档放在：

- `docs/archive/agent-core/data-report-json-generation-guide.md`

后续新增 `packages/agent-core` 相关文档，也应继续放在：

- `docs/archive/agent-core/`

## 2. 当前入口

前端通过 `POST /api/chat` 发起报表 schema 生成，请求体至少包含：

```json
{
  "messages": [{ "role": "user", "content": "..." }],
  "responseFormat": "report-schema",
  "preferLlm": true
}
```

说明：

- `responseFormat: "report-schema"` 会进入 `ChatService.streamReportSchema()`
- `preferLlm: true` 用于显式开启 brand-new 单报表的 strict LLM 路径
- 当前后端默认 `disableCache: true`，即每次请求都会重新生成，不复用 report artifact cache、split-block cache 或局部 node cache

关键代码：

- `apps/backend/agent-server/src/chat/chat.service.ts`
- `apps/backend/agent-server/src/chat/chat.direct.dto.ts`

## 3. 当前主流程

### 3.1 高层流程

```text
/api/chat
  -> ChatService.streamReportSchema()
  -> executeDataReportJsonGraph()
  -> planningNode
  -> filterSchemaNode + dataSourceNode (并发)
  -> sectionPlanNode
  -> schema_progress phase=skeleton
  -> metricsBlockNode + chartBlockNode + tableBlockNode (并发)
  -> schema_progress phase=block
  -> sectionAssembleNode
  -> patchSchemaNode
  -> validateNode
  -> schema_ready / done
```

### 3.2 SSE 事件

当前会返回以下几类事件：

- `stage`
- `schema_progress`
- `schema_ready`
- `schema_failed`
- `done`

其中：

- `schema_progress phase: "skeleton"` 表示筛选项、数据源、页面骨架已生成，可先渲染页面框架
- `schema_progress phase: "block"` 表示某个 block 已补齐，可渐进更新预览

## 4. strict LLM 与 fast-lane 的关系

### 4.1 不带 `preferLlm`

默认 brand-new 单报表仍保留原有 deterministic / structured fast-lane 策略，目的是：

- 保持现有测试稳定
- 保持 patch 模式不受影响
- 保持老调用方行为不变

### 4.2 带 `preferLlm: true`

只有显式传入 `preferLlm: true`，brand-new 单报表才进入 strict LLM 路径。

当前 strict LLM 路径特征：

- `planningNode` 统一包住 `analysisNode + schemaSpecNode`
- `filterSchemaNode` 和 `dataSourceNode` 并发
- `metricsBlockNode` / `chartBlockNode` / `tableBlockNode` 并发
- 前端可通过 `schema_progress` 做渐进式渲染

### 4.3 节点输入裁剪

当前 brand-new 的 LLM 节点不再默认把整段用户原始需求重复传给每个节点，而是先在 `analysisNode` 后生成一份 node-specific trimmed contexts，再按节点分发。

实现位置：

- `packages/agent-core/src/flows/data-report-json/nodes/goal-parser.ts`
- `packages/agent-core/src/flows/data-report-json/nodes/goal-analysis.ts`
- `packages/agent-core/src/flows/data-report-json/nodes/structured-input.ts`
- `packages/agent-core/src/flows/data-report-json/nodes/goal-artifacts.ts`
- `packages/agent-core/src/flows/data-report-json/nodes/analysis-node.ts`
- `packages/agent-core/src/flows/data-report-json/prompts/generate-report-page-part-prompt.ts`

当前裁剪约定：

- `filterSchemaNode`
  - 只看 `标题 / 报表名称 / 筛选项`
- `dataSourceNode`
  - 只看 `标题 / 报表名称 / 大数据接口 / 筛选项`
- `metricsBlockNode`
  - 只看 `标题 / 报表名称 / 大数据接口 / 指标字段`
- `chartBlockNode`
  - 只看 `标题 / 报表名称 / 大数据接口 / 维度字段 / 指标字段`
- `tableBlockNode`
  - 只看 `标题 / 报表名称 / 大数据接口 / 展示及文案`
- `sectionSchemaNode`
  - 只看 `标题 / 报表名称 / 大数据接口 / 筛选项 / 展示及文案`

约束：

- 不要再把完整 `goal` 文本直接作为每个 LLM 节点的 user prompt 主体
- Bonus Center 一类领域规则仍可保留在 system prompt 中，但不要通过把原始全文重复拼回去实现
- 后续新增 LLM 节点时，必须同步定义自己的 trimmed context，而不是复用其他节点的大上下文

补充：

- deterministic / heuristic fast-lane 也应优先复用同一份解析结果
- `buildSingleReportFilterSchema / buildSingleReportDataSources / buildSingleReportMetricsBlock / buildSingleReportChartBlock / buildSingleReportTableBlock` 现在优先基于已解析出的 `filterEntries / displayFields / metricFields / dimensionFields`
- 因此，即使当前节点没有走 LLM，也不应该再退回完全依赖全文正则猜测的 `summaryValue / 单列表格 / 通用 xField` 兜底行为
- 当筛选项行里出现显式枚举定义，例如 `user_type (string) - 新老用户：全部：dau,新用户：new,老用户：old`，deterministic parser 必须把它解析成 `field.options` 和稳定默认值；如果这一步没做，会表现得像“重新生成后还是旧值”，但根因不是缓存，而是解析未覆盖

### 4.4 block 节点的 deterministic-first 策略

当前 single report split lane 中，`metricsBlockNode / tableBlockNode / chartBlockNode` 不再都按“完整 LLM 生成”处理。

当前约定：

- `metricsBlockNode`
  - 默认直接走 deterministic builder
  - 优先从 `metricFields` 生成指标卡，不再默认请求 LLM
- `tableBlockNode`
  - 默认直接走 deterministic builder
  - 优先从 `displayFields` 生成列配置，不再默认请求 LLM
- `chartBlockNode`
  - 默认直接走 deterministic builder
  - 只有在目标里出现明显复杂图表诉求时，才升级到 LLM
  - 当前复杂信号包括：`双轴 / 组合图 / 混合图 / 堆叠 / TopN / 同比 / 环比`

这样做的目的：

- 避免 `strictLlmBrandNew` 下 block 节点长期等待 LLM
- 缩短 `schema_progress phase=block` 的首个可见时间
- 把 LLM 留给真正有设计空间的复杂图表需求

### 4.5 block progress 的实时下发

当前 single report split lane 中，`metricsBlockNode / chartBlockNode / tableBlockNode` 虽然仍然并发启动，但 `schema_progress phase=block` 已经改成“哪个 block 先完成，就先下发哪个 block 的 partial schema”。

实现位置：

- `packages/agent-core/src/flows/data-report-json/runtime-split-lane.ts`
- `packages/agent-core/src/flows/data-report-json/runtime-helpers.ts`

当前约束：

- 不要再使用 `Promise.allSettled(...)` 之后统一遍历结果再发 block progress
- block 节点完成后，应立即：
  - merge 当前 partial state
  - 触发 `schema_progress phase=block`
- 因此前端可以先收到 `metrics` / `table`，再等慢一点的 `chart`

前端兼容性：

- `/Users/dev/Desktop/gosh_admin_fe/src/components/ReportCopilot/useReportSchemaStream.ts` 已能消费 `schema_progress`
- 本轮无需改动 gosh_admin_fe，即可获得更早的预览刷新

### 4.6 patch 路径的 node-scoped merge

当前 patch 路径不再默认把所有 complex patch 都送进 `patchSchemaNode` 的整页 schemaPatch LLM。

当前约定：

- 如果 `CHANGE_REQUEST` 只命中单一目标，优先按 node-scoped patch 处理：
  - `filterSchema`
  - `dataSources`
  - `metricsBlock`
  - `chartBlock`
  - `tableBlock`
- 命中上述目标时，优先走 node-scoped lane，本地只重生成目标节点，并在 `patchSchemaNode` 做最终 merge
- 只有无法归类到单一目标、且确实涉及跨节点联动时，才继续走整页 schemaPatch LLM

这样做的目的：

- 避免为一句“把图表改成柱状图”读取整页 schema 并生成全局 patch
- 降低 patch 模式的 token 消耗和路径漂移风险
- 让局部重生成和本地替换成为 patch 的默认路径

当前本地 chart patch 还额外支持两类自然语言：

- 精确追加已有字段到图表：
  - 例如 `图表添加包含邀请发放金额`
  - patch 会优先从当前 schema 的 table / metrics / chart 中反查同名字段，补成新的 chart series，而不是退回通用 `seriesValue`
- 指定字段级的折线 / 柱状样式：
  - 例如 `图表改成组合图，总发放金额用柱状，包含邀请发放金额用折线`
  - patch 会把 block 级 `chartType` 提升为 `line-bar`
  - 同时在 `series[]` 上写入可选 `seriesType: "line" | "bar"`，用来表达“同一张图里不同字段走不同图形”

当前约束：

- `seriesType` 目前只在需要字段级混合图时出现；普通单一折线/柱状图可以继续只看 block 级 `chartType`
- 本地 patch 默认只识别 `line / bar` 级别的字段混合，不处理更复杂的双轴、堆叠或 TopN 语义；这些仍应升级到 chartBlock LLM / complex chart lane

### 4.6.1 当前 patch intent 约定

当前 patch 路径已经开始从“单目标字符串命中”收敛到“单句多 intent”：

- 同一句里可以同时命中多个 target：
  - `metricsBlock`
  - `chartBlock`
  - `tableBlock`
  - `filterSchema`
- 只有当请求中的 intent 最终只落到单一 target 时，才继续走 node-scoped patch lane
- 如果一句话同时改图表、指标、表格或筛选项，`resolveNodeScopedPatchTarget()` 会返回 `undefined`，交给整页本地 patch merge，避免误把多目标修改错误压成单目标 patch

当前本地多 intent patch 已覆盖的典型组合：

- `删除指标总发放金额，图表添加包含邀请发放金额，明细表标题改成兑换详情`
- `筛选项 user_type 改为下拉选择并重新生成 options`

当前 filter patch 额外支持：

- 把筛选项改为输入框：
  - 会把 `componentKey` 改为 `gosh-input`
  - 会把 `valueType` 改为 `string`
  - 会移除 `options`
- 把筛选项改为下拉 / 单选 / 多选：
  - 会把 `componentKey` 收敛为现有 select 或 `gosh-select`
  - 会按文案切到 `string` / `string[]`
- `重新生成 options`：
  - 当前已为 `user_type` 内置稳定 options：`全部 / 新用户 / 老用户`

当前限制：

- patch intent 已升级为独立的 `patchIntentNode`，但默认仍是 deterministic parser 优先
- 当 deterministic parser 返回空或全部 `unknown` 时，`patchIntentNode` 才会调用 LLM 只输出 `intents[]`
- filter options 的本地重生成目前主要覆盖 `user_type` 一类稳定枚举字段，尚未覆盖任意外部枚举源
- `patchIntentNode` 产出的 `intents[]` 现在已经会继续传入本地 executor，不再只用于 patch 路由判断
- 当前 `metrics / chart / filter` 三类 executor 已优先消费 `intents[]`，仅在缺少 intent subject 时才回退到 request 正则
- 标题类 patch intent 已按 block 逐条解析：
  - `图表标题改成金额趋势`
  - `明细表改为兑换详情`
  - `指标卡标题改成核心总览`
  - 这些语句会分别落到 `chartBlock / tableBlock / metricsBlock`，不再用“整句里包含哪个关键词”做粗略归类
- 后续继续扩 patch 能力时，优先原则应是：
  - 先在 `patchIntentNode` / parser 中补结构化 action
  - 再让对应 executor 消费 intent
  - 避免重新在 executor 内堆新的 request 正则，导致“解析结果”和“执行规则”再次分叉

补充：

- 当前 runtime prelude 已新增 `patchIntentNode`
- 当请求携带 `CURRENT_SCHEMA` 且存在 `CHANGE_REQUEST` 时，prelude 会先执行：
  - `analysisNode`
  - `patchIntentNode`
  - 再决定是否进入 node-scoped patch lane
- `patchIntentNode` 当前执行策略：
  - 先跑本地 heuristic parser
  - parser 结果为空或全为 `unknown` 时，再走 LLM structured output fallback
  - LLM fallback 只允许输出 `intents[]`，不允许直接改整份 schema
- 因此后续排查 patch 路由时，应优先看 `patchIntentNode` 输出的 intents 数量和 target 集合，而不是只看原始 request 文本

### 4.7 当前模块拆分

为了遵守“单文件超过 400 行继续拆分”的仓库规范，`data-report-json` 当前按职责拆成以下模块：

- goal 解析与 node context：
  - `packages/agent-core/src/flows/data-report-json/nodes/goal-parser.ts`
  - `packages/agent-core/src/flows/data-report-json/nodes/goal-analysis.ts`
  - `packages/agent-core/src/flows/data-report-json/nodes/structured-input.ts`
  - `packages/agent-core/src/flows/data-report-json/nodes/goal-artifacts.ts`
- schema 构建：
  - `packages/agent-core/src/flows/data-report-json/nodes/single-report-builders.ts`
  - `packages/agent-core/src/flows/data-report-json/nodes/page-schema-builders.ts`
  - `packages/agent-core/src/flows/data-report-json/nodes/schema-builders.ts`
- patch 处理：
  - `packages/agent-core/src/flows/data-report-json/nodes/schema-patch-mutations.ts`
  - `packages/agent-core/src/flows/data-report-json/nodes/patch-helpers.ts`
- runtime：
  - `packages/agent-core/src/flows/data-report-json/runtime-cache.ts`
  - `packages/agent-core/src/flows/data-report-json/runtime-helpers.ts`
  - `packages/agent-core/src/flows/data-report-json/runtime-patch-lane.ts`
  - `packages/agent-core/src/flows/data-report-json/runtime-split-lane.ts`
  - `packages/agent-core/src/flows/data-report-json/runtime-standard-lanes.ts`
  - `packages/agent-core/src/flows/data-report-json/runtime-lanes.ts`
  - `packages/agent-core/src/flows/data-report-json/runtime.ts`

兼容性约束：

- 外部节点仍然通过 `nodes/shared.ts` 读取共享函数，不需要感知内部拆分
- graph 入口仍然只通过 `runtime.ts` 暴露 `executeDataReportJsonGraph()`
- 后续这些模块如果再次超过 400 行，必须继续拆分，不能回退成“大而全 shared/runtime”

## 5. 缓存策略

当前为了便于联调，后端默认禁用缓存：

- report-schema artifact cache：禁用
- split-block artifact cache：禁用
- analysis / schemaSpec / patch 局部 cache：禁用

实现位置：

- `apps/backend/agent-server/src/chat/chat.service.ts`
- `packages/agent-core/src/flows/data-report-json/runtime-cache.ts`
- `packages/agent-core/src/flows/data-report-json/runtime.ts`
- `packages/agent-core/src/flows/data-report-json/nodes/shared.ts`

如果后续要恢复缓存，必须先确认：

1. cache key 要区分 `preferLlm`
2. cache key 要区分 strict / non-strict block 路径
3. 不允许把旧的 fast-lane 结果回放到 strict LLM 请求上

## 6. 单报表筛选项约定

### 6.1 当前已支持的 heuristic 提取

当用户 goal 中存在类似：

```text
筛选项：
start_dt (string) - 开始日期，UTC时区 yyyy-MM-dd
end_dt (string) - 结束日期，UTC时区 yyyy-MM-dd
app (string) - 商户ID列表：vizz、hotya
user_type (string) - 新老用户
```

当前 deterministic fast-lane 也必须产出完整筛选 schema，而不再只返回一个 `dateRange`。

### 6.2 当前生成约定

当前单报表 schema 应生成：

```json
{
  "filterSchema": {
    "fields": [
      {
        "name": "dateRange",
        "component": { "componentKey": "gosh-date-range" },
        "requestMapping": {
          "start": "start_dt",
          "end": "end_dt"
        }
      },
      {
        "name": "app",
        "component": { "componentKey": "merchant-app-select" }
      },
      {
        "name": "user_type",
        "component": { "componentKey": "user-type-select" }
      }
    ]
  }
}
```

同时：

- `pageDefaults.filters.app = []`
- `pageDefaults.filters.user_type = "all"`
- `dataSources.*.requestAdapter.app = "app"`
- `dataSources.*.requestAdapter.user_type = "user_type"`

### 6.4 单报表表格列不能被截断

当用户在 `展示及文案` 中显式列出表格字段时，single-report deterministic builder 必须完整保留这些字段的顺序与数量。

例如用户列了：

- `dt`
- `app`
- `user_type`
- `total_record_all_cnt`
- `total_record_amount`
- `total_record_user_cnt`
- `total_record_amount_avg`
- `invite_record_all_cnt`
- `invite_record_amount`
- `invite_record_user_cnt`
- `invite_record_amount_avg`
- `not_invite_record_all_cnt`
- `not_invite_record_amount`
- `not_invite_record_user_cnt`
- `not_invite_record_amount_avg`

那么生成出来的 `table` block 也必须保留这 15 列，不能只取前 8 列。

维度字段在表格中继续优先映射到 `*_label`：

- `dt -> dt_label`
- `app -> app_label`
- `user_type -> user_type_label`

### 6.5 会话内继续修改要优先走字段级 patch

对于 `CHANGE_REQUEST + CURRENT_SCHEMA` 形式的继续修改，简单的图表/指标增删要优先走本地 patch，而不是把整页当成 brand-new schema 重新生成。

当前约束：

- `图表添加不包含邀请发放人数`
- `图表删除总发放金额`
- `指标添加不包含邀请发放人数`
- `指标删除总发放金额`

这类请求都应直接命中当前 schema 里的已有字段映射，优先复用 table / metrics / chart 中已经存在的字段定义：

- 中文文案 `不包含邀请发放人数` 要映射回真实字段 `not_invite_record_user_cnt`
- 中文文案 `总发放金额` 要映射回真实字段 `total_record_amount`

同时，前端预览层如果外层卡片已经渲染了 block 标题，图表内部的 ECharts option 不应再次渲染 `title.text`，否则会出现双标题。

### 6.3 为什么必须有 `requestMapping`

如果 `dateRange` 字段缺少：

```json
{
  "requestMapping": {
    "start": "start_dt",
    "end": "end_dt"
  }
}
```

前端容易把原始 `dateRange` 作为接口参数一并透传，导致请求里既有：

- `start_dt`
- `end_dt`

又错误地带上：

- `dateRange`

因此，对日期范围字段，`requestMapping` 是必填语义，不是可选装饰。

## 7. gosh_admin_fe 前端接入约定

外部前端项目路径：

- `/Users/dev/Desktop/gosh_admin_fe`

当前主要接入位置：

- `src/components/ReportCopilot/useReportSchemaStream.ts`
- `src/components/DataReportSchemaRenderer/registry.tsx`
- `src/components/DataReportSchemaRenderer/utils.ts`

### 7.1 请求约定

发起 `/api/chat` 的 `report-schema` 请求时，应显式带：

```json
{
  "preferLlm": true
}
```

### 7.2 日期筛选组件约定

当前 `DateRangeField` 应按如下语义工作：

```tsx
<ProFormDateRangePicker
  name={field.name}
  transform={value => ({
    [field.name]: value,
    start_dt: dayjs(value[0]).format('YYYY-MM-DD'),
    end_dt: dayjs(value[1]).format('YYYY-MM-DD')
  })}
/>
```

注意：

- 为了兼容当前 `DataReportSchemaRenderer` 内部的 `buildEffectiveFilters()` 和 `buildRequestParams()`，不能只返回 `start_dt / end_dt`
- 还必须保留原始 `dateRange`

### 7.3 参数拼装约定

前端真实请求参数以 `buildRequestParams()` 为准：

- 如果字段有 `requestMapping`，按 `requestMapping` 映射
- 如果字段没有 `requestMapping`，才按字段名直接透传

因此，后端 schema 的 `requestMapping` 正确与否会直接影响前端最终请求。

## 8. 当前联调时的判断标准

如果链路正常，单报表 `preferLlm: true` 请求至少应满足：

1. SSE 中出现 `planningNode`
2. SSE 中出现 `schema_progress`
3. `schema_progress phase: "skeleton"` 先于最终 `schema_ready`
4. `filterSchema.fields` 包含 `dateRange / app / user_type`
5. `dataSources.*.requestAdapter` 包含：
   - `dateRange.start -> start_dt`
   - `dateRange.end -> end_dt`
   - `app -> app`
   - `user_type -> user_type`
6. 浏览器 Network 中真实请求参数不应再包含原始 `dateRange`

## 9. 常见误判

### 9.1 “接口没走大模型”

先看 `runtime`：

- `executionPath: "llm"` 表示已进入 strict LLM 路径
- `llmAttempted: true` 表示至少尝试过 LLM

### 9.2 “看起来还是旧逻辑”

优先排查是否命中了旧后端进程，而不是先怀疑代码没改对。

尤其当你看到：

- 没有 `planningNode`
- 没有 `schema_progress`
- 仍然返回旧的 timeout / fallback 结构

大概率说明当前监听端口上的进程不是最新代码。

### 9.3 “还是有旧数据/脏结果”

当前默认 `disableCache: true`，如果仍出现旧结果，优先怀疑：

- 本地 dev server 没重启
- 浏览器连的不是当前这台后端
- 另一个旧进程仍占用了目标端口

## 10. 建议的后续演进方向

后续如果继续优化，建议优先级如下：

1. 继续强化 `filterSchemaNode` / `dataSourceNode` 对自然语言字段描述的结构提取能力
2. 给 `metrics/chart/table` 的 strict LLM 输出补更强的业务字段约束
3. 为 `gosh_admin_fe` 的 `DataReportSchemaRenderer` 补更直接的自动化测试
4. 在恢复缓存前，先把 cache key 和 fallback 污染问题彻底回归覆盖
