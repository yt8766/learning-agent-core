import { Injectable } from '@nestjs/common';
import { type DataReportJsonGenerateResult, type DataReportSandpackFiles } from '@agent/agents-data-report';
import { resolveWorkflowPreset } from '@agent/agents-supervisor';
import {
  AppendChatMessageDto,
  CreateChatSessionDto,
  LearningConfirmationDto,
  RecoverToCheckpointDto,
  SessionApprovalDto,
  SessionCancelDto,
  UpdateChatSessionDto
} from '@agent/shared';

import { RuntimeHost } from '../runtime/core/runtime.host';
import { RuntimeSessionService } from '../runtime/services/runtime-session.service';
import { ChatCapabilityIntentsService } from './chat-capability-intents.service';
import { DirectChatRequestDto, DirectChatSseEvent } from './chat.direct.dto';
import {
  extractDirectGoal,
  generateSandpackPreview,
  normalizeDirectMessages,
  streamChat,
  streamSandpackCode,
  streamSandpackPreview
} from './chat-direct-response.helpers';
import { resolveReportSchemaArtifactCacheKey, streamReportSchema } from './chat-report-schema.helpers';

type SandpackFiles = Record<string, { code: string }>;
type SandpackStringFiles = DataReportSandpackFiles;
type DirectResponseMode = 'preview' | 'stream' | 'sandpack' | 'report-schema';

@Injectable()
export class ChatService {
  constructor(
    private readonly runtimeSessionService: RuntimeSessionService,
    private readonly chatCapabilityIntentsService: ChatCapabilityIntentsService,
    private readonly runtimeHost: RuntimeHost
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

  resolveDirectResponseMode(dto: DirectChatRequestDto): DirectResponseMode {
    if (dto.responseFormat === 'preview') {
      return 'preview';
    }

    if (dto.responseFormat === 'sandpack') {
      return 'sandpack';
    }

    if (dto.responseFormat === 'report-schema') {
      return 'report-schema';
    }

    const goal = this.extractDirectGoal(dto);
    const workflow = resolveWorkflowPreset(goal);
    return workflow.preset.id === 'data-report' ? 'sandpack' : 'stream';
  }

  async generateSandpackPreview(dto: DirectChatRequestDto): Promise<SandpackFiles> {
    return generateSandpackPreview(dto);
  }

  async streamSandpackPreview(
    dto: DirectChatRequestDto,
    onEvent: (event: DirectChatSseEvent) => void
  ): Promise<SandpackFiles> {
    return streamSandpackPreview(dto, onEvent);
  }

  async streamChat(
    dto: DirectChatRequestDto,
    onEvent: (event: DirectChatSseEvent) => void
  ): Promise<{ content: string }> {
    return streamChat(this.runtimeHost, dto, onEvent);
  }

  async streamSandpackCode(
    dto: DirectChatRequestDto,
    onEvent: (event: DirectChatSseEvent) => void
  ): Promise<{ files: SandpackStringFiles; content: string }> {
    return streamSandpackCode(this.runtimeHost, dto, onEvent);
  }

  async streamReportSchema(
    dto: DirectChatRequestDto,
    onEvent: (event: DirectChatSseEvent) => void
  ): Promise<DataReportJsonGenerateResult> {
    return streamReportSchema(this.runtimeHost, dto, onEvent);
  }

  private extractDirectGoal(dto: DirectChatRequestDto) {
    return extractDirectGoal(dto);
  }

  private resolveReportSchemaArtifactCacheKey(dto: DirectChatRequestDto) {
    return resolveReportSchemaArtifactCacheKey(this.runtimeHost, dto);
  }
}
