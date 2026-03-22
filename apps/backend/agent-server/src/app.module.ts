import { Module } from '@nestjs/common';

import { AppFeatureModule } from './app/app.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { ChatModule } from './chat/chat.module';
import { LearningModule } from './learning/learning.module';
import { LoggerModule } from './logger/logger.module';
import { MemoryModule } from './memory/memory.module';
import { RulesModule } from './rules/rules.module';
import { RuntimeModule } from './runtime/runtime.module';
import { SkillsModule } from './skills/skills.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    LoggerModule,
    RuntimeModule,
    AppFeatureModule,
    ChatModule,
    TasksModule,
    MemoryModule,
    RulesModule,
    SkillsModule,
    LearningModule,
    ApprovalsModule
  ]
})
export class AppModule {}
