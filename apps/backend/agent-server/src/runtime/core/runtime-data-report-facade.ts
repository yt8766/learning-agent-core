import {
  DATA_REPORT_GENERATION_NODE_META,
  DATA_REPORT_JSON_DEFAULT_MODEL_POLICY,
  DATA_REPORT_PREVIEW_STAGE_META,
  DATA_REPORT_SANDPACK_GENERATE_HEARTBEAT_MS,
  DATA_REPORT_SANDPACK_STAGE_META,
  executeReportBundleEditFlow,
  executeReportBundleGenerateFlow,
  executeDataReportJsonGraph,
  executeDataReportSandpackGraph,
  generateDataReportPreview
} from '@agent/platform-runtime';
import type { DataReportJsonGenerateResult } from '@agent/platform-runtime';

export {
  DATA_REPORT_GENERATION_NODE_META,
  DATA_REPORT_JSON_DEFAULT_MODEL_POLICY,
  DATA_REPORT_PREVIEW_STAGE_META,
  DATA_REPORT_SANDPACK_GENERATE_HEARTBEAT_MS,
  DATA_REPORT_SANDPACK_STAGE_META,
  executeReportBundleEditFlow,
  executeReportBundleGenerateFlow,
  executeDataReportJsonGraph,
  executeDataReportSandpackGraph,
  generateDataReportPreview
};

export type {
  DataReportFileGenerationEvent,
  DataReportGenerationNode,
  ReportBundleEditInput,
  ReportBundleEditResult,
  ReportBundleGenerateInput,
  ReportBundleGenerateResult,
  DataReportJsonGenerateResult,
  DataReportJsonNodeModelPolicy,
  DataReportJsonNodeModelSelector,
  DataReportJsonNodeStageEvent,
  DataReportJsonSchema,
  DataReportJsonStructuredInput,
  DataReportNodeStageEvent,
  DataReportPreviewStage,
  DataReportPreviewStageEvent,
  DataReportSandpackFiles,
  DataReportSandpackStage
} from '@agent/platform-runtime';
export type { ReportBundle } from '@agent/core';

export type DataReportBundleGenerateResult = DataReportJsonGenerateResult & {
  bundle?: import('@agent/core').ReportBundle;
};
