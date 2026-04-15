export type DataReportJsonScope = 'single' | 'multiple';
export type DataReportJsonLayout = 'dashboard' | 'single-table';
export type DataReportJsonGenerationMode = 'brand-new' | 'patch';
export type DataReportJsonGenerationStatus = 'success' | 'partial' | 'failed';
export type DataReportJsonComplexityLevel = 'simple' | 'complex';
export type DataReportJsonFilterValueType = 'string' | 'string[]' | 'date-range';
export type DataReportJsonBlockType = 'metrics' | 'chart' | 'table';
export type DataReportJsonChartType = 'line' | 'bar' | 'pie' | 'line-bar';
export type DataReportJsonChartSeriesType = Extract<DataReportJsonChartType, 'line' | 'bar'>;
export type DataReportJsonFormat = 'text' | 'number' | 'percent' | 'date';
export type DataReportJsonAggregate = 'latest' | 'sum';
export type DataReportJsonMigrationSourceProduct = 'metabase' | 'superset' | 'grafana' | 'retool' | 'custom';

export interface DataReportJsonMeta {
  reportId: string;
  title: string;
  description: string;
  route: string;
  templateRef: string;
  scope: DataReportJsonScope;
  layout: DataReportJsonLayout;
  owner: 'data-report-json-agent';
}

export interface DataReportJsonFilterField {
  name: string;
  label: string;
  options?: Array<{
    label: string;
    value: string | number;
  }>;
  component: {
    type: 'custom';
    componentKey: string;
    props: Record<string, unknown>;
  };
  valueType: DataReportJsonFilterValueType;
  required: boolean;
  defaultValue?: unknown;
  requestMapping?: Record<string, string>;
}

export interface DataReportJsonFilterSchema {
  formKey: string;
  layout: 'inline';
  fields: DataReportJsonFilterField[];
}

export interface DataReportJsonDataSource {
  serviceKey: string;
  requestAdapter: Record<string, string>;
  responseAdapter: {
    listPath: string;
    totalPath?: string;
  };
}

export interface DataReportJsonMetricItem {
  key: string;
  label: string;
  field: string;
  format: Extract<DataReportJsonFormat, 'number' | 'percent'>;
  aggregate: DataReportJsonAggregate;
}

export interface DataReportJsonChartSeries {
  key: string;
  label: string;
  field: string;
  seriesType?: DataReportJsonChartSeriesType;
}

export interface DataReportJsonTableColumn {
  title: string;
  dataIndex: string;
  width: number;
  fixed?: 'left' | 'right';
}

export interface DataReportJsonStructuredFilterInput {
  name: string;
  label: string;
  options?: Array<{
    label: string;
    value: string | number;
  }>;
  componentKey: string;
  valueType: DataReportJsonFilterValueType;
  required: boolean;
  defaultValue?: unknown;
  requestMapping?: Record<string, string>;
  props?: Record<string, unknown>;
}

export interface DataReportJsonStructuredDataSourceInput {
  key: string;
  serviceKey: string;
  requestAdapter: Record<string, string>;
  responseAdapter: {
    listPath: string;
    totalPath?: string;
  };
}

export interface DataReportJsonStructuredMetricsSpec {
  title?: string;
  items: DataReportJsonMetricItem[];
}

export interface DataReportJsonStructuredChartSpec {
  title: string;
  chartType: DataReportJsonChartType;
  xField: string;
  series: DataReportJsonChartSeries[];
}

export interface DataReportJsonStructuredTableSpec {
  title: string;
  exportable: boolean;
  columns: DataReportJsonTableColumn[];
}

export interface DataReportJsonStructuredSectionInput {
  id: string;
  title: string;
  description: string;
  dataSourceKey: string;
  metricsSpec: DataReportJsonStructuredMetricsSpec | DataReportJsonMetricItem[];
  chartSpec: DataReportJsonStructuredChartSpec;
  tableSpec: DataReportJsonStructuredTableSpec;
  sectionDefaults?: {
    filters?: Record<string, unknown>;
    table?: {
      pageSize?: number;
      defaultSort?: {
        field: string;
        order: 'asc' | 'desc';
      };
    };
    chart?: {
      granularity?: 'day';
    };
  };
}

export interface DataReportJsonGenerationHints {
  autoQueryOnInit?: boolean;
  autoQueryOnFilterChange?: boolean;
  cacheKey?: string;
  targetLatencyClass?: 'fast' | 'balanced' | 'quality';
}

export interface DataReportJsonMigrationContext {
  sourceProduct: DataReportJsonMigrationSourceProduct;
  sourceDatasetName?: string;
  sourcePanelTypes?: string[];
  sourceFilters?: string[];
  sourceNotes?: string;
}

export interface DataReportJsonStructuredInput {
  meta: Omit<DataReportJsonMeta, 'owner'>;
  filters: DataReportJsonStructuredFilterInput[];
  dataSources: DataReportJsonStructuredDataSourceInput[];
  sections: DataReportJsonStructuredSectionInput[];
  generationHints?: DataReportJsonGenerationHints;
  migrationContext?: DataReportJsonMigrationContext;
}

export interface DataReportJsonMetricsBlock {
  type: 'metrics';
  title: string;
  items: DataReportJsonMetricItem[];
}

export interface DataReportJsonChartBlock {
  type: 'chart';
  title: string;
  chartType: DataReportJsonChartType;
  xField: string;
  series: DataReportJsonChartSeries[];
}

export interface DataReportJsonTableBlock {
  type: 'table';
  title: string;
  exportable: boolean;
  columns: DataReportJsonTableColumn[];
}

export type DataReportJsonBlock = DataReportJsonMetricsBlock | DataReportJsonChartBlock | DataReportJsonTableBlock;

export interface DataReportJsonSection {
  id: string;
  title: string;
  description: string;
  dataSourceKey: string;
  sectionDefaults: {
    filters: Record<string, unknown>;
    table: {
      pageSize: number;
      defaultSort: {
        field: string;
        order: 'asc' | 'desc';
      };
    };
    chart?: {
      granularity: 'day';
    };
  };
  blocks: DataReportJsonBlock[];
}

export interface DataReportJsonPageDefaults {
  filters: Record<string, unknown>;
  queryPolicy: {
    autoQueryOnInit: boolean;
    autoQueryOnFilterChange: boolean;
    cacheKey: string;
  };
}

export interface DataReportJsonPatchOperation {
  op:
    | 'replace-meta-title'
    | 'replace-section-title'
    | 'replace-block-title'
    | 'replace-filter-default'
    | 'prepend-block';
  path: string;
  summary: string;
}

export interface DataReportJsonVersionInfo {
  baseVersion: number;
  nextVersion: number;
  patchSummary: string;
}

export interface DataReportJsonSchema {
  version: '1.0';
  kind: 'data-report-json';
  meta: DataReportJsonMeta;
  pageDefaults: DataReportJsonPageDefaults;
  filterSchema: DataReportJsonFilterSchema;
  dataSources: Record<string, DataReportJsonDataSource>;
  sections: DataReportJsonSection[];
  registries: {
    filterComponents: string[];
    blockTypes: DataReportJsonBlockType[];
    serviceKeys: string[];
  };
  modification: {
    strategy: 'patchable-json';
    supportedOperations: Array<'update-filter-defaults' | 'replace-section' | 'append-section' | 'update-block-config'>;
  };
  patchOperations?: DataReportJsonPatchOperation[];
  warnings: string[];
}

export interface DataReportJsonAnalysisArtifact {
  templateRef: DataReportJsonMeta['templateRef'];
  scope: DataReportJsonScope;
  routeName: string;
  route: string;
  title: string;
  layout: DataReportJsonLayout;
  reportName?: string;
  serviceKey?: string;
  filterFields?: string[];
  displayFields?: string[];
}
