import type {
  DataReportJsonBlock,
  DataReportJsonGraphState,
  DataReportJsonMeta,
  DataReportJsonNodeStageEvent,
  DataReportJsonPatchOperation,
  DataReportJsonSchema,
  DataReportJsonSection
} from '../../../types/data-report-json';
import {
  resolveDataReportJsonFastLane,
  resolveDataReportJsonMode,
  resolveDataReportJsonNodeModelCandidates
} from '../model-policy';

export type DataReportJsonNodePatch = Partial<DataReportJsonGraphState>;
export type DataReportJsonPatchTarget = 'filterSchema' | 'dataSources' | 'metricsBlock' | 'chartBlock' | 'tableBlock';

const schemaSpecCache = new Map<
  string,
  {
    meta: Omit<DataReportJsonMeta, 'owner'>;
    pageDefaults: DataReportJsonSchema['pageDefaults'];
    patchOperations: DataReportJsonPatchOperation[];
    warnings: string[];
  }
>();
const sectionPatchCache = new Map<
  string,
  {
    schema: DataReportJsonSchema;
    patchOperations: DataReportJsonPatchOperation[];
  }
>();
const splitBlockArtifactCache = new Map<string, DataReportJsonBlock | Omit<DataReportJsonSection, 'blocks'>>();

export function emitJsonNodeStage(state: DataReportJsonGraphState, event: DataReportJsonNodeStageEvent) {
  state.onStage?.(event);
}

export function getSchemaSpecCache(key: string, disabled = false) {
  if (disabled) {
    return undefined;
  }
  return schemaSpecCache.get(key);
}

export function setSchemaSpecCache(
  key: string,
  value: {
    meta: Omit<DataReportJsonMeta, 'owner'>;
    pageDefaults: DataReportJsonSchema['pageDefaults'];
    patchOperations: DataReportJsonPatchOperation[];
    warnings: string[];
  },
  disabled = false
) {
  if (disabled) {
    return;
  }
  schemaSpecCache.set(key, cloneSchema(value));
}

export function getSectionPatchCache(key: string, disabled = false) {
  if (disabled) {
    return undefined;
  }
  return sectionPatchCache.get(key);
}

export function setSectionPatchCache(
  key: string,
  value: {
    schema: DataReportJsonSchema;
    patchOperations: DataReportJsonPatchOperation[];
  },
  disabled = false
) {
  if (disabled) {
    return;
  }
  sectionPatchCache.set(key, cloneSchema(value));
}

export function getSplitBlockArtifactCache<T extends DataReportJsonBlock | Omit<DataReportJsonSection, 'blocks'>>(
  key: string,
  disabled = false
) {
  if (disabled) {
    return undefined;
  }
  return splitBlockArtifactCache.get(key) as T | undefined;
}

export function setSplitBlockArtifactCache<T extends DataReportJsonBlock | Omit<DataReportJsonSection, 'blocks'>>(
  key: string,
  value: T,
  disabled = false
) {
  if (disabled) {
    return;
  }
  splitBlockArtifactCache.set(key, cloneSchema(value));
}

export function buildSplitBlockArtifactCacheKey(
  state: DataReportJsonGraphState,
  node: 'sectionPlanNode' | 'metricsBlockNode' | 'chartBlockNode' | 'tableBlockNode'
) {
  const reportId = state.meta?.reportId ?? state.analysis?.routeName ?? 'dataReport';
  const modelCandidates =
    node === 'sectionPlanNode' && !state.llm?.isConfigured()
      ? []
      : resolveDataReportJsonNodeModelCandidates(state, node);

  return JSON.stringify({
    version: 'split-block-v4',
    node,
    goal: state.goal.trim(),
    reportId,
    scope: state.analysis?.scope ?? state.reportSchemaInput?.meta.scope ?? 'single',
    mode: resolveDataReportJsonMode(state),
    fastLane: resolveDataReportJsonFastLane(state),
    strictLlmBrandNew: state.strictLlmBrandNew ?? false,
    llmConfigured: state.llm?.isConfigured() ?? false,
    modelCandidates
  });
}

export function resetDataReportJsonNodeCaches() {
  schemaSpecCache.clear();
  sectionPatchCache.clear();
  splitBlockArtifactCache.clear();
}

export function cloneSchema<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function stableStringify(value: unknown) {
  return JSON.stringify(value);
}
