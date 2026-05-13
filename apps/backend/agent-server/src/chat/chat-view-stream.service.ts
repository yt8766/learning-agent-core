import { BadRequestException, Injectable } from '@nestjs/common';
import type { ChatEventRecord, ChatRunRecord, ChatViewStreamEvent } from '@agent/core';

import { RuntimeSessionService } from '../runtime/services/runtime-session.service';
import { ChatRunService } from './chat-run.service';
import { projectChatViewStreamEvents } from './chat-view-stream.adapter';
import { ChatViewStreamEventRepository } from './chat-view-stream-event.repository';

@Injectable()
export class ChatViewStreamService {
  constructor(
    private readonly runtimeSessionService: RuntimeSessionService,
    private readonly chatRunService: ChatRunService,
    private readonly viewEventRepository: ChatViewStreamEventRepository
  ) {}

  listEvents(sessionId: string, runId: string, afterSeq?: number): ChatViewStreamEvent[] {
    const run = this.getRunForSession(sessionId, runId);
    this.backfillSessionEvents(sessionId, run);
    return this.viewEventRepository.list(sessionId, runId, afterSeq);
  }

  subscribe(
    sessionId: string,
    runId: string,
    listener: (event: ChatViewStreamEvent) => void,
    afterSeq?: number
  ): () => void {
    const run = this.getRunForSession(sessionId, runId);
    this.backfillSessionEvents(sessionId, run);
    return this.runtimeSessionService.subscribeSession(sessionId, event => {
      const projectedEvents = this.projectAndAppend([event], run);
      for (const projectedEvent of projectedEvents) {
        if (typeof afterSeq !== 'number' || projectedEvent.seq > afterSeq) {
          listener(projectedEvent);
        }
      }
    });
  }

  private backfillSessionEvents(sessionId: string, run: ChatRunRecord): ChatViewStreamEvent[] {
    return this.projectAndAppend(this.runtimeSessionService.listSessionEvents(sessionId), run);
  }

  private projectAndAppend(sourceEvents: ChatEventRecord[], run: ChatRunRecord): ChatViewStreamEvent[] {
    const projectedEvents = projectChatViewStreamEvents(sourceEvents, {
      run,
      nextSeq: this.viewEventRepository.getLastSeq(run.sessionId, run.id) + 1
    });
    return projectedEvents.map(event => this.viewEventRepository.append(event));
  }

  private getRunForSession(sessionId: string, runId: string): ChatRunRecord {
    const run = this.chatRunService.getRun(runId);
    if (run.sessionId !== sessionId) {
      throw new BadRequestException('run does not belong to session');
    }
    return run;
  }
}
