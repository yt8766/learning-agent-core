import { readdir } from 'node:fs/promises';

import type { ToolExecutionRequest } from '@agent/runtime';

import { toWorkspacePath } from '@agent/runtime';
import type { RuntimeGovernanceRepository } from '../../runtime-governance/runtime-governance-repository';
import { getDefaultRuntimeGovernanceRepository } from '../../runtime-governance/runtime-governance-repository';

export type RuntimeGovernanceExecutorOptions = {
  repository?: RuntimeGovernanceRepository;
};

export async function executeRuntimeGovernanceTool(
  request: ToolExecutionRequest,
  options: RuntimeGovernanceExecutorOptions = {}
) {
  const repository = options.repository ?? getDefaultRuntimeGovernanceRepository();
  switch (request.toolName) {
    case 'archive_thread': {
      const sessionId = String(request.input.sessionId ?? '').trim();
      if (!sessionId) {
        throw new Error('archive_thread requires sessionId.');
      }
      const archive = {
        sessionId,
        reason: typeof request.input.reason === 'string' ? request.input.reason : '',
        archivedAt: new Date().toISOString()
      };
      await repository.archiveThread(archive);
      return {
        outputSummary: `Archived thread ${sessionId}`,
        rawOutput: archive
      };
    }
    case 'schedule_cancel': {
      const runId = String(request.input.runId ?? '').trim();
      if (!runId) {
        throw new Error('schedule_cancel requires runId.');
      }
      const cancel = {
        runId,
        reason: typeof request.input.reason === 'string' ? request.input.reason : '',
        cancelledAt: new Date().toISOString()
      };
      await repository.recordCancellation(cancel);
      return {
        outputSummary: `Recorded cancellation for run ${runId}`,
        rawOutput: cancel
      };
    }
    case 'recover_run': {
      const runId = String(request.input.runId ?? '').trim();
      if (!runId) {
        throw new Error('recover_run requires runId.');
      }
      const recovery = {
        runId,
        checkpointId: typeof request.input.checkpointId === 'string' ? request.input.checkpointId : undefined,
        recoveredAt: new Date().toISOString()
      };
      await repository.recordRecovery(recovery);
      return {
        outputSummary: `Recorded recovery request for run ${runId}`,
        rawOutput: recovery
      };
    }
    case 'list_runtime_artifacts': {
      const kind = String(request.input.kind ?? 'all');
      const artifacts = await repository.listRuntimeArtifacts(kind);
      const browserReplays =
        kind === 'all' || kind === 'browser-replays' ? await listBrowserReplayArtifacts('data/browser-replays') : [];
      return {
        outputSummary: `Listed runtime artifacts for ${kind}`,
        rawOutput: {
          ...artifacts,
          browserReplays
        }
      };
    }
    default:
      return undefined;
  }
}

async function listBrowserReplayArtifacts(relativeDir: string) {
  const dir = toWorkspacePath(relativeDir);
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries.filter(entry => entry.isDirectory()).map(entry => ({ name: entry.name, type: 'directory' }));
}
