import { z } from 'zod';

export const DataReportJsonScopeSchema = z.enum(['single', 'multiple']);
export const DataReportJsonLayoutSchema = z.enum(['dashboard', 'single-table']);
export const DataReportJsonGenerationModeSchema = z.enum(['brand-new', 'patch']);
export const DataReportJsonGenerationStatusSchema = z.enum(['success', 'partial', 'failed']);
export const DataReportJsonComplexityLevelSchema = z.enum(['simple', 'complex']);
export const DataReportJsonFilterValueTypeSchema = z.enum(['string', 'string[]', 'date-range']);
export const DataReportJsonBlockTypeSchema = z.enum(['metrics', 'chart', 'table']);
export const DataReportJsonChartTypeSchema = z.enum(['line', 'bar', 'pie', 'line-bar']);
export const DataReportJsonChartSeriesTypeSchema = z.enum(['line', 'bar']);
export const DataReportJsonFormatSchema = z.enum(['text', 'number', 'percent', 'date']);
export const DataReportJsonAggregateSchema = z.enum(['latest', 'sum']);
export const DataReportJsonMigrationSourceProductSchema = z.enum([
  'metabase',
  'superset',
  'grafana',
  'retool',
  'custom'
]);

const DataReportJsonOptionSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()])
});

export const DataReportJsonMetaSchema = z.object({
  reportId: z.string(),
  title: z.string(),
  description: z.string(),
  route: z.string(),
  templateRef: z.string(),
  scope: DataReportJsonScopeSchema,
  layout: DataReportJsonLayoutSchema,
  owner: z.literal('data-report-json-agent')
});

export const DataReportJsonFilterFieldComponentSchema = z.object({
  type: z.literal('custom'),
  componentKey: z.string(),
  props: z.record(z.string(), z.unknown())
});

export const DataReportJsonFilterFieldSchema = z.object({
  name: z.string(),
  label: z.string(),
  options: z.array(DataReportJsonOptionSchema).optional(),
  component: DataReportJsonFilterFieldComponentSchema,
  valueType: DataReportJsonFilterValueTypeSchema,
  required: z.boolean(),
  defaultValue: z.unknown().optional(),
  requestMapping: z.record(z.string(), z.string()).optional()
});

export const DataReportJsonFilterSchemaSchema = z.object({
  formKey: z.string(),
  layout: z.literal('inline'),
  fields: z.array(DataReportJsonFilterFieldSchema)
});

export const DataReportJsonDataSourceResponseAdapterSchema = z.object({
  listPath: z.string(),
  totalPath: z.string().optional()
});

export const DataReportJsonDataSourceSchema = z.object({
  serviceKey: z.string(),
  requestAdapter: z.record(z.string(), z.string()),
  responseAdapter: DataReportJsonDataSourceResponseAdapterSchema
});

export const DataReportJsonMetricItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  field: z.string(),
  format: z.enum(['number', 'percent']),
  aggregate: DataReportJsonAggregateSchema
});

export const DataReportJsonChartSeriesSchema = z.object({
  key: z.string(),
  label: z.string(),
  field: z.string(),
  seriesType: DataReportJsonChartSeriesTypeSchema.optional()
});

export const DataReportJsonTableColumnSchema = z.object({
  title: z.string(),
  dataIndex: z.string(),
  width: z.number(),
  fixed: z.enum(['left', 'right']).optional()
});

export const DataReportJsonStructuredFilterInputSchema = z.object({
  name: z.string(),
  label: z.string(),
  options: z.array(DataReportJsonOptionSchema).optional(),
  componentKey: z.string(),
  valueType: DataReportJsonFilterValueTypeSchema,
  required: z.boolean(),
  defaultValue: z.unknown().optional(),
  requestMapping: z.record(z.string(), z.string()).optional(),
  props: z.record(z.string(), z.unknown()).optional()
});

export const DataReportJsonStructuredDataSourceInputSchema = z.object({
  key: z.string(),
  serviceKey: z.string(),
  requestAdapter: z.record(z.string(), z.string()),
  responseAdapter: DataReportJsonDataSourceResponseAdapterSchema
});

export const DataReportJsonStructuredMetricsSpecSchema = z.object({
  title: z.string().optional(),
  items: z.array(DataReportJsonMetricItemSchema)
});

export const DataReportJsonStructuredChartSpecSchema = z.object({
  title: z.string(),
  chartType: DataReportJsonChartTypeSchema,
  xField: z.string(),
  series: z.array(DataReportJsonChartSeriesSchema)
});

export const DataReportJsonStructuredTableSpecSchema = z.object({
  title: z.string(),
  exportable: z.boolean(),
  columns: z.array(DataReportJsonTableColumnSchema)
});

const DataReportJsonSectionDefaultsSchema = z.object({
  filters: z.record(z.string(), z.unknown()).optional(),
  table: z
    .object({
      pageSize: z.number().optional(),
      defaultSort: z
        .object({
          field: z.string(),
          order: z.enum(['asc', 'desc'])
        })
        .optional()
    })
    .optional(),
  chart: z
    .object({
      granularity: z.literal('day').optional()
    })
    .optional()
});

export const DataReportJsonStructuredSectionInputSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  dataSourceKey: z.string(),
  metricsSpec: z.union([DataReportJsonStructuredMetricsSpecSchema, z.array(DataReportJsonMetricItemSchema)]),
  chartSpec: DataReportJsonStructuredChartSpecSchema,
  tableSpec: DataReportJsonStructuredTableSpecSchema,
  sectionDefaults: DataReportJsonSectionDefaultsSchema.optional()
});

export const DataReportJsonGenerationHintsSchema = z.object({
  autoQueryOnInit: z.boolean().optional(),
  autoQueryOnFilterChange: z.boolean().optional(),
  cacheKey: z.string().optional(),
  targetLatencyClass: z.enum(['fast', 'balanced', 'quality']).optional()
});

export const DataReportJsonMigrationContextSchema = z.object({
  sourceProduct: DataReportJsonMigrationSourceProductSchema,
  sourceDatasetName: z.string().optional(),
  sourcePanelTypes: z.array(z.string()).optional(),
  sourceFilters: z.array(z.string()).optional(),
  sourceNotes: z.string().optional()
});

export const DataReportJsonStructuredInputSchema = z.object({
  meta: DataReportJsonMetaSchema.omit({ owner: true }),
  filters: z.array(DataReportJsonStructuredFilterInputSchema),
  dataSources: z.array(DataReportJsonStructuredDataSourceInputSchema),
  sections: z.array(DataReportJsonStructuredSectionInputSchema),
  generationHints: DataReportJsonGenerationHintsSchema.optional(),
  migrationContext: DataReportJsonMigrationContextSchema.optional()
});

export const DataReportJsonMetricsBlockSchema = z.object({
  type: z.literal('metrics'),
  title: z.string(),
  items: z.array(DataReportJsonMetricItemSchema)
});

export const DataReportJsonChartBlockSchema = z.object({
  type: z.literal('chart'),
  title: z.string(),
  chartType: DataReportJsonChartTypeSchema,
  xField: z.string(),
  series: z.array(DataReportJsonChartSeriesSchema)
});

export const DataReportJsonTableBlockSchema = z.object({
  type: z.literal('table'),
  title: z.string(),
  exportable: z.boolean(),
  columns: z.array(DataReportJsonTableColumnSchema)
});

export const DataReportJsonBlockSchema = z.discriminatedUnion('type', [
  DataReportJsonMetricsBlockSchema,
  DataReportJsonChartBlockSchema,
  DataReportJsonTableBlockSchema
]);

export const DataReportJsonSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  dataSourceKey: z.string(),
  sectionDefaults: z.object({
    filters: z.record(z.string(), z.unknown()),
    table: z.object({
      pageSize: z.number(),
      defaultSort: z.object({
        field: z.string(),
        order: z.enum(['asc', 'desc'])
      })
    }),
    chart: z
      .object({
        granularity: z.literal('day')
      })
      .optional()
  }),
  blocks: z.array(DataReportJsonBlockSchema)
});

export const DataReportJsonPageDefaultsSchema = z.object({
  filters: z.record(z.string(), z.unknown()),
  queryPolicy: z.object({
    autoQueryOnInit: z.boolean(),
    autoQueryOnFilterChange: z.boolean(),
    cacheKey: z.string()
  })
});

export const DataReportJsonPatchOperationSchema = z.object({
  op: z.enum([
    'replace-meta-title',
    'replace-section-title',
    'replace-block-title',
    'replace-filter-default',
    'prepend-block'
  ]),
  path: z.string(),
  summary: z.string()
});

export const DataReportJsonVersionInfoSchema = z.object({
  baseVersion: z.number(),
  nextVersion: z.number(),
  patchSummary: z.string()
});

export const DataReportJsonSchemaSchema = z.object({
  version: z.literal('1.0'),
  kind: z.literal('data-report-json'),
  meta: DataReportJsonMetaSchema,
  pageDefaults: DataReportJsonPageDefaultsSchema,
  filterSchema: DataReportJsonFilterSchemaSchema,
  dataSources: z.record(z.string(), DataReportJsonDataSourceSchema),
  sections: z.array(DataReportJsonSectionSchema),
  registries: z.object({
    filterComponents: z.array(z.string()),
    blockTypes: z.array(DataReportJsonBlockTypeSchema),
    serviceKeys: z.array(z.string())
  }),
  modification: z.object({
    strategy: z.literal('patchable-json'),
    supportedOperations: z.array(
      z.enum(['update-filter-defaults', 'replace-section', 'append-section', 'update-block-config'])
    )
  }),
  patchOperations: z.array(DataReportJsonPatchOperationSchema).optional(),
  warnings: z.array(z.string())
});

export const DataReportJsonAnalysisArtifactSchema = z.object({
  reportType: z.literal('data-report-json').optional(),
  title: z.string(),
  reportName: z.string().optional(),
  routeName: z.string(),
  route: z.string(),
  templateRef: z.string(),
  scope: DataReportJsonScopeSchema,
  layout: DataReportJsonLayoutSchema,
  serviceKey: z.string().optional(),
  sourceProduct: DataReportJsonMigrationSourceProductSchema.optional(),
  keywords: z.array(z.string()).optional(),
  complexity: DataReportJsonComplexityLevelSchema.optional()
});
