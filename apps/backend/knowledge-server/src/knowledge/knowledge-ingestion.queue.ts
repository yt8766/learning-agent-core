import { Injectable, Logger } from '@nestjs/common';

import type { DocumentProcessingJobRecord } from './domain/knowledge-document.types';
import { KnowledgeIngestionWorker } from './knowledge-ingestion.worker';
import { getErrorMessage } from './knowledge.errors';

@Injectable()
export class KnowledgeIngestionQueue {
  private readonly jobs: DocumentProcessingJobRecord[] = [];
  private running = false;
  private draining = false;

  constructor(private readonly worker: KnowledgeIngestionWorker) {}

  enqueue(job: DocumentProcessingJobRecord): void {
    this.jobs.push(job);
    if (this.running) {
      void this.drain();
    }
  }

  start(): void {
    this.running = true;
    void this.drain();
  }

  stop(): void {
    this.running = false;
  }

  async waitForIdle(): Promise<void> {
    while (this.draining || this.jobs.length > 0) {
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    while (this.jobs.length > 0 && this.running) {
      const job = this.jobs.shift()!;
      try {
        await this.worker.process(job);
      } catch (error) {
        Logger.error(`Ingestion job ${job.id} failed: ${getErrorMessage(error)}`, 'KnowledgeIngestionQueue');
      }
    }
    this.draining = false;
  }
}
