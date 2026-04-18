import type { EvidenceRecord, MemoryRecord } from '@agent/core';

import type { MemoryRepository } from '../repositories/memory-repository';

export interface MemoryScrubberFinding {
  memoryId: string;
  shouldQuarantine: boolean;
  reason?: string;
  category?: MemoryRecord['quarantineCategory'];
  detail?: string;
  restoreSuggestion?: string;
  evidenceRefs?: string[];
  evidenceRecords?: EvidenceRecord[];
}

export interface MemoryScrubberValidator {
  validate(record: MemoryRecord): Promise<MemoryScrubberFinding | null>;
}

export class MemoryScrubberService {
  constructor(
    private readonly memoryRepository: MemoryRepository,
    private readonly validator: MemoryScrubberValidator
  ) {}

  async scrubRecent(limit = 20): Promise<MemoryRecord[]> {
    const records = await this.memoryRepository.list();
    const recent = records
      .filter(record => !record.quarantined)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);

    const quarantined: MemoryRecord[] = [];
    for (const record of recent) {
      const finding = await this.validator.validate(record);
      if (!finding?.shouldQuarantine || !finding.reason) {
        continue;
      }
      const updated = await this.memoryRepository.quarantine(
        record.id,
        finding.reason,
        finding.evidenceRefs,
        finding.category,
        finding.detail,
        finding.restoreSuggestion
      );
      if (updated) {
        quarantined.push(updated);
      }
    }

    return quarantined;
  }
}
