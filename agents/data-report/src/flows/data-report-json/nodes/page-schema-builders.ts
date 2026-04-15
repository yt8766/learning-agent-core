import type {
  DataReportJsonDataSource,
  DataReportJsonFilterSchema,
  DataReportJsonGraphState,
  DataReportJsonMeta,
  DataReportJsonPatchOperation,
  DataReportJsonReportSummary,
  DataReportJsonSchema,
  DataReportJsonSection,
  DataReportJsonVersionInfo
} from '../../../types/data-report-json';
import {
  classifyDataReportJsonPatchMode,
  resolveDataReportJsonComplexity,
  resolveDataReportJsonFastLane,
  resolveDataReportJsonMode,
  resolveDataReportJsonNodeModelPolicy
} from '../model-policy';
import {
  collectRequestedFilterKeys,
  deriveAnalysisFromGoalWithCacheControl,
  inferReportName,
  inferRouteName,
  parseGoalArtifacts
} from './goal-artifacts';
import { getSchemaSpecCache, setSchemaSpecCache } from './shared-core';

function buildCacheKey(goal: string, suffix: string) {
  return `${suffix}:${goal.trim()}`;
}

function inferSingleReportFilterDefaults(goal: string) {
  const requestedFilterKeys = collectRequestedFilterKeys(goal);
  const artifacts = parseGoalArtifacts(goal);
  const userTypeField = artifacts.filterEntries.find(field => field.name === 'user_type');
  const filters: Record<string, unknown> = {
    dateRange: {
      preset: 'last7Days'
    }
  };

  if (requestedFilterKeys.has('app')) {
    filters.app = [];
  }
  if (requestedFilterKeys.has('user_type')) {
    filters.user_type = userTypeField?.options?.[0]?.value ?? 'all';
  }

  return filters;
}

export function buildDeterministicSchemaSpec(
  state: Pick<DataReportJsonGraphState, 'goal' | 'analysis' | 'disableCache'>
) {
  const cacheKey = buildCacheKey(state.goal, 'schema-spec');
  const cached = getSchemaSpecCache(cacheKey, state.disableCache);
  if (cached) {
    return {
      ...cached,
      cacheHit: true
    };
  }

  const analysis = state.analysis ?? deriveAnalysisFromGoalWithCacheControl(state.goal, state.disableCache).analysis;
  const title = analysis.title || inferReportName(state.goal);
  const reportId = analysis.routeName || inferRouteName(state.goal);
  const schemaSpec = {
    meta: {
      reportId,
      title,
      description: `${title} 页面 schema`,
      route: analysis.route || `/dataDashboard/${reportId}`,
      templateRef: analysis.templateRef,
      scope: analysis.scope,
      layout: analysis.layout
    },
    pageDefaults: {
      filters: inferSingleReportFilterDefaults(state.goal),
      queryPolicy: {
        autoQueryOnInit: true,
        autoQueryOnFilterChange: false,
        cacheKey: reportId
      }
    },
    patchOperations: [] as DataReportJsonPatchOperation[],
    warnings: [] as string[]
  };

  setSchemaSpecCache(cacheKey, schemaSpec, state.disableCache);
  return {
    ...schemaSpec,
    cacheHit: false
  };
}

export function buildVersionInfo(
  currentSchema: DataReportJsonSchema | undefined,
  patchOperations: DataReportJsonPatchOperation[]
): DataReportJsonVersionInfo {
  const baseVersion = currentSchema ? 1 : 0;
  return {
    baseVersion,
    nextVersion: baseVersion + 1,
    patchSummary: patchOperations.length
      ? patchOperations.map(operation => operation.summary).join('；')
      : '生成报表 schema'
  };
}

export function buildPartialPageSchema(
  state: Pick<
    DataReportJsonGraphState,
    'currentSchema' | 'meta' | 'pageDefaults' | 'filterSchema' | 'dataSources' | 'sections' | 'warnings'
  >
) {
  const warnings = state.warnings ?? [];
  if (state.currentSchema) {
    return buildPatchedPageSchema({
      currentSchema: state.currentSchema,
      meta: state.meta,
      pageDefaults: state.pageDefaults,
      filterSchema: state.filterSchema,
      dataSources: state.dataSources,
      sections: state.sections,
      warnings
    });
  }

  return {
    version: '1.0' as const,
    kind: 'data-report-json' as const,
    meta: state.meta
      ? {
          ...state.meta,
          owner: 'data-report-json-agent' as const
        }
      : undefined,
    pageDefaults: state.pageDefaults,
    filterSchema: state.filterSchema,
    dataSources: state.dataSources ?? {},
    sections: state.sections ?? [],
    registries: {
      filterComponents: Array.from(
        new Set((state.filterSchema?.fields ?? []).map(field => field.component.componentKey))
      ),
      blockTypes: ['metrics', 'chart', 'table'],
      serviceKeys: Array.from(new Set(Object.values(state.dataSources ?? {}).map(item => item.serviceKey)))
    },
    modification: {
      strategy: 'patchable-json',
      supportedOperations: ['update-filter-defaults', 'replace-section', 'append-section', 'update-block-config']
    },
    patchOperations: [],
    warnings
  } satisfies Partial<DataReportJsonSchema>;
}

export function buildReportSummaries(
  sections: DataReportJsonSection[] | undefined,
  defaults?: Partial<DataReportJsonReportSummary>
) {
  return (sections ?? []).map(section => ({
    reportKey: section.id,
    status: 'success' as const,
    elapsedMs: defaults?.elapsedMs,
    modelId: defaults?.modelId,
    retryCount: defaults?.retryCount,
    cacheHit: defaults?.cacheHit
  }));
}

export function decorateStateDefaults(state: DataReportJsonGraphState) {
  const mode = resolveDataReportJsonMode(state);
  const complexity = resolveDataReportJsonComplexity(state);
  const fastLane = resolveDataReportJsonFastLane(state);
  return {
    mode,
    complexity,
    fastLane,
    nodeModelPolicy: resolveDataReportJsonNodeModelPolicy(state),
    patchMode: classifyDataReportJsonPatchMode(state)
  };
}

export function buildPatchedPageSchema(params: {
  currentSchema: DataReportJsonSchema;
  meta?: Omit<DataReportJsonMeta, 'owner'>;
  pageDefaults?: DataReportJsonSchema['pageDefaults'];
  filterSchema?: DataReportJsonFilterSchema;
  dataSources?: Record<string, DataReportJsonDataSource>;
  sections?: DataReportJsonSection[];
  patchOperations?: DataReportJsonPatchOperation[];
  warnings?: string[];
}): DataReportJsonSchema {
  const meta = params.meta
    ? {
        ...params.meta,
        owner: 'data-report-json-agent' as const
      }
    : params.currentSchema.meta;
  const filterSchema = params.filterSchema ?? params.currentSchema.filterSchema;
  const dataSources = params.dataSources ?? params.currentSchema.dataSources;
  const sections = params.sections ?? params.currentSchema.sections;

  return {
    ...params.currentSchema,
    meta,
    pageDefaults: params.pageDefaults ?? params.currentSchema.pageDefaults,
    filterSchema,
    dataSources,
    sections,
    registries: {
      filterComponents: Array.from(new Set(filterSchema.fields.map(field => field.component.componentKey))),
      blockTypes: ['metrics', 'chart', 'table'],
      serviceKeys: Array.from(new Set(Object.values(dataSources).map(item => item.serviceKey)))
    },
    patchOperations: params.patchOperations ?? params.currentSchema.patchOperations ?? [],
    warnings: params.warnings ?? params.currentSchema.warnings ?? []
  };
}

export function buildBrandNewPageSchema(params: {
  meta: Omit<DataReportJsonMeta, 'owner'>;
  pageDefaults: DataReportJsonSchema['pageDefaults'];
  filterSchema: DataReportJsonFilterSchema;
  dataSources: Record<string, DataReportJsonDataSource>;
  sections: DataReportJsonSection[];
  patchOperations?: DataReportJsonPatchOperation[];
  warnings?: string[];
}): DataReportJsonSchema {
  return {
    version: '1.0',
    kind: 'data-report-json',
    meta: {
      ...params.meta,
      owner: 'data-report-json-agent' as const
    },
    pageDefaults: params.pageDefaults,
    filterSchema: params.filterSchema,
    dataSources: params.dataSources,
    sections: params.sections,
    registries: {
      filterComponents: Array.from(new Set(params.filterSchema.fields.map(field => field.component.componentKey))),
      blockTypes: ['metrics', 'chart', 'table'],
      serviceKeys: Array.from(new Set(Object.values(params.dataSources).map(item => item.serviceKey)))
    },
    modification: {
      strategy: 'patchable-json',
      supportedOperations: ['update-filter-defaults', 'replace-section', 'append-section', 'update-block-config']
    },
    patchOperations: params.patchOperations ?? [],
    warnings: params.warnings ?? []
  };
}
