import { Module } from '@nestjs/common';

import { RuntimeModule } from '../runtime/runtime.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [RuntimeModule, KnowledgeModule],
  controllers: [AppController],
  providers: [AppService],
  exports: [AppService]
})
export class AppFeatureModule {}
