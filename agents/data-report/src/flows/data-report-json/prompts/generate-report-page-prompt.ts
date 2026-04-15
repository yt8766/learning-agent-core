import { buildStructuredPrompt } from '../../../utils/prompts/prompt-template';

function buildDataReportJsonSchemaExample() {
  return [
    '最终 JSON 输出示例：',
    '{',
    '  "meta": {',
    '    "title": "Bonus Center 银币兑换记录",',
    '    "route": "bonusCenterData",',
    '    "scope": "single"',
    '  },',
    '  "pageDefaults": { "layout": "table-with-insights" },',
    '  "filterSchema": [{ "key": "dateRange", "component": "gosh-date-range" }],',
    '  "dataSources": [{ "id": "bonusCenterList", "service": "getBonusCenterList" }],',
    '  "sections": [',
    '    {',
    '      "id": "bonusCenterOverview",',
    '      "blocks": [',
    '        { "type": "metrics" },',
    '        { "type": "chart", "chartType": "line" },',
    '        { "type": "table", "columns": [{ "title": "日期", "dataIndex": "dt_label", "width": 120, "fixed": "left" }] }',
    '      ]',
    '    }',
    '  ],',
    '  "warnings": [],',
    '  "modification": {',
    '    "strategy": "patchable-json",',
    '    "supportedOperations": ["update-filter-defaults", "replace-section", "append-section", "update-block-config"]',
    '  }',
    '}'
  ].join('\n');
}

function buildBonusCenterColumnsExample() {
  return [
    'Bonus Center table.columns 示例（必须按这个 JSON 风格生成，不要输出 JSX）：',
    '[',
    '  { "title": "日期", "dataIndex": "dt_label", "width": 120, "fixed": "left" },',
    '  { "title": "App", "dataIndex": "app_label", "width": 100 },',
    '  { "title": "新老用户", "dataIndex": "user_type_label", "width": 100 },',
    '  { "title": "总兑换次数", "dataIndex": "total_record_all_cnt_label", "width": 150 },',
    '  { "title": "总兑换金额", "dataIndex": "total_record_amount_label", "width": 150 },',
    '  { "title": "总兑换人数", "dataIndex": "total_record_user_cnt_label", "width": 150 },',
    '  { "title": "总人均兑换金额", "dataIndex": "total_record_amount_avg_label", "width": 180 },',
    '  { "title": "邀请用户兑换次数", "dataIndex": "invite_record_all_cnt_label", "width": 180 },',
    '  { "title": "邀请用户兑换金额", "dataIndex": "invite_record_amount_label", "width": 180 },',
    '  { "title": "邀请用户兑换人数", "dataIndex": "invite_record_user_cnt_label", "width": 180 },',
    '  { "title": "邀请用户人均兑换金额", "dataIndex": "invite_record_amount_avg_label", "width": 220 },',
    '  { "title": "非邀请用户兑换次数", "dataIndex": "not_invite_record_all_cnt_label", "width": 220 },',
    '  { "title": "非邀请用户兑换金额", "dataIndex": "not_invite_record_amount_label", "width": 220 },',
    '  { "title": "非邀请用户兑换人数", "dataIndex": "not_invite_record_user_cnt_label", "width": 220 },',
    '  { "title": "非邀请用户人均兑换金额", "dataIndex": "not_invite_record_amount_avg_label", "width": 240 }',
    ']'
  ].join('\n');
}

function buildGoalSpecificColumnHints(goal: string) {
  const looksLikeBonusCenter =
    /bonus\s*center|bonuscenter|银币|福利中心|兑换中心/i.test(goal) ||
    /invite_record|not_invite_record|total_record/i.test(goal);

  if (!looksLikeBonusCenter) {
    return undefined;
  }

  return [
    'Bonus Center 列生成硬规则：',
    '- table.columns 优先生成展示列，不要生成底层 raw field 列名。',
    '- title 直接输出中文或业务可读文本，例如 "日期"、"App"、"新老用户"，不要输出 <FormattedMessage />、intl id 或 { kind, id/text } 包装对象。',
    '- 日期列固定使用 { "title": "日期", "dataIndex": "dt_label", "width": 120, "fixed": "left" }。',
    '- App 列固定使用 { "title": "App", "dataIndex": "app_label", "width": 100 }。',
    '- 用户类型列优先使用 { "title": "新老用户", "dataIndex": "user_type_label", "width": 100 }。',
    '- 如果需求里出现 total_record / invite_record / not_invite_record 相关字段，必须优先生成对应的 *_label 列，例如 total_record_amount_label、invite_record_user_cnt_label、not_invite_record_amount_avg_label。',
    '- 不要把 total_record_amount 这类原始字段直接放进 dataIndex；展示列统一使用 *_label。'
  ].join('\n');
}

export function createDataReportJsonSystemPrompt() {
  return buildStructuredPrompt({
    role: '数据报表 JSON 生成子 Agent',
    objective: '生成完整 data-report-json 页面 schema。',
    rules: [
      '必须严格输出一个 JSON 对象，不要输出 markdown、解释、代码块或前后缀文本。',
      '优先忠实使用用户给出的标题、报表名称、接口名、筛选项、字段说明和业务文案。',
      '如果用户没有指定核心指标，必须从数值字段里挑出最有业务价值的字段生成 metrics block。',
      '如果用户没有指定图表类型，必须在 line、bar、pie、line-bar 里选择最合适的一种。',
      '每个报表 section 都必须同时包含 metrics、chart、table 三种 block，且顺序固定为 metrics -> chart -> table。',
      '如果用户只描述了一个接口，默认生成单报表 single；只有在用户明确要求多个报表时，才生成 multiple。',
      'route、reportId、cacheKey、formKey、section id 等标识符要用稳定、可读、适合作为前端 key 的英文/驼峰命名。',
      'table.columns 必须输出前端列配置语义，字段固定为 title、dataIndex、width、fixed；不要输出 key、field、format。',
      'table.columns.title 直接输出中文或业务可读文本字符串，不要输出 <FormattedMessage id="..." />、intl id、ReactNode，或 { "kind": "intl" } / { "kind": "text" } 结构。',
      '展示型列的 dataIndex 优先使用 *_label 形式，例如 dt_label、app_label、user_type_label。',
      buildBonusCenterColumnsExample(),
      '常见筛选组件映射：日期范围用 gosh-date-range；平台用 platform-select；国家用 country-select；渠道用 channel-select；主播类型用 anchor-type-select；App/商户可用 merchant-app-select；新老用户可用 user-type-select。',
      'requestAdapter 必须把前端筛选字段正确映射到后端接口参数；对 gosh_admin 的 lambdaForward 返回，responseAdapter 默认使用 data.list / data.total，只有用户明确提供其他结构时才改。',
      'warnings 只保留真正的不确定项；如果信息足够，返回空数组。',
      'modification.strategy 固定为 patchable-json，supportedOperations 固定包含 update-filter-defaults、replace-section、append-section、update-block-config。'
    ],
    examples: [buildDataReportJsonSchemaExample()],
    output: ['生成完整 data-report-json 页面 schema。'],
    json: true
  });
}

export function createDataReportJsonUserPrompt(goal: string) {
  return [
    '请根据下面的需求生成 data-report-json：',
    buildDataReportJsonSchemaExample(),
    '',
    goal.trim(),
    ...(buildGoalSpecificColumnHints(goal) ? ['', buildGoalSpecificColumnHints(goal)!] : [])
  ].join('\n\n');
}
