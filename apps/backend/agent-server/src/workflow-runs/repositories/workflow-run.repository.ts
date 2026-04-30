// apps/backend/agent-server/src/workflow-runs/repositories/workflow-run.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { CompanyLiveNodeTrace } from '@agent/core';

import { WorkflowRun } from '../entities/workflow-run.entity';
import type { WorkflowRunStatus } from '../entities/workflow-run.entity';

export interface CreateRunInput {
  id: string;
  workflowId: string;
  inputData: Record<string, unknown>;
}

@Injectable()
export class WorkflowRunRepository {
  constructor(
    @InjectRepository(WorkflowRun)
    private readonly repo: Repository<WorkflowRun>
  ) {}

  async create(input: CreateRunInput): Promise<WorkflowRun> {
    const run = this.repo.create({
      id: input.id,
      workflowId: input.workflowId,
      status: 'running' as WorkflowRunStatus,
      startedAt: Date.now(),
      completedAt: null,
      inputData: input.inputData,
      traceData: null
    });
    return this.repo.save(run);
  }

  async complete(id: string, traceData: CompanyLiveNodeTrace[]): Promise<void> {
    await this.repo.update(id, {
      status: 'completed',
      completedAt: Date.now(),
      traceData
    });
  }

  async fail(id: string): Promise<void> {
    await this.repo.update(id, {
      status: 'failed',
      completedAt: Date.now()
    });
  }

  async findById(id: string): Promise<WorkflowRun | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByWorkflowId(workflowId: string, limit = 20): Promise<WorkflowRun[]> {
    return this.repo.find({
      where: { workflowId },
      order: { startedAt: 'DESC' },
      take: limit
    });
  }

  async findAll(limit = 50): Promise<WorkflowRun[]> {
    return this.repo.find({ order: { startedAt: 'DESC' }, take: limit });
  }
}
