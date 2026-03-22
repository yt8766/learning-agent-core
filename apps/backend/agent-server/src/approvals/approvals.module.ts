import { Module } from '@nestjs/common';

import { RuntimeModule } from '../runtime/runtime.module';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';

@Module({
  imports: [RuntimeModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService]
})
export class ApprovalsModule {}
