import type { DataReportJsonAnalysisArtifact } from '../../../types/data-report-json';
import { buildStructuredPrompt } from '../../../utils/prompts/prompt-template';

function buildPartOutputExample(partName: string) {
  return [
    '最终 JSON 输出示例：',
    partName === 'sections'
      ? [
          '[',
          '  {',
          '    "id": "bonusCenterOverview",',
          '    "blocks": [',
          '      { "type": "metrics" },',
          '      { "type": "chart", "chartType": "line" },',
          '      { "type": "table", "columns": [{ "title": { "kind": "intl", "id": "common.time.date" }, "dataIndex": "dt_label", "width": 120, "fixed": "left" }] }',
          '    ]',
          '  }',
          ']'
        ].join('\n')
      : partName === 'filterSchema'
        ? [
            '{',
            '  "formKey": "bonusCenterSearchForm",',
            '  "layout": "inline",',
            '  "fields": [',
            '    {',
            '      "name": "dateRange",',
            '      "label": "日期",',
            '      "component": { "type": "custom", "componentKey": "gosh-date-range", "props": { "allowClear": false } },',
            '      "valueType": "date-range",',
            '      "required": true,',
            '      "defaultValue": { "preset": "last7Days" }',
            '    }',
            '  ]',
            '}'
          ].join('\n')
        : partName === 'dataSources'
          ? [
              '{',
              '  "bonusCenterList": {',
              '    "serviceKey": "getBonusCenterList",',
              '    "requestAdapter": { "dateRange.start": "start_dt", "dateRange.end": "end_dt" },',
              '    "responseAdapter": { "listPath": "data.list", "totalPath": "data.total" }',
              '  }',
              '}'
            ].join('\n')
          : partName === 'schemaPatch'
            ? [
                '{',
                '  "meta": {',
                '    "reportId": "bonusCenterData",',
                '    "title": "Bonus Center 银币兑换记录",',
                '    "description": "Bonus Center 数据分析页",',
                '    "route": "/dataDashboard/bonusCenterData",',
                '    "templateRef": "bonus-center-data",',
                '    "scope": "single",',
                '    "layout": "dashboard"',
                '  },',
                '  "pageDefaults": {',
                '    "filters": { "dateRange": { "preset": "last7Days" } },',
                '    "queryPolicy": {',
                '      "autoQueryOnInit": true,',
                '      "autoQueryOnFilterChange": false,',
                '      "cacheKey": "bonusCenterData"',
                '    }',
                '  },',
                '  "patchOperations": [],',
                '  "warnings": []',
                '}'
              ].join('\n')
            : partName === 'patchIntents'
              ? [
                  '{',
                  '  "intents": [',
                  '    { "target": "chartBlock", "action": "update-style", "subject": "不包含邀请发放人数" },',
                  '    { "target": "metricsBlock", "action": "remove", "subject": "总发放金额" },',
                  '    { "target": "tableBlock", "action": "update-title", "subject": "兑换详情" }',
                  '  ]',
                  '}'
                ].join('\n')
              : '{ "example": "根据当前片段输出对应 JSON" }'
  ].join('\n');
}

function buildBonusCenterColumnsExample() {
  return [
    'Bonus Center table.columns 示例（必须按这个 JSON 风格生成，不要输出 JSX）：',
    '[',
    '  { "title": { "kind": "intl", "id": "common.time.date" }, "dataIndex": "dt_label", "width": 120, "fixed": "left" },',
    '  { "title": { "kind": "text", "text": "App" }, "dataIndex": "app_label", "width": 100 },',
    '  { "title": { "kind": "intl", "id": "data.bonusCenter.userType" }, "dataIndex": "user_type_label", "width": 100 },',
    '  { "title": { "kind": "intl", "id": "data.bonusCenter.totalRecordAllCnt" }, "dataIndex": "total_record_all_cnt_label", "width": 150 },',
    '  { "title": { "kind": "intl", "id": "data.bonusCenter.totalRecordAmount" }, "dataIndex": "total_record_amount_label", "width": 150 },',
    '  { "title": { "kind": "intl", "id": "data.bonusCenter.totalRecordUserCnt" }, "dataIndex": "total_record_user_cnt_label", "width": 150 },',
    '  { "title": { "kind": "intl", "id": "data.bonusCenter.totalRecordAmountAvg" }, "dataIndex": "total_record_amount_avg_label", "width": 180 },',
    '  { "title": { "kind": "intl", "id": "data.bonusCenter.inviteRecordAllCnt" }, "dataIndex": "invite_record_all_cnt_label", "width": 180 },',
    '  { "title": { "kind": "intl", "id": "data.bonusCenter.inviteRecordAmount" }, "dataIndex": "invite_record_amount_label", "width": 180 },',
    '  { "title": { "kind": "intl", "id": "data.bonusCenter.inviteRecordUserCnt" }, "dataIndex": "invite_record_user_cnt_label", "width": 180 },',
    '  { "title": { "kind": "intl", "id": "data.bonusCenter.inviteRecordAmountAvg" }, "dataIndex": "invite_record_amount_avg_label", "width": 220 },',
    '  { "title": { "kind": "intl", "id": "data.bonusCenter.notInviteRecordAllCnt" }, "dataIndex": "not_invite_record_all_cnt_label", "width": 220 },',
    '  { "title": { "kind": "intl", "id": "data.bonusCenter.notInviteRecordAmount" }, "dataIndex": "not_invite_record_amount_label", "width": 220 },',
    '  { "title": { "kind": "intl", "id": "data.bonusCenter.notInviteRecordUserCnt" }, "dataIndex": "not_invite_record_user_cnt_label", "width": 220 },',
    '  { "title": { "kind": "intl", "id": "data.bonusCenter.notInviteRecordAmountAvg" }, "dataIndex": "not_invite_record_amount_avg_label", "width": 240 }',
    ']'
  ].join('\n');
}

function buildAnalysisContext(analysis?: DataReportJsonAnalysisArtifact) {
  if (!analysis) {
    return '当前没有额外分析上下文。';
  }

  return [
    '已知页面分析上下文：',
    `- templateRef: ${analysis.templateRef}`,
    `- scope: ${analysis.scope}`,
    `- routeName: ${analysis.routeName}`,
    `- route: ${analysis.route}`,
    `- title: ${analysis.title}`,
    `- layout: ${analysis.layout}`
  ].join('\n');
}

function buildGoalSpecificColumnHints(goal: string) {
  const normalized = goal.toLowerCase();
  const looksLikeBonusCenter =
    /bonus\s*center|bonuscenter|银币|福利中心|兑换中心/.test(normalized) ||
    /invite_record|not_invite_record|total_record/.test(normalized);

  if (!looksLikeBonusCenter) {
    return undefined;
  }

  return [
    'Bonus Center 列生成硬规则：',
    '- table.columns 优先生成展示列，不要生成底层 raw field 列名。',
    '- 日期列固定使用 { "title": { "kind": "intl", "id": "common.time.date" }, "dataIndex": "dt_label", "width": 120, "fixed": "left" }。',
    '- App 列固定使用 { "title": { "kind": "text", "text": "App" }, "dataIndex": "app_label", "width": 100 }。',
    '- 用户类型列优先使用 { "title": { "kind": "intl", "id": "data.bonusCenter.userType" }, "dataIndex": "user_type_label", "width": 100 }。',
    '- 如果需求里出现 total_record / invite_record / not_invite_record 相关字段，必须优先生成对应的 *_label 列，例如 total_record_amount_label、invite_record_user_cnt_label、not_invite_record_amount_avg_label。',
    '- 不要把 total_record_amount 这类原始字段直接放进 dataIndex；展示列统一使用 *_label。'
  ].join('\n');
}

function createBaseRules() {
  return [
    '你是数据报表 JSON 生成子 Agent。',
    '当前任务是把整份 data-report-json 拆成多个小 JSON 片段分别生成。',
    '你只负责当前这个片段，必须严格输出一个 JSON 对象或 JSON 数组，不要输出 markdown、解释、代码块或前后缀文本。',
    '忠实提取用户提供的标题、报表名称、接口名、筛选项、展示字段与文案。',
    'table.columns 必须输出前端列配置语义，字段固定为 title、dataIndex、width、fixed；不要输出 key、field、format。',
    '如果列标题来自 <FormattedMessage id=..." />，必须编码成 JSON：{ "kind": "intl", "id": "..." }；如果是纯文本标题，编码成 { "kind": "text", "text": "..." }。',
    '展示型列的 dataIndex 优先使用 *_label 形式，例如 dt_label、app_label、user_type_label。',
    buildBonusCenterColumnsExample(),
    '常见筛选组件映射：日期范围用 gosh-date-range；平台用 platform-select；国家用 country-select；渠道用 channel-select；主播类型用 anchor-type-select；App/商户可用 merchant-app-select；新老用户可用 user-type-select。',
    '对 gosh_admin 的 lambdaForward 返回，responseAdapter 默认优先使用 data.list / data.total。',
    '所有 key、id、cacheKey、formKey、routeName 都必须稳定、可读、适合作为前端 key。'
  ];
}

export function createDataReportJsonPartSystemPrompt(params: { partName: string; outputRules: string[] }) {
  return buildStructuredPrompt({
    role: '数据报表 JSON 生成子 Agent',
    objective: `把整份 data-report-json 拆成多个小 JSON 片段分别生成，当前只负责 ${params.partName} 片段。`,
    rules: createBaseRules(),
    examples: [buildPartOutputExample(params.partName)],
    output: [`当前片段：${params.partName}`, ...params.outputRules],
    json: true
  });
}

export function createDataReportJsonPartUserPrompt(params: {
  context: string;
  analysis?: DataReportJsonAnalysisArtifact;
  partName?: string;
  rawGoal?: string;
}) {
  return [
    '请根据下面的需求生成当前 JSON 片段：',
    buildPartOutputExample(params.partName ?? 'sections'),
    '',
    params.context.trim(),
    '',
    buildAnalysisContext(params.analysis),
    ...(buildGoalSpecificColumnHints(params.rawGoal ?? params.context)
      ? ['', buildGoalSpecificColumnHints(params.rawGoal ?? params.context)!]
      : [])
  ].join('\n');
}

export function createDataReportJsonPatchPartUserPrompt(params: {
  changeRequest?: string;
  analysis?: DataReportJsonAnalysisArtifact;
  currentFragment: unknown;
  currentSchema?: unknown;
  partName?: string;
}) {
  return [
    '请基于下面的已有 schema 修改当前 JSON 片段：',
    buildPartOutputExample(params.partName ?? 'sections'),
    '',
    `CHANGE_REQUEST:\n${params.changeRequest?.trim() || '保持现有结构，仅做必要修正。'}`,
    '',
    buildAnalysisContext(params.analysis),
    '',
    'CURRENT_FRAGMENT:',
    JSON.stringify(params.currentFragment, null, 2),
    ...(params.currentSchema ? ['', 'CURRENT_SCHEMA:', JSON.stringify(params.currentSchema, null, 2)] : [])
  ].join('\n');
}
