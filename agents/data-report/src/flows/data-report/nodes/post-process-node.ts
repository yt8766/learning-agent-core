import { postProcessDataReportSandpackFiles } from '@agent/report-kit';

import type { DataReportSandpackGraphHandlers, DataReportSandpackGraphState } from '../../../types/data-report';
import { fromToolFiles, toToolFiles, traceNode, type NodePatch } from './shared';

export async function runPostProcessNode(
  state: DataReportSandpackGraphState,
  handlers: DataReportSandpackGraphHandlers = {}
): Promise<NodePatch> {
  if (handlers.postProcessNode) {
    return traceNode(state, 'postProcessNode', await handlers.postProcessNode(state));
  }

  const files = state.files ?? state.payload?.files;
  if (!files) {
    throw new Error('Data report sandpack graph cannot post-process before files are assembled.');
  }

  const postProcessed = postProcessDataReportSandpackFiles(toToolFiles(files));
  const normalizedFiles = fromToolFiles(postProcessed.files);
  return traceNode(state, 'postProcessNode', {
    files: normalizedFiles,
    payload: {
      status: 'success',
      files: normalizedFiles
    },
    postProcessSummary: { ...postProcessed.summary }
  });
}
