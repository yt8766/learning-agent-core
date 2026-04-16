import { type ReportSchemaStreamEvent } from '@/api/chat-api';

import { formatWorkbenchJson } from './report-schema-workbench-support';

type WorkbenchResult = {
  schema?: Record<string, unknown>;
  error?: Record<string, unknown> | string;
  elapsedMs?: number;
  reportSummaries?: unknown;
  rawJson?: string;
};

export function applyWorkbenchStreamEvent(
  event: ReportSchemaStreamEvent,
  setEvents: React.Dispatch<
    React.SetStateAction<Array<{ stage: string; status: string; details?: Record<string, unknown> }>>
  >,
  setResult: React.Dispatch<React.SetStateAction<WorkbenchResult>>,
  setRuntimeError: React.Dispatch<React.SetStateAction<string>>
) {
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

export type { WorkbenchResult };
