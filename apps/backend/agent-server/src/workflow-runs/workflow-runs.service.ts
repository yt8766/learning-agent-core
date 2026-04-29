import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WorkflowRun } from './entities/workflow-run.entity';

@Injectable()
export class WorkflowRunsService {
  constructor(
    @InjectRepository(WorkflowRun)
    private workflowRunRepository: Repository<WorkflowRun>
  ) {}

  async getWorkflowRuns(): Promise<WorkflowRun[]> {
    return this.workflowRunRepository.find();
  }
}
