import { Module } from '@nestjs/common';

import { RuntimeModule } from '../runtime/runtime.module';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';

@Module({
  imports: [RuntimeModule],
  controllers: [SkillsController],
  providers: [SkillsService]
})
export class SkillsModule {}
