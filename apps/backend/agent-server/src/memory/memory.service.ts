import { Injectable } from '@nestjs/common';

import { InvalidateKnowledgeDto, RetireKnowledgeDto, SearchMemoryDto, SupersedeKnowledgeDto } from '@agent/shared';

import { RuntimeService } from '../runtime/runtime.service';

@Injectable()
export class MemoryService {
  constructor(private readonly runtimeService: RuntimeService) {}

  search(dto: SearchMemoryDto) {
    return this.runtimeService.searchMemory(dto);
  }

  getById(id: string) {
    return this.runtimeService.getMemory(id);
  }

  invalidate(id: string, dto: InvalidateKnowledgeDto) {
    return this.runtimeService.invalidateMemory(id, dto);
  }

  supersede(id: string, dto: SupersedeKnowledgeDto) {
    return this.runtimeService.supersedeMemory(id, dto);
  }

  restore(id: string) {
    return this.runtimeService.restoreMemory(id);
  }

  retire(id: string, dto: RetireKnowledgeDto) {
    return this.runtimeService.retireMemory(id, dto);
  }
}
