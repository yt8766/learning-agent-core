import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentToolsModule } from './agent-tools/agent-tools.module';
import { AdminAuthModule } from './admin-auth/admin-auth.module';
import { createPersistenceImports } from './app.persistence';
import { AppFeatureModule } from './app/app.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { AutoReviewModule } from './auto-review/auto-review.module';
import { ChatModule } from './chat/chat.module';
import { CompanyLiveModule } from './company-live/company-live.module';
import { EvidenceModule } from './evidence/evidence.module';
import { LearningModule } from './learning/learning.module';
import { LoggerModule } from './logger/logger.module';
import { MemoryModule } from './memory/memory.module';
import { MessageGatewayModule } from './message-gateway/message-gateway.module';
import { PlatformModule } from './platform/platform.module';
import { RulesModule } from './rules/rules.module';
import { RuntimeModule } from './runtime/runtime.module';
import { SandboxModule } from './sandbox/sandbox.module';
import { SkillsModule } from './skills/skills.module';
import { TasksModule } from './tasks/tasks.module';
import { TemplatesModule } from './templates/templates.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env', 'apps/backend/agent-server/.env'],
      isGlobal: true
    }),
    LoggerModule,
    AdminAuthModule,
    RuntimeModule,
    AgentToolsModule,
    SandboxModule,
    AutoReviewModule,
    AppFeatureModule,
    ChatModule,
    MessageGatewayModule,
    TasksModule,
    EvidenceModule,
    MemoryModule,
    PlatformModule,
    RulesModule,
    SkillsModule,
    LearningModule,
    ApprovalsModule,
    TemplatesModule,
    CompanyLiveModule,
    ...createPersistenceImports()
  ]
})
export class AppModule {}
