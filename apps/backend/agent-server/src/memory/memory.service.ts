import { Injectable } from '@nestjs/common';

import {
  InvalidateKnowledgeDto,
  MemoryFeedbackDto,
  OverrideMemoryDto,
  PatchUserProfileDto,
  ResolveResolutionCandidateDto,
  RetireKnowledgeDto,
  RollbackMemoryDto,
  SearchMemoryDto,
  SupersedeKnowledgeDto
} from '@agent/shared';

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

  history(id: string) {
    return this.runtimeKnowledgeService.getMemoryHistory(id);
  }

  usageInsights() {
    return this.runtimeKnowledgeService.getMemoryUsageInsights();
  }

  compare(id: string, leftVersion: number, rightVersion: number) {
    return this.runtimeKnowledgeService.compareMemoryVersions(id, leftVersion, rightVersion);
  }

  evidenceLinks(id: string) {
    return this.runtimeKnowledgeService.listMemoryEvidenceLinks(id);
  }

  override(id: string, dto: OverrideMemoryDto) {
    return this.runtimeKnowledgeService.overrideMemory(id, dto);
  }

  rollback(id: string, dto: RollbackMemoryDto) {
    return this.runtimeKnowledgeService.rollbackMemory(id, dto);
  }

  feedback(id: string, dto: MemoryFeedbackDto) {
    return this.runtimeKnowledgeService.recordMemoryFeedback(id, dto);
  }

  getProfile(userId: string) {
    return this.runtimeKnowledgeService.getProfile(userId);
  }

  patchProfile(userId: string, dto: PatchUserProfileDto) {
    return this.runtimeKnowledgeService.patchProfile(userId, dto);
  }

  listResolutionCandidates() {
    return this.runtimeKnowledgeService.listResolutionCandidates();
  }

  resolveResolutionCandidate(id: string, dto: ResolveResolutionCandidateDto) {
    return this.runtimeKnowledgeService.resolveResolutionCandidate(id, dto);
  }
}
