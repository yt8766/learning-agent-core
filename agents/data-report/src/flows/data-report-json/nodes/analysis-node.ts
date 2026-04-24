import type { DataReportJsonGraphHandlers, DataReportJsonGraphState } from '../../../types/data-report-json';
import { resolveFirstModelSelectorCandidate } from '../../../utils/model-selection';
import {
  buildDataReportJsonNodeContexts,
  buildStructuredSchemaArtifacts,
  decorateStateDefaults,
  deriveAnalysisFromGoalWithCacheControl,
  deriveAnalysisFromSchema,
  emitJsonNodeStage,
  hasStructuredReportInput,
  type DataReportJsonNodePatch
} from './shared';

export async function runJsonAnalysisNode(
  state: DataReportJsonGraphState,
  handlers: DataReportJsonGraphHandlers = {}
): Promise<DataReportJsonNodePatch> {
  if (handlers.analysisNode) {
    return handlers.analysisNode(state);
  }

  const defaults = decorateStateDefaults({
    ...state
  });
  if (hasStructuredReportInput(state) && !state.currentSchema) {
    const structured = buildStructuredSchemaArtifacts(state.reportSchemaInput);
    const analysis = deriveAnalysisFromSchema({
      version: '1.0',
      kind: 'data-report-json',
      meta: {
        ...structured.meta,
        owner: 'data-report-json-agent'
      },
      pageDefaults: structured.pageDefaults,
      filterSchema: structured.filterSchema,
      dataSources: structured.dataSources,
      sections: structured.sections,
      registries: {
        filterComponents: Array.from(
          new Set(structured.filterSchema.fields.map(field => field.component.componentKey))
        ),
        blockTypes: ['metrics', 'chart', 'table'],
        serviceKeys: Array.from(new Set(Object.values(structured.dataSources).map(item => item.serviceKey)))
      },
      modification: {
        strategy: 'patchable-json',
        supportedOperations: ['update-filter-defaults', 'replace-section', 'append-section', 'update-block-config']
      },
      warnings: structured.warnings
    });
    emitJsonNodeStage(state, {
      node: 'analysisNode',
      status: 'success',
      modelId: resolveFirstModelSelectorCandidate({
        llm: state.llm,
        selector: defaults.nodeModelPolicy.analysisNode.primary
      }),
      details: {
        source: 'structured-input',
        modificationMode: false,
        currentSchema: false,
        mode: defaults.mode,
        complexity: defaults.complexity,
        fastLane: true,
        templateRef: analysis.templateRef,
        scope: analysis.scope,
        route: analysis.route
      }
    });
    return {
      analysis,
      nodeContexts: buildDataReportJsonNodeContexts({
        goal: state.goal,
        analysis
      }),
      mode: defaults.mode,
      complexity: defaults.complexity,
      fastLane: true,
      nodeModelPolicy: defaults.nodeModelPolicy,
      cacheHit: false
    };
  }

  if (state.currentSchema) {
    const analysis = deriveAnalysisFromSchema(state.currentSchema);
    emitJsonNodeStage(state, {
      node: 'analysisNode',
      status: 'success',
      modelId: resolveFirstModelSelectorCandidate({
        llm: state.llm,
        selector: defaults.nodeModelPolicy.analysisNode.primary
      }),
      details: {
        templateRef: analysis.templateRef,
        scope: analysis.scope,
        route: analysis.route,
        source: 'current-schema',
        modificationMode: true,
        mode: defaults.mode,
        complexity: defaults.complexity,
        fastLane: defaults.fastLane
      }
    });
    return {
      analysis,
      nodeContexts: buildDataReportJsonNodeContexts({
        goal: state.goal,
        analysis
      }),
      currentSchema: state.currentSchema,
      modificationRequest: state.modificationRequest,
      mode: defaults.mode,
      complexity: defaults.complexity,
      fastLane: defaults.fastLane,
      nodeModelPolicy: defaults.nodeModelPolicy
    };
  }

  const derived = deriveAnalysisFromGoalWithCacheControl(state.goal, state.disableCache);

  emitJsonNodeStage(state, {
    node: 'analysisNode',
    status: 'success',
    modelId: resolveFirstModelSelectorCandidate({
      llm: state.llm,
      selector: defaults.nodeModelPolicy.analysisNode.primary
    }),
    cacheHit: derived.cacheHit,
    details: {
      source: 'heuristic',
      modificationMode: false,
      currentSchema: false,
      mode: defaults.mode,
      complexity: defaults.complexity,
      fastLane: defaults.fastLane,
      templateRef: derived.analysis.templateRef,
      scope: derived.analysis.scope,
      route: derived.analysis.route
    }
  });

  return {
    analysis: derived.analysis,
    nodeContexts: buildDataReportJsonNodeContexts({
      goal: state.goal,
      analysis: derived.analysis
    }),
    currentSchema: state.currentSchema,
    modificationRequest: state.modificationRequest,
    mode: defaults.mode,
    complexity: defaults.complexity,
    fastLane: defaults.fastLane,
    nodeModelPolicy: defaults.nodeModelPolicy,
    cacheHit: derived.cacheHit
  };
}
