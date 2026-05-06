import { Injectable } from '@nestjs/common';
import type { ChatViewStreamEvent } from '@agent/core';

import { RuntimeSessionService } from '../runtime/services/runtime-session.service';
import { ChatRunService } from './chat-run.service';
import { projectChatViewStreamEvents } from './chat-view-stream.adapter';

@Injectable()
export class ChatViewStreamService {
  constructor(
    private readonly runtimeSessionService: RuntimeSessionService,
    private readonly chatRunService: ChatRunService
  ) {}

  listEvents(sessionId: string, runId: string, afterSeq?: number): ChatViewStreamEvent[] {
    const run = this.chatRunService.getRun(runId);
    const events = projectChatViewStreamEvents(this.runtimeSessionService.listSessionEvents(sessionId), {
      run,
      nextSeq: 0
    });
    return typeof afterSeq === 'number' ? events.filter(event => event.seq > afterSeq) : events;
  }

  subscribe(
    sessionId: string,
    runId: string,
    listener: (event: ChatViewStreamEvent) => void,
    afterSeq?: number
  ): () => void {
    const run = this.chatRunService.getRun(runId);
    let nextSeq = typeof afterSeq === 'number' ? afterSeq + 1 : 0;
    return this.runtimeSessionService.subscribeSession(sessionId, event => {
      const projectedEvents = projectChatViewStreamEvents([event], { run, nextSeq });
      nextSeq += projectedEvents.length;
      projectedEvents.forEach(listener);
    });
  }
}
