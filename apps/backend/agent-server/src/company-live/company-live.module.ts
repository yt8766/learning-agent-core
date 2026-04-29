import { Module } from '@nestjs/common';

import { CompanyLiveController } from './company-live.controller';
import { CompanyLiveService } from './company-live.service';

@Module({
  controllers: [CompanyLiveController],
  providers: [CompanyLiveService]
})
export class CompanyLiveModule {}
