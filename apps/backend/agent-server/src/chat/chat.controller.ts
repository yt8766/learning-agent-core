import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res
} from '@nestjs/common';
import type { Request, Response } from 'express';

import {
  AppendChatMessageDto,
  CreateChatSessionDto,
  LearningConfirmationDto,
  RecoverToCheckpointDto,
  SessionApprovalDto,
  SessionCancelDto,
  UpdateChatSessionDto
} from '@agent/shared';

import { DirectChatRequestDto } from './chat.direct.dto';
import { ChatService } from './chat.service';

const SESSION_COOKIE_NAME = 'agent_session_id';

type SessionBody = { sessionId?: string };
type SseResponse = Response & { flush?: () => void; flushHeaders?: () => void };

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async streamDirectChat(@Body() dto: DirectChatRequestDto, @Res() response: Response) {
    const directResponseMode = this.chatService.resolveDirectResponseMode(dto);
    const sseResponse = response as SseResponse;
    sseResponse.setHeader('Content-Type', 'text/event-stream');
    sseResponse.setHeader('Cache-Control', 'no-cache, no-transform');
    sseResponse.setHeader('Connection', 'keep-alive');
    sseResponse.setHeader('X-Accel-Buffering', 'no');
    sseResponse.flushHeaders?.();

    try {
      sseResponse.write(': keep-alive\n\n');
      if (directResponseMode === 'preview') {
        await this.chatService.streamSandpackPreview(dto, event => {
          this.writeSseEvent(sseResponse, event);
        });
        this.writeSseEvent(sseResponse, { type: 'done' });
        sseResponse.end();
        return;
      }

      if (directResponseMode === 'sandpack') {
        const result = await this.chatService.streamSandpackCode(dto, event => {
          this.writeSseEvent(sseResponse, event);
        });
        this.writeSseEvent(sseResponse, {
          type: 'done',
          data: {
            content: result.content
          }
        });
        sseResponse.end();
        return;
      }

      if (directResponseMode === 'report-schema') {
        const result = await this.chatService.streamReportSchema(dto, event => {
          this.writeSseEvent(sseResponse, event);
        });
        this.writeSseEvent(sseResponse, {
          type: 'done',
          data: {
            content: result.content,
            status: result.status,
            elapsedMs: result.elapsedMs,
            reportSummaries: result.reportSummaries,
            runtime: result.runtime
          }
        });
        sseResponse.end();
        return;
      }

      await this.chatService.streamChat(dto, event => {
        this.writeSseEvent(sseResponse, event);
      });
      this.writeSseEvent(sseResponse, { type: 'done' });
      sseResponse.end();
    } catch (error) {
      this.writeSseEvent(sseResponse, {
        type: 'error',
        message: error instanceof Error ? error.message : 'Internal server error'
      });
      sseResponse.end();
    }
  }

  @Get('sessions')
  listSessions() {
    return this.chatService.listSessions();
  }

  @Get('models')
  listAvailableModels() {
    return this.chatService.listAvailableModels();
  }

  @Post('sessions')
  async createSession(@Body() dto: CreateChatSessionDto, @Res({ passthrough: true }) response: Response) {
    const session = await this.chatService.createSession(dto);
    this.setSessionCookie(response, session.id);
    return session;
  }

  @Delete('sessions/:id')
  deleteSession(@Param('id') id: string) {
    return this.chatService.deleteSession(id);
  }

  @Patch('sessions/:id')
  updateSession(@Param('id') id: string, @Body() dto: UpdateChatSessionDto) {
    return this.chatService.updateSession(id, dto);
  }

  @Get('sessions/:id')
  getSession(@Param('id') id: string, @Res({ passthrough: true }) response: Response) {
    this.setSessionCookie(response, id);
    return this.chatService.getSession(id);
  }

  @Get('messages')
  listMessages(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Query('sessionId') sessionId?: string
  ) {
    const resolvedSessionId = this.resolveSessionId(request, sessionId);
    this.setSessionCookie(response, resolvedSessionId);
    return this.chatService.listMessages(resolvedSessionId);
  }

  @Get('events')
  listEvents(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Query('sessionId') sessionId?: string
  ) {
    const resolvedSessionId = this.resolveSessionId(request, sessionId);
    this.setSessionCookie(response, resolvedSessionId);
    return this.chatService.listEvents(resolvedSessionId);
  }

  @Get('checkpoint')
  getCheckpoint(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Query('sessionId') sessionId?: string
  ) {
    const resolvedSessionId = this.resolveSessionId(request, sessionId);
    this.setSessionCookie(response, resolvedSessionId);
    return this.chatService.getCheckpoint(resolvedSessionId);
  }

  @Post('messages')
  appendMessage(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() dto: AppendChatMessageDto & SessionBody
  ) {
    const resolvedSessionId = this.resolveSessionId(request, dto.sessionId);
    this.setSessionCookie(response, resolvedSessionId);
    return this.chatService.appendMessage(resolvedSessionId, { message: dto.message, modelId: dto.modelId });
  }

  @Post('approve')
  approve(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() dto: Omit<SessionApprovalDto, 'sessionId'> & SessionBody
  ) {
    const resolvedSessionId = this.resolveSessionId(request, dto.sessionId);
    this.setSessionCookie(response, resolvedSessionId);
    return this.chatService.approve(resolvedSessionId, { ...dto, sessionId: resolvedSessionId });
  }

  @Post('reject')
  reject(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() dto: Omit<SessionApprovalDto, 'sessionId'> & SessionBody
  ) {
    const resolvedSessionId = this.resolveSessionId(request, dto.sessionId);
    this.setSessionCookie(response, resolvedSessionId);
    return this.chatService.reject(resolvedSessionId, { ...dto, sessionId: resolvedSessionId });
  }

  @Post('learning/confirm')
  confirmLearning(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() dto: Omit<LearningConfirmationDto, 'sessionId'> & SessionBody
  ) {
    const resolvedSessionId = this.resolveSessionId(request, dto.sessionId);
    this.setSessionCookie(response, resolvedSessionId);
    return this.chatService.confirmLearning(resolvedSessionId, { ...dto, sessionId: resolvedSessionId });
  }

  @Post('recover')
  recover(@Req() request: Request, @Res({ passthrough: true }) response: Response, @Body() dto: SessionBody = {}) {
    const resolvedSessionId = this.resolveSessionId(request, dto.sessionId);
    this.setSessionCookie(response, resolvedSessionId);
    return this.chatService.recover(resolvedSessionId);
  }

  @Post('recover-to-checkpoint')
  recoverToCheckpoint(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() dto: Omit<RecoverToCheckpointDto, 'sessionId'> & SessionBody
  ) {
    const resolvedSessionId = this.resolveSessionId(request, dto.sessionId);
    this.setSessionCookie(response, resolvedSessionId);
    return this.chatService.recoverToCheckpoint({
      sessionId: resolvedSessionId,
      checkpointCursor: dto.checkpointCursor,
      checkpointId: dto.checkpointId,
      reason: dto.reason
    });
  }

  @Post('cancel')
  cancel(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() dto: Omit<SessionCancelDto, 'sessionId'> & SessionBody = {}
  ) {
    const resolvedSessionId = this.resolveSessionId(request, dto.sessionId);
    this.setSessionCookie(response, resolvedSessionId);
    return this.chatService.cancel(resolvedSessionId, { ...dto, sessionId: resolvedSessionId });
  }

  @Get('stream')
  stream(@Req() request: Request, @Res() response: Response, @Query('sessionId') sessionId?: string): void {
    const sseResponse = response as SseResponse;
    const resolvedSessionId = this.resolveSessionId(request, sessionId);
    this.setSessionCookie(sseResponse, resolvedSessionId);
    sseResponse.setHeader('Content-Type', 'text/event-stream');
    sseResponse.setHeader('Cache-Control', 'no-cache, no-transform');
    sseResponse.setHeader('Connection', 'keep-alive');
    sseResponse.setHeader('X-Accel-Buffering', 'no');
    sseResponse.flushHeaders?.();
    sseResponse.write(': stream-open\n\n');

    for (const event of this.chatService.listEvents(resolvedSessionId)) {
      if (event.type === 'assistant_token') {
        continue;
      }
      sseResponse.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    sseResponse.flush?.();

    const keepAliveTimer = setInterval(() => {
      sseResponse.write(': keep-alive\n\n');
      sseResponse.flush?.();
    }, 15_000);

    const unsubscribe = this.chatService.subscribe(resolvedSessionId, event => {
      sseResponse.write(`data: ${JSON.stringify(event)}\n\n`);
      sseResponse.flush?.();
    });

    const closeStream = () => {
      clearInterval(keepAliveTimer);
      unsubscribe();
      sseResponse.end();
    };

    request.on('close', closeStream);
  }

  private resolveSessionId(request: Request, explicitSessionId?: string): string {
    const sessionId = explicitSessionId ?? this.readCookie(request, SESSION_COOKIE_NAME);
    if (!sessionId) {
      throw new BadRequestException('sessionId is required.');
    }
    return sessionId;
  }

  private readCookie(request: Request, name: string): string | undefined {
    const rawCookieHeader = request.headers.cookie;
    if (!rawCookieHeader) {
      return undefined;
    }

    const cookies = rawCookieHeader.split(';').map(item => item.trim());
    for (const cookie of cookies) {
      const [key, ...value] = cookie.split('=');
      if (key === name) {
        return decodeURIComponent(value.join('='));
      }
    }

    return undefined;
  }

  private writeSseEvent(
    sseResponse: SseResponse,
    event: { type: string; data?: Record<string, unknown>; message?: string }
  ) {
    sseResponse.write(`data: ${JSON.stringify(event)}\n\n`);
    sseResponse.flush?.();
  }

  private setSessionCookie(response: Response, sessionId: string): void {
    response.cookie(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: false,
      sameSite: 'lax',
      path: '/'
    });
  }
}
