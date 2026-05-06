import type { ChatRunRecord } from '@agent/core';

export class ChatRunRepository {
  private readonly runs = new Map<string, ChatRunRecord>();

  create(run: ChatRunRecord): ChatRunRecord {
    this.runs.set(run.id, run);
    return run;
  }

  get(runId: string): ChatRunRecord | undefined {
    return this.runs.get(runId);
  }

  listBySession(sessionId: string): ChatRunRecord[] {
    return [...this.runs.values()].filter(run => run.sessionId === sessionId);
  }

  update(run: ChatRunRecord): ChatRunRecord {
    this.runs.set(run.id, run);
    return run;
  }
}
