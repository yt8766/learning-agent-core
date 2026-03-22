import { Module } from '@nestjs/common';

import { RuntimeModule } from '../runtime/runtime.module';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';

@Module({
  imports: [RuntimeModule],
  controllers: [MemoryController],
  providers: [MemoryService]
})
export class MemoryModule {}
