import { Injectable } from '@nestjs/common';

import { RuntimeService } from '../runtime/runtime.service';

@Injectable()
export class EvidenceService {
  constructor(private readonly runtimeService: RuntimeService) {}

  getCenter() {
    return this.runtimeService.getEvidenceCenter();
  }
}
