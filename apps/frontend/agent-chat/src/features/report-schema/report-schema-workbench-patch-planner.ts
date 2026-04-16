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
