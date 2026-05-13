import { Injectable } from '@nestjs/common';

export interface RuntimeUsageQueueRecord {
  recordKind: 'runtime-audit';
  requestId: string;
  timestamp: string;
  providerKind: string;
  model: string;
  clientId: string;
  failed: boolean;
  tokens: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

@Injectable()
export class RuntimeUsageQueueService {
  private readonly records: RuntimeUsageQueueRecord[] = [];

  append(record: RuntimeUsageQueueRecord): void {
    this.records.push(record);
  }

  pop(count: number): RuntimeUsageQueueRecord[] {
    return this.records.splice(0, Math.max(0, count));
  }

  size(): number {
    return this.records.length;
  }

  snapshot(): { pending: number; failed: number } {
    return {
      pending: this.records.length,
      failed: this.records.filter(record => record.failed).length
    };
  }
}
