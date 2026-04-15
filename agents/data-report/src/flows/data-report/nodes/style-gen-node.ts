import { buildDataReportPlanningContext, DATA_REPORT_STYLE_PROMPT } from '../prompts';
import { DataReportStyleSchema } from '../schemas';
import type { DataReportSandpackGraphHandlers, DataReportSandpackGraphState } from '../../../types/data-report';
import { tryExecuteMock } from '../../../utils/mock';
import { generateDataReportNodeObject } from './planning-node-helpers';
import { shouldDeterministicMultiAssembly, traceNode, type NodePatch } from './shared';

export async function runStyleGenNode(
  state: DataReportSandpackGraphState,
  handlers: DataReportSandpackGraphHandlers = {}
): Promise<NodePatch> {
  if (handlers.styleGenNode) {
    return traceNode(state, 'styleGenNode', await handlers.styleGenNode(state));
  }

  const mocked = await tryExecuteMock(state, 'styleGenNode', 'data-report/style-gen-node.json', 'styles');
  if (mocked && typeof mocked === 'object' && 'styles' in mocked) {
    return traceNode(state, 'styleGenNode', mocked as NodePatch);
  }

  const structured = shouldDeterministicMultiAssembly(state)
    ? null
    : await generateDataReportNodeObject({
        state,
        node: 'styleGenNode',
        contractName: 'data-report.style',
        contractVersion: '1.0.0',
        schema: DataReportStyleSchema,
        systemPrompt: DATA_REPORT_STYLE_PROMPT,
        userContent: buildDataReportPlanningContext(state)
      });

  return traceNode(state, 'styleGenNode', {
    styles: structured ?? {
      target: 'tailwind-inline',
      theme: 'bonus-center'
    }
  });
}
