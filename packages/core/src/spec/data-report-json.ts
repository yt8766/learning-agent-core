import { z } from 'zod';

import {
  DataReportJsonAnalysisArtifactSchema,
  DataReportJsonBlockSchema,
  DataReportJsonBlockTypeSchema,
  DataReportJsonComplexityLevelSchema,
  DataReportJsonDataSourceSchema,
  DataReportJsonFilterSchemaSchema,
  DataReportJsonGenerationModeSchema,
  DataReportJsonGenerationStatusSchema,
  DataReportJsonMetaSchema,
  DataReportJsonPageDefaultsSchema,
  DataReportJsonPatchOperationSchema,
  DataReportJsonSchemaSchema,
  DataReportJsonSectionSchema,
  DataReportJsonStructuredInputSchema,
  DataReportJsonVersionInfoSchema
} from './data-report-json-schema';

export const DataReportJsonGenerationNodeSchema = z.enum([
  'planningNode',
  'analysisNode',
  'patchIntentNode',
  'schemaSpecNode',
  'filterSchemaNode',
  'dataSourceNode',
  'sectionPlanNode',
  'metricsBlockNode',
  'chartBlockNode',
  'tableBlockNode',
  'sectionAssembleNode',
  'sectionSchemaNode',
  'patchSchemaNode',
  'validateNode'
]);

export const DataReportJsonTrimmedContextNodeSchema = z.enum([
  'filterSchemaNode',
  'dataSourceNode',
  'metricsBlockNode',
  'chartBlockNode',
  'tableBlockNode',
  'sectionSchemaNode'
]);

export const DataReportJsonTrimmedContextsSchema = z.record(z.string(), z.string());

export const DataReportJsonArtifactEventSchema = z.object({
  phase: z.enum(['skeleton', 'block', 'final']),
  schema: DataReportJsonSchemaSchema.partial(),
  blockType: DataReportJsonBlockTypeSchema.optional(),
  status: DataReportJsonGenerationStatusSchema.optional()
});

export const DataReportJsonNodeStageEventSchema = z.object({
  node: DataReportJsonGenerationNodeSchema,
  status: z.enum(['pending', 'success', 'error']),
  modelId: z.string().optional(),
  cacheHit: z.boolean().optional(),
  retryCount: z.number().optional(),
  degraded: z.boolean().optional(),
  upgraded: z.boolean().optional(),
  details: z.record(z.string(), z.unknown()).optional()
});

export const DataReportJsonGenerationErrorSchema = z.object({
  errorCode: z.enum(['report_schema_generation_failed', 'report_schema_validation_failed']),
  errorMessage: z.string(),
  failedNode: DataReportJsonGenerationNodeSchema.optional(),
  failedNodes: z.array(DataReportJsonGenerationNodeSchema).optional(),
  failedReports: z.array(z.string()).optional(),
  modelId: z.string().optional(),
  elapsedMs: z.number().optional(),
  retryable: z.boolean()
});

export const DataReportJsonReportSummarySchema = z.object({
  reportKey: z.string(),
  status: z.enum(['success', 'partial', 'failed']),
  elapsedMs: z.number().optional(),
  modelId: z.string().optional(),
  retryCount: z.number().optional(),
  cacheHit: z.boolean().optional()
});

export const DataReportJsonRuntimeMetaSchema = z.object({
  cacheHit: z.boolean(),
  executionPath: z.enum(['structured-fast-lane', 'partial-llm', 'llm']),
  llmAttempted: z.boolean(),
  llmSucceeded: z.boolean(),
  nodeDurations: z.record(z.string(), z.number())
});

export const DataReportJsonPatchIntentSchema = z.object({
  target: z.enum(['filterSchema', 'dataSources', 'metricsBlock', 'chartBlock', 'tableBlock']),
  action: z.enum([
    'add',
    'remove',
    'update-title',
    'update-style',
    'update-component',
    'regenerate-options',
    'update-default',
    'unknown'
  ]),
  subject: z.string().optional()
});

export const DataReportJsonGenerateResultSchema = z.object({
  status: DataReportJsonGenerationStatusSchema,
  schema: DataReportJsonSchemaSchema.optional(),
  partialSchema: DataReportJsonSchemaSchema.partial().optional(),
  error: DataReportJsonGenerationErrorSchema.optional(),
  reportSummaries: z.array(DataReportJsonReportSummarySchema).optional(),
  runtime: DataReportJsonRuntimeMetaSchema.optional(),
  content: z.string(),
  elapsedMs: z.number()
});

export {
  DataReportJsonAnalysisArtifactSchema,
  DataReportJsonBlockSchema,
  DataReportJsonComplexityLevelSchema,
  DataReportJsonDataSourceSchema,
  DataReportJsonFilterSchemaSchema,
  DataReportJsonGenerationModeSchema,
  DataReportJsonGenerationStatusSchema,
  DataReportJsonMetaSchema,
  DataReportJsonPageDefaultsSchema,
  DataReportJsonPatchOperationSchema,
  DataReportJsonSchemaSchema,
  DataReportJsonSectionSchema,
  DataReportJsonStructuredInputSchema,
  DataReportJsonVersionInfoSchema
};
