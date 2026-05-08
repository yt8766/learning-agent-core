import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { PermissionGuard } from '../infrastructure/auth/guards/permission.guard';
import { RuntimeModule } from '../runtime/runtime.module';
import { RuntimeKnowledgeGovernanceService } from '../runtime/services/runtime-knowledge-governance.service';
import { ApprovalsCenterController } from './approvals-center.controller';
import { CompanyAgentsCenterController } from './company-agents-center.controller';
import { ConnectorsCenterController } from './connectors-center.controller';
import { EvalsCenterController } from './evals-center.controller';
import { EvidenceCenterController } from './evidence-center.controller';
import { LearningCenterController } from './learning-center.controller';
import { KnowledgeGovernanceController } from './knowledge-governance.controller';
import { KnowledgeIngestionController } from './knowledge-ingestion.controller';
import { PlatformBriefingsController } from './platform-briefings.controller';
import { PlatformConsoleController } from './platform-console.controller';
import { PlatformDiagnosticsController } from './platform-diagnostics.controller';
import { RuntimeCenterController } from './runtime-center.controller';
import { SkillSourcesCenterController } from './skill-sources-center.controller';
import { WorkspaceCenterController } from './workspace-center.controller';

@Module({
  imports: [RuntimeModule],
  controllers: [
    PlatformConsoleController,
    RuntimeCenterController,
    ApprovalsCenterController,
    KnowledgeIngestionController,
    KnowledgeGovernanceController,
    LearningCenterController,
    EvidenceCenterController,
    ConnectorsCenterController,
    SkillSourcesCenterController,
    CompanyAgentsCenterController,
    EvalsCenterController,
    PlatformBriefingsController,
    PlatformDiagnosticsController,
    WorkspaceCenterController
  ],
  providers: [
    RuntimeKnowledgeGovernanceService,
    {
      provide: APP_GUARD,
      useClass: PermissionGuard
    }
  ]
})
export class PlatformModule {}
