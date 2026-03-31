import { Injectable } from '@nestjs/common';

import { InvalidateKnowledgeDto, RetireKnowledgeDto, SearchMemoryDto, SupersedeKnowledgeDto } from '@agent/shared';

import { RuntimeKnowledgeService } from '../runtime/services/runtime-knowledge.service';

@Injectable()
export class MemoryService {
  constructor(private readonly runtimeKnowledgeService: RuntimeKnowledgeService) {}

  search(dto: SearchMemoryDto) {
    return this.runtimeKnowledgeService.searchMemory(dto);
  }

  getById(id: string) {
    return this.runtimeKnowledgeService.getMemory(id);
  }

  invalidate(id: string, dto: InvalidateKnowledgeDto) {
    return this.runtimeKnowledgeService.invalidateMemory(id, dto);
  }

  supersede(id: string, dto: SupersedeKnowledgeDto) {
    return this.runtimeKnowledgeService.supersedeMemory(id, dto);
  }

  restore(id: string) {
    return this.runtimeKnowledgeService.restoreMemory(id);
  }

  retire(id: string, dto: RetireKnowledgeDto) {
    return this.runtimeKnowledgeService.retireMemory(id, dto);
  }
}
