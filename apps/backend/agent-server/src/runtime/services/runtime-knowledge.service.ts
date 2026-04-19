import { NotFoundException } from '@nestjs/common';
import {
  MemoryScrubberService,
  type MemoryScrubberValidator,
  type MemoryRepository,
  type RuleRepository,
  type RuntimeStateSnapshot
} from '@agent/memory';

import {
  EvidenceRecord,
  InvalidateKnowledgeDto,
  MemoryFeedbackDto,
  MemorySearchResult,
  MemoryRecord,
  OverrideMemoryDto,
  PatchUserProfileDto,
  RetireKnowledgeDto,
  ResolveResolutionCandidateDto,
  ResolutionCandidateRecord,
  RollbackMemoryDto,
  SearchMemoryDto,
  UserProfileRecord,
  SupersedeKnowledgeDto
} from '@agent/core';
import type { RuntimeHost } from '../core/runtime.host';
import { applyCrossCheckEvidenceRecords } from '../domain/knowledge/runtime-cross-check-evidence';
import { buildMemoryUsageInsights } from '../domain/knowledge/runtime-memory-usage-insights';
import { buildMemoryVersionComparison } from '../domain/knowledge/runtime-memory-version-compare';
import { RuntimeWenyuanFacade } from '../wenyuan/runtime-wenyuan-facade';

export interface RuntimeKnowledgeContext {
  wenyuanFacade: RuntimeWenyuanFacade;
  ruleRepository: RuleRepository;
  orchestrator: RuntimeHost['orchestrator'];
  runtimeStateRepository: RuntimeHost['runtimeStateRepository'];
}

export class RuntimeKnowledgeService {
  constructor(private readonly getContext: () => RuntimeKnowledgeContext) {}

  async searchMemory(dto: SearchMemoryDto): Promise<MemoryRecord[] | MemorySearchResult> {
    if (
      dto.scopeContext ||
      dto.entityContext ||
      dto.memoryTypes ||
      dto.includeRules !== undefined ||
      dto.includeReflections
    ) {
      return (
        (await this.ctx().wenyuanFacade.searchMemoryStructured({
          query: dto.query,
          limit: dto.limit ?? 10,
          scopeContext: dto.scopeContext,
          entityContext: dto.entityContext,
          memoryTypes: dto.memoryTypes,
          includeRules: dto.includeRules,
          includeReflections: dto.includeReflections
        })) ?? {
          coreMemories: [],
          archivalMemories: [],
          rules: [],
          reflections: [],
          reasons: []
        }
      );
    }
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

  async getMemoryHistory(memoryId: string) {
    const history = await this.ctx().wenyuanFacade.getMemoryHistory(memoryId);
    if (!history.memory) {
      throw new NotFoundException(`Memory ${memoryId} not found`);
    }
    return history;
  }

  listMemoryEvidenceLinks(memoryId: string) {
    return this.ctx().wenyuanFacade.listEvidenceLinks(memoryId);
  }

  async getMemoryUsageInsights() {
    const memories = await this.ctx().wenyuanFacade.listMemories();
    return buildMemoryUsageInsights(memories);
  }

  async compareMemoryVersions(memoryId: string, leftVersion: number, rightVersion: number) {
    const history = await this.getMemoryHistory(memoryId);
    const comparison = buildMemoryVersionComparison({
      memoryId,
      history,
      leftVersion,
      rightVersion
    });
    if (!comparison) {
      throw new NotFoundException(
        `Unable to compare versions ${leftVersion} and ${rightVersion} for memory ${memoryId}`
      );
    }
    return comparison;
  }

  async overrideMemory(
    memoryId: string,
    dto: OverrideMemoryDto
  ): Promise<{ previous?: MemoryRecord; replacement: MemoryRecord }> {
    const overridden = await this.ctx().wenyuanFacade.overrideMemory(
      memoryId,
      {
        summary: dto.summary,
        content: dto.content,
        tags: dto.tags,
        memoryType: dto.memoryType,
        scopeType: dto.scopeType
      },
      dto.reason,
      dto.actor
    );
    if (!overridden) {
      throw new NotFoundException(`Memory ${memoryId} not found`);
    }
    return overridden;
  }

  async rollbackMemory(memoryId: string, dto: RollbackMemoryDto): Promise<MemoryRecord> {
    const memory = await this.ctx().wenyuanFacade.rollbackMemory(memoryId, dto.version, dto.actor);
    if (!memory) {
      throw new NotFoundException(`Memory ${memoryId} not found`);
    }
    return memory;
  }

  async recordMemoryFeedback(memoryId: string, dto: MemoryFeedbackDto): Promise<MemoryRecord> {
    const memory = await this.ctx().wenyuanFacade.recordMemoryFeedback(memoryId, dto.kind, dto.at);
    if (!memory) {
      throw new NotFoundException(`Memory ${memoryId} not found`);
    }
    return memory;
  }

  getProfile(userId: string): Promise<UserProfileRecord | undefined> {
    return this.ctx().wenyuanFacade.getProfile(userId);
  }

  patchProfile(userId: string, dto: PatchUserProfileDto): Promise<UserProfileRecord> {
    return this.ctx().wenyuanFacade.patchProfile(userId, dto, dto.actor);
  }

  listResolutionCandidates(): Promise<ResolutionCandidateRecord[]> {
    return this.ctx().wenyuanFacade.listResolutionCandidates();
  }

  async resolveResolutionCandidate(id: string, dto: ResolveResolutionCandidateDto): Promise<ResolutionCandidateRecord> {
    const candidate = await this.ctx().wenyuanFacade.resolveResolutionCandidate(id, dto.resolution);
    if (!candidate) {
      throw new NotFoundException(`Resolution candidate ${id} not found`);
    }
    return candidate;
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
    return new MemoryScrubberService(this.ctx().wenyuanFacade.getMemoryRepository() as MemoryRepository, validator);
  }

  async recordCrossCheckEvidence(memoryId: string, records: EvidenceRecord[]) {
    if (!records.length) {
      return [];
    }

    const snapshot = await this.ctx().runtimeStateRepository.load();
    await this.ctx().runtimeStateRepository.save(applyCrossCheckEvidenceRecords(snapshot, memoryId, records));
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
