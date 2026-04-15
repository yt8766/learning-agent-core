import type {
  DataReportJsonChartSeries,
  DataReportJsonPatchIntent,
  DataReportJsonPatchOperation,
  DataReportJsonSchema,
  DataReportJsonSection
} from '../../../types/data-report-json';
import { normalizeIdentifier } from './goal-artifacts';
import { getIntentSubjects, hasIntent } from './schema-patch-intent-utils';
import { normalizePatchLabel, resolveFieldFromLabel } from './schema-patch-shared-utils';

function getFirstChartBlock(
  section?: DataReportJsonSection
): Extract<DataReportJsonSection['blocks'][number], { type: 'chart' }> | undefined {
  return section?.blocks.find(
    (block): block is Extract<DataReportJsonSection['blocks'][number], { type: 'chart' }> => block.type === 'chart'
  );
}

function ensureChartBlock(firstSection: DataReportJsonSection, operations: DataReportJsonPatchOperation[]) {
  let chartBlock = getFirstChartBlock(firstSection);
  if (chartBlock) {
    return chartBlock;
  }

  chartBlock = { type: 'chart', title: `${firstSection.title}趋势`, chartType: 'line', xField: 'dt', series: [] };
  firstSection.blocks.splice(1, 0, chartBlock);
  operations.push({
    op: 'prepend-block',
    path: '/sections/0/blocks/1',
    summary: `为报表 ${firstSection.title} 新增趋势图`
  });
  return chartBlock;
}

function ensureChartSeries(
  schema: DataReportJsonSchema,
  chartBlock: Extract<DataReportJsonSection['blocks'][number], { type: 'chart' }>,
  label: string
) {
  let series = chartBlock.series.find(item => item.label === label);
  if (series) {
    return series;
  }

  const resolvedField = resolveFieldFromLabel(schema, label) || 'seriesValue';
  const normalized = normalizeIdentifier(label) || normalizeIdentifier(resolvedField) || 'seriesValue';
  series = { key: normalized, label, field: resolvedField };
  chartBlock.series.push(series);
  return series;
}

function normalizeSeriesType(rawValue: string): 'line' | 'bar' {
  return /柱状|bar/i.test(rawValue) ? 'bar' : 'line';
}

function deriveChartTypeFromSeries(series: DataReportJsonChartSeries[]) {
  const assignedTypes = new Set(series.map(item => item.seriesType).filter(Boolean));
  if (assignedTypes.has('line') && assignedTypes.has('bar')) {
    return 'line-bar' as const;
  }
  if (assignedTypes.has('bar')) {
    return 'bar' as const;
  }
  if (assignedTypes.has('line')) {
    return 'line' as const;
  }
  return undefined;
}

function updateChartTypeIfRequested(
  request: string,
  chartBlock: Extract<DataReportJsonSection['blocks'][number], { type: 'chart' }>,
  operations: DataReportJsonPatchOperation[]
) {
  const nextChartType = /组合图|混合图|line-bar/i.test(request)
    ? 'line-bar'
    : /饼图|pie/i.test(request)
      ? 'pie'
      : /柱状图|柱状|bar/i.test(request)
        ? 'bar'
        : /折线图|折线|line/i.test(request)
          ? 'line'
          : undefined;

  if (!nextChartType || chartBlock.chartType === nextChartType) {
    return;
  }

  chartBlock.chartType = nextChartType;
  operations.push({
    op: 'prepend-block',
    path: '/sections/0/blocks/chart/chartType',
    summary: `图表改为${nextChartType === 'line-bar' ? '组合图' : nextChartType === 'bar' ? '柱状图' : nextChartType === 'pie' ? '饼图' : '折线图'}`
  });
}

export function appendChartSeriesIfNeeded(
  schema: DataReportJsonSchema,
  request: string,
  intents?: DataReportJsonPatchIntent[]
) {
  const firstSection = schema.sections[0];
  if (!firstSection) {
    return [];
  }

  const operations: DataReportJsonPatchOperation[] = [];
  const intentSubjects = getIntentSubjects(intents, 'chartBlock', 'add');
  const labels = intentSubjects.length
    ? intentSubjects.map(subject => normalizePatchLabel(subject))
    : Array.from(
        request.matchAll(
          /(?:(?:新增|增加|添加)(?:(?:图表\s*)?(?:series|序列)\s*|图表\s*)|图表(?:新增|增加|添加)\s*)([^，。\n]+)/gi
        )
      ).map(match => normalizePatchLabel(match[1] ?? ''));
  if (!labels.length) {
    return operations;
  }

  const chartBlock = ensureChartBlock(firstSection, operations);
  for (const label of labels) {
    if (!label || chartBlock.series.some(series => series.label === label)) {
      continue;
    }

    ensureChartSeries(schema, chartBlock, label);
    operations.push({
      op: 'prepend-block',
      path: `/sections/0/blocks/${firstSection.blocks.findIndex(block => block.type === 'chart')}/series/${chartBlock.series.length - 1}`,
      summary: `新增图表 series ${label}`
    });
  }

  return operations;
}

export function removeChartSeriesIfNeeded(
  schema: DataReportJsonSchema,
  request: string,
  intents?: DataReportJsonPatchIntent[]
) {
  const firstSection = schema.sections[0];
  const chartBlock = getFirstChartBlock(firstSection);
  if (!firstSection || !chartBlock) {
    return [];
  }

  const operations: DataReportJsonPatchOperation[] = [];
  const labels = getIntentSubjects(intents, 'chartBlock', 'remove');
  const normalizedLabels = labels.length
    ? labels.map(label => normalizePatchLabel(label))
    : Array.from(
        request.matchAll(
          /(?:(?:删除|移除|去掉)(?:(?:图表\s*)?(?:series|序列)\s*|图表\s*)|图表(?:删除|移除|去掉)\s*)([^，。\n]+)/gi
        )
      ).map(match => normalizePatchLabel(match[1] ?? ''));
  for (const label of normalizedLabels) {
    if (!label) {
      continue;
    }
    const nextSeries = chartBlock.series.filter(series => series.label !== label);
    if (nextSeries.length === chartBlock.series.length) {
      continue;
    }
    chartBlock.series = nextSeries;
    operations.push({
      op: 'prepend-block',
      path: `/sections/0/blocks/${firstSection.blocks.findIndex(block => block.type === 'chart')}/series`,
      summary: `删除图表 series ${label}`
    });
  }

  return operations;
}

export function updateChartSeriesTypesIfNeeded(
  schema: DataReportJsonSchema,
  request: string,
  intents?: DataReportJsonPatchIntent[]
) {
  const firstSection = schema.sections[0];
  if (!firstSection) {
    return [];
  }
  if (
    !hasIntent(intents, 'chartBlock', 'update-style') &&
    !/图表|chart|折线|柱状|line|bar|饼图|pie|组合图|混合图/i.test(request)
  ) {
    return [];
  }

  const operations: DataReportJsonPatchOperation[] = [];
  const chartBlock = ensureChartBlock(firstSection, operations);
  const assignments = Array.from(
    request.matchAll(/(?:图表(?:里|中)?\s*)?([^，。\n]+?)\s*(?:用|走)\s*(折线|柱状|line|bar)/gi)
  );

  updateChartTypeIfRequested(request, chartBlock, operations);
  if (!assignments.length) {
    return operations;
  }

  const summaryParts: string[] = [];
  for (const match of assignments) {
    const label = normalizePatchLabel((match[1] ?? '').replace(/^里|^中/, ''));
    if (!label) {
      continue;
    }
    const series = ensureChartSeries(schema, chartBlock, label);
    const seriesType = normalizeSeriesType(match[2] ?? '');
    series.seriesType = seriesType;
    summaryParts.push(`${label}=${seriesType === 'bar' ? '柱状' : '折线'}`);
  }

  const derivedChartType = deriveChartTypeFromSeries(chartBlock.series);
  if (derivedChartType) {
    chartBlock.chartType = derivedChartType;
  }

  if (summaryParts.length) {
    operations.push({
      op: 'prepend-block',
      path: `/sections/0/blocks/${firstSection.blocks.findIndex(block => block.type === 'chart')}`,
      summary: `图表系列样式更新为${chartBlock.chartType === 'line-bar' ? '组合图' : chartBlock.chartType === 'bar' ? '柱状图' : '折线图'}：${summaryParts.join('，')}`
    });
  }

  return operations;
}
