import { Module } from '@nestjs/common';

import { RuntimeCompanyLiveFacade } from '../runtime/core/runtime-company-live-facade';
import { CompanyLiveController } from './company-live.controller';
import { CompanyLiveService } from './company-live.service';

@Module({
  controllers: [CompanyLiveController],
  providers: [CompanyLiveService, RuntimeCompanyLiveFacade]
})
export class CompanyLiveModule {}
