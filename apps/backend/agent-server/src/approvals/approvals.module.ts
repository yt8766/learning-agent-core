import { Module } from '@nestjs/common';

import { RuntimeModule } from '../runtime/runtime.module';
import { ApprovalsController } from '../modules/approvals/controllers/approvals.controller';
import { ApprovalsService } from '../modules/approvals/services/approvals.service';

@Module({
  imports: [RuntimeModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService]
})
export class ApprovalsModule {}
