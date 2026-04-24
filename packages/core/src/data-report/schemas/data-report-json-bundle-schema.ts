import { z } from 'zod';

import {
  DataReportJsonAggregateSchema,
  DataReportJsonChartSeriesSchema,
  DataReportJsonChartTypeSchema,
  DataReportJsonTableColumnSchema
} from './data-report-json-schema';

export const DataReportJsonBundleFieldValueTypeSchema = z.enum([
  'string',
  'number',
  'percent',
  'date',
  'date-range',
  'string[]',
  'boolean'
]);

const DataReportJsonBundleOptionSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()])
});

export const DataReportJsonBundleFieldSchema = z.object({
  name: z.string(),
  label: z.string(),
  valueType: DataReportJsonBundleFieldValueTypeSchema,
  required: z.boolean(),
  requestKey: z.string().optional(),
  formatter: z.string().optional(),
  defaultValue: z.unknown().optional(),
  options: z.array(DataReportJsonBundleOptionSchema).optional()
});

export const DataReportJsonBundleFormatterSchema = z.object({
  name: z.string(),
  input: z.enum(['string', 'number', 'date', 'unknown']),
  output: z.enum(['text', 'number', 'percent', 'date'])
});

export const DataReportJsonBundleServiceSchema = z.object({
  serviceKey: z.string(),
  lambdaKey: z.string(),
  requestTypeName: z.string(),
  responseTypeName: z.string(),
  listPath: z.string(),
  totalPath: z.string().optional()
});

export const DataReportJsonBundleMetricSchema = z.object({
  key: z.string(),
  label: z.string(),
  field: z.string(),
  format: z.enum(['number', 'percent']),
  aggregate: DataReportJsonAggregateSchema
});

export const DataReportJsonBundleChartSchema = z.object({
  key: z.string(),
  title: z.string(),
  chartType: DataReportJsonChartTypeSchema,
  xField: z.string(),
  series: z.array(DataReportJsonChartSeriesSchema)
});

export const DataReportJsonBundleTableSchema = z.object({
  key: z.string(),
  title: z.string(),
  exportable: z.boolean(),
  columns: z.array(DataReportJsonTableColumnSchema)
});

export const DataReportJsonBundleComponentPlanSchema = z.object({
  fileName: z.string(),
  role: z.enum(['report-entry', 'metrics', 'chart', 'table', 'hook', 'formatter', 'search', 'page']),
  dependsOn: z.array(z.string()).optional()
});

export const DataReportJsonBundleReportSchema = z.object({
  id: z.string(),
  componentName: z.string(),
  titleI18nKey: z.string(),
  service: DataReportJsonBundleServiceSchema,
  dataModel: z.array(DataReportJsonBundleFieldSchema),
  metrics: z.array(DataReportJsonBundleMetricSchema),
  charts: z.array(DataReportJsonBundleChartSchema),
  tables: z.array(DataReportJsonBundleTableSchema),
  components: z.array(DataReportJsonBundleComponentPlanSchema)
});

export const DataReportJsonBundleFilePlanSchema = z.object({
  path: z.string(),
  kind: z.enum(['page', 'component', 'service', 'type', 'config', 'locale', 'route', 'test', 'doc']),
  source: z.enum(['intent', 'bundle-assembly', 'report-view', 'service-type', 'review', 'renderer'])
});

export const DataReportJsonBundleSchema = z.object({
  version: z.literal('data-report-json.v1'),
  targetProject: z.string(),
  page: z.object({
    routePath: z.string(),
    pageDir: z.string(),
    titleI18nKey: z.string(),
    mode: z.enum(['single', 'tabs', 'dashboard'])
  }),
  shared: z.object({
    searchParams: z.array(DataReportJsonBundleFieldSchema),
    defaultParams: z.record(z.string(), z.unknown()),
    formatters: z.array(DataReportJsonBundleFormatterSchema)
  }),
  reports: z.array(DataReportJsonBundleReportSchema).min(1),
  files: z.array(DataReportJsonBundleFilePlanSchema),
  checks: z.array(z.string())
});
