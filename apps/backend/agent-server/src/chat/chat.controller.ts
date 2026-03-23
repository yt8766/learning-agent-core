import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  MessageEvent,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  Sse
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';

import {
  AppendChatMessageDto,
  CreateChatSessionDto,
  LearningConfirmationDto,
  SessionApprovalDto,
  SessionCancelDto,
  UpdateChatSessionDto
} from '@agent/shared';

import { ChatService } from './chat.service';

const SESSION_COOKIE_NAME = 'agent_session_id';

type SessionBody = { sessionId?: string };

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('sessions')
  listSessions() {
    return this.chatService.listSessions();
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
    return this.chatService.appendMessage(resolvedSessionId, { message: dto.message });
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

  @Sse('stream')
  stream(@Req() request: Request, @Query('sessionId') sessionId?: string): Observable<MessageEvent> {
    const resolvedSessionId = this.resolveSessionId(request, sessionId);
    return new Observable<MessageEvent>(subscriber => {
      this.chatService.listEvents(resolvedSessionId).forEach(event => {
        if (event.type === 'assistant_token') {
          return;
        }
        subscriber.next({ data: event });
      });

      const unsubscribe = this.chatService.subscribe(resolvedSessionId, event => {
        subscriber.next({ data: event });
      });

      return () => {
        unsubscribe();
      };
    });
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

  private setSessionCookie(response: Response, sessionId: string): void {
    response.cookie(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: false,
      sameSite: 'lax',
      path: '/'
    });
  }
}
