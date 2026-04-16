import { getSchemaFilterFields, getSchemaSectionBlocks, getSchemaSections } from './report-schema-workbench-formatter';

function createMockMetricValue(index: number) {
  return String(100 + index * 12);
}

function createMockChartRows(chartBlock: Record<string, unknown> | undefined) {
  if (!chartBlock) {
    return [];
  }

  const xField = String(chartBlock.xField ?? 'dt');
  const series = Array.isArray(chartBlock.series) ? (chartBlock.series as Array<Record<string, unknown>>) : [];
  return Array.from({ length: 3 }, (_, index) => ({
    [xField]: xField === 'category_name' ? `分类 ${index + 1}` : `2026-04-${String(index + 1).padStart(2, '0')}`,
    ...(series[0]?.field ? { [String(series[0].field)]: 100 + index * 20 } : {})
  }));
}

function createMockTableRows(tableBlock: Record<string, unknown> | undefined) {
  if (!tableBlock) {
    return [];
  }

  const columns = Array.isArray(tableBlock.columns) ? (tableBlock.columns as Array<Record<string, unknown>>) : [];
  return Array.from({ length: 3 }, (_, rowIndex) =>
    Object.fromEntries(
      columns.map((column, columnIndex) => [
        String(column.dataIndex ?? `field_${columnIndex}`),
        columnIndex === 0 ? `样例 ${rowIndex + 1}` : String((rowIndex + 1) * (columnIndex + 2) * 10)
      ])
    )
  );
}

export function getSingleReportPreviewModel(schema: Record<string, unknown> | undefined) {
  const firstSection = getSchemaSections(schema)[0];
  const blocks = getSchemaSectionBlocks(firstSection);
  const metricsBlock = blocks.find(block => block.type === 'metrics');
  const chartBlock = blocks.find(block => block.type === 'chart');
  const tableBlock = blocks.find(block => block.type === 'table');
  const filters = getSchemaFilterFields(schema);
  const metricItems =
    metricsBlock && Array.isArray(metricsBlock.items) ? (metricsBlock.items as Array<Record<string, unknown>>) : [];

  return {
    sectionTitle: String(firstSection?.title ?? '单报表预览'),
    filters,
    metricItems,
    chartBlock: chartBlock as Record<string, unknown> | undefined,
    tableBlock: tableBlock as Record<string, unknown> | undefined,
    metricPreview: metricItems.map((item, index) => ({
      key: String(item.key ?? `metric_${index}`),
      label: String(item.label ?? item.key ?? '-'),
      value: createMockMetricValue(index)
    })),
    chartRows: createMockChartRows(chartBlock as Record<string, unknown> | undefined),
    tableRows: createMockTableRows(tableBlock as Record<string, unknown> | undefined)
  };
}
