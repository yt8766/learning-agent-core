import { z } from 'zod';

import {
  DataReportAnalysisArtifactSchema,
  DataReportAppArtifactSchema,
  DataReportAssembleArtifactSchema,
  DataReportBlueprintResultSchema,
  DataReportCapabilityArtifactSchema,
  DataReportComponentArtifactSchema,
  DataReportDependencyArtifactSchema,
  DataReportDeterministicAssetsSchema,
  DataReportFileGenerationEventSchema,
  DataReportGeneratedModuleArtifactSchema,
  DataReportGenerationNodeSchema,
  DataReportHooksArtifactSchema,
  DataReportIntentArtifactSchema,
  DataReportLayoutArtifactSchema,
  DataReportMockDataArtifactSchema,
  DataReportModuleBlueprintSchema,
  DataReportNodeModelOverridesSchema,
  DataReportNodeStageEventSchema,
  DataReportPlannedFileSchema,
  DataReportPreviewStageSchema,
  DataReportSandpackFilesSchema,
  DataReportSandpackPayloadSchema,
  DataReportSandpackStageSchema,
  DataReportScopeDecisionArtifactSchema,
  DataReportScopeSchema,
  DataReportServiceArtifactSchema,
  DataReportStructureArtifactSchema,
  DataReportStyleArtifactSchema,
  DataReportTypesArtifactSchema,
  DataReportUtilsArtifactSchema
} from '../spec/data-report';
export type {
  DataReportSandpackGenerateInput,
  DataReportSandpackGenerateResult,
  DataReportSandpackGraphHandlers,
  DataReportSandpackGraphState
} from '../contracts/data-report';

export type DataReportScope = z.infer<typeof DataReportScopeSchema>;
export type DataReportModuleBlueprint = z.infer<typeof DataReportModuleBlueprintSchema>;
export type DataReportBlueprintResult = z.infer<typeof DataReportBlueprintResultSchema>;
export type DataReportPlannedFile = z.infer<typeof DataReportPlannedFileSchema>;
export type DataReportAnalysisArtifact = z.infer<typeof DataReportAnalysisArtifactSchema>;
export type DataReportIntentArtifact = z.infer<typeof DataReportIntentArtifactSchema>;
export type DataReportScopeDecisionArtifact = z.infer<typeof DataReportScopeDecisionArtifactSchema>;
export type DataReportCapabilityArtifact = z.infer<typeof DataReportCapabilityArtifactSchema>;
export type DataReportComponentArtifact = z.infer<typeof DataReportComponentArtifactSchema>;
export type DataReportStructureArtifact = z.infer<typeof DataReportStructureArtifactSchema>;
export type DataReportDependencyArtifact = z.infer<typeof DataReportDependencyArtifactSchema>;
export type DataReportTypesArtifact = z.infer<typeof DataReportTypesArtifactSchema>;
export type DataReportUtilsArtifact = z.infer<typeof DataReportUtilsArtifactSchema>;
export type DataReportMockDataArtifact = z.infer<typeof DataReportMockDataArtifactSchema>;
export type DataReportServiceArtifact = z.infer<typeof DataReportServiceArtifactSchema>;
export type DataReportHooksArtifact = z.infer<typeof DataReportHooksArtifactSchema>;
export type DataReportGeneratedModuleArtifact = z.infer<typeof DataReportGeneratedModuleArtifactSchema>;
export type DataReportLayoutArtifact = z.infer<typeof DataReportLayoutArtifactSchema>;
export type DataReportStyleArtifact = z.infer<typeof DataReportStyleArtifactSchema>;
export type DataReportAppArtifact = z.infer<typeof DataReportAppArtifactSchema>;
export type DataReportFileGenerationEvent = z.infer<typeof DataReportFileGenerationEventSchema>;
export type DataReportNodeStageEvent = z.infer<typeof DataReportNodeStageEventSchema>;
export type DataReportAssembleArtifact = z.infer<typeof DataReportAssembleArtifactSchema>;
export type DataReportDeterministicAssets = z.infer<typeof DataReportDeterministicAssetsSchema>;
export type DataReportPreviewStage = z.infer<typeof DataReportPreviewStageSchema>;
export type DataReportSandpackStage = z.infer<typeof DataReportSandpackStageSchema>;
export type DataReportGenerationNode = z.infer<typeof DataReportGenerationNodeSchema>;
export type DataReportNodeModelOverrides = z.infer<typeof DataReportNodeModelOverridesSchema>;
export type DataReportSandpackFiles = z.infer<typeof DataReportSandpackFilesSchema>;
export type DataReportSandpackPayload = z.infer<typeof DataReportSandpackPayloadSchema>;
