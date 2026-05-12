import { Module } from '@nestjs/common';
import { RuntimeQuotaService } from './accounting/runtime-quota.service';
import { RuntimeUsageQueueService } from './accounting/runtime-usage-queue.service';
import { DeterministicOpenAICompatibleExecutor, GATEWAY_RUNTIME_EXECUTORS } from './executors';
import { RuntimeEngineFacade } from './runtime-engine.facade';

@Module({
  providers: [
    RuntimeEngineFacade,
    RuntimeQuotaService,
    RuntimeUsageQueueService,
    {
      provide: GATEWAY_RUNTIME_EXECUTORS,
      useFactory: () => [new DeterministicOpenAICompatibleExecutor()]
    }
  ],
  exports: [RuntimeEngineFacade, RuntimeQuotaService, RuntimeUsageQueueService]
})
export class RuntimeEngineModule {}
