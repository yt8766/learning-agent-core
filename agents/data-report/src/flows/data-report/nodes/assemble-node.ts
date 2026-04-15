import type { DataReportSandpackGraphHandlers, DataReportSandpackGraphState } from '../../../types/data-report';
import { dataReportSandpackAgent } from '../sandpack-agent';
import { traceNode, type NodePatch } from './shared';

export async function runAssembleNode(
  state: DataReportSandpackGraphState,
  handlers: DataReportSandpackGraphHandlers = {}
): Promise<NodePatch> {
  if (handlers.assembleNode) {
    return traceNode(state, 'assembleNode', await handlers.assembleNode(state));
  }

  const payload =
    state.payload ??
    (state.files
      ? {
          status: 'success' as const,
          files: state.files
        }
      : state.rawContent
        ? dataReportSandpackAgent.parsePayload(state.rawContent)
        : undefined);
  if (!payload) {
    throw new Error('Data report sandpack graph cannot assemble before appGenNode produces a payload.');
  }

  dataReportSandpackAgent.validateFiles(payload.files);

  return traceNode(state, 'assembleNode', {
    rawContent: JSON.stringify(payload),
    payload,
    files: payload.files,
    assemble: {
      fileCount: Object.keys(payload.files).length,
      routeName: state.intent?.routeName
    }
  });
}
