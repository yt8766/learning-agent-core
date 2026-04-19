import { Controller, Get, Param, Post } from '@nestjs/common';

import { RuntimeCentersService } from '../runtime/centers/runtime-centers.service';

@Controller('platform')
export class CompanyAgentsCenterController {
  constructor(private readonly runtimeCentersService: RuntimeCentersService) {}

  @Get('company-agents-center')
  getCompanyAgentsCenter() {
    return this.runtimeCentersService.getCompanyAgentsCenter();
  }

  @Post('company-agents-center/:workerId/enable')
  enableCompanyAgent(@Param('workerId') workerId: string) {
    return this.runtimeCentersService.setCompanyAgentEnabled(workerId, true);
  }

  @Post('company-agents-center/:workerId/disable')
  disableCompanyAgent(@Param('workerId') workerId: string) {
    return this.runtimeCentersService.setCompanyAgentEnabled(workerId, false);
  }
}
