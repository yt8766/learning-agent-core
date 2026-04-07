import { NotFoundException } from '@nestjs/common';
import { MemoryScrubberService, type MemoryScrubberValidator } from '@agent/memory';

import {
  EvidenceRecord,
  InvalidateKnowledgeDto,
  MemoryRecord,
  RetireKnowledgeDto,
  SearchMemoryDto,
  SupersedeKnowledgeDto
} from '@agent/shared';
import { RuntimeWenyuanFacade } from '../wenyuan/runtime-wenyuan-facade';

export interface RuntimeKnowledgeContext {
  wenyuanFacade: RuntimeWenyuanFacade;
  ruleRepository: any;
  orchestrator: any;
  runtimeStateRepository: any;
}

export class RuntimeKnowledgeService {
  constructor(private readonly getContext: () => RuntimeKnowledgeContext) {}

  searchMemory(dto: SearchMemoryDto): Promise<MemoryRecord[]> {
    return this.ctx().wenyuanFacade.searchMemory(dto.query, dto.limit ?? 10);
  }

  async getMemory(memoryId: string): Promise<MemoryRecord> {
    const memory = await this.ctx().wenyuanFacade.getMemory(memoryId);
    if (!memory) {
      throw new NotFoundException(`Memory ${memoryId} not found`);
    }
    return memory;
  }

  async invalidateMemory(memoryId: string, dto: InvalidateKnowledgeDto): Promise<MemoryRecord> {
    const memory = await this.ctx().wenyuanFacade.invalidateMemory(memoryId, dto.reason);
    if (!memory) {
      throw new NotFoundException(`Memory ${memoryId} not found`);
    }
    return memory;
  }

  async supersedeMemory(memoryId: string, dto: SupersedeKnowledgeDto): Promise<MemoryRecord> {
    const memory = await this.ctx().wenyuanFacade.supersedeMemory(memoryId, dto.replacementId, dto.reason);
    if (!memory) {
      throw new NotFoundException(`Memory ${memoryId} not found`);
    }
    return memory;
  }

  async restoreMemory(memoryId: string): Promise<MemoryRecord> {
    const memory = await this.ctx().wenyuanFacade.restoreMemory(memoryId);
    if (!memory) {
      throw new NotFoundException(`Memory ${memoryId} not found`);
    }
    return memory;
  }

  async retireMemory(memoryId: string, dto: RetireKnowledgeDto): Promise<MemoryRecord> {
    const memory = await this.ctx().wenyuanFacade.retireMemory(memoryId, dto.reason);
    if (!memory) {
      throw new NotFoundException(`Memory ${memoryId} not found`);
    }
    return memory;
  }

  listMemories(): Promise<MemoryRecord[]> {
    return this.ctx().wenyuanFacade.listMemories();
  }

  async quarantineMemory(memoryId: string, reason: string, evidenceRefs?: string[]): Promise<MemoryRecord> {
    const memory = await this.ctx().wenyuanFacade.quarantineMemory(memoryId, reason, evidenceRefs);
    if (!memory) {
      throw new NotFoundException(`Memory ${memoryId} not found`);
    }
    return memory;
  }

  createMemoryScrubber(validator: MemoryScrubberValidator) {
    return new MemoryScrubberService(this.ctx().wenyuanFacade.getMemoryRepository() as any, validator);
  }

  async recordCrossCheckEvidence(memoryId: string, records: EvidenceRecord[]) {
    if (!records.length) {
      return [];
    }

    const snapshot = await this.ctx().runtimeStateRepository.load();
    const current = snapshot.crossCheckEvidence ?? [];
    const next = [...current];

    for (const record of records) {
      const index = next.findIndex(item => item.record.id === record.id);
      const entry = { memoryId, record };
      if (index >= 0) {
        next[index] = entry;
      } else {
        next.push(entry);
      }
    }

    snapshot.crossCheckEvidence = next.slice(-200);
    await this.ctx().runtimeStateRepository.save(snapshot);
    return records;
  }

  async listCrossCheckEvidence(memoryId?: string) {
    return this.ctx().wenyuanFacade.listCrossCheckEvidence(memoryId);
  }

  listRules() {
    return this.ctx().orchestrator.listRules();
  }

  async invalidateRule(ruleId: string, dto: InvalidateKnowledgeDto) {
    const rule = await this.ctx().ruleRepository.invalidate(ruleId, dto.reason);
    if (!rule) {
      throw new NotFoundException(`Rule ${ruleId} not found`);
    }
    return rule;
  }

  async supersedeRule(ruleId: string, dto: SupersedeKnowledgeDto) {
    const rule = await this.ctx().ruleRepository.supersede(ruleId, dto.replacementId, dto.reason);
    if (!rule) {
      throw new NotFoundException(`Rule ${ruleId} not found`);
    }
    return rule;
  }

  async restoreRule(ruleId: string) {
    const rule = await this.ctx().ruleRepository.restore(ruleId);
    if (!rule) {
      throw new NotFoundException(`Rule ${ruleId} not found`);
    }
    return rule;
  }

  async retireRule(ruleId: string, dto: RetireKnowledgeDto) {
    const rule = await this.ctx().ruleRepository.retire(ruleId, dto.reason);
    if (!rule) {
      throw new NotFoundException(`Rule ${ruleId} not found`);
    }
    return rule;
  }

  private ctx() {
    return this.getContext();
  }
}
