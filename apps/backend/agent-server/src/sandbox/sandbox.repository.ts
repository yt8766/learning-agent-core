import { Injectable } from '@nestjs/common';
import { z } from 'zod/v4';

import type { SandboxRunRecord } from './sandbox.types';

export interface SandboxRepositorySnapshot {
  runs: SandboxRunRecord[];
}

@Injectable()
export class SandboxRepository {
  private readonly runs = new Map<string, SandboxRunRecord>();

  saveRun(run: SandboxRunRecord): SandboxRunRecord {
    const parsed = cloneRun(run);
    this.runs.set(parsed.runId, parsed);
    return cloneRun(parsed);
  }

  getRun(runId: string): SandboxRunRecord | undefined {
    const run = this.runs.get(runId);
    return run ? cloneRun(run) : undefined;
  }

  listRuns(): SandboxRunRecord[] {
    return [...this.runs.values()].map(cloneRun);
  }

  exportSnapshot(): SandboxRepositorySnapshot {
    return { runs: this.listRuns() };
  }

  restoreSnapshot(snapshot: SandboxRepositorySnapshot): void {
    const parsed = SandboxRepositorySnapshotSchema.parse(snapshot);
    this.runs.clear();
    for (const run of parsed.runs) {
      this.saveRun(run);
    }
  }
}

function cloneRun(run: SandboxRunRecord): SandboxRunRecord {
  return SandboxRunRecordSchema.parse(structuredClone(run));
}

const SandboxRunRecordSchema = z
  .object({
    runId: z.string().min(1),
    requestId: z.string().min(1).optional(),
    taskId: z.string().min(1),
    sessionId: z.string().min(1).optional(),
    profile: z.string().min(1),
    stage: z.enum(['preflight', 'prepare', 'execute', 'execution', 'verify', 'cleanup']),
    status: z.enum(['pending', 'running', 'passed', 'failed', 'blocked', 'cancelled', 'exhausted']),
    attempt: z.number().int(),
    maxAttempts: z.number().int(),
    verdict: z.enum(['allow', 'warn', 'block', 'unknown']).optional(),
    exhaustedReason: z.string().min(1).optional(),
    outputPreview: z.string().optional(),
    evidenceIds: z.array(z.string().min(1)).optional(),
    artifactIds: z.array(z.string().min(1)).optional(),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
    metadata: z.record(z.string(), z.unknown())
  })
  .strict();

const SandboxRepositorySnapshotSchema = z
  .object({
    runs: z.array(SandboxRunRecordSchema)
  })
  .strict();
