import { formatWorkbenchJson } from './report-schema-workbench-support';

export function ReportSchemaWorkbenchPreview(props: {
  events: Array<{ stage: string; status: string; details?: Record<string, unknown> }>;
  runtimeSummary: Array<{
    stage: string;
    status: string;
    elapsedMs?: number;
    cacheHit?: boolean;
    modelId?: string;
    degraded?: boolean;
    fallbackReason?: string;
  }>;
  elapsedMs?: number;
  hasGeneratedSchema: boolean;
  schema?: Record<string, unknown>;
  resultRawJson?: string;
  filterFields: Array<Record<string, unknown>>;
  dataSourceMappings: Array<{
    key: string;
    serviceKey: string;
    requestAdapter: Record<string, unknown>;
    responseAdapter: Record<string, unknown>;
  }>;
  metricsItems: Array<Record<string, unknown>>;
  chartSummary?: {
    title: string;
    chartType: string;
    xField: string;
    series: Array<Record<string, unknown>>;
  };
  tableColumns: Array<Record<string, unknown>>;
  sections: Array<Record<string, unknown>>;
  previewWarnings: string[];
  previewModel: {
    sectionTitle: string;
    filters: Array<Record<string, unknown>>;
    metricPreview: Array<{ key: string; label: string; value: string }>;
    chartBlock?: Record<string, unknown>;
    tableBlock?: Record<string, unknown>;
    chartRows: Array<Record<string, unknown>>;
    tableRows: Array<Record<string, unknown>>;
  };
  resultError?: Record<string, unknown> | string;
}) {
  const {
    events,
    runtimeSummary,
    elapsedMs,
    hasGeneratedSchema,
    schema,
    resultRawJson,
    filterFields,
    dataSourceMappings,
    metricsItems,
    chartSummary,
    tableColumns,
    sections,
    previewWarnings,
    previewModel,
    resultError
  } = props;

  return (
    <>
      {events.length ? (
        <div className="chatx-report-schema-card__section">
          <h4>Runtime</h4>
          <ul>
            {runtimeSummary.map(item => (
              <li key={item.stage}>
                <strong>{item.stage}</strong>: {item.status}
                {typeof item.elapsedMs === 'number' ? ` · ${item.elapsedMs}ms` : ''}
                {item.cacheHit ? ' · cache' : ''}
                {item.modelId ? ` · ${item.modelId}` : ''}
              </li>
            ))}
          </ul>
          {typeof elapsedMs === 'number' ? <p>总耗时：{elapsedMs}ms</p> : null}
        </div>
      ) : null}

      {hasGeneratedSchema && schema ? (
        <div className="chatx-report-schema-card__preview">
          <div className="chatx-report-schema-card__section">
            <h4>真实预览</h4>
            <p>{previewModel.sectionTitle}</p>
            <h5>筛选区</h5>
            <ul>
              {previewModel.filters.map(field => (
                <li key={String(field.name)}>
                  {String(field.label ?? field.name)} ·{' '}
                  {String((field.component as { componentKey?: string } | undefined)?.componentKey ?? '-')}
                </li>
              ))}
            </ul>
            {previewWarnings.length ? (
              <>
                <h5>降级告警</h5>
                <ul>
                  {previewWarnings.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            ) : null}
            <h5>Mock 数据预览</h5>
            <div>
              <strong>指标卡</strong>
              <ul>
                {previewModel.metricPreview.map(item => (
                  <li key={item.key}>
                    {item.label} · {item.value}
                  </li>
                ))}
              </ul>
            </div>
            {previewModel.chartBlock ? (
              <div>
                <strong>{String(previewModel.chartBlock.title ?? '图表')}</strong>
                <pre>{formatWorkbenchJson(previewModel.chartRows)}</pre>
              </div>
            ) : null}
            {previewModel.tableBlock ? (
              <div>
                <strong>{String(previewModel.tableBlock.title ?? '表格')}</strong>
                <pre>{formatWorkbenchJson(previewModel.tableRows)}</pre>
              </div>
            ) : null}
          </div>

          <div className="chatx-report-schema-card__section">
            <h4>Meta</h4>
            <p>标题：{String((schema.meta as Record<string, unknown> | undefined)?.title ?? '-')}</p>
            <p>路由：{String((schema.meta as Record<string, unknown> | undefined)?.route ?? '-')}</p>
            <p>模板：{String((schema.meta as Record<string, unknown> | undefined)?.templateRef ?? '-')}</p>
            <p>布局：{String((schema.meta as Record<string, unknown> | undefined)?.layout ?? '-')}</p>
            <p>范围：{String((schema.meta as Record<string, unknown> | undefined)?.scope ?? '-')}</p>
          </div>

          <div className="chatx-report-schema-card__section">
            <h4>Filters</h4>
            <ul>
              {filterFields.map(field => (
                <li key={String(field.name)}>
                  {String(field.label ?? field.name)} ·{' '}
                  {String((field.component as { componentKey?: string } | undefined)?.componentKey ?? '-')} · required=
                  {String(Boolean(field.required))}
                </li>
              ))}
            </ul>
          </div>

          <div className="chatx-report-schema-card__section">
            <h4>Data Source</h4>
            <pre>{formatWorkbenchJson(schema.dataSources)}</pre>
            <h5>请求参数映射</h5>
            <ul>
              {dataSourceMappings.map(item => (
                <li key={`${item.key}:request`}>
                  {item.key} · {item.serviceKey} · {formatWorkbenchJson(item.requestAdapter)}
                </li>
              ))}
            </ul>
            <h5>响应路径映射</h5>
            <ul>
              {dataSourceMappings.map(item => (
                <li key={`${item.key}:response`}>
                  {item.key} · {formatWorkbenchJson(item.responseAdapter)}
                </li>
              ))}
            </ul>
          </div>

          <div className="chatx-report-schema-card__section">
            <h4>Metrics</h4>
            <ul>
              {metricsItems.map(item => (
                <li key={String(item.key)}>
                  {String(item.label)} · {String(item.field)} · {String(item.aggregate)}
                </li>
              ))}
            </ul>
          </div>

          {chartSummary ? (
            <div className="chatx-report-schema-card__section">
              <h4>Chart</h4>
              <p>{chartSummary.title}</p>
              <p>
                {chartSummary.chartType} · xField={chartSummary.xField}
              </p>
              <ul>
                {chartSummary.series.map(item => (
                  <li key={String(item.key)}>
                    {String(item.label)} · {String(item.field)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="chatx-report-schema-card__section">
            <h4>Table</h4>
            <ul>
              {tableColumns.map(column => (
                <li key={`${String(column.dataIndex)}:${String(column.title)}`}>
                  {String(column.title)} · {String(column.dataIndex)} · width={String(column.width ?? '-')}
                </li>
              ))}
            </ul>
            <p>Section 数：{sections.length}</p>
          </div>

          <div className="chatx-report-schema-card__section">
            <h4>Raw JSON</h4>
            <pre>{resultRawJson}</pre>
          </div>
        </div>
      ) : null}

      {!schema && resultError ? (
        <div className="chatx-report-schema-card__section">
          <h4>错误</h4>
          <pre>{typeof resultError === 'string' ? resultError : formatWorkbenchJson(resultError)}</pre>
        </div>
      ) : null}
    </>
  );
}
