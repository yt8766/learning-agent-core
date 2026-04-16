import { Module } from '@nestjs/common';

import { RuntimeModule } from '../runtime/runtime.module';
import { LearningController } from '../modules/learning/controllers/learning.controller';
import { LearningService } from '../modules/learning/services/learning.service';

@Module({
  imports: [RuntimeModule],
  controllers: [LearningController],
  providers: [LearningService]
})
export class LearningModule {}
