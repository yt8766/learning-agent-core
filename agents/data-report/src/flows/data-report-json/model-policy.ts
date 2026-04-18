import type {
  DataReportJsonComplexityLevel,
  DataReportJsonGenerationMode,
  DataReportJsonGenerationNode,
  DataReportJsonGraphState,
  DataReportJsonNodeModelSelector,
  DataReportJsonNodeModelPolicy
} from '../../types/data-report-json';
import { resolveModelSelectorCandidateIds } from '../../utils/model-selection';

function isNodeModelSelector(
  value: DataReportJsonNodeModelSelector | undefined
): value is DataReportJsonNodeModelSelector {
  return Boolean(value);
}

export const DATA_REPORT_JSON_DEFAULT_MODEL_POLICY: DataReportJsonNodeModelPolicy = {
  analysisNode: {
    primary: { tier: 'fast', role: 'manager' }
  },
  patchIntentNode: {
    primary: { tier: 'fast', role: 'manager' }
  },
  schemaSpecNode: {
    primary: { tier: 'quality', role: 'research' }
  },
  filterSchemaNode: {
    primary: { tier: 'fast', role: 'manager' },
    fallback: { tier: 'quality', role: 'research' }
  },
  dataSourceNode: {
    primary: { tier: 'fast', role: 'manager' },
    fallback: { tier: 'quality', role: 'research' }
  },
  sectionPlanNode: {
    primary: { tier: 'fast', role: 'manager' },
    fallback: { tier: 'quality', role: 'research' }
  },
  metricsBlockNode: {
    primary: { tier: 'fast', role: 'manager' },
    fallback: { tier: 'quality', role: 'research' }
  },
  chartBlockNode: {
    primary: { tier: 'fast', role: 'manager' },
    fallback: { tier: 'quality', role: 'research' }
  },
  tableBlockNode: {
    primary: { tier: 'fast', role: 'manager' },
    fallback: { tier: 'quality', role: 'research' }
  },
  sectionSchemaNode: {
    primary: { tier: 'fast', role: 'manager' },
    complex: { tier: 'quality', role: 'research' },
    fallback: { tier: 'quality', role: 'research' }
  },
  patchSchemaNode: {
    primary: { tier: 'fast', role: 'manager' },
    complex: { tier: 'quality', role: 'research' },
    fallback: { tier: 'quality', role: 'research' }
  }
};

export function resolveDataReportJsonMode(state: DataReportJsonGraphState): DataReportJsonGenerationMode {
  if (state.mode) {
    return state.mode;
  }

  return state.currentSchema ? 'patch' : 'brand-new';
}

export function resolveDataReportJsonComplexity(
  state: Pick<DataReportJsonGraphState, 'goal' | 'currentSchema' | 'analysis' | 'complexity'>
): DataReportJsonComplexityLevel {
  if (state.complexity) {
    return state.complexity;
  }

  const currentSchema = state.currentSchema;
  if ((state.analysis?.scope ?? currentSchema?.meta.scope) === 'multiple') {
    return 'complex';
  }

  if ((currentSchema?.sections.length ?? 0) > 1) {
    return 'complex';
  }

  const blockCount = currentSchema?.sections.reduce((sum, section) => sum + section.blocks.length, 0) ?? 0;
  if (blockCount > 4) {
    return 'complex';
  }

  const normalizedGoal = state.goal.toLowerCase();
  if (/多个|multi|bundle|强还原|复杂|complex|dashboard|驾驶舱|参考.+模板|参考.+页面/i.test(normalizedGoal)) {
    return 'complex';
  }

  return 'simple';
}

export function resolveDataReportJsonFastLane(state: DataReportJsonGraphState) {
  if (typeof state.fastLane === 'boolean') {
    return state.fastLane;
  }

  return resolveDataReportJsonMode(state) === 'brand-new' && resolveDataReportJsonComplexity(state) === 'simple';
}

export function shouldUseSplitSingleReportLane(
  state: Pick<DataReportJsonGraphState, 'currentSchema' | 'reportSchemaInput' | 'analysis'>
) {
  return !state.currentSchema && !state.reportSchemaInput && state.analysis?.scope === 'single';
}

export function resolveDataReportJsonTargetLatencyClass(
  state: Pick<DataReportJsonGraphState, 'reportSchemaInput' | 'analysis' | 'currentSchema'>
) {
  if (state.reportSchemaInput?.generationHints?.targetLatencyClass) {
    return state.reportSchemaInput.generationHints.targetLatencyClass;
  }

  return 'balanced';
}

export function shouldPreferDeterministicSingleReportBlocks(
  state: Pick<DataReportJsonGraphState, 'currentSchema' | 'analysis' | 'reportSchemaInput'>
) {
  if (state.currentSchema || state.analysis?.scope !== 'single') {
    return false;
  }

  return resolveDataReportJsonTargetLatencyClass(state) === 'fast';
}

export function resolveDataReportJsonNodeModelPolicy(state: DataReportJsonGraphState) {
  return state.nodeModelPolicy ?? DATA_REPORT_JSON_DEFAULT_MODEL_POLICY;
}

export function resolveDataReportJsonNodeModelCandidates(
  state: DataReportJsonGraphState,
  node: Exclude<DataReportJsonGenerationNode, 'validateNode'>
) {
  const policy = resolveDataReportJsonNodeModelPolicy(state);
  const override = state.nodeModelOverrides?.[node];
  const complexity = resolveDataReportJsonComplexity(state);

  let defaults: DataReportJsonNodeModelSelector[] = [];
  switch (node) {
    case 'planningNode':
      defaults = [policy.schemaSpecNode.primary];
      break;
    case 'analysisNode':
      defaults = [policy.analysisNode.primary];
      break;
    case 'patchIntentNode':
      defaults = [policy.patchIntentNode.primary];
      break;
    case 'schemaSpecNode':
      defaults = [policy.schemaSpecNode.primary];
      break;
    case 'filterSchemaNode':
      defaults = [policy.filterSchemaNode.primary, policy.filterSchemaNode.fallback].filter(isNodeModelSelector);
      break;
    case 'dataSourceNode':
      defaults = [policy.dataSourceNode.primary, policy.dataSourceNode.fallback].filter(isNodeModelSelector);
      break;
    case 'sectionPlanNode':
      defaults = [policy.sectionPlanNode.primary, policy.sectionPlanNode.fallback].filter(isNodeModelSelector);
      break;
    case 'metricsBlockNode':
      defaults = [policy.metricsBlockNode.primary, policy.metricsBlockNode.fallback].filter(isNodeModelSelector);
      break;
    case 'chartBlockNode':
      defaults = [policy.chartBlockNode.primary, policy.chartBlockNode.fallback].filter(isNodeModelSelector);
      break;
    case 'tableBlockNode':
      defaults = [policy.tableBlockNode.primary, policy.tableBlockNode.fallback].filter(isNodeModelSelector);
      break;
    case 'sectionSchemaNode':
      defaults =
        complexity === 'complex'
          ? [policy.sectionSchemaNode.complex ?? policy.sectionSchemaNode.primary, policy.sectionSchemaNode.primary]
          : [
              policy.sectionSchemaNode.primary,
              policy.sectionSchemaNode.complex ?? policy.sectionSchemaNode.fallback
            ].filter(isNodeModelSelector);
      break;
    case 'patchSchemaNode':
      defaults =
        complexity === 'complex'
          ? [policy.patchSchemaNode.complex ?? policy.patchSchemaNode.primary, policy.patchSchemaNode.primary]
          : [policy.patchSchemaNode.primary, policy.patchSchemaNode.complex ?? policy.patchSchemaNode.fallback].filter(
              isNodeModelSelector
            );
      break;
  }

  return Array.from(
    new Set(
      [override, ...defaults]
        .filter((value): value is DataReportJsonNodeModelSelector => Boolean(value))
        .flatMap(selector => resolveModelSelectorCandidateIds({ llm: state.llm, selector, explicitModelId: override }))
    )
  );
}

export function classifyDataReportJsonPatchMode(state: DataReportJsonGraphState) {
  if (!state.currentSchema) {
    return 'brand-new';
  }

  const request = state.modificationRequest?.trim() ?? '';
  if (!request) {
    return 'simple';
  }

  if (/route|reportid|dataSourceKey|data source key|serviceKey/i.test(request)) {
    return 'complex';
  }

  if (/图表|chart|折线|柱状|饼图|line|bar|pie/i.test(request)) {
    return 'complex';
  }

  if ((state.currentSchema.sections.length ?? 0) > 1 && /全部|所有|多个|联动|同步/.test(request)) {
    return 'complex';
  }

  return 'simple';
}
