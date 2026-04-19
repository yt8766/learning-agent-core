import { Module } from '@nestjs/common';

import { RuntimeModule } from '../runtime/runtime.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [RuntimeModule],
  controllers: [TasksController],
  providers: [TasksService]
})
export class TasksModule {}
