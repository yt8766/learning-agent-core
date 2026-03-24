import { Injectable } from '@nestjs/common';

import { InvalidateKnowledgeDto, RetireKnowledgeDto, SupersedeKnowledgeDto } from '@agent/shared';

import { RuntimeService } from '../runtime/runtime.service';

@Injectable()
export class RulesService {
  constructor(private readonly runtimeService: RuntimeService) {}

  list() {
    return this.runtimeService.listRules();
  }

  invalidate(id: string, dto: InvalidateKnowledgeDto) {
    return this.runtimeService.invalidateRule(id, dto);
  }

  supersede(id: string, dto: SupersedeKnowledgeDto) {
    return this.runtimeService.supersedeRule(id, dto);
  }

  restore(id: string) {
    return this.runtimeService.restoreRule(id);
  }

  retire(id: string, dto: RetireKnowledgeDto) {
    return this.runtimeService.retireRule(id, dto);
  }
}
