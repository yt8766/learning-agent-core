import { Injectable } from '@nestjs/common';

import { RuntimeService } from '../runtime/runtime.service';

@Injectable()
export class RulesService {
  constructor(private readonly runtimeService: RuntimeService) {}

  list() {
    return this.runtimeService.listRules();
  }
}
