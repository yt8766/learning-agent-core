import { formatWorkbenchJson, type SingleReportFormValues } from './report-schema-workbench-support';

export function ReportSchemaWorkbenchEditor(props: {
  goalDraft: string;
  onGoalDraftChange: (value: string) => void;
  structuredInputDraft: string;
  onStructuredInputDraftChange: (value: string) => void;
  currentSchemaDraft: string;
  onCurrentSchemaDraftChange: (value: string) => void;
  singleReportForm: SingleReportFormValues;
  onSingleReportFieldChange: (field: keyof SingleReportFormValues, value: string) => void;
  running: boolean;
  hasGeneratedSchema: boolean;
  rawJson?: string;
  runtimeError: string;
  onRun: () => void;
  onApplyStarter: (kind: 'single-report' | 'multi-report') => void;
  onCopyJson: () => void;
  onOpenConfigurator: () => void;
  onReuseForPatch: () => void;
}) {
  const {
    goalDraft,
    onGoalDraftChange,
    structuredInputDraft,
    onStructuredInputDraftChange,
    currentSchemaDraft,
    onCurrentSchemaDraftChange,
    singleReportForm,
    onSingleReportFieldChange,
    running,
    hasGeneratedSchema,
    rawJson,
    runtimeError,
    onRun,
    onApplyStarter,
    onCopyJson,
    onOpenConfigurator,
    onReuseForPatch
  } = props;

  return (
    <>
      <label className="chatx-report-schema-card__label">
        变更目标 / 需求
        <textarea
          rows={4}
          value={goalDraft}
          onChange={event => onGoalDraftChange(event.target.value)}
          placeholder="例如：生成直播间分类报表，默认最近 7 天。"
        />
      </label>

      <label className="chatx-report-schema-card__label">
        结构化输入 JSON
        <textarea
          rows={10}
          value={structuredInputDraft}
          onChange={event => onStructuredInputDraftChange(event.target.value)}
          placeholder='{"meta": {...}, "dataSources": [...], "sections": [...]}'
        />
      </label>

      <div className="chatx-report-schema-card__section">
        <h4>单报表表单</h4>
        <div className="chatx-report-schema-card__form-grid">
          <WorkbenchInput
            label="报表 ID"
            value={singleReportForm.reportId}
            onChange={value => onSingleReportFieldChange('reportId', value)}
          />
          <WorkbenchInput
            label="标题"
            value={singleReportForm.title}
            onChange={value => onSingleReportFieldChange('title', value)}
          />
          <WorkbenchInput
            label="描述"
            value={singleReportForm.description}
            onChange={value => onSingleReportFieldChange('description', value)}
          />
          <WorkbenchInput
            label="路由"
            value={singleReportForm.route}
            onChange={value => onSingleReportFieldChange('route', value)}
          />
          <WorkbenchInput
            label="模板"
            value={singleReportForm.templateRef}
            onChange={value => onSingleReportFieldChange('templateRef', value)}
          />
          <WorkbenchInput
            label="Section 标题"
            value={singleReportForm.sectionTitle}
            onChange={value => onSingleReportFieldChange('sectionTitle', value)}
          />
          <WorkbenchInput
            label="接口 serviceKey"
            value={singleReportForm.serviceKey}
            onChange={value => onSingleReportFieldChange('serviceKey', value)}
          />
          <WorkbenchInput
            label="请求开始参数"
            value={singleReportForm.requestStartKey}
            onChange={value => onSingleReportFieldChange('requestStartKey', value)}
          />
          <WorkbenchInput
            label="请求结束参数"
            value={singleReportForm.requestEndKey}
            onChange={value => onSingleReportFieldChange('requestEndKey', value)}
          />
          <WorkbenchInput
            label="列表路径"
            value={singleReportForm.responseListPath}
            onChange={value => onSingleReportFieldChange('responseListPath', value)}
          />
          <WorkbenchInput
            label="Total 路径"
            value={singleReportForm.responseTotalPath}
            onChange={value => onSingleReportFieldChange('responseTotalPath', value)}
          />
          <WorkbenchInput
            label="指标名"
            value={singleReportForm.metricLabel}
            onChange={value => onSingleReportFieldChange('metricLabel', value)}
          />
          <WorkbenchInput
            label="指标字段"
            value={singleReportForm.metricField}
            onChange={value => onSingleReportFieldChange('metricField', value)}
          />
          <WorkbenchInput
            label="图表标题"
            value={singleReportForm.chartTitle}
            onChange={value => onSingleReportFieldChange('chartTitle', value)}
          />
          <WorkbenchInput
            label="图表类型"
            value={singleReportForm.chartType}
            onChange={value => onSingleReportFieldChange('chartType', value)}
          />
          <WorkbenchInput
            label="图表 X 字段"
            value={singleReportForm.chartXField}
            onChange={value => onSingleReportFieldChange('chartXField', value)}
          />
          <WorkbenchInput
            label="表格标题"
            value={singleReportForm.tableTitle}
            onChange={value => onSingleReportFieldChange('tableTitle', value)}
          />
          <WorkbenchInput
            label="第一列标题"
            value={singleReportForm.firstColumnTitle}
            onChange={value => onSingleReportFieldChange('firstColumnTitle', value)}
          />
          <WorkbenchInput
            label="第一列 dataIndex"
            value={singleReportForm.firstColumnDataIndex}
            onChange={value => onSingleReportFieldChange('firstColumnDataIndex', value)}
          />
        </div>
      </div>

      <label className="chatx-report-schema-card__label">
        当前 Schema JSON（用于 patch）
        <textarea
          rows={8}
          value={currentSchemaDraft}
          onChange={event => onCurrentSchemaDraftChange(event.target.value)}
          placeholder='{"version":"1.0","kind":"data-report-json",...}'
        />
      </label>

      <div className="chatx-report-schema-card__actions">
        <button type="button" onClick={onRun} disabled={running || !goalDraft.trim()}>
          {running ? '生成中...' : '生成报表 JSON'}
        </button>
        <button type="button" onClick={() => onApplyStarter('single-report')}>
          填充单报表模板
        </button>
        <button type="button" onClick={() => onApplyStarter('multi-report')}>
          填充多报表模板
        </button>
        <button type="button" onClick={onCopyJson} disabled={!rawJson}>
          复制 JSON
        </button>
        <button type="button" onClick={onOpenConfigurator} disabled={!hasGeneratedSchema}>
          打开配置器
        </button>
        <button type="button" onClick={onReuseForPatch} disabled={!hasGeneratedSchema}>
          基于当前 schema 发起 patch
        </button>
      </div>

      {runtimeError ? <p className="chatx-report-schema-card__error">{runtimeError}</p> : null}
      {rawJson ? <input type="hidden" value={formatWorkbenchJson(rawJson)} readOnly hidden /> : null}
    </>
  );
}

function WorkbenchInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="chatx-report-schema-card__label">
      {label}
      <input value={value} onChange={event => onChange(event.target.value)} />
    </label>
  );
}
