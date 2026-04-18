import { NotFoundException } from '@nestjs/common';
import { MemoryScrubberService, type MemoryScrubberValidator } from '@agent/memory';

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
import { RuntimeWenyuanFacade } from '../wenyuan/runtime-wenyuan-facade';

export interface RuntimeKnowledgeContext {
  wenyuanFacade: RuntimeWenyuanFacade;
  ruleRepository: any;
  orchestrator: any;
  runtimeStateRepository: any;
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
    const totals = memories.reduce(
      (summary, memory) => {
        summary.totalMemories += 1;
        summary.retrieved += memory.usageMetrics?.retrievedCount ?? 0;
        summary.injected += memory.usageMetrics?.injectedCount ?? 0;
        summary.adopted += memory.usageMetrics?.adoptedCount ?? 0;
        summary.dismissed += memory.usageMetrics?.dismissedCount ?? 0;
        summary.corrected += memory.usageMetrics?.correctedCount ?? 0;
        const memoryType = memory.memoryType ?? 'unknown';
        summary.byMemoryType[memoryType] =
          (summary.byMemoryType[memoryType] ?? 0) + (memory.usageMetrics?.adoptedCount ?? 0);
        const status = memory.status ?? 'unknown';
        summary.byStatus[status] = (summary.byStatus[status] ?? 0) + 1;
        return summary;
      },
      {
        totalMemories: 0,
        retrieved: 0,
        injected: 0,
        adopted: 0,
        dismissed: 0,
        corrected: 0,
        byMemoryType: {} as Record<string, number>,
        byStatus: {} as Record<string, number>
      }
    );

    const rankBy = (selector: (memory: MemoryRecord) => number) =>
      memories
        .slice()
        .sort((left, right) => selector(right) - selector(left))
        .filter(memory => selector(memory) > 0)
        .slice(0, 5)
        .map(memory => ({
          id: memory.id,
          summary: memory.summary,
          memoryType: memory.memoryType,
          status: memory.status,
          value: selector(memory)
        }));

    return {
      totalMemories: totals.totalMemories,
      totalRetrieved: totals.retrieved,
      totalInjected: totals.injected,
      totalAdopted: totals.adopted,
      totalDismissed: totals.dismissed,
      totalCorrected: totals.corrected,
      adoptionRate: totals.injected > 0 ? Number((totals.adopted / totals.injected).toFixed(4)) : 0,
      topAdoptedMemories: rankBy(memory => memory.usageMetrics?.adoptedCount ?? 0),
      topDismissedMemories: rankBy(memory => memory.usageMetrics?.dismissedCount ?? 0),
      topCorrectedMemories: rankBy(memory => memory.usageMetrics?.correctedCount ?? 0),
      adoptionByMemoryType: Object.entries(totals.byMemoryType).map(([memoryType, adoptedCount]) => ({
        memoryType,
        adoptedCount
      })),
      countByStatus: Object.entries(totals.byStatus).map(([status, count]) => ({
        status,
        count
      }))
    };
  }

  async compareMemoryVersions(memoryId: string, leftVersion: number, rightVersion: number) {
    const history = await this.getMemoryHistory(memoryId);
    const current = history.memory;
    if (!current) {
      throw new NotFoundException(`Memory ${memoryId} not found`);
    }

    const resolveSnapshot = (version: number) => {
      if (current.version === version) {
        return buildMemoryCompareSnapshot(current);
      }
      const event = history.events
        .filter(item => item.version === version)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0];
      const snapshot = event?.payload?.snapshot as Record<string, unknown> | undefined;
      if (!snapshot) {
        return undefined;
      }
      return buildMemoryCompareSnapshot({
        ...current,
        ...snapshot,
        id: current.id
      } as MemoryRecord);
    };

    const left = resolveSnapshot(leftVersion);
    const right = resolveSnapshot(rightVersion);
    if (!left || !right) {
      throw new NotFoundException(
        `Unable to compare versions ${leftVersion} and ${rightVersion} for memory ${memoryId}`
      );
    }

    return {
      memoryId,
      currentVersion: current.version ?? rightVersion,
      leftVersion,
      rightVersion,
      left,
      right,
      latestEventType: history.events.slice().sort((a, b) => b.version - a.version)[0]?.type
    };
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

function buildMemoryCompareSnapshot(memory: MemoryRecord) {
  return {
    summary: memory.summary,
    content: memory.content,
    status: memory.status,
    scopeType: memory.scopeType,
    memoryType: memory.memoryType,
    usageMetrics: memory.usageMetrics,
    sourceEvidenceIds: memory.sourceEvidenceIds ?? []
  };
}
