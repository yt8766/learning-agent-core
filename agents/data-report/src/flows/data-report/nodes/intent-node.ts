import { buildDataReportPlanningContext, DATA_REPORT_INTENT_PROMPT } from '../prompts';
import { DataReportIntentSchema } from '../schemas';
import type { DataReportSandpackGraphHandlers, DataReportSandpackGraphState } from '../../../types/data-report';
import { tryExecuteMock } from '../../../utils/mock';
import { generateDataReportNodeObject } from './planning-node-helpers';
import { routeNameFromGoal, shouldDeterministicMultiAssembly, traceNode, type NodePatch } from './shared';

export async function runIntentNode(
  state: DataReportSandpackGraphState,
  handlers: DataReportSandpackGraphHandlers = {}
): Promise<NodePatch> {
  if (handlers.intentNode) {
    return traceNode(state, 'intentNode', await handlers.intentNode(state));
  }

  const mocked = await tryExecuteMock(state, 'intentNode', 'data-report/intent-node.json', 'intent');
  if (mocked && typeof mocked === 'object' && 'intent' in mocked) {
    return traceNode(state, 'intentNode', mocked as NodePatch);
  }

  const structured = shouldDeterministicMultiAssembly(state)
    ? null
    : await generateDataReportNodeObject({
        state,
        node: 'intentNode',
        contractName: 'data-report.intent',
        contractVersion: '1.0.0',
        schema: DataReportIntentSchema,
        systemPrompt: DATA_REPORT_INTENT_PROMPT,
        userContent: buildDataReportPlanningContext(state)
      });

  return traceNode(state, 'intentNode', {
    intent: structured ?? {
      action: 'generate-report-page',
      routeName: state.analysis?.routeName ?? routeNameFromGoal(state.goal),
      moduleBasePath: `/src/pages/dataDashboard/${state.analysis?.routeName ?? routeNameFromGoal(state.goal)}`,
      serviceBaseName: state.analysis?.routeName ?? routeNameFromGoal(state.goal)
    }
  });
}
