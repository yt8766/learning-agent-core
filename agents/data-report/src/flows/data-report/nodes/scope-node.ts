import { buildDataReportBlueprint } from '@agent/report-kit';

import type { DataReportSandpackGraphHandlers, DataReportSandpackGraphState } from '../../../types/data-report';
import { tryExecuteMock } from '../../../utils/mock';
import { traceNode, type NodePatch } from './shared';

export async function runScopeNode(
  state: DataReportSandpackGraphState,
  handlers: DataReportSandpackGraphHandlers = {}
): Promise<NodePatch> {
  if (handlers.scopeNode) {
    return traceNode(state, 'scopeNode', await handlers.scopeNode(state));
  }

  const mocked = await tryExecuteMock(state, 'scopeNode', 'data-report/scope-node.json', data => data as NodePatch);
  if (mocked) {
    return traceNode(state, 'scopeNode', mocked as NodePatch);
  }

  const blueprint = buildDataReportBlueprint({
    goal: state.goal,
    baseDir: 'src',
    templateId: state.analysis?.templateId
  });

  return traceNode(state, 'scopeNode', {
    blueprint,
    analysis: state.analysis
      ? {
          ...state.analysis,
          title: blueprint.routeTitle,
          routeName: blueprint.routeName,
          referenceMode: blueprint.scope
        }
      : undefined,
    scopeDecision: {
      referenceMode: blueprint.scope,
      reason: 'template-inspection',
      templateApiCount: blueprint.templateApiCount,
      routeName: blueprint.routeName,
      routeTitle: blueprint.routeTitle,
      selectedModuleIds: blueprint.moduleIds
    }
  });
}
