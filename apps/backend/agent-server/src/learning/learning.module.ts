import { Module } from '@nestjs/common';

import { RuntimeModule } from '../runtime/runtime.module';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';

@Module({
  imports: [RuntimeModule],
  controllers: [LearningController],
  providers: [LearningService]
})
export class LearningModule {}
