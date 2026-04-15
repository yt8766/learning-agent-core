import type { DataReportSandpackGraphHandlers, DataReportSandpackGraphState } from '../../../types/data-report';
import { tryExecuteMock } from '../../../utils/mock';
import { traceNode, type NodePatch } from './shared';

export async function runLayoutNode(
  state: DataReportSandpackGraphState,
  handlers: DataReportSandpackGraphHandlers = {}
): Promise<NodePatch> {
  if (handlers.layoutNode) {
    return traceNode(state, 'layoutNode', await handlers.layoutNode(state));
  }

  const mocked = await tryExecuteMock(state, 'layoutNode', 'data-report/layout-node.json', 'layouts');
  if (mocked && typeof mocked === 'object' && 'layouts' in mocked) {
    return traceNode(state, 'layoutNode', mocked as NodePatch);
  }

  return traceNode(state, 'layoutNode', {
    layouts: {
      root: '/App.tsx',
      routeFile: '/routes.ts'
    }
  });
}
