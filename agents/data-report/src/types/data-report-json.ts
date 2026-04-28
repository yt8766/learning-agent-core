import { z } from 'zod';

import {
  DataReportJsonArtifactEventSchema,
  DataReportJsonGenerateResultSchema,
  DataReportJsonGenerationErrorSchema,
  DataReportJsonGenerationNodeSchema,
  DataReportJsonNodeStageEventSchema,
  DataReportJsonPatchIntentSchema,
  DataReportJsonReportSummarySchema,
  DataReportJsonRuntimeMetaSchema,
  DataReportJsonTrimmedContextNodeSchema,
  DataReportJsonTrimmedContextsSchema
} from './schemas/data-report-json';
export * from './data-report-json-schema';

export type DataReportJsonGenerationNode = z.infer<typeof DataReportJsonGenerationNodeSchema>;
export type DataReportJsonTrimmedContextNode = z.infer<typeof DataReportJsonTrimmedContextNodeSchema>;
export type DataReportJsonTrimmedContexts = z.infer<typeof DataReportJsonTrimmedContextsSchema>;
export type DataReportJsonArtifactEvent = z.infer<typeof DataReportJsonArtifactEventSchema>;
export type DataReportJsonNodeStageEvent = z.infer<typeof DataReportJsonNodeStageEventSchema>;
export type DataReportJsonGenerationError = z.infer<typeof DataReportJsonGenerationErrorSchema>;
export type DataReportJsonReportSummary = z.infer<typeof DataReportJsonReportSummarySchema>;
export type DataReportJsonRuntimeMeta = z.infer<typeof DataReportJsonRuntimeMetaSchema>;
export type DataReportJsonPatchIntent = z.infer<typeof DataReportJsonPatchIntentSchema>;
export type DataReportJsonGenerateResult = z.infer<typeof DataReportJsonGenerateResultSchema>;
export type {
  DataReportJsonGenerateInput,
  DataReportJsonGraphHandlers,
  DataReportJsonGraphState,
  DataReportJsonModelSelectorPreference,
  DataReportJsonModelSelectorTier,
  DataReportJsonNodeModelPolicy,
  DataReportJsonNodeModelSelector
} from './contracts/data-report-json';
