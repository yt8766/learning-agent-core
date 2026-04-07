import { Module } from '@nestjs/common';

import { RuntimeModule } from '../runtime/runtime.module';
import { MemoryController } from './memory.controller';
import { MemoryCrossCheckService } from './memory-cross-check.service';
import { MemoryScrubberRunnerService } from './memory-scrubber-runner.service';
import { MemoryService } from './memory.service';

@Module({
  imports: [RuntimeModule],
  controllers: [MemoryController],
  providers: [MemoryService, MemoryCrossCheckService, MemoryScrubberRunnerService]
})
export class MemoryModule {}
