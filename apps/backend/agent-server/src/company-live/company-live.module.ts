import { Module } from '@nestjs/common';

import { RuntimeCompanyLiveFacade } from '../runtime/core/runtime-company-live-facade';
import { RuntimeModule } from '../runtime/runtime.module';
import { CompanyLiveController } from './company-live.controller';
import { CompanyLiveService } from './company-live.service';

@Module({
  imports: [RuntimeModule],
  controllers: [CompanyLiveController],
  providers: [CompanyLiveService, RuntimeCompanyLiveFacade]
})
export class CompanyLiveModule {}
