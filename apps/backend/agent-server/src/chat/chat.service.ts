import { Injectable } from '@nestjs/common';

import {
  AppendChatMessageDto,
  CreateChatSessionDto,
  LearningConfirmationDto,
  RecoverToCheckpointDto,
  SessionApprovalDto,
  SessionCancelDto,
  UpdateChatSessionDto
} from '@agent/shared';

import { RuntimeSessionService } from '../runtime/services/runtime-session.service';
import { ChatCapabilityIntentsService } from './chat-capability-intents.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly runtimeSessionService: RuntimeSessionService,
    private readonly chatCapabilityIntentsService: ChatCapabilityIntentsService
  ) {}

  listSessions() {
    return this.runtimeSessionService.listSessions();
  }

  createSession(dto: CreateChatSessionDto) {
    return this.runtimeSessionService.createSession(dto);
  }

  deleteSession(sessionId: string) {
    return this.runtimeSessionService.deleteSession(sessionId);
  }

  updateSession(sessionId: string, dto: UpdateChatSessionDto) {
    return this.runtimeSessionService.updateSession(sessionId, dto);
  }

  getSession(sessionId: string) {
    return this.runtimeSessionService.getSession(sessionId);
  }

  listMessages(sessionId: string) {
    return this.runtimeSessionService.listSessionMessages(sessionId);
  }

  listEvents(sessionId: string) {
    return this.runtimeSessionService.listSessionEvents(sessionId);
  }

  getCheckpoint(sessionId: string) {
    return this.runtimeSessionService.getSessionCheckpoint(sessionId);
  }

  appendMessage(sessionId: string, dto: AppendChatMessageDto) {
    return this.chatCapabilityIntentsService
      .tryHandle(sessionId, dto)
      .then(result => result ?? this.runtimeSessionService.appendSessionMessage(sessionId, dto));
  }

  approve(sessionId: string, dto: SessionApprovalDto) {
    return this.runtimeSessionService.approveSessionAction(sessionId, dto);
  }

  reject(sessionId: string, dto: SessionApprovalDto) {
    return this.runtimeSessionService.rejectSessionAction(sessionId, dto);
  }

  confirmLearning(sessionId: string, dto: LearningConfirmationDto) {
    return this.runtimeSessionService.confirmLearning(sessionId, dto);
  }

  recover(sessionId: string) {
    return this.runtimeSessionService.recoverSession(sessionId);
  }

  recoverToCheckpoint(dto: RecoverToCheckpointDto) {
    return this.runtimeSessionService.recoverSessionToCheckpoint(dto);
  }

  cancel(sessionId: string, dto: SessionCancelDto) {
    return this.runtimeSessionService.cancelSession(sessionId, dto);
  }

  subscribe(sessionId: string, listener: Parameters<RuntimeSessionService['subscribeSession']>[1]) {
    return this.runtimeSessionService.subscribeSession(sessionId, listener);
  }
}
