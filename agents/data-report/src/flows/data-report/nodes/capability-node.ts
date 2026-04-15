import type { DataReportSandpackGraphHandlers, DataReportSandpackGraphState } from '../../../types/data-report';
import { tryExecuteMock } from '../../../utils/mock';
import { traceNode, type NodePatch } from './shared';

export async function runCapabilityNode(
  state: DataReportSandpackGraphState,
  handlers: DataReportSandpackGraphHandlers = {}
): Promise<NodePatch> {
  if (handlers.capabilityNode) {
    return traceNode(state, 'capabilityNode', await handlers.capabilityNode(state));
  }

  const mocked = await tryExecuteMock(state, 'capabilityNode', 'data-report/capability-node.json', 'capabilities');
  if (mocked && typeof mocked === 'object' && 'capabilities' in mocked) {
    return traceNode(state, 'capabilityNode', mocked as NodePatch);
  }

  return traceNode(state, 'capabilityNode', {
    capabilities: {
      llmGeneration: true,
      sandpackAssembly: true,
      astPostProcess: true,
      deterministicPlanning: true
    }
  });
}
