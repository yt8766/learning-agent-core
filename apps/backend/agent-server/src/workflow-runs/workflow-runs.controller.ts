import { Controller, Get } from '@nestjs/common';

import { WorkflowRunsService } from './workflow-runs.service';

@Controller('workflow-runs')
export class WorkflowRunsController {
  constructor(private workflowRunsService: WorkflowRunsService) {}

  @Get()
  async getWorkflowRuns() {
    return this.workflowRunsService.getWorkflowRuns();
  }
}
