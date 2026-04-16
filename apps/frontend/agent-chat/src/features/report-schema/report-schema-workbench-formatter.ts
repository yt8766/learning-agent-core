import { toWorkbenchRecord } from './report-schema-workbench-parser';

export function formatWorkbenchJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function getSchemaSections(schema: Record<string, unknown> | undefined) {
  return Array.isArray(schema?.sections) ? (schema.sections as Array<Record<string, unknown>>) : [];
}

export function getSchemaFilterFields(schema: Record<string, unknown> | undefined) {
  const filterSchema = schema?.filterSchema as Record<string, unknown> | undefined;
  return Array.isArray(filterSchema?.fields) ? (filterSchema.fields as Array<Record<string, unknown>>) : [];
}

export function getSchemaSectionBlocks(section: Record<string, unknown> | undefined) {
  return Array.isArray(section?.blocks) ? (section.blocks as Array<Record<string, unknown>>) : [];
}

export function getSchemaTableColumns(schema: Record<string, unknown> | undefined) {
  const firstSection = getSchemaSections(schema)[0];
  const blocks = getSchemaSectionBlocks(firstSection);
  const tableBlock = blocks.find(block => block.type === 'table');
  return Array.isArray(tableBlock?.columns) ? (tableBlock.columns as Array<Record<string, unknown>>) : [];
}

export function getSchemaMetricsItems(schema: Record<string, unknown> | undefined) {
  const firstSection = getSchemaSections(schema)[0];
  const blocks = getSchemaSectionBlocks(firstSection);
  const metricsBlock = blocks.find(block => block.type === 'metrics');
  return Array.isArray(metricsBlock?.items) ? (metricsBlock.items as Array<Record<string, unknown>>) : [];
}

export function getSchemaChartSummary(schema: Record<string, unknown> | undefined) {
  const firstSection = getSchemaSections(schema)[0];
  const blocks = getSchemaSectionBlocks(firstSection);
  const chartBlock = blocks.find(block => block.type === 'chart');
  if (!chartBlock) {
    return undefined;
  }

  return {
    title: String(chartBlock.title ?? '-'),
    chartType: String(chartBlock.chartType ?? '-'),
    xField: String(chartBlock.xField ?? '-'),
    series: Array.isArray(chartBlock.series) ? (chartBlock.series as Array<Record<string, unknown>>) : []
  };
}

export function getSchemaRuntimeSummary(
  events: Array<{ stage: string; status: string; details?: Record<string, unknown> }>
) {
  return events.map(item => ({
    stage: item.stage,
    status: item.status,
    elapsedMs: typeof item.details?.elapsedMs === 'number' ? item.details.elapsedMs : undefined,
    cacheHit: item.details?.cacheHit === true,
    modelId: typeof item.details?.modelId === 'string' ? item.details.modelId : undefined,
    degraded: item.details?.degraded === true,
    fallbackReason: typeof item.details?.fallbackReason === 'string' ? item.details.fallbackReason : undefined
  }));
}

export function getSchemaDataSourceMappings(schema: Record<string, unknown> | undefined) {
  const dataSources = schema?.dataSources as Record<string, Record<string, unknown>> | undefined;
  if (!dataSources) {
    return [];
  }

  return Object.entries(dataSources).map(([key, value]) => ({
    key,
    serviceKey: String(toWorkbenchRecord(value)?.serviceKey ?? '-'),
    requestAdapter: toWorkbenchRecord(toWorkbenchRecord(value)?.requestAdapter) ?? {},
    responseAdapter: toWorkbenchRecord(toWorkbenchRecord(value)?.responseAdapter) ?? {}
  }));
}

export function getSchemaPreviewWarnings(
  schema: Record<string, unknown> | undefined,
  runtimeSummary: Array<{
    stage: string;
    status: string;
    degraded?: boolean;
    fallbackReason?: string;
  }>
) {
  const schemaWarnings = Array.isArray(schema?.warnings)
    ? (schema.warnings as unknown[]).map(item => String(item))
    : [];
  const runtimeWarnings = runtimeSummary
    .filter(item => item.degraded)
    .map(item => `${item.stage} 已降级：${item.fallbackReason ?? 'unknown'}`);

  return Array.from(new Set([...schemaWarnings, ...runtimeWarnings]));
}
