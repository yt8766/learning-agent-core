import { Injectable } from '@nestjs/common';

import { RuntimeCentersService } from '../runtime/centers/runtime-centers.service';

@Injectable()
export class EvidenceService {
  constructor(private readonly runtimeCentersService: RuntimeCentersService) {}

  getCenter() {
    return this.runtimeCentersService.getEvidenceCenter();
  }
}
