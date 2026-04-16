import { useState } from 'react';

import { streamReportSchema } from '@/api/chat-api';
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
import { ReportSchemaWorkbenchEditor } from './report-schema-workbench-editor';
import { ReportSchemaWorkbenchPreview } from './report-schema-workbench-preview';
import { applyWorkbenchStreamEvent, type WorkbenchResult } from './report-schema-workbench-runtime';

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
          applyWorkbenchStreamEvent(event, setEvents, setResult, setRuntimeError);
        }
      );
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : '报表 JSON 请求失败');
    } finally {
      setRunning(false);
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
      <ReportSchemaWorkbenchEditor
        goalDraft={goalDraft}
        onGoalDraftChange={setGoalDraft}
        structuredInputDraft={structuredInputDraft}
        onStructuredInputDraftChange={setStructuredInputDraft}
        currentSchemaDraft={currentSchemaDraft}
        onCurrentSchemaDraftChange={setCurrentSchemaDraft}
        singleReportForm={singleReportForm}
        onSingleReportFieldChange={handleSingleReportFieldChange}
        running={running}
        hasGeneratedSchema={hasGeneratedSchema}
        rawJson={result.rawJson}
        runtimeError={runtimeError}
        onRun={() => void handleRun()}
        onApplyStarter={handleApplyStarter}
        onCopyJson={() => void handleCopyJson()}
        onOpenConfigurator={handleOpenConfigurator}
        onReuseForPatch={handleReuseForPatch}
      />
      <ReportSchemaWorkbenchPreview
        events={events}
        runtimeSummary={runtimeSummary}
        elapsedMs={result.elapsedMs}
        hasGeneratedSchema={hasGeneratedSchema}
        schema={schema}
        resultRawJson={result.rawJson}
        filterFields={filterFields}
        dataSourceMappings={dataSourceMappings}
        metricsItems={metricsItems}
        chartSummary={chartSummary}
        tableColumns={tableColumns}
        sections={sections}
        previewWarnings={previewWarnings}
        previewModel={previewModel}
        resultError={result.error}
      />
    </section>
  );
}
