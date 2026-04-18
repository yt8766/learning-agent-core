import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { MemoryRecord } from '@agent/core';

import { MemoryCrossCheckService } from './memory-cross-check.service';
import { RuntimeKnowledgeService } from '../runtime/services/runtime-knowledge.service';

const SCRUBBER_INTERVAL_MS = 1000 * 60 * 30;
const SCRUBBER_SAMPLE_LIMIT = 20;

@Injectable()
export class MemoryScrubberRunnerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MemoryScrubberRunnerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly runtimeKnowledgeService: RuntimeKnowledgeService,
    private readonly memoryCrossCheckService: MemoryCrossCheckService
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.runSweep();
    }, SCRUBBER_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runSweep() {
    if (this.running) {
      return [];
    }
    this.running = true;
    try {
      const scrubber = this.runtimeKnowledgeService.createMemoryScrubber({
        validate: async (record: MemoryRecord) => this.validate(record)
      });
      const quarantined = await scrubber.scrubRecent(SCRUBBER_SAMPLE_LIMIT);
      if (quarantined.length) {
        this.logger.warn(`Quarantined ${quarantined.length} suspicious memory records.`);
      }
      return quarantined;
    } finally {
      this.running = false;
    }
  }

  private async validate(record: MemoryRecord) {
    const crossCheckFinding = await this.memoryCrossCheckService.validate(record);
    if (crossCheckFinding?.shouldQuarantine) {
      if (crossCheckFinding.evidenceRecords?.length) {
        await this.runtimeKnowledgeService.recordCrossCheckEvidence(record.id, crossCheckFinding.evidenceRecords);
      }
      return crossCheckFinding;
    }

    const haystack = `${record.summary}\n${record.content}\n${record.tags.join(' ')}`.toLowerCase();
    const suspiciousPatterns = [
      '首辅已',
      '礼部',
      '户部',
      '已分派给',
      'runid',
      '研究策略优先来源',
      'vitest.dev',
      'playwright.dev'
    ];
    const matched = suspiciousPatterns.find(pattern => haystack.includes(pattern.toLowerCase()));
    if (!matched) {
      return null;
    }

    return {
      memoryId: record.id,
      shouldQuarantine: true,
      reason: `Detected suspicious learned artifact containing "${matched}".`,
      category: 'runtime_noise' as const,
      detail: `Matched suspicious runtime artifact token "${matched}".`,
      restoreSuggestion: '确认该经验不再包含运行态噪声后，再从 Learning Center 手动恢复。',
      evidenceRefs: []
    };
  }
}
