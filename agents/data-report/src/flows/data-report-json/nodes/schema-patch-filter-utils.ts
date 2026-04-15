import type {
  DataReportJsonFilterField,
  DataReportJsonPatchIntent,
  DataReportJsonPatchOperation,
  DataReportJsonSchema
} from '../../../types/data-report-json';
import { hasIntent } from './schema-patch-intent-utils';
import { normalizeTextValue } from './schema-patch-shared-utils';

function resolveFilterField(schema: DataReportJsonSchema, request: string) {
  const fields = schema.filterSchema.fields;
  const candidates = [...fields].sort(
    (left, right) => normalizeTextValue(right.label).length - normalizeTextValue(left.label).length
  );
  return candidates.find(field => {
    const label = normalizeTextValue(field.label);
    return (label && request.includes(label)) || request.includes(field.name);
  });
}

function buildRegeneratedOptions(field: DataReportJsonFilterField) {
  if (field.name === 'user_type') {
    return [
      { label: '全部', value: 'dau' },
      { label: '新用户', value: 'new' },
      { label: '老用户', value: 'old' }
    ];
  }

  return field.options ?? [];
}

export function updateFilterFieldComponentIfNeeded(
  schema: DataReportJsonSchema,
  request: string,
  intents?: DataReportJsonPatchIntent[]
) {
  if (
    !hasIntent(intents, 'filterSchema', 'update-component') &&
    (!/(筛选|筛选项|filter)/i.test(request) || !/(输入框|选择框|下拉|单选|多选)/i.test(request))
  ) {
    return [];
  }

  const field = resolveFilterField(schema, request);
  if (!field) {
    return [];
  }

  const operations: DataReportJsonPatchOperation[] = [];
  if (/输入框/.test(request)) {
    field.component.componentKey = 'gosh-input';
    field.valueType = 'string';
    delete field.options;
    operations.push({
      op: 'prepend-block',
      path: `/filterSchema/fields/${schema.filterSchema.fields.findIndex(item => item.name === field.name)}/component`,
      summary: `筛选项 ${normalizeTextValue(field.label) || field.name} 改为输入框`
    });
    return operations;
  }

  field.component.componentKey = field.component.componentKey.includes('select')
    ? field.component.componentKey
    : 'gosh-select';
  field.valueType = /多选/.test(request) ? 'string[]' : 'string';
  field.options = buildRegeneratedOptions(field);
  operations.push({
    op: 'prepend-block',
    path: `/filterSchema/fields/${schema.filterSchema.fields.findIndex(item => item.name === field.name)}/component`,
    summary: `筛选项 ${normalizeTextValue(field.label) || field.name} 改为${/多选/.test(request) ? '多选下拉' : '下拉选择'}`
  });
  return operations;
}

export function regenerateFilterFieldOptionsIfNeeded(
  schema: DataReportJsonSchema,
  request: string,
  intents?: DataReportJsonPatchIntent[]
) {
  if (
    !hasIntent(intents, 'filterSchema', 'regenerate-options') &&
    (!/(筛选|筛选项|filter)/i.test(request) ||
      !/(options|选项)/i.test(request) ||
      !/(重生成|重新生成|刷新)/.test(request))
  ) {
    return [];
  }

  const field = resolveFilterField(schema, request);
  if (!field) {
    return [];
  }

  field.options = buildRegeneratedOptions(field);
  return [
    {
      op: 'prepend-block',
      path: `/filterSchema/fields/${schema.filterSchema.fields.findIndex(item => item.name === field.name)}/options`,
      summary: `重新生成筛选项 ${normalizeTextValue(field.label) || field.name} 的 options`
    }
  ];
}
