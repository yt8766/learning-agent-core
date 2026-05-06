import { BadRequestException, Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ChatViewStreamEvent } from '@agent/core';

import { ChatViewStreamService } from './chat-view-stream.service';

type SseResponse = Response & { flush?: () => void; flushHeaders?: () => void };

@Controller('chat/view-stream')
export class ChatViewStreamController {
  constructor(private readonly chatViewStreamService: ChatViewStreamService) {}

  @Get()
  stream(
    @Req() request: Request,
    @Res() response: Response,
    @Query('sessionId') sessionId: string,
    @Query('runId') runId: string,
    @Query('afterSeq') afterSeq?: string
  ): void {
    const parsedAfterSeq = parseAfterSeq(afterSeq);
    if (!sessionId || !runId) {
      throw new BadRequestException('sessionId and runId are required');
    }
    const historicalEvents = this.chatViewStreamService.listEvents(sessionId, runId, parsedAfterSeq);
    const sseResponse = response as SseResponse;
    sseResponse.setHeader('Content-Type', 'text/event-stream');
    sseResponse.setHeader('Cache-Control', 'no-cache, no-transform');
    sseResponse.setHeader('Connection', 'keep-alive');
    sseResponse.setHeader('X-Accel-Buffering', 'no');
    sseResponse.flushHeaders?.();
    sseResponse.write(': view-stream-open\n\n');

    for (const event of historicalEvents) {
      writeViewEvent(sseResponse, event);
    }
    sseResponse.flush?.();

    const subscribeAfterSeq =
      historicalEvents.length > 0 ? historicalEvents[historicalEvents.length - 1]?.seq : parsedAfterSeq;
    const unsubscribe = this.chatViewStreamService.subscribe(
      sessionId,
      runId,
      event => {
        writeViewEvent(sseResponse, event);
        sseResponse.flush?.();
      },
      subscribeAfterSeq
    );

    request.on('close', () => {
      unsubscribe();
      sseResponse.end();
    });
  }
}

function writeViewEvent(response: SseResponse, event: ChatViewStreamEvent): void {
  response.write(`event: ${event.event}\ndata: ${JSON.stringify(event)}\n\n`);
}

function parseAfterSeq(afterSeq?: string): number | undefined {
  if (!afterSeq) {
    return undefined;
  }
  const value = Number(afterSeq);
  return Number.isFinite(value) ? value : undefined;
}
