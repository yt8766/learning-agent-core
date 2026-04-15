import { Module } from '@nestjs/common';

import { AppFeatureModule } from './app/app.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { ChatModule } from './chat/chat.module';
import { EvidenceModule } from './evidence/evidence.module';
import { LearningModule } from './learning/learning.module';
import { LoggerModule } from './logger/logger.module';
import { MemoryModule } from './memory/memory.module';
import { MessageGatewayModule } from './message-gateway/message-gateway.module';
import { PlatformModule } from './platform/platform.module';
import { RulesModule } from './rules/rules.module';
import { RuntimeModule } from './runtime/runtime.module';
import { SkillsModule } from './skills/skills.module';
import { TasksModule } from './tasks/tasks.module';
import { TemplatesModule } from './templates/templates.module';

@Module({
  imports: [
    LoggerModule,
    RuntimeModule,
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
    TemplatesModule
  ]
})
export class AppModule {}
