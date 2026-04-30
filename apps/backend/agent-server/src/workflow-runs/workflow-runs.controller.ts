import { Controller, Get } from '@nestjs/common';

import { WorkflowRunService } from './workflow-runs.service';

@Controller('workflow-runs')
export class WorkflowRunsController {
  constructor(private workflowRunService: WorkflowRunService) {}

  @Get()
  async getWorkflowRuns() {
    return this.workflowRunService.listRuns();
  }
}
