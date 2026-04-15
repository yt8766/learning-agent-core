export function parseWorkbenchJsonDraft<T>(draft: string, label: string): T | undefined {
  const trimmed = draft.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Invalid JSON';
    throw new Error(`${label} JSON 解析失败：${reason}`);
  }
}

export function formatWorkbenchJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function toRecordArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(item => toRecord(item)).filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
}

export function normalizeWorkbenchSchema(
  schema: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  const base = toRecord(schema);
  if (!base) {
    return undefined;
  }

  const normalizedSections = toRecordArray(base.sections).map(section => ({
    ...section,
    blocks: toRecordArray(section.blocks).map(block => {
      if (block.type === 'metrics') {
        return {
          ...block,
          items: toRecordArray(block.items)
        };
      }

      if (block.type === 'chart') {
        return {
          ...block,
          series: toRecordArray(block.series)
        };
      }

      if (block.type === 'table') {
        return {
          ...block,
          columns: toRecordArray(block.columns)
        };
      }

      return block;
    })
  }));

  const normalizedDataSources = Object.fromEntries(
    Object.entries(toRecord(base.dataSources) ?? {}).flatMap(([key, value]) => {
      const source = toRecord(value);
      return source ? [[key, source] as const] : [];
    })
  );
  const filterSchema = toRecord(base.filterSchema);

  return {
    ...base,
    filterSchema: filterSchema
      ? {
          ...filterSchema,
          fields: toRecordArray(filterSchema.fields)
        }
      : undefined,
    dataSources: normalizedDataSources,
    sections: normalizedSections,
    warnings: Array.isArray(base.warnings) ? base.warnings.map(item => String(item)) : []
  };
}

export interface SingleReportFormValues {
  reportId: string;
  title: string;
  description: string;
  route: string;
  templateRef: string;
  sectionId: string;
  sectionTitle: string;
  sectionDescription: string;
  filterLabel: string;
  serviceKey: string;
  requestStartKey: string;
  requestEndKey: string;
  responseListPath: string;
  responseTotalPath: string;
  metricLabel: string;
  metricField: string;
  chartTitle: string;
  chartType: string;
  chartXField: string;
  chartSeriesLabel: string;
  chartSeriesField: string;
  tableTitle: string;
  firstColumnTitle: string;
  firstColumnDataIndex: string;
  firstColumnWidth: string;
}

export function createStructuredInputStarter(kind: 'single-report' | 'multi-report') {
  if (kind === 'multi-report') {
    return {
      meta: {
        reportId: 'bonusCenterOverview',
        title: 'Bonus Center 运营总览',
        description: '多报表运营分析页',
        route: '/dataDashboard/bonusCenterOverview',
        templateRef: 'bonus-center-data',
        scope: 'multiple',
        layout: 'dashboard'
      },
      filters: [
        {
          name: 'dateRange',
          label: '日期',
          componentKey: 'gosh-date-range',
          valueType: 'date-range',
          required: true,
          defaultValue: {
            preset: 'last7Days'
          },
          requestMapping: {
            start: 'start_dt',
            end: 'end_dt'
          }
        }
      ],
      dataSources: [
        {
          key: 'overview',
          serviceKey: 'getBonusCenterOverview',
          requestAdapter: {
            'dateRange.start': 'start_dt',
            'dateRange.end': 'end_dt'
          },
          responseAdapter: {
            listPath: 'data.list',
            totalPath: 'data.total'
          }
        }
      ],
      sections: [
        {
          id: 'overview',
          title: '总览',
          description: '核心经营看板',
          dataSourceKey: 'overview',
          metricsSpec: [
            {
              key: 'amount',
              label: '兑换金额',
              field: 'exchange_amount',
              format: 'number',
              aggregate: 'sum'
            }
          ],
          chartSpec: {
            title: '趋势图',
            chartType: 'line',
            xField: 'dt',
            series: [
              {
                key: 'amount',
                label: '兑换金额',
                field: 'exchange_amount'
              }
            ]
          },
          tableSpec: {
            title: '明细表',
            exportable: true,
            columns: [
              {
                title: '日期',
                dataIndex: 'dt_label',
                width: 120
              }
            ]
          }
        }
      ]
    };
  }

  return {
    meta: {
      reportId: 'roomCategoryDashboard',
      title: '直播间分类报表',
      description: '直播间分类经营分析',
      route: '/dataDashboard/roomCategoryDashboard',
      templateRef: 'generic-report',
      scope: 'single',
      layout: 'dashboard'
    },
    filters: [
      {
        name: 'dateRange',
        label: '日期',
        componentKey: 'gosh-date-range',
        valueType: 'date-range',
        required: true,
        defaultValue: {
          preset: 'last7Days'
        },
        requestMapping: {
          start: 'start_dt',
          end: 'end_dt'
        }
      }
    ],
    dataSources: [
      {
        key: 'roomCategory',
        serviceKey: 'getRoomCategoryData',
        requestAdapter: {
          'dateRange.start': 'start_dt',
          'dateRange.end': 'end_dt'
        },
        responseAdapter: {
          listPath: 'data.list',
          totalPath: 'data.total'
        }
      }
    ],
    sections: [
      {
        id: 'roomCategory',
        title: '直播间分类',
        description: '直播间分类核心数据',
        dataSourceKey: 'roomCategory',
        metricsSpec: [
          {
            key: 'roomCount',
            label: '直播间数',
            field: 'room_cnt',
            format: 'number',
            aggregate: 'latest'
          }
        ],
        chartSpec: {
          title: '直播间分类趋势',
          chartType: 'bar',
          xField: 'category_name',
          series: [
            {
              key: 'roomCount',
              label: '直播间数',
              field: 'room_cnt'
            }
          ]
        },
        tableSpec: {
          title: '直播间分类明细',
          exportable: true,
          columns: [
            {
              title: '直播间分类',
              dataIndex: 'category_name',
              width: 180
            }
          ]
        }
      }
    ]
  };
}

export function deriveSingleReportFormValues(input: Record<string, unknown> | undefined): SingleReportFormValues {
  const base = input ?? createStructuredInputStarter('single-report');
  const meta = (base.meta as Record<string, unknown> | undefined) ?? {};
  const filters = Array.isArray(base.filters) ? (base.filters as Array<Record<string, unknown>>) : [];
  const firstFilter = filters[0] ?? {};
  const dataSources = Array.isArray(base.dataSources) ? (base.dataSources as Array<Record<string, unknown>>) : [];
  const firstDataSource = dataSources[0] ?? {};
  const requestAdapter = (firstDataSource.requestAdapter as Record<string, unknown> | undefined) ?? {};
  const responseAdapter = (firstDataSource.responseAdapter as Record<string, unknown> | undefined) ?? {};
  const sections = Array.isArray(base.sections) ? (base.sections as Array<Record<string, unknown>>) : [];
  const firstSection = sections[0] ?? {};
  const metrics = Array.isArray(firstSection.metricsSpec)
    ? (firstSection.metricsSpec as Array<Record<string, unknown>>)
    : Array.isArray((firstSection.metricsSpec as Record<string, unknown> | undefined)?.items)
      ? ((firstSection.metricsSpec as Record<string, unknown>).items as Array<Record<string, unknown>>)
      : [];
  const firstMetric = metrics[0] ?? {};
  const chartSpec = (firstSection.chartSpec as Record<string, unknown> | undefined) ?? {};
  const chartSeries = Array.isArray(chartSpec.series) ? (chartSpec.series as Array<Record<string, unknown>>) : [];
  const firstSeries = chartSeries[0] ?? {};
  const tableSpec = (firstSection.tableSpec as Record<string, unknown> | undefined) ?? {};
  const tableColumns = Array.isArray(tableSpec.columns) ? (tableSpec.columns as Array<Record<string, unknown>>) : [];
  const firstColumn = tableColumns[0] ?? {};

  return {
    reportId: String(meta.reportId ?? ''),
    title: String(meta.title ?? ''),
    description: String(meta.description ?? ''),
    route: String(meta.route ?? ''),
    templateRef: String(meta.templateRef ?? ''),
    sectionId: String(firstSection.id ?? ''),
    sectionTitle: String(firstSection.title ?? ''),
    sectionDescription: String(firstSection.description ?? ''),
    filterLabel: String(firstFilter.label ?? ''),
    serviceKey: String(firstDataSource.serviceKey ?? ''),
    requestStartKey: String(requestAdapter['dateRange.start'] ?? requestAdapter.start ?? ''),
    requestEndKey: String(requestAdapter['dateRange.end'] ?? requestAdapter.end ?? ''),
    responseListPath: String(responseAdapter.listPath ?? ''),
    responseTotalPath: String(responseAdapter.totalPath ?? ''),
    metricLabel: String(firstMetric.label ?? ''),
    metricField: String(firstMetric.field ?? ''),
    chartTitle: String(chartSpec.title ?? ''),
    chartType: String(chartSpec.chartType ?? ''),
    chartXField: String(chartSpec.xField ?? ''),
    chartSeriesLabel: String(firstSeries.label ?? ''),
    chartSeriesField: String(firstSeries.field ?? ''),
    tableTitle: String(tableSpec.title ?? ''),
    firstColumnTitle: String(firstColumn.title ?? ''),
    firstColumnDataIndex: String(firstColumn.dataIndex ?? ''),
    firstColumnWidth: String(firstColumn.width ?? '')
  };
}

export function applySingleReportFormValues(
  currentInput: Record<string, unknown> | undefined,
  nextValues: SingleReportFormValues
) {
  const base = structuredClone(currentInput ?? createStructuredInputStarter('single-report')) as Record<
    string,
    unknown
  >;
  const filters = (Array.isArray(base.filters) ? base.filters : []) as Array<Record<string, unknown>>;
  const dataSources = (Array.isArray(base.dataSources) ? base.dataSources : []) as Array<Record<string, unknown>>;
  const sections = (Array.isArray(base.sections) ? base.sections : []) as Array<Record<string, unknown>>;
  const firstFilter = (filters[0] ?? {}) as Record<string, unknown>;
  const firstDataSource = (dataSources[0] ?? {}) as Record<string, unknown>;
  const firstSection = (sections[0] ?? {}) as Record<string, unknown>;
  const metrics = (Array.isArray(firstSection.metricsSpec) ? firstSection.metricsSpec : []) as Array<
    Record<string, unknown>
  >;
  const firstMetric = (metrics[0] ?? {}) as Record<string, unknown>;
  const chartSpec = ((firstSection.chartSpec as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
  const chartSeries = (Array.isArray(chartSpec.series) ? chartSpec.series : []) as Array<Record<string, unknown>>;
  const firstSeries = (chartSeries[0] ?? {}) as Record<string, unknown>;
  const tableSpec = ((firstSection.tableSpec as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
  const tableColumns = (Array.isArray(tableSpec.columns) ? tableSpec.columns : []) as Array<Record<string, unknown>>;
  const firstColumn = (tableColumns[0] ?? {}) as Record<string, unknown>;

  base.meta = {
    ...(base.meta as Record<string, unknown> | undefined),
    reportId: nextValues.reportId,
    title: nextValues.title,
    description: nextValues.description,
    route: nextValues.route,
    templateRef: nextValues.templateRef,
    scope: 'single',
    layout: 'dashboard'
  };

  base.filters = [
    {
      ...firstFilter,
      name: 'dateRange',
      label: nextValues.filterLabel,
      componentKey: String(firstFilter.componentKey ?? 'gosh-date-range'),
      valueType: String(firstFilter.valueType ?? 'date-range'),
      required: true,
      requestMapping: {
        start: nextValues.requestStartKey,
        end: nextValues.requestEndKey
      }
    }
  ];

  base.dataSources = [
    {
      ...firstDataSource,
      key: String(firstDataSource.key ?? nextValues.sectionId),
      serviceKey: nextValues.serviceKey,
      requestAdapter: {
        'dateRange.start': nextValues.requestStartKey,
        'dateRange.end': nextValues.requestEndKey
      },
      responseAdapter: {
        listPath: nextValues.responseListPath,
        totalPath: nextValues.responseTotalPath
      }
    }
  ];

  firstSection.id = nextValues.sectionId;
  firstSection.title = nextValues.sectionTitle;
  firstSection.description = nextValues.sectionDescription;
  firstSection.dataSourceKey = String(firstDataSource.key ?? nextValues.sectionId);
  firstSection.metricsSpec = [
    {
      ...firstMetric,
      key: String(firstMetric.key ?? 'metricValue'),
      label: nextValues.metricLabel,
      field: nextValues.metricField,
      format: String(firstMetric.format ?? 'number'),
      aggregate: String(firstMetric.aggregate ?? 'latest')
    }
  ];
  firstSection.chartSpec = {
    ...chartSpec,
    title: nextValues.chartTitle,
    chartType: nextValues.chartType,
    xField: nextValues.chartXField,
    series: [
      {
        ...firstSeries,
        key: String(firstSeries.key ?? 'metricSeries'),
        label: nextValues.chartSeriesLabel,
        field: nextValues.chartSeriesField
      }
    ]
  };
  firstSection.tableSpec = {
    ...tableSpec,
    title: nextValues.tableTitle,
    exportable: tableSpec.exportable ?? true,
    columns: [
      {
        ...firstColumn,
        title: nextValues.firstColumnTitle,
        dataIndex: nextValues.firstColumnDataIndex,
        width: Number(nextValues.firstColumnWidth || 120)
      }
    ]
  };
  base.sections = [firstSection];

  return base;
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
    serviceKey: String(toRecord(value)?.serviceKey ?? '-'),
    requestAdapter: toRecord(toRecord(value)?.requestAdapter) ?? {},
    responseAdapter: toRecord(toRecord(value)?.responseAdapter) ?? {}
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
