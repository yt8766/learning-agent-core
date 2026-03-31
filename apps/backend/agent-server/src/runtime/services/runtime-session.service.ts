import { NotFoundException } from '@nestjs/common';

import {
  AppendChatMessageDto,
  CapabilityAttachmentRecord,
  CapabilityAugmentationRecord,
  ChatCheckpointRecord,
  ChatEventRecord,
  ChatMessageRecord,
  ChatSessionRecord,
  CreateChatSessionDto,
  LearningConfirmationDto,
  RecoverToCheckpointDto,
  SessionApprovalDto,
  SessionCancelDto,
  UpdateChatSessionDto
} from '@agent/shared';

export interface RuntimeSessionContext {
  sessionCoordinator: any;
}

export class RuntimeSessionService {
  constructor(private readonly getContext: () => RuntimeSessionContext) {}

  listSessions(): ChatSessionRecord[] {
    return this.ctx().sessionCoordinator.listSessions();
  }

  createSession(dto: CreateChatSessionDto): Promise<ChatSessionRecord> {
    return this.ctx().sessionCoordinator.createSession(dto);
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.getSession(sessionId);
    await this.ctx().sessionCoordinator.deleteSession(sessionId);
  }

  updateSession(sessionId: string, dto: UpdateChatSessionDto): Promise<ChatSessionRecord> {
    this.getSession(sessionId);
    return this.ctx().sessionCoordinator.updateSession(sessionId, dto);
  }

  getSession(sessionId: string): ChatSessionRecord {
    const session = this.ctx().sessionCoordinator.getSession(sessionId);
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }
    return session;
  }

  listSessionMessages(sessionId: string): ChatMessageRecord[] {
    this.getSession(sessionId);
    return this.ctx().sessionCoordinator.getMessages(sessionId);
  }

  listSessionEvents(sessionId: string): ChatEventRecord[] {
    this.getSession(sessionId);
    return this.ctx().sessionCoordinator.getEvents(sessionId);
  }

  getSessionCheckpoint(sessionId: string): ChatCheckpointRecord | undefined {
    this.getSession(sessionId);
    return this.ctx().sessionCoordinator.getCheckpoint(sessionId);
  }

  appendSessionMessage(sessionId: string, dto: AppendChatMessageDto): Promise<ChatMessageRecord> {
    this.getSession(sessionId);
    return this.ctx().sessionCoordinator.appendMessage(sessionId, dto);
  }

  appendInlineCapabilityResponse(
    sessionId: string,
    dto: AppendChatMessageDto,
    response: {
      role?: ChatMessageRecord['role'];
      content: string;
      card?: ChatMessageRecord['card'];
    }
  ): Promise<ChatMessageRecord> {
    this.getSession(sessionId);
    return this.ctx().sessionCoordinator.appendInlineCapabilityResponse(sessionId, dto, response);
  }

  attachSessionCapabilities(
    sessionId: string,
    params: {
      attachments?: CapabilityAttachmentRecord[];
      augmentations?: CapabilityAugmentationRecord[];
      usedInstalledSkills?: string[];
    }
  ): Promise<ChatCheckpointRecord> {
    this.getSession(sessionId);
    return this.ctx().sessionCoordinator.attachSessionCapabilities(sessionId, params);
  }

  approveSessionAction(sessionId: string, dto: SessionApprovalDto): Promise<ChatSessionRecord> {
    this.getSession(sessionId);
    return this.ctx().sessionCoordinator.approve(sessionId, dto);
  }

  rejectSessionAction(sessionId: string, dto: SessionApprovalDto): Promise<ChatSessionRecord> {
    this.getSession(sessionId);
    return this.ctx().sessionCoordinator.reject(sessionId, dto);
  }

  confirmLearning(sessionId: string, dto: LearningConfirmationDto): Promise<ChatSessionRecord> {
    this.getSession(sessionId);
    return this.ctx().sessionCoordinator.confirmLearning(sessionId, dto);
  }

  recoverSession(sessionId: string): Promise<ChatSessionRecord> {
    this.getSession(sessionId);
    return this.ctx().sessionCoordinator.recover(sessionId);
  }

  recoverSessionToCheckpoint(dto: RecoverToCheckpointDto): Promise<ChatSessionRecord> {
    this.getSession(dto.sessionId);
    return this.ctx().sessionCoordinator.recoverToCheckpoint(dto.sessionId, dto);
  }

  cancelSession(sessionId: string, dto: SessionCancelDto): Promise<ChatSessionRecord> {
    this.getSession(sessionId);
    return this.ctx().sessionCoordinator.cancel(sessionId, dto);
  }

  subscribeSession(sessionId: string, listener: (event: ChatEventRecord) => void): () => void {
    this.getSession(sessionId);
    return this.ctx().sessionCoordinator.subscribe(sessionId, listener);
  }

  private ctx() {
    return this.getContext();
  }
}
