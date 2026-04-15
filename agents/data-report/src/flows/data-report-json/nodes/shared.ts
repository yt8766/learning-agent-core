export type { DataReportJsonNodePatch, DataReportJsonPatchTarget } from './shared-core';
export {
  buildSplitBlockArtifactCacheKey,
  cloneSchema,
  emitJsonNodeStage,
  getSchemaSpecCache,
  getSectionPatchCache,
  getSplitBlockArtifactCache,
  setSchemaSpecCache,
  setSectionPatchCache,
  setSplitBlockArtifactCache,
  stableStringify
} from './shared-core';
export type { ParsedDisplayField, ParsedGoalArtifacts } from './goal-artifacts';
export {
  buildDataReportJsonNodeContexts,
  buildStructuredSchemaArtifacts,
  collectRequestedFilterKeys,
  deriveAnalysisFromGoal,
  deriveAnalysisFromGoalWithCacheControl,
  deriveAnalysisFromSchema,
  extractEmbeddedSchema,
  extractLabeledSection,
  extractLabeledValue,
  hasStructuredReportInput,
  inferReportName,
  inferRouteName,
  inferServiceKey,
  normalizeIdentifier,
  parseGoalArtifacts,
  resetDataReportJsonGoalArtifactCaches,
  validateStructuredReportInput
} from './goal-artifacts';
export {
  buildBrandNewPageSchema,
  buildDeterministicSchemaSpec,
  buildPartialPageSchema,
  buildPatchedPageSchema,
  buildReportSummaries,
  buildSingleReportChartBlock,
  buildSingleReportDataSources,
  buildSingleReportFilterSchema,
  buildSingleReportMetricsBlock,
  buildSingleReportSectionPlan,
  buildSingleReportTableBlock,
  buildVersionInfo,
  decorateStateDefaults
} from './schema-builders';
export {
  applySchemaModification,
  applySchemaModificationWithCache,
  buildNodeScopedPatchOperations,
  resolveNodeScopedPatchTarget,
  resolveNodeScopedPatchTargetFromIntents
} from './patch-helpers';
export { parsePatchIntents } from './patch-intent-parser';

export { resetDataReportJsonGoalArtifactCaches as resetDataReportJsonNodeCaches } from './goal-artifacts';
