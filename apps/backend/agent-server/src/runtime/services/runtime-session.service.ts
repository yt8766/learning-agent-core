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
} from '@agent/core';

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
    return dedupeSessionMessages(this.ctx().sessionCoordinator.getMessages(sessionId));
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

const STREAM_MESSAGE_PREFIXES = ['progress_stream_', 'direct_reply_', 'summary_stream_'] as const;

function dedupeSessionMessages(messages: ChatMessageRecord[]) {
  const deduped: ChatMessageRecord[] = [];

  for (const message of messages) {
    const duplicateIndex = deduped.findIndex(candidate => shouldCollapseAssistantDuplicate(candidate, message));
    if (duplicateIndex >= 0) {
      deduped[duplicateIndex] = pickPreferredAssistantMessage(deduped[duplicateIndex]!, message);
      continue;
    }

    deduped.push(message);
  }

  return deduped;
}

function shouldCollapseAssistantDuplicate(left: ChatMessageRecord, right: ChatMessageRecord) {
  if (left.role !== 'assistant' || right.role !== 'assistant') {
    return false;
  }

  const leftTaskIdentity = resolveMessageTaskIdentity(left);
  const rightTaskIdentity = resolveMessageTaskIdentity(right);
  if (leftTaskIdentity !== rightTaskIdentity) {
    return false;
  }

  const leftContent = left.content.trim();
  const rightContent = right.content.trim();
  if (!leftContent || !rightContent) {
    return false;
  }

  return leftContent === rightContent || leftContent.startsWith(rightContent) || rightContent.startsWith(leftContent);
}

function resolveMessageTaskIdentity(message: ChatMessageRecord) {
  if (message.taskId) {
    return message.taskId;
  }

  for (const prefix of STREAM_MESSAGE_PREFIXES) {
    if (message.id.startsWith(prefix)) {
      return message.id.slice(prefix.length);
    }
  }

  return message.id;
}

function pickPreferredAssistantMessage(left: ChatMessageRecord, right: ChatMessageRecord) {
  const leftContent = left.content.trim();
  const rightContent = right.content.trim();

  if (isTransientAssistantMessage(left) && !isTransientAssistantMessage(right)) {
    return {
      ...right,
      content: rightContent.length >= leftContent.length ? right.content : left.content,
      createdAt: right.createdAt || left.createdAt
    };
  }

  if (!isTransientAssistantMessage(left) && isTransientAssistantMessage(right)) {
    return {
      ...left,
      content: leftContent.length >= rightContent.length ? left.content : right.content,
      createdAt: right.createdAt || left.createdAt
    };
  }

  return rightContent.length >= leftContent.length ? right : left;
}

function isTransientAssistantMessage(message: ChatMessageRecord) {
  return STREAM_MESSAGE_PREFIXES.some(prefix => message.id.startsWith(prefix));
}
