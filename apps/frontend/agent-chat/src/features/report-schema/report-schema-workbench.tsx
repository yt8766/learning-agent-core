import { useState } from 'react';

import { streamReportSchema, type ReportSchemaStreamEvent } from '@/api/chat-api';
import {
  applySingleReportFormValues,
  createStructuredInputStarter,
  deriveSingleReportFormValues,
  formatWorkbenchJson,
  getSchemaChartSummary,
  getSchemaDataSourceMappings,
  getSchemaFilterFields,
  getSchemaMetricsItems,
  getSchemaPreviewWarnings,
  getSchemaRuntimeSummary,
  getSchemaSections,
  getSchemaTableColumns,
  getSingleReportPreviewModel,
  normalizeWorkbenchSchema,
  parseWorkbenchJsonDraft
} from './report-schema-workbench-support';

type WorkbenchResult = {
  schema?: Record<string, unknown>;
  error?: Record<string, unknown> | string;
  elapsedMs?: number;
  reportSummaries?: unknown;
  rawJson?: string;
};

export interface ReportSchemaWorkbenchProps {
  initialGoal?: string;
  initialStructuredInput?: string;
  initialCurrentSchema?: string;
  initialResult?: WorkbenchResult;
  streamRequest?: typeof streamReportSchema;
  copyToClipboard?: (value: string) => Promise<void>;
  onOpenConfigurator?: (schema: Record<string, unknown>) => void;
}

export function ReportSchemaWorkbench({
  initialGoal = '',
  initialStructuredInput = '',
  initialCurrentSchema = '',
  initialResult,
  streamRequest = streamReportSchema,
  copyToClipboard = value => navigator.clipboard.writeText(value),
  onOpenConfigurator
}: ReportSchemaWorkbenchProps) {
  const [goalDraft, setGoalDraft] = useState(initialGoal);
  const [structuredInputDraft, setStructuredInputDraft] = useState(initialStructuredInput);
  const [currentSchemaDraft, setCurrentSchemaDraft] = useState(initialCurrentSchema);
  const [running, setRunning] = useState(false);
  const [runtimeError, setRuntimeError] = useState('');
  const [events, setEvents] = useState<Array<{ stage: string; status: string; details?: Record<string, unknown> }>>([]);
  const [result, setResult] = useState<WorkbenchResult>(initialResult ?? {});

  const schema = normalizeWorkbenchSchema(result.schema);
  const sections = getSchemaSections(schema);
  const filterFields = getSchemaFilterFields(schema);
  const metricsItems = getSchemaMetricsItems(schema);
  const chartSummary = getSchemaChartSummary(schema);
  const tableColumns = getSchemaTableColumns(schema);
  const runtimeSummary = getSchemaRuntimeSummary(events);
  const dataSourceMappings = getSchemaDataSourceMappings(schema);
  const previewWarnings = getSchemaPreviewWarnings(schema, runtimeSummary);
  const previewModel = getSingleReportPreviewModel(schema);
  const hasGeneratedSchema = sections.length > 0 || filterFields.length > 0 || dataSourceMappings.length > 0;
  let structuredInputObject: Record<string, unknown> | undefined;
  try {
    structuredInputObject = parseWorkbenchJsonDraft<Record<string, unknown>>(structuredInputDraft, '结构化输入');
  } catch {
    structuredInputObject = undefined;
  }
  const singleReportForm = deriveSingleReportFormValues(structuredInputObject);

  async function handleRun() {
    setRunning(true);
    setRuntimeError('');
    setEvents([]);
    setResult({});

    try {
      const structuredInput = parseWorkbenchJsonDraft<Record<string, unknown>>(structuredInputDraft, '结构化输入');
      const currentSchema = parseWorkbenchJsonDraft<Record<string, unknown>>(currentSchemaDraft, '当前 Schema');

      await streamRequest(
        {
          message: goalDraft.trim(),
          reportSchemaInput: structuredInput,
          currentSchema
        },
        event => {
          handleStreamEvent(event);
        }
      );
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : '报表 JSON 请求失败');
    } finally {
      setRunning(false);
    }
  }

  function handleStreamEvent(event: ReportSchemaStreamEvent) {
    if (event.type === 'stage' && event.data) {
      const data = event.data;
      setEvents(current => [
        ...current.filter(item => item.stage !== String(data.stage ?? '')),
        {
          stage: String(data.stage ?? 'unknown'),
          status: String(data.status ?? 'pending'),
          details: (data.details as Record<string, unknown> | undefined) ?? undefined
        }
      ]);
      return;
    }

    if (event.type === 'schema_ready' && event.data) {
      setResult({
        schema: event.data.schema as Record<string, unknown>,
        reportSummaries: event.data.reportSummaries,
        rawJson: formatWorkbenchJson(event.data.schema)
      });
      return;
    }

    if (event.type === 'schema_partial' && event.data) {
      setResult({
        schema: event.data.schema as Record<string, unknown>,
        error: event.data.error as Record<string, unknown>,
        reportSummaries: event.data.reportSummaries,
        rawJson: formatWorkbenchJson(event.data.schema)
      });
      return;
    }

    if (event.type === 'schema_failed' && event.data) {
      setResult({
        error: event.data.error as Record<string, unknown>,
        reportSummaries: event.data.reportSummaries
      });
      return;
    }

    if (event.type === 'done' && event.data) {
      const data = event.data;
      setResult(current => ({
        ...current,
        elapsedMs: typeof data.elapsedMs === 'number' ? data.elapsedMs : current.elapsedMs
      }));
      return;
    }

    if (event.type === 'error') {
      setRuntimeError(event.message ?? '报表 JSON 请求失败');
    }
  }

  async function handleCopyJson() {
    if (!result.rawJson) {
      return;
    }
    await copyToClipboard(result.rawJson);
  }

  function handleReuseForPatch() {
    if (!hasGeneratedSchema || !schema) {
      return;
    }
    setCurrentSchemaDraft(formatWorkbenchJson(schema));
  }

  function handleOpenConfigurator() {
    if (!hasGeneratedSchema || !schema) {
      return;
    }

    onOpenConfigurator?.(schema);
  }

  function handleApplyStarter(kind: 'single-report' | 'multi-report') {
    const starter = createStructuredInputStarter(kind);
    setStructuredInputDraft(formatWorkbenchJson(starter));
    setGoalDraft(kind === 'single-report' ? '生成直播间分类报表' : '生成 Bonus Center 多报表总览');
  }

  function handleSingleReportFieldChange(field: keyof typeof singleReportForm, value: string) {
    const nextValues = {
      ...singleReportForm,
      [field]: value
    };
    const nextStructuredInput = applySingleReportFormValues(structuredInputObject, nextValues);
    setStructuredInputDraft(formatWorkbenchJson(nextStructuredInput));
  }

  return (
    <section className="chatx-report-schema-card">
      <div className="chatx-report-schema-card__header">
        <h3>报表 JSON 工作台</h3>
        <p>填写结构化输入后直接生成可预览的 `data-report-json`，不走代码生成链。</p>
      </div>

      <label className="chatx-report-schema-card__label">
        变更目标 / 需求
        <textarea
          rows={4}
          value={goalDraft}
          onChange={event => setGoalDraft(event.target.value)}
          placeholder="例如：生成直播间分类报表，默认最近 7 天。"
        />
      </label>

      <label className="chatx-report-schema-card__label">
        结构化输入 JSON
        <textarea
          rows={10}
          value={structuredInputDraft}
          onChange={event => setStructuredInputDraft(event.target.value)}
          placeholder='{"meta": {...}, "dataSources": [...], "sections": [...]}'
        />
      </label>

      <div className="chatx-report-schema-card__section">
        <h4>单报表表单</h4>
        <div className="chatx-report-schema-card__form-grid">
          <label className="chatx-report-schema-card__label">
            报表 ID
            <input
              value={singleReportForm.reportId}
              onChange={event => handleSingleReportFieldChange('reportId', event.target.value)}
            />
          </label>
          <label className="chatx-report-schema-card__label">
            标题
            <input
              value={singleReportForm.title}
              onChange={event => handleSingleReportFieldChange('title', event.target.value)}
            />
          </label>
          <label className="chatx-report-schema-card__label">
            描述
            <input
              value={singleReportForm.description}
              onChange={event => handleSingleReportFieldChange('description', event.target.value)}
            />
          </label>
          <label className="chatx-report-schema-card__label">
            路由
            <input
              value={singleReportForm.route}
              onChange={event => handleSingleReportFieldChange('route', event.target.value)}
            />
          </label>
          <label className="chatx-report-schema-card__label">
            模板
            <input
              value={singleReportForm.templateRef}
              onChange={event => handleSingleReportFieldChange('templateRef', event.target.value)}
            />
          </label>
          <label className="chatx-report-schema-card__label">
            Section 标题
            <input
              value={singleReportForm.sectionTitle}
              onChange={event => handleSingleReportFieldChange('sectionTitle', event.target.value)}
            />
          </label>
          <label className="chatx-report-schema-card__label">
            接口 serviceKey
            <input
              value={singleReportForm.serviceKey}
              onChange={event => handleSingleReportFieldChange('serviceKey', event.target.value)}
            />
          </label>
          <label className="chatx-report-schema-card__label">
            请求开始参数
            <input
              value={singleReportForm.requestStartKey}
              onChange={event => handleSingleReportFieldChange('requestStartKey', event.target.value)}
            />
          </label>
          <label className="chatx-report-schema-card__label">
            请求结束参数
            <input
              value={singleReportForm.requestEndKey}
              onChange={event => handleSingleReportFieldChange('requestEndKey', event.target.value)}
            />
          </label>
          <label className="chatx-report-schema-card__label">
            列表路径
            <input
              value={singleReportForm.responseListPath}
              onChange={event => handleSingleReportFieldChange('responseListPath', event.target.value)}
            />
          </label>
          <label className="chatx-report-schema-card__label">
            Total 路径
            <input
              value={singleReportForm.responseTotalPath}
              onChange={event => handleSingleReportFieldChange('responseTotalPath', event.target.value)}
            />
          </label>
          <label className="chatx-report-schema-card__label">
            指标名
            <input
              value={singleReportForm.metricLabel}
              onChange={event => handleSingleReportFieldChange('metricLabel', event.target.value)}
            />
          </label>
          <label className="chatx-report-schema-card__label">
            指标字段
            <input
              value={singleReportForm.metricField}
              onChange={event => handleSingleReportFieldChange('metricField', event.target.value)}
            />
          </label>
          <label className="chatx-report-schema-card__label">
            图表标题
            <input
              value={singleReportForm.chartTitle}
              onChange={event => handleSingleReportFieldChange('chartTitle', event.target.value)}
            />
          </label>
          <label className="chatx-report-schema-card__label">
            图表类型
            <input
              value={singleReportForm.chartType}
              onChange={event => handleSingleReportFieldChange('chartType', event.target.value)}
            />
          </label>
          <label className="chatx-report-schema-card__label">
            图表 X 字段
            <input
              value={singleReportForm.chartXField}
              onChange={event => handleSingleReportFieldChange('chartXField', event.target.value)}
            />
          </label>
          <label className="chatx-report-schema-card__label">
            表格标题
            <input
              value={singleReportForm.tableTitle}
              onChange={event => handleSingleReportFieldChange('tableTitle', event.target.value)}
            />
          </label>
          <label className="chatx-report-schema-card__label">
            第一列标题
            <input
              value={singleReportForm.firstColumnTitle}
              onChange={event => handleSingleReportFieldChange('firstColumnTitle', event.target.value)}
            />
          </label>
          <label className="chatx-report-schema-card__label">
            第一列 dataIndex
            <input
              value={singleReportForm.firstColumnDataIndex}
              onChange={event => handleSingleReportFieldChange('firstColumnDataIndex', event.target.value)}
            />
          </label>
        </div>
      </div>

      <label className="chatx-report-schema-card__label">
        当前 Schema JSON（用于 patch）
        <textarea
          rows={8}
          value={currentSchemaDraft}
          onChange={event => setCurrentSchemaDraft(event.target.value)}
          placeholder='{"version":"1.0","kind":"data-report-json",...}'
        />
      </label>

      <div className="chatx-report-schema-card__actions">
        <button type="button" onClick={() => void handleRun()} disabled={running || !goalDraft.trim()}>
          {running ? '生成中...' : '生成报表 JSON'}
        </button>
        <button type="button" onClick={() => handleApplyStarter('single-report')}>
          填充单报表模板
        </button>
        <button type="button" onClick={() => handleApplyStarter('multi-report')}>
          填充多报表模板
        </button>
        <button type="button" onClick={() => void handleCopyJson()} disabled={!result.rawJson}>
          复制 JSON
        </button>
        <button type="button" onClick={handleOpenConfigurator} disabled={!hasGeneratedSchema}>
          打开配置器
        </button>
        <button type="button" onClick={handleReuseForPatch} disabled={!hasGeneratedSchema}>
          基于当前 schema 发起 patch
        </button>
      </div>

      {runtimeError ? <p className="chatx-report-schema-card__error">{runtimeError}</p> : null}

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
          {typeof result.elapsedMs === 'number' ? <p>总耗时：{result.elapsedMs}ms</p> : null}
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
            <pre>{result.rawJson}</pre>
          </div>
        </div>
      ) : null}

      {!schema && result.error ? (
        <div className="chatx-report-schema-card__section">
          <h4>错误</h4>
          <pre>{typeof result.error === 'string' ? result.error : formatWorkbenchJson(result.error)}</pre>
        </div>
      ) : null}
    </section>
  );
}
