import { Injectable } from '@nestjs/common';
import type { ChatViewCloseEvent, ChatViewStreamEvent } from '@agent/core';

@Injectable()
export class ChatViewStreamEventRepository {
  private readonly eventsByRun = new Map<string, ChatViewStreamEvent[]>();

  append(event: ChatViewStreamEvent): ChatViewStreamEvent {
    const key = this.buildKey(event.sessionId, event.runId);
    const events = this.eventsByRun.get(key) ?? [];
    const existing = events.find(candidate => candidate.id === event.id);
    if (existing) {
      return existing;
    }

    events.push(event);
    events.sort((left, right) => left.seq - right.seq);
    this.eventsByRun.set(key, events);
    return event;
  }

  list(sessionId: string, runId: string, afterSeq?: number): ChatViewStreamEvent[] {
    const events = this.eventsByRun.get(this.buildKey(sessionId, runId)) ?? [];
    const filtered = typeof afterSeq === 'number' ? events.filter(event => event.seq > afterSeq) : events;
    return [...filtered];
  }

  getLastSeq(sessionId: string, runId: string): number {
    const events = this.eventsByRun.get(this.buildKey(sessionId, runId)) ?? [];
    return events.length > 0 ? (events[events.length - 1]?.seq ?? -1) : -1;
  }

  markClosed(_sessionId: string, _runId: string, closeEvent: ChatViewCloseEvent): ChatViewStreamEvent {
    return this.append(closeEvent);
  }

  private buildKey(sessionId: string, runId: string): string {
    return `${sessionId}:${runId}`;
  }
}
