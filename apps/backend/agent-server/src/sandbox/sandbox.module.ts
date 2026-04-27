import { Module } from '@nestjs/common';

import { SandboxController } from './sandbox.controller';
import { SandboxRepository } from './sandbox.repository';
import { SandboxService } from './sandbox.service';

@Module({
  controllers: [SandboxController],
  providers: [SandboxRepository, SandboxService],
  exports: [SandboxService]
})
export class SandboxModule {}
