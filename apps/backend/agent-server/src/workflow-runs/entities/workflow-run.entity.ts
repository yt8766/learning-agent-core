import { Column, Entity, PrimaryColumn } from 'typeorm';

import type { CompanyLiveNodeTrace } from '@agent/core';

export type WorkflowRunStatus = 'pending' | 'running' | 'completed' | 'failed';

@Entity('workflow_runs')
export class WorkflowRun {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @Column({ type: 'varchar', length: 128 })
  workflowId: string;

  @Column({ type: 'varchar', length: 32 })
  status: WorkflowRunStatus;

  @Column({ type: 'bigint' })
  startedAt: number;

  @Column({ type: 'bigint', nullable: true })
  completedAt: number | null;

  @Column({ type: 'jsonb', nullable: true })
  inputData: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  traceData: CompanyLiveNodeTrace[] | null;
}
