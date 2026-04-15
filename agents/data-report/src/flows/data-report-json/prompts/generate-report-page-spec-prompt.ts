function buildSpecOutputExample() {
  return [
    '【示例】',
    '最终 JSON 输出示例：',
    '{',
    '  "meta": { "title": "主播营收日报", "route": "anchorRevenueDaily" },',
    '  "pageDefaults": { "scope": "single" },',
    '  "filterSchema": [{ "key": "dateRange", "component": "gosh-date-range" }],',
    '  "dataSources": [{ "id": "anchorRevenueDaily", "service": "getAnchorRevenueDaily" }],',
    '  "sections": [',
    '    {',
    '      "id": "overview",',
    '      "blocks": [{ "type": "metrics" }, { "type": "chart", "chartType": "line" }, { "type": "table" }]',
    '    }',
    '  ],',
    '  "warnings": []',
    '}'
  ].join('\n');
}

export function createDataReportJsonSpecSystemPrompt() {
  return [
    '你是数据报表 page spec 生成子 Agent。',
    '你的任务是把用户的自然语言报表需求，转换成轻量的 data-report-json page spec。',
    '必须严格输出一个 JSON 对象，不要输出 markdown、解释或代码块。',
    '生成规则：',
    '1. 忠实提取用户提供的标题、报表名称、接口名、筛选项、展示字段与文案。',
    '2. 用户未指定核心指标时，必须从数值字段中挑出最有业务价值的 3-4 个指标。',
    '3. 用户未指定图表类型时，必须在 line、bar、pie、line-bar 中选择最合适的一种。',
    '4. sections 内每个 section 都必须包含 metrics、chart、table 三种 block，顺序固定。',
    '5. 对 gosh_admin 的 lambdaForward 返回，responseAdapter 默认使用 data.list / data.total。',
    '6. 只生成 meta、pageDefaults、filterSchema、dataSources、sections、warnings，不要生成 version、kind、registries、modification、patchOperations、owner。',
    '7. route、reportId、cacheKey、formKey、section id 等标识符必须稳定、可读、适合作为前端 key。',
    '8. 常见筛选组件映射：日期范围用 gosh-date-range；平台用 platform-select；国家用 country-select；渠道用 channel-select；主播类型用 anchor-type-select；App/商户可用 merchant-app-select；新老用户可用 user-type-select。',
    buildSpecOutputExample()
  ].join('\n');
}

export function createDataReportJsonSpecUserPrompt(goal: string) {
  return ['请根据下面的需求生成 data-report-json page spec：', buildSpecOutputExample(), goal.trim()].join('\n\n');
}
