import { buildDataReportBlueprint } from '@agent/report-kit';

import { buildDataReportPlanningContext, DATA_REPORT_ANALYSIS_PROMPT } from '../prompts';
import { DataReportAnalysisSchema } from '../schemas';
import type { DataReportSandpackGraphHandlers, DataReportSandpackGraphState } from '../../../types/data-report';
import { tryExecuteMock } from '../../../utils/mock';
import { generateDataReportNodeObject } from './planning-node-helpers';
import { dataSourceHintFromGoal, routeNameFromGoal, titleFromGoal, traceNode, type NodePatch } from './shared';

export async function runAnalysisNode(
  state: DataReportSandpackGraphState,
  handlers: DataReportSandpackGraphHandlers = {}
): Promise<NodePatch> {
  if (handlers.analysisNode) {
    return traceNode(state, 'analysisNode', await handlers.analysisNode(state));
  }

  const mocked = await tryExecuteMock(state, 'analysisNode', 'data-report/analysis-node.json', 'analysis');
  if (mocked && typeof mocked === 'object' && 'analysis' in mocked) {
    return traceNode(state, 'analysisNode', mocked as NodePatch);
  }

  const routeName = routeNameFromGoal(state.goal);
  const blueprint = buildDataReportBlueprint({ goal: state.goal, baseDir: 'src' });
  const hasStructuredSingleReportHints = /(报表名称|大数据接口|字段列表|展示字段|字段\s*[：:])/i.test(state.goal);
  const keywords = Array.from(
    new Set(
      [routeName, blueprint.templateId, blueprint.scope, /bonus/i.test(state.goal) ? 'bonus-center' : undefined].filter(
        Boolean
      ) as string[]
    )
  );
  const useDeterministicAnalysis =
    blueprint.templateId === 'bonus-center-data' &&
    blueprint.scope === 'multiple' &&
    /(多个|多张|多页|multi|批量|一组|多个报表)/i.test(state.goal) &&
    !hasStructuredSingleReportHints;
  let structured = null;
  if (!useDeterministicAnalysis) {
    try {
      structured = await generateDataReportNodeObject({
        state,
        node: 'analysisNode',
        contractName: 'data-report.analysis',
        contractVersion: '1.0.0',
        schema: DataReportAnalysisSchema,
        systemPrompt: DATA_REPORT_ANALYSIS_PROMPT,
        userContent: buildDataReportPlanningContext(state)
      });
    } catch {
      structured = null;
    }
  }
  const normalizedAnalysis = structured
    ? {
        ...structured,
        templateId: blueprint.templateId
      }
    : null;

  return traceNode(state, 'analysisNode', {
    goal: state.goal.trim(),
    blueprint,
    analysis: normalizedAnalysis ?? {
      reportType: 'data-dashboard',
      requiresSandpack: true,
      requiresMultiFileOutput: true,
      title: blueprint.routeTitle || titleFromGoal(state.goal),
      routeName: blueprint.routeName || routeName,
      templateId: blueprint.templateId,
      referenceMode: blueprint.scope,
      dataSourceHint: dataSourceHintFromGoal(state.goal),
      keywords
    }
  });
}
