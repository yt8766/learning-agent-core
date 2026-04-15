import { z } from 'zod';

import type { DataReportJsonSchema as DataReportJsonSchemaType } from '../../../types/data-report-json';

export const dataReportJsonFilterFieldSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  options: z
    .array(
      z.object({
        label: z.string().min(1),
        value: z.union([z.string().min(1), z.number()])
      })
    )
    .optional(),
  component: z.object({
    type: z.literal('custom'),
    componentKey: z.string().min(1),
    props: z.record(z.string(), z.unknown())
  }),
  valueType: z.enum(['string', 'string[]', 'date-range']),
  required: z.boolean(),
  defaultValue: z.unknown().optional(),
  requestMapping: z.record(z.string(), z.string()).optional()
});

export const dataReportJsonFilterSchema = z.object({
  formKey: z.string().min(1),
  layout: z.literal('inline'),
  fields: z.array(dataReportJsonFilterFieldSchema).min(1)
});

export const dataReportJsonMetricItemSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  field: z.string().min(1),
  format: z.enum(['number', 'percent']),
  aggregate: z.enum(['latest', 'sum'])
});

export const dataReportJsonChartSeriesSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  field: z.string().min(1),
  seriesType: z.enum(['line', 'bar']).optional()
});

export const dataReportJsonTableColumnSchema = z.object({
  title: z.string().min(1),
  dataIndex: z.string().min(1),
  width: z.number().int().positive(),
  fixed: z.enum(['left', 'right']).optional()
});

export const dataReportJsonBlockSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('metrics'),
    title: z.string().min(1),
    items: z.array(dataReportJsonMetricItemSchema).min(1)
  }),
  z.object({
    type: z.literal('chart'),
    title: z.string().min(1),
    chartType: z.enum(['line', 'bar', 'pie', 'line-bar']),
    xField: z.string().min(1),
    series: z.array(dataReportJsonChartSeriesSchema).min(1)
  }),
  z.object({
    type: z.literal('table'),
    title: z.string().min(1),
    exportable: z.boolean(),
    columns: z.array(dataReportJsonTableColumnSchema).min(1)
  })
]);

export const dataReportJsonDataSourceSchema = z.object({
  serviceKey: z.string().min(1),
  requestAdapter: z.record(z.string(), z.string()),
  responseAdapter: z.object({
    listPath: z.string().min(1),
    totalPath: z.string().min(1).optional()
  })
});

export const dataReportJsonSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  dataSourceKey: z.string().min(1),
  sectionDefaults: z.object({
    filters: z.record(z.string(), z.unknown()),
    table: z.object({
      pageSize: z.number().int().positive(),
      defaultSort: z.object({
        field: z.string().min(1),
        order: z.enum(['asc', 'desc'])
      })
    }),
    chart: z
      .object({
        granularity: z.literal('day')
      })
      .optional()
  }),
  blocks: z.array(dataReportJsonBlockSchema).min(1)
});

export const dataReportJsonMetaSchema = z.object({
  reportId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  route: z.string().min(1),
  templateRef: z.string().min(1),
  scope: z.enum(['single', 'multiple']),
  layout: z.enum(['dashboard', 'single-table']),
  owner: z.literal('data-report-json-agent')
});

export const dataReportJsonMetaSpecSchema = dataReportJsonMetaSchema.omit({ owner: true });

export const dataReportJsonPageDefaultsSchema = z.object({
  filters: z.record(z.string(), z.unknown()),
  queryPolicy: z.object({
    autoQueryOnInit: z.boolean(),
    autoQueryOnFilterChange: z.boolean(),
    cacheKey: z.string().min(1)
  })
});

export const dataReportJsonDataSourcesSpecSchema = z.record(z.string(), dataReportJsonDataSourceSchema);
export const dataReportJsonSectionsSpecSchema = z.array(dataReportJsonSectionSchema).min(1);
export const dataReportJsonSectionPlanSchema = dataReportJsonSectionSchema.omit({ blocks: true });
export const dataReportJsonMetricsBlockSchema = z.object({
  type: z.literal('metrics'),
  title: z.string().min(1),
  items: z.array(dataReportJsonMetricItemSchema).min(1)
});
export const dataReportJsonChartBlockSchema = z.object({
  type: z.literal('chart'),
  title: z.string().min(1),
  chartType: z.enum(['line', 'bar', 'pie', 'line-bar']),
  xField: z.string().min(1),
  series: z.array(dataReportJsonChartSeriesSchema).min(1)
});
export const dataReportJsonTableBlockSchema = z.object({
  type: z.literal('table'),
  title: z.string().min(1),
  exportable: z.boolean(),
  columns: z.array(dataReportJsonTableColumnSchema).min(1)
});

export const dataReportJsonPatchOperationSchema = z.object({
  op: z.enum([
    'replace-meta-title',
    'replace-section-title',
    'replace-block-title',
    'replace-filter-default',
    'prepend-block'
  ]),
  path: z.string().min(1),
  summary: z.string().min(1)
});

export const dataReportJsonPatchSchema = z.object({
  meta: dataReportJsonMetaSpecSchema,
  pageDefaults: dataReportJsonPageDefaultsSchema,
  patchOperations: z.array(dataReportJsonPatchOperationSchema).default([]),
  warnings: z.array(z.string()).optional()
});

export const dataReportJsonSchema = z.object({
  version: z.literal('1.0'),
  kind: z.literal('data-report-json'),
  meta: dataReportJsonMetaSchema,
  pageDefaults: dataReportJsonPageDefaultsSchema,
  filterSchema: dataReportJsonFilterSchema,
  dataSources: z.record(z.string(), dataReportJsonDataSourceSchema),
  sections: z.array(dataReportJsonSectionSchema).min(1),
  registries: z.object({
    filterComponents: z.array(z.string()).min(1),
    blockTypes: z.array(z.enum(['metrics', 'chart', 'table'])).min(1),
    serviceKeys: z.array(z.string()).min(1)
  }),
  modification: z.object({
    strategy: z.literal('patchable-json'),
    supportedOperations: z.array(
      z.enum(['update-filter-defaults', 'replace-section', 'append-section', 'update-block-config'])
    )
  }),
  patchOperations: z.array(dataReportJsonPatchOperationSchema).optional(),
  warnings: z.array(z.string())
});

export function parseDataReportJsonSchema(input: unknown): DataReportJsonSchemaType {
  return dataReportJsonSchema.parse(input) as DataReportJsonSchemaType;
}
