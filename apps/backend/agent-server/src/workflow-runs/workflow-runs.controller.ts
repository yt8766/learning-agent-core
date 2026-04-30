// apps/backend/agent-server/src/workflow-runs/workflow-runs.controller.ts
import { Body, Controller, Get, NotFoundException, Param, Post, Query, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';

import { StartWorkflowRunDto } from './workflow-runs.dto';
import { WorkflowRunService } from './workflow-runs.service';

@Controller('workflow-runs')
export class WorkflowRunsController {
  constructor(private readonly service: WorkflowRunService) {}

  @Post()
  async startRun(@Body() dto: StartWorkflowRunDto): Promise<{ runId: string }> {
    const runId = await this.service.startRun(dto.workflowId, dto.input);
    return { runId };
  }

  @Get()
  async listRuns(@Query('workflowId') workflowId?: string) {
    return this.service.listRuns(workflowId);
  }

  @Get(':id')
  async getRun(@Param('id') id: string) {
    const run = await this.service.getRun(id);
    if (!run) throw new NotFoundException(`Run ${id} not found`);
    return run;
  }

  @Sse(':id/stream')
  streamRun(@Param('id') id: string): Observable<{ data: string; type: string }> {
    return this.service.streamRun(id);
  }
}
