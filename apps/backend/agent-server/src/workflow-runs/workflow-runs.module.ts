import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RuntimeCompanyLiveFacade } from '../runtime/core/runtime-company-live-facade';
import { RuntimeWorkflowExecutionFacade } from '../runtime/core/runtime-workflow-execution-facade';
import { WorkflowRun } from './entities/workflow-run.entity';
import { WorkflowRunsController } from './workflow-runs.controller';
import { WorkflowRunService } from './workflow-runs.service';
import { WorkflowRunRepository } from './repositories/workflow-run.repository';
import { WorkflowDispatcher } from './workflow-dispatcher';

@Module({
  imports: [TypeOrmModule.forFeature([WorkflowRun])],
  controllers: [WorkflowRunsController],
  providers: [
    WorkflowRunService,
    WorkflowRunRepository,
    WorkflowDispatcher,
    RuntimeCompanyLiveFacade,
    RuntimeWorkflowExecutionFacade
  ],
  exports: [WorkflowRunService]
})
export class WorkflowRunsModule {}
