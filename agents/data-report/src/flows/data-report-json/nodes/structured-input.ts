import type {
  DataReportJsonDataSource,
  DataReportJsonFilterSchema,
  DataReportJsonGraphState,
  DataReportJsonSchema,
  DataReportJsonStructuredInput,
  DataReportJsonSection
} from '../../../types/data-report-json';

export function hasStructuredReportInput(
  state: Pick<DataReportJsonGraphState, 'reportSchemaInput'>
): state is Pick<DataReportJsonGraphState, 'reportSchemaInput'> & { reportSchemaInput: DataReportJsonStructuredInput } {
  return Boolean(state.reportSchemaInput);
}

function resolveStructuredPageDefaults(input: DataReportJsonStructuredInput): DataReportJsonSchema['pageDefaults'] {
  const defaults = input.generationHints;
  const filterDefaults = Object.fromEntries(
    input.filters
      .filter(field => typeof field.defaultValue !== 'undefined')
      .map(field => [field.name, field.defaultValue])
  );

  return {
    filters: filterDefaults,
    queryPolicy: {
      autoQueryOnInit: defaults?.autoQueryOnInit ?? true,
      autoQueryOnFilterChange: defaults?.autoQueryOnFilterChange ?? false,
      cacheKey: defaults?.cacheKey ?? input.meta.reportId
    }
  };
}

function resolveStructuredFilterSchema(input: DataReportJsonStructuredInput): DataReportJsonFilterSchema {
  const fields: DataReportJsonFilterSchema['fields'] = input.filters.length
    ? input.filters.map(field => ({
        name: field.name,
        label: field.label,
        options: field.options?.map(option => ({
          label: option.label,
          value: option.value
        })),
        component: {
          type: 'custom' as const,
          componentKey: field.componentKey,
          props: field.props ?? {}
        },
        valueType: field.valueType,
        required: field.required,
        defaultValue: field.defaultValue,
        requestMapping: field.requestMapping
      }))
    : [
        {
          name: 'dateRange',
          label: '日期',
          component: {
            type: 'custom' as const,
            componentKey: 'gosh-date-range',
            props: {
              allowClear: false
            }
          },
          valueType: 'date-range' as const,
          required: true,
          defaultValue: {
            preset: 'last7Days'
          }
        }
      ];

  return {
    formKey: `${input.meta.reportId}SearchForm`,
    layout: 'inline',
    fields
  };
}

function resolveStructuredDataSources(input: DataReportJsonStructuredInput): Record<string, DataReportJsonDataSource> {
  return Object.fromEntries(
    input.dataSources.map(item => [
      item.key,
      {
        serviceKey: item.serviceKey,
        requestAdapter: item.requestAdapter,
        responseAdapter: item.responseAdapter
      }
    ])
  );
}

function resolveStructuredSections(input: DataReportJsonStructuredInput): DataReportJsonSection[] {
  return input.sections.map(section => {
    const metricsItems = Array.isArray(section.metricsSpec) ? section.metricsSpec : section.metricsSpec.items;
    const metricsTitle = Array.isArray(section.metricsSpec) ? '核心指标' : (section.metricsSpec.title ?? '核心指标');

    return {
      id: section.id,
      title: section.title,
      description: section.description,
      dataSourceKey: section.dataSourceKey,
      sectionDefaults: {
        filters: section.sectionDefaults?.filters ?? {},
        table: {
          pageSize: section.sectionDefaults?.table?.pageSize ?? 100,
          defaultSort: section.sectionDefaults?.table?.defaultSort ?? {
            field: section.tableSpec.columns[0]?.dataIndex ?? 'id',
            order: 'desc'
          }
        },
        chart: {
          granularity: section.sectionDefaults?.chart?.granularity ?? 'day'
        }
      },
      blocks: [
        {
          type: 'metrics',
          title: metricsTitle,
          items: metricsItems
        },
        {
          type: 'chart',
          title: section.chartSpec.title,
          chartType: section.chartSpec.chartType,
          xField: section.chartSpec.xField,
          series: section.chartSpec.series
        },
        {
          type: 'table',
          title: section.tableSpec.title,
          exportable: section.tableSpec.exportable,
          columns: section.tableSpec.columns
        }
      ]
    };
  });
}

export function validateStructuredReportInput(input: DataReportJsonStructuredInput) {
  const errors: string[] = [];

  if (!input.dataSources.length) {
    errors.push('dataSources: at least one data source contract is required');
  }

  input.dataSources.forEach((item, index) => {
    if (!item.key) {
      errors.push(`dataSources[${index}].key: required`);
    }
    if (!item.serviceKey) {
      errors.push(`dataSources[${index}].serviceKey: required`);
    }
    if (!item.responseAdapter?.listPath) {
      errors.push(`dataSources[${index}].responseAdapter.listPath: required`);
    }
  });

  input.sections.forEach((section, index) => {
    if (!section.metricsSpec) {
      errors.push(`sections[${index}].metricsSpec: required`);
    }
    if (!section.chartSpec) {
      errors.push(`sections[${index}].chartSpec: required`);
    }
    if (!section.tableSpec) {
      errors.push(`sections[${index}].tableSpec: required`);
    }
    if (section.tableSpec && !section.tableSpec.columns.length) {
      errors.push(`sections[${index}].tableSpec.columns: at least one column is required`);
    }
  });

  if (errors.length) {
    throw new Error(`Structured report schema input validation failed: ${errors.join('; ')}`);
  }
}

export function buildStructuredSchemaArtifacts(input: DataReportJsonStructuredInput) {
  validateStructuredReportInput(input);

  return {
    meta: input.meta,
    pageDefaults: resolveStructuredPageDefaults(input),
    filterSchema: resolveStructuredFilterSchema(input),
    dataSources: resolveStructuredDataSources(input),
    sections: resolveStructuredSections(input),
    warnings: input.migrationContext ? [`migrated-from:${input.migrationContext.sourceProduct}`] : []
  };
}

export function extractEmbeddedSchema(goal: string) {
  void goal;

  return {
    currentSchema: undefined,
    modificationRequest: undefined
  };
}
