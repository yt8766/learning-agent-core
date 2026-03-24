import { Controller, Get } from '@nestjs/common';

import { EvidenceService } from './evidence.service';

@Controller('evidence')
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Get('center')
  getCenter() {
    return this.evidenceService.getCenter();
  }
}
