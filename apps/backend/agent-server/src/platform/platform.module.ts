import { Module } from '@nestjs/common';

import { RuntimeModule } from '../runtime/runtime.module';
import { ApprovalsCenterController } from './approvals-center.controller';
import { CompanyAgentsCenterController } from './company-agents-center.controller';
import { ConnectorsCenterController } from './connectors-center.controller';
import { EvalsCenterController } from './evals-center.controller';
import { EvidenceCenterController } from './evidence-center.controller';
import { LearningCenterController } from './learning-center.controller';
import { PlatformBriefingsController } from './platform-briefings.controller';
import { PlatformConsoleController } from './platform-console.controller';
import { PlatformDiagnosticsController } from './platform-diagnostics.controller';
import { RuntimeCenterController } from './runtime-center.controller';
import { SkillSourcesCenterController } from './skill-sources-center.controller';

@Module({
  imports: [RuntimeModule],
  controllers: [
    PlatformConsoleController,
    RuntimeCenterController,
    ApprovalsCenterController,
    LearningCenterController,
    EvidenceCenterController,
    ConnectorsCenterController,
    SkillSourcesCenterController,
    CompanyAgentsCenterController,
    EvalsCenterController,
    PlatformBriefingsController,
    PlatformDiagnosticsController
  ]
})
export class PlatformModule {}
