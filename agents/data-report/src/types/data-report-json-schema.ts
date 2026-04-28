import { z } from 'zod';

import {
  DataReportJsonAggregateSchema,
  DataReportJsonAnalysisArtifactSchema,
  DataReportJsonBlockSchema,
  DataReportJsonBlockTypeSchema,
  DataReportJsonChartBlockSchema,
  DataReportJsonChartSeriesSchema,
  DataReportJsonChartSeriesTypeSchema,
  DataReportJsonChartTypeSchema,
  DataReportJsonComplexityLevelSchema,
  DataReportJsonDataSourceSchema,
  DataReportJsonFilterFieldSchema,
  DataReportJsonFilterSchemaSchema,
  DataReportJsonFilterValueTypeSchema,
  DataReportJsonFormatSchema,
  DataReportJsonGenerationHintsSchema,
  DataReportJsonGenerationModeSchema,
  DataReportJsonGenerationStatusSchema,
  DataReportJsonLayoutSchema,
  DataReportJsonMetaSchema,
  DataReportJsonMetricItemSchema,
  DataReportJsonMetricsBlockSchema,
  DataReportJsonMigrationContextSchema,
  DataReportJsonMigrationSourceProductSchema,
  DataReportJsonPageDefaultsSchema,
  DataReportJsonPatchOperationSchema,
  DataReportJsonSchemaSchema,
  DataReportJsonScopeSchema,
  DataReportJsonSectionSchema,
  DataReportJsonStructuredChartSpecSchema,
  DataReportJsonStructuredDataSourceInputSchema,
  DataReportJsonStructuredFilterInputSchema,
  DataReportJsonStructuredInputSchema,
  DataReportJsonStructuredMetricsSpecSchema,
  DataReportJsonStructuredSectionInputSchema,
  DataReportJsonStructuredTableSpecSchema,
  DataReportJsonTableBlockSchema,
  DataReportJsonTableColumnSchema,
  DataReportJsonVersionInfoSchema
} from './schemas/data-report-json-schema';

export type DataReportJsonScope = z.infer<typeof DataReportJsonScopeSchema>;
export type DataReportJsonLayout = z.infer<typeof DataReportJsonLayoutSchema>;
export type DataReportJsonGenerationMode = z.infer<typeof DataReportJsonGenerationModeSchema>;
export type DataReportJsonGenerationStatus = z.infer<typeof DataReportJsonGenerationStatusSchema>;
export type DataReportJsonComplexityLevel = z.infer<typeof DataReportJsonComplexityLevelSchema>;
export type DataReportJsonFilterValueType = z.infer<typeof DataReportJsonFilterValueTypeSchema>;
export type DataReportJsonBlockType = z.infer<typeof DataReportJsonBlockTypeSchema>;
export type DataReportJsonChartType = z.infer<typeof DataReportJsonChartTypeSchema>;
export type DataReportJsonChartSeriesType = z.infer<typeof DataReportJsonChartSeriesTypeSchema>;
export type DataReportJsonFormat = z.infer<typeof DataReportJsonFormatSchema>;
export type DataReportJsonAggregate = z.infer<typeof DataReportJsonAggregateSchema>;
export type DataReportJsonMigrationSourceProduct = z.infer<typeof DataReportJsonMigrationSourceProductSchema>;
export type DataReportJsonMeta = z.infer<typeof DataReportJsonMetaSchema>;
export type DataReportJsonFilterField = z.infer<typeof DataReportJsonFilterFieldSchema>;
export type DataReportJsonFilterSchema = z.infer<typeof DataReportJsonFilterSchemaSchema>;
export type DataReportJsonDataSource = z.infer<typeof DataReportJsonDataSourceSchema>;
export type DataReportJsonMetricItem = z.infer<typeof DataReportJsonMetricItemSchema>;
export type DataReportJsonChartSeries = z.infer<typeof DataReportJsonChartSeriesSchema>;
export type DataReportJsonTableColumn = z.infer<typeof DataReportJsonTableColumnSchema>;
export type DataReportJsonStructuredFilterInput = z.infer<typeof DataReportJsonStructuredFilterInputSchema>;
export type DataReportJsonStructuredDataSourceInput = z.infer<typeof DataReportJsonStructuredDataSourceInputSchema>;
export type DataReportJsonStructuredMetricsSpec = z.infer<typeof DataReportJsonStructuredMetricsSpecSchema>;
export type DataReportJsonStructuredChartSpec = z.infer<typeof DataReportJsonStructuredChartSpecSchema>;
export type DataReportJsonStructuredTableSpec = z.infer<typeof DataReportJsonStructuredTableSpecSchema>;
export type DataReportJsonStructuredSectionInput = z.infer<typeof DataReportJsonStructuredSectionInputSchema>;
export type DataReportJsonGenerationHints = z.infer<typeof DataReportJsonGenerationHintsSchema>;
export type DataReportJsonMigrationContext = z.infer<typeof DataReportJsonMigrationContextSchema>;
export type DataReportJsonStructuredInput = z.infer<typeof DataReportJsonStructuredInputSchema>;
export type DataReportJsonMetricsBlock = z.infer<typeof DataReportJsonMetricsBlockSchema>;
export type DataReportJsonChartBlock = z.infer<typeof DataReportJsonChartBlockSchema>;
export type DataReportJsonTableBlock = z.infer<typeof DataReportJsonTableBlockSchema>;
export type DataReportJsonBlock = z.infer<typeof DataReportJsonBlockSchema>;
export type DataReportJsonSection = z.infer<typeof DataReportJsonSectionSchema>;
export type DataReportJsonPageDefaults = z.infer<typeof DataReportJsonPageDefaultsSchema>;
export type DataReportJsonPatchOperation = z.infer<typeof DataReportJsonPatchOperationSchema>;
export type DataReportJsonVersionInfo = z.infer<typeof DataReportJsonVersionInfoSchema>;
export type DataReportJsonSchema = z.infer<typeof DataReportJsonSchemaSchema>;
export type DataReportJsonAnalysisArtifact = z.infer<typeof DataReportJsonAnalysisArtifactSchema>;
