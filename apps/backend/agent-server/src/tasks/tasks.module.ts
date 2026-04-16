import { Module } from '@nestjs/common';

import { RuntimeModule } from '../runtime/runtime.module';
import { TasksController } from '../modules/tasks/controllers/tasks.controller';
import { TasksService } from '../modules/tasks/services/tasks.service';

@Module({
  imports: [RuntimeModule],
  controllers: [TasksController],
  providers: [TasksService]
})
export class TasksModule {}
