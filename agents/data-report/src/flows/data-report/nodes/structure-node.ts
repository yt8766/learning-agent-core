import {
  buildDataReportBlueprint,
  buildDataReportModuleScaffold,
  buildDataReportRoutes,
  buildDataReportScaffold
} from '@agent/report-kit';

import type { DataReportSandpackGraphHandlers, DataReportSandpackGraphState } from '../../../types/data-report';
import { tryExecuteMock } from '../../../utils/mock';
import {
  createStructureFromBlueprint,
  routeNameFromGoal,
  scaffoldFilesToSandpackFiles,
  shouldDeterministicMultiAssembly,
  traceNode,
  type NodePatch
} from './shared';

export async function runStructureNode(
  state: DataReportSandpackGraphState,
  handlers: DataReportSandpackGraphHandlers = {}
): Promise<NodePatch> {
  if (handlers.structureNode) {
    return traceNode(state, 'structureNode', await handlers.structureNode(state));
  }

  const mocked = await tryExecuteMock(
    state,
    'structureNode',
    'data-report/structure-node.json',
    data => data as NodePatch
  );
  if (mocked) {
    return traceNode(state, 'structureNode', mocked as NodePatch);
  }

  const routeName = state.intent?.routeName ?? routeNameFromGoal(state.goal);
  const blueprint = state.blueprint ?? buildDataReportBlueprint({ goal: state.goal, baseDir: 'src' });
  const components = state.components?.planned ?? [];
  const deterministicAssets = shouldDeterministicMultiAssembly({ ...state, blueprint })
    ? {
        scaffoldFiles: scaffoldFilesToSandpackFiles(
          buildDataReportScaffold({
            goal: state.goal,
            baseDir: blueprint.baseDir,
            templateId: blueprint.templateId
          }).files
        ),
        moduleFiles: scaffoldFilesToSandpackFiles(
          blueprint.modules.flatMap(
            module =>
              buildDataReportModuleScaffold({
                goal: state.goal,
                baseDir: blueprint.baseDir,
                templateId: blueprint.templateId,
                moduleId: module.id
              }).files
          )
        ),
        routeFiles: scaffoldFilesToSandpackFiles(buildDataReportRoutes(blueprint).files)
      }
    : undefined;
  return traceNode(state, 'structureNode', {
    blueprint,
    structure: createStructureFromBlueprint(blueprint, routeName, components, state.components?.singleReportMode),
    deterministicAssets
  });
}
