import { buildDataReportBlueprint, inferSingleReportStructure } from '@agent/report-kit';

import { buildDataReportPlanningContext, DATA_REPORT_COMPONENT_PROMPT } from '../prompts';
import { DataReportComponentPlanSchema } from '../schemas';
import type { DataReportSandpackGraphHandlers, DataReportSandpackGraphState } from '../../../types/data-report';
import { tryExecuteMock } from '../../../utils/mock';
import { generateDataReportNodeObject } from './planning-node-helpers';
import { routeNameFromGoal, traceNode, type NodePatch } from './shared';

export async function runComponentNode(
  state: DataReportSandpackGraphState,
  handlers: DataReportSandpackGraphHandlers = {}
): Promise<NodePatch> {
  if (handlers.componentNode) {
    return traceNode(state, 'componentNode', await handlers.componentNode(state));
  }

  const mocked = await tryExecuteMock(
    state,
    'componentNode',
    'data-report/component-node.json',
    data => data as NodePatch
  );
  if (mocked) {
    return traceNode(state, 'componentNode', mocked as NodePatch);
  }

  const routeName = state.intent?.routeName ?? routeNameFromGoal(state.goal);
  const blueprint = state.blueprint ?? buildDataReportBlueprint({ goal: state.goal, baseDir: 'src' });
  const isSingleReport =
    (state.scopeDecision?.referenceMode ?? state.analysis?.referenceMode ?? blueprint.scope) === 'single';
  if (!isSingleReport) {
    return traceNode(state, 'componentNode', {
      blueprint,
      components: {
        singleReportMode: undefined,
        planned: blueprint.modules.map(module => ({
          name: module.id,
          path: `/src/pages/dataDashboard/${routeName}/components/${module.id}/index.tsx`,
          purpose: `${module.id} 报表模块，内部使用 ProCard、指标卡、图表和表格区域`
        }))
      }
    });
  }

  const singleReportStructure = inferSingleReportStructure({
    goal: state.goal,
    routeName
  });

  if (singleReportStructure.mode === 'page-only') {
    return traceNode(state, 'componentNode', {
      blueprint,
      components: {
        singleReportMode: 'page-only' as const,
        planned: []
      }
    });
  }

  const structured = await generateDataReportNodeObject({
    state: { ...state, blueprint },
    node: 'componentNode',
    contractName: 'data-report.component',
    contractVersion: '1.0.0',
    schema: DataReportComponentPlanSchema,
    systemPrompt: DATA_REPORT_COMPONENT_PROMPT,
    userContent: buildDataReportPlanningContext({ ...state, blueprint })
  });

  const baseName = singleReportStructure.componentBaseName;
  return traceNode(state, 'componentNode', {
    blueprint,
    components: structured ?? {
      singleReportMode: 'component-files' as const,
      planned: [
        {
          name: `${baseName}Chart`,
          path: `/src/pages/dataDashboard/${routeName}/components/${baseName}Chart.tsx`,
          purpose: `${blueprint.routeTitle} 的图表组件`
        },
        {
          name: `${baseName}Metrics`,
          path: `/src/pages/dataDashboard/${routeName}/components/${baseName}Metrics.tsx`,
          purpose: `${blueprint.routeTitle} 的指标组件`
        },
        {
          name: `${baseName}Table`,
          path: `/src/pages/dataDashboard/${routeName}/components/${baseName}Table.tsx`,
          purpose: `${blueprint.routeTitle} 的表格组件`
        }
      ]
    }
  });
}
