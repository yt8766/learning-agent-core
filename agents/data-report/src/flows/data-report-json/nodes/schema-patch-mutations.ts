import type {
  DataReportJsonPatchIntent,
  DataReportJsonPatchOperation,
  DataReportJsonSchema,
  DataReportJsonSection
} from '../../../types/data-report-json';
import { normalizeIdentifier } from './goal-artifacts';
import { cloneSchema } from './shared-core';
import {
  appendChartSeriesIfNeeded,
  removeChartSeriesIfNeeded,
  updateChartSeriesTypesIfNeeded
} from './schema-patch-chart-utils';
import { regenerateFilterFieldOptionsIfNeeded, updateFilterFieldComponentIfNeeded } from './schema-patch-filter-utils';
import { parsePatchIntents } from './patch-intent-parser';
import { getIntentSubjects, hasIntent } from './schema-patch-intent-utils';
import { normalizePatchLabel, resolveFieldFromLabel } from './schema-patch-shared-utils';

function appendMetricsBlockIfNeeded(
  schema: DataReportJsonSchema,
  request: string,
  intents?: DataReportJsonPatchIntent[]
) {
  if (!hasIntent(intents, 'metricsBlock', 'add') && !/指标|metric/i.test(request)) {
    return undefined;
  }

  const firstSection = schema.sections[0];
  if (!firstSection) {
    return undefined;
  }

  if (firstSection.blocks.some(block => block.type === 'metrics')) {
    return undefined;
  }

  firstSection.blocks.unshift({
    type: 'metrics',
    title: '核心指标',
    items:
      firstSection.dataSourceKey === 'roomTreasure'
        ? [
            { key: 'prizeNum', label: '宝箱生成数', field: 'prize_num', format: 'number', aggregate: 'latest' },
            { key: 'joinUserCnt', label: '参与用户数', field: 'join_user_cnt', format: 'number', aggregate: 'latest' }
          ]
        : [{ key: 'summaryValue', label: '核心指标', field: 'value', format: 'number', aggregate: 'latest' }]
  });

  return {
    op: 'prepend-block',
    path: `/sections/0/blocks/0`,
    summary: `为报表 ${firstSection.title} 新增核心指标卡`
  } satisfies DataReportJsonPatchOperation;
}

function normalizeColumnTitle(rawTitle: string) {
  return rawTitle
    .trim()
    .replace(/^(新增|增加|添加|删除|去掉|移除)/, '')
    .replace(/列$/, '')
    .trim();
}

function defaultDataIndexFromTitle(title: string) {
  const normalized = normalizeIdentifier(title);
  return normalized ? `${normalized}_label` : 'value_label';
}

function appendMetricsItemsIfNeeded(
  schema: DataReportJsonSchema,
  request: string,
  intents?: DataReportJsonPatchIntent[]
) {
  const firstSection = schema.sections[0];
  const metricsBlock = firstSection?.blocks.find(
    (block): block is Extract<DataReportJsonSection['blocks'][number], { type: 'metrics' }> => block.type === 'metrics'
  );
  if (!firstSection || !metricsBlock) {
    return [];
  }

  const operations: DataReportJsonPatchOperation[] = [];
  const labels = getIntentSubjects(intents, 'metricsBlock', 'add');
  const normalizedLabels = labels.length
    ? labels.map(label => normalizePatchLabel(label))
    : Array.from(request.matchAll(/(?:(?:新增|增加|添加)指标\s*|指标(?:新增|增加|添加)\s*)([^，。\n]+)/g)).map(match =>
        normalizePatchLabel(match[1] ?? '')
      );
  for (const label of normalizedLabels) {
    if (!label || metricsBlock.items.some(item => item.label === label)) {
      continue;
    }
    const resolvedField = resolveFieldFromLabel(schema, label) || 'metricValue';
    const normalized = normalizeIdentifier(label) || normalizeIdentifier(resolvedField) || 'metricValue';
    metricsBlock.items.push({ key: normalized, label, field: resolvedField, format: 'number', aggregate: 'latest' });
    operations.push({
      op: 'prepend-block',
      path: `/sections/0/blocks/${firstSection.blocks.findIndex(block => block.type === 'metrics')}/items/${metricsBlock.items.length - 1}`,
      summary: `新增指标 ${label}`
    });
  }

  return operations;
}

function removeMetricsItemsIfNeeded(
  schema: DataReportJsonSchema,
  request: string,
  intents?: DataReportJsonPatchIntent[]
) {
  const firstSection = schema.sections[0];
  const metricsBlock = firstSection?.blocks.find(
    (block): block is Extract<DataReportJsonSection['blocks'][number], { type: 'metrics' }> => block.type === 'metrics'
  );
  if (!firstSection || !metricsBlock) {
    return [];
  }

  const operations: DataReportJsonPatchOperation[] = [];
  const labels = getIntentSubjects(intents, 'metricsBlock', 'remove');
  const normalizedLabels = labels.length
    ? labels.map(label => normalizePatchLabel(label))
    : Array.from(request.matchAll(/(?:(?:删除|移除|去掉)指标\s*|指标(?:删除|移除|去掉)\s*)([^，。\n]+)/g)).map(match =>
        normalizePatchLabel(match[1] ?? '')
      );
  for (const label of normalizedLabels) {
    if (!label) {
      continue;
    }
    const nextItems = metricsBlock.items.filter(item => item.label !== label);
    if (nextItems.length === metricsBlock.items.length) {
      continue;
    }
    metricsBlock.items = nextItems;
    operations.push({
      op: 'prepend-block',
      path: `/sections/0/blocks/${firstSection.blocks.findIndex(block => block.type === 'metrics')}/items`,
      summary: `删除指标 ${label}`
    });
  }

  return operations;
}

function updateTableColumnsIfNeeded(schema: DataReportJsonSchema, request: string) {
  const firstTable = schema.sections
    .flatMap(section => section.blocks)
    .find(
      (block): block is Extract<DataReportJsonSection['blocks'][number], { type: 'table' }> => block.type === 'table'
    );
  if (!firstTable) {
    return [];
  }

  const operations: DataReportJsonPatchOperation[] = [];
  for (const match of Array.from(request.matchAll(/(?:新增|增加|添加)([^，。\n]+?)列/g))) {
    const title = normalizeColumnTitle(match[1] ?? '');
    if (!title || firstTable.columns.some(column => column.title === title)) {
      continue;
    }
    firstTable.columns.push({ title, dataIndex: defaultDataIndexFromTitle(title), width: 160 });
    operations.push({
      op: 'prepend-block',
      path: `/sections/0/blocks/${schema.sections[0]?.blocks.findIndex(block => block.type === 'table') ?? 0}/columns/${firstTable.columns.length - 1}`,
      summary: `新增表格列 ${title}`
    });
  }

  for (const match of Array.from(request.matchAll(/(?:删除|移除|去掉)([^，。\n]+?)列/g))) {
    const title = normalizeColumnTitle(match[1] ?? '');
    if (!title) {
      continue;
    }
    const nextColumns = firstTable.columns.filter(column => column.title !== title);
    if (nextColumns.length === firstTable.columns.length) {
      continue;
    }
    firstTable.columns = nextColumns;
    operations.push({
      op: 'replace-section-title',
      path: '/sections/0/blocks/table/columns',
      summary: `删除表格列 ${title}`
    });
  }

  return operations;
}

function updateTitleIfNeeded(schema: DataReportJsonSchema, request: string) {
  if (
    /(明细表|表格|table|图表|趋势图|chart|指标卡|metrics?)(?:.{0,8})?(?:标题改成|标题改为|改成|改为)/i.test(request)
  ) {
    return undefined;
  }
  const match = request.match(/(?:标题改成|页面标题改成|标题改为|页面标题改为)([^，。\n]+)/);
  if (!match?.[1]) {
    return undefined;
  }
  const nextTitle = match[1].trim();
  if (!nextTitle) {
    return undefined;
  }
  schema.meta.title = nextTitle;
  return {
    op: 'replace-meta-title',
    path: '/meta/title',
    summary: `页面标题更新为 ${nextTitle}`
  } satisfies DataReportJsonPatchOperation;
}

function updateSectionTitleIfNeeded(schema: DataReportJsonSchema, request: string) {
  const match = request.match(/(?:第一个报表|首个报表|第一个 section).{0,8}(?:标题改成|标题改为)([^，。\n]+)/i);
  if (!match?.[1] || !schema.sections[0]) {
    return undefined;
  }
  const nextTitle = match[1].trim();
  schema.sections[0].title = nextTitle;
  return {
    op: 'replace-section-title',
    path: '/sections/0/title',
    summary: `首个报表标题更新为 ${nextTitle}`
  } satisfies DataReportJsonPatchOperation;
}

function updateBlockTitleIfNeeded(
  schema: DataReportJsonSchema,
  request: string,
  intents?: DataReportJsonPatchIntent[]
) {
  const firstSection = schema.sections[0];
  if (!firstSection) {
    return undefined;
  }

  const blockMatchers = [
    {
      type: 'table' as const,
      pattern: /(?:明细表|表格|table)(?:.{0,8})?(?:标题改成|标题改为|改成|改为)([^，。\n]+)/i,
      summaryPrefix: '明细表标题更新为'
    },
    {
      type: 'chart' as const,
      pattern: /(?:图表|趋势图|chart)(?:.{0,8})?(?:标题改成|标题改为|改成|改为)([^，。\n]+)/i,
      summaryPrefix: '图表标题更新为'
    },
    {
      type: 'metrics' as const,
      pattern: /(?:指标卡|指标|metrics?)(?:.{0,8})?(?:标题改成|标题改为|改成|改为)([^，。\n]+)/i,
      summaryPrefix: '指标卡标题更新为'
    }
  ];

  for (const matcher of blockMatchers) {
    const intentTitle = (intents ?? []).find(
      intent => intent.target === `${matcher.type}Block` && intent.action === 'update-title' && intent.subject?.trim()
    )?.subject;
    const match = request.match(matcher.pattern);
    const nextTitle = intentTitle?.trim() || match?.[1]?.trim();
    if (!nextTitle) {
      continue;
    }
    const blockIndex = firstSection.blocks.findIndex(block => block.type === matcher.type);
    if (blockIndex < 0) {
      continue;
    }
    firstSection.blocks[blockIndex] = {
      ...firstSection.blocks[blockIndex],
      title: nextTitle
    } as DataReportJsonSection['blocks'][number];
    return {
      op: 'replace-block-title',
      path: `/sections/0/blocks/${blockIndex}/title`,
      summary: `${matcher.summaryPrefix} ${nextTitle}`
    } satisfies DataReportJsonPatchOperation;
  }

  return undefined;
}

function updateFilterDefaultsIfNeeded(schema: DataReportJsonSchema, request: string) {
  const operations: DataReportJsonPatchOperation[] = [];

  if (/默认.{0,8}(最近7天|近7天|last ?7 days)/i.test(request)) {
    schema.pageDefaults.filters.dateRange = { preset: 'last7Days' };
    const dateRangeField = schema.filterSchema.fields.find(field => field.name === 'dateRange');
    if (dateRangeField) {
      dateRangeField.defaultValue = { preset: 'last7Days' };
    }
    operations.push({
      op: 'replace-filter-default',
      path: '/pageDefaults/filters/dateRange',
      summary: '默认日期范围更新为最近 7 天'
    });
  }

  if (/默认.{0,8}(最近30天|近30天|last ?30 days)/i.test(request)) {
    schema.pageDefaults.filters.dateRange = { preset: 'last30Days' };
    const dateRangeField = schema.filterSchema.fields.find(field => field.name === 'dateRange');
    if (dateRangeField) {
      dateRangeField.defaultValue = { preset: 'last30Days' };
    }
    operations.push({
      op: 'replace-filter-default',
      path: '/pageDefaults/filters/dateRange',
      summary: '默认日期范围更新为最近 30 天'
    });
  }

  if (/默认.{0,8}(新用户)/.test(request)) {
    schema.pageDefaults.filters.userType = 'new';
    schema.sections.forEach(section => {
      section.sectionDefaults.filters.userType = 'new';
    });
    operations.push({
      op: 'replace-filter-default',
      path: '/pageDefaults/filters/userType',
      summary: '默认用户类型更新为新用户'
    });
  }

  if (/默认.{0,8}(老用户)/.test(request)) {
    schema.pageDefaults.filters.userType = 'old';
    schema.sections.forEach(section => {
      section.sectionDefaults.filters.userType = 'old';
    });
    operations.push({
      op: 'replace-filter-default',
      path: '/pageDefaults/filters/userType',
      summary: '默认用户类型更新为老用户'
    });
  }

  return operations;
}

export function applySchemaModification(
  baseSchema: DataReportJsonSchema,
  request?: string,
  intents?: DataReportJsonPatchIntent[]
): DataReportJsonSchema {
  if (!request?.trim()) {
    return cloneSchema(baseSchema);
  }

  const nextSchema = cloneSchema(baseSchema);
  const resolvedIntents = intents ?? parsePatchIntents(request);
  const patchOperations = [
    updateTitleIfNeeded(nextSchema, request),
    updateSectionTitleIfNeeded(nextSchema, request),
    updateBlockTitleIfNeeded(nextSchema, request, resolvedIntents),
    appendMetricsBlockIfNeeded(nextSchema, request, resolvedIntents),
    ...appendMetricsItemsIfNeeded(nextSchema, request, resolvedIntents),
    ...removeMetricsItemsIfNeeded(nextSchema, request, resolvedIntents),
    ...appendChartSeriesIfNeeded(nextSchema, request, resolvedIntents),
    ...removeChartSeriesIfNeeded(nextSchema, request, resolvedIntents),
    ...updateChartSeriesTypesIfNeeded(nextSchema, request, resolvedIntents),
    ...updateFilterFieldComponentIfNeeded(nextSchema, request, resolvedIntents),
    ...regenerateFilterFieldOptionsIfNeeded(nextSchema, request, resolvedIntents),
    ...updateFilterDefaultsIfNeeded(nextSchema, request),
    ...updateTableColumnsIfNeeded(nextSchema, request)
  ].filter((item): item is DataReportJsonPatchOperation => Boolean(item));
  nextSchema.patchOperations = patchOperations;
  return nextSchema;
}
