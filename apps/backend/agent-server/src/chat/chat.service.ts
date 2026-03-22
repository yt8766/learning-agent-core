import { Injectable } from '@nestjs/common';

import { AppendChatMessageDto, CreateChatSessionDto, LearningConfirmationDto, SessionApprovalDto } from '@agent/shared';

import { RuntimeService } from '../runtime/runtime.service';

@Injectable()
export class ChatService {
  constructor(private readonly runtimeService: RuntimeService) {}

  listSessions() {
    return this.runtimeService.listSessions();
  }

  createSession(dto: CreateChatSessionDto) {
    return this.runtimeService.createSession(dto);
  }

  getSession(sessionId: string) {
    return this.runtimeService.getSession(sessionId);
  }

  listMessages(sessionId: string) {
    return this.runtimeService.listSessionMessages(sessionId);
  }

  listEvents(sessionId: string) {
    return this.runtimeService.listSessionEvents(sessionId);
  }

  getCheckpoint(sessionId: string) {
    return this.runtimeService.getSessionCheckpoint(sessionId);
  }

  appendMessage(sessionId: string, dto: AppendChatMessageDto) {
    return this.runtimeService.appendSessionMessage(sessionId, dto);
  }

  approve(sessionId: string, dto: SessionApprovalDto) {
    return this.runtimeService.approveSessionAction(sessionId, dto);
  }

  reject(sessionId: string, dto: SessionApprovalDto) {
    return this.runtimeService.rejectSessionAction(sessionId, dto);
  }

  confirmLearning(sessionId: string, dto: LearningConfirmationDto) {
    return this.runtimeService.confirmLearning(sessionId, dto);
  }

  recover(sessionId: string) {
    return this.runtimeService.recoverSession(sessionId);
  }

  subscribe(sessionId: string, listener: Parameters<RuntimeService['subscribeSession']>[1]) {
    return this.runtimeService.subscribeSession(sessionId, listener);
  }
}
