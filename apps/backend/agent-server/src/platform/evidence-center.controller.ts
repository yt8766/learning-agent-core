import { Controller, Get, Param } from '@nestjs/common';

import { RuntimeCentersService } from '../runtime/centers/runtime-centers.service';

@Controller('platform')
export class EvidenceCenterController {
  constructor(private readonly runtimeCentersService: RuntimeCentersService) {}

  @Get('evidence-center')
  getEvidenceCenter() {
    return this.runtimeCentersService.getEvidenceCenter();
  }

  @Get('browser-replays/:sessionId')
  getBrowserReplay(@Param('sessionId') sessionId: string) {
    return this.runtimeCentersService.getBrowserReplay(sessionId);
  }
}
