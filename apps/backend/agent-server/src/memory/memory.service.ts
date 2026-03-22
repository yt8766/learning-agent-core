import { Injectable } from '@nestjs/common';

import { SearchMemoryDto } from '@agent/shared';

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
}
