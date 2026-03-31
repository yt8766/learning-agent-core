import { Injectable } from '@nestjs/common';

import { InvalidateKnowledgeDto, RetireKnowledgeDto, SupersedeKnowledgeDto } from '@agent/shared';

import { RuntimeKnowledgeService } from '../runtime/services/runtime-knowledge.service';

@Injectable()
export class RulesService {
  constructor(private readonly runtimeKnowledgeService: RuntimeKnowledgeService) {}

  list() {
    return this.runtimeKnowledgeService.listRules();
  }

  invalidate(id: string, dto: InvalidateKnowledgeDto) {
    return this.runtimeKnowledgeService.invalidateRule(id, dto);
  }

  supersede(id: string, dto: SupersedeKnowledgeDto) {
    return this.runtimeKnowledgeService.supersedeRule(id, dto);
  }

  restore(id: string) {
    return this.runtimeKnowledgeService.restoreRule(id);
  }

  retire(id: string, dto: RetireKnowledgeDto) {
    return this.runtimeKnowledgeService.retireRule(id, dto);
  }
}
