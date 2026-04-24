import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Bree publishes a CommonJS constructor export; require-style import keeps Nest CJS runtime compatible.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import Bree = require('bree');

export const INTEL_JOB_DEFINITIONS = [
  { name: 'intel-patrol', cron: '*/30 * * * *' },
  { name: 'intel-ingest', cron: '0 */3 * * *' },
  { name: 'intel-digest', cron: '0 21 * * *' },
  { name: 'intel-delivery-retry', cron: '*/15 * * * *' }
] as const;

export type IntelJobName = (typeof INTEL_JOB_DEFINITIONS)[number]['name'];

export interface CreateIntelSchedulerInput {
  workspaceRoot: string;
}

function resolveIntelWorkerPath(workspaceRoot: string) {
  const candidates = [
    join(workspaceRoot, 'apps/backend/agent-server/workers/intel-worker.mjs'),
    join(workspaceRoot, 'apps/backend/agent-server/workers/intel-worker.js'),
    resolve(__dirname, '../../../workers/intel-worker.mjs'),
    resolve(__dirname, '../../../workers/intel-worker.js')
  ];

  return candidates.find(candidate => existsSync(candidate)) ?? candidates[0]!;
}

export function createIntelScheduler(input: CreateIntelSchedulerInput): Bree {
  const workerPath = resolveIntelWorkerPath(input.workspaceRoot);

  return new Bree({
    root: false,
    logger: false,
    jobs: INTEL_JOB_DEFINITIONS.map(job => ({
      name: job.name,
      cron: job.cron,
      path: workerPath,
      timeout: false,
      worker: {
        workerData: {
          jobName: job.name,
          workspaceRoot: input.workspaceRoot
        }
      }
    }))
  });
}
