import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { ToolExecutionRequest } from '@agent/core';

import { toWorkspacePath } from '../sandbox/sandbox-executor-utils';

export async function executeRuntimeGovernanceTool(request: ToolExecutionRequest) {
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
      const path = toWorkspacePath(`data/runtime/archives/${sessionId}.json`);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, `${JSON.stringify(archive, null, 2)}\n`);
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
      const path = toWorkspacePath(`data/runtime/cancellations/${runId}.json`);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, `${JSON.stringify(cancel, null, 2)}\n`);
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
      const path = toWorkspacePath(`data/runtime/recoveries/${runId}.json`);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, `${JSON.stringify(recovery, null, 2)}\n`);
      return {
        outputSummary: `Recorded recovery request for run ${runId}`,
        rawOutput: recovery
      };
    }
    case 'list_runtime_artifacts': {
      const kind = String(request.input.kind ?? 'all');
      const schedules = kind === 'all' || kind === 'schedules' ? await listArtifacts('data/runtime/schedules') : [];
      const archives = kind === 'all' || kind === 'archives' ? await listArtifacts('data/runtime/archives') : [];
      const recoveries = kind === 'all' || kind === 'recoveries' ? await listArtifacts('data/runtime/recoveries') : [];
      const cancellations =
        kind === 'all' || kind === 'cancellations' ? await listArtifacts('data/runtime/cancellations') : [];
      const browserReplays =
        kind === 'all' || kind === 'browser-replays' ? await listArtifacts('data/browser-replays', true) : [];
      return {
        outputSummary: `Listed runtime artifacts for ${kind}`,
        rawOutput: {
          kind,
          schedules,
          archives,
          recoveries,
          cancellations,
          browserReplays
        }
      };
    }
    default:
      return undefined;
  }
}

async function listArtifacts(relativeDir: string, directoriesOnly = false) {
  const dir = toWorkspacePath(relativeDir);
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  if (directoriesOnly) {
    return entries.filter(entry => entry.isDirectory()).map(entry => ({ name: entry.name, type: 'directory' }));
  }
  const items = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }
    const filePath = toWorkspacePath(`${relativeDir}/${entry.name}`);
    items.push(JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>);
  }
  return items;
}
