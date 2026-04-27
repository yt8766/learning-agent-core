import { Module } from '@nestjs/common';

import { AutoReviewModule } from '../auto-review/auto-review.module';
import { SandboxModule } from '../sandbox/sandbox.module';
import { AgentToolsController } from './agent-tools.controller';
import { AgentToolsRepository } from './agent-tools.repository';
import { AgentToolsService } from './agent-tools.service';

@Module({
  imports: [SandboxModule, AutoReviewModule],
  controllers: [AgentToolsController],
  providers: [AgentToolsRepository, AgentToolsService],
  exports: [AgentToolsService]
})
export class AgentToolsModule {}
