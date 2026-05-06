import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  type DataReportBundleGenerateResult,
  type DataReportSandpackFiles
} from '../runtime/core/runtime-data-report-facade';
import {
  AppendChatMessageDto,
  CreateChatSessionDto,
  LearningConfirmationDto,
  RecoverToCheckpointDto,
  SessionApprovalDto,
  SessionCancelDto,
  UpdateChatSessionDto,
  type ChatMessageFeedbackRequest,
  type ChatMessageRecord,
  type ChatEventRecord
} from '@agent/core';

import { RuntimeHost } from '../runtime/core/runtime.host';
import { RuntimeSessionService } from '../runtime/services/runtime-session.service';
import { AgentToolsService } from '../agent-tools/agent-tools.service';
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
import { submitChatMessageFeedback } from './chat-message-feedback.helpers';
import { resolveReportSchemaArtifactCacheKey, streamReportSchema } from './chat-report-schema.helpers';
import {
  createResponseStepProjectionState,
  projectRealtimeResponseStepEvent,
  projectResponseStepEvents
} from './chat-response-step-events.helpers';
import { interpretApprovalReply } from './approval-reply-interpreter';
import { PendingInteractionService } from './pending-interaction.service';
import { ChatRunRepository } from './chat-run.repository';
import { ChatRunService } from './chat-run.service';

type SandpackFiles = Record<string, { code: string }>;
type SandpackStringFiles = DataReportSandpackFiles;
type DirectResponseMode = 'preview' | 'stream' | 'sandpack' | 'report-schema';
type ChatModelOption = {
  id: string;
  displayName: string;
  providerId: string;
};

@Injectable()
export class ChatService {
  constructor(
    private readonly runtimeSessionService: RuntimeSessionService,
    private readonly chatCapabilityIntentsService: ChatCapabilityIntentsService,
    private readonly runtimeHost: RuntimeHost,
    @Optional()
    @Inject(ChatRunService)
    private readonly chatRunService = new ChatRunService(new ChatRunRepository()),
    @Optional()
    @Inject(PendingInteractionService)
    private readonly pendingInteractionService = new PendingInteractionService(),
    @Optional()
    private readonly agentToolsService?: AgentToolsService
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

  async submitMessageFeedback(messageId: string, input: ChatMessageFeedbackRequest): Promise<ChatMessageRecord> {
    return submitChatMessageFeedback(this.runtimeSessionService, messageId, input);
  }

  listEvents(sessionId: string) {
    return projectResponseStepEvents(this.runtimeSessionService.listSessionEvents(sessionId));
  }

  listAvailableModels(): ChatModelOption[] {
    return this.runtimeHost.llmProvider
      .supportedModels()
      .map(model => ({
        id: `${model.providerId}/${model.id}`,
        displayName: model.displayName,
        providerId: model.providerId
      }))
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
  }

  listRuns(sessionId: string) {
    this.runtimeSessionService.getSession(sessionId);
    return this.chatRunService.listRuns(sessionId);
  }

  getRun(runId: string) {
    return this.chatRunService.getRun(runId);
  }

  cancelRun(runId: string) {
    return this.chatRunService.cancelRun(runId);
  }

  getCheckpoint(sessionId: string) {
    return this.runtimeSessionService.getSessionCheckpoint(sessionId);
  }

  appendMessage(sessionId: string, dto: AppendChatMessageDto) {
    const pendingInteraction = this.pendingInteractionService.getActive(sessionId);
    if (pendingInteraction) {
      const intent = interpretApprovalReply({
        interactionId: pendingInteraction.id,
        text: dto.message,
        expectedActions: pendingInteraction.expectedActions,
        requiredConfirmationPhrase: pendingInteraction.requiredConfirmationPhrase
      });
      const resolvedInteraction = this.pendingInteractionService.resolve(pendingInteraction.id, intent);
      return Promise.resolve({
        message: {
          id: `interaction_reply_${Date.now()}`,
          sessionId,
          role: 'user' as const,
          content: dto.message,
          createdAt: new Date().toISOString()
        },
        handledAs: 'pending_interaction_reply' as const,
        interactionResolution: {
          interactionId: pendingInteraction.id,
          intent,
          resolvedInteraction
        }
      });
    }
    const agentToolApprovalReply = this.tryHandleAgentToolApprovalReply(sessionId, dto.message);
    if (agentToolApprovalReply) {
      return Promise.resolve(agentToolApprovalReply);
    }
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
    const projectionState = createResponseStepProjectionState();
    for (const event of this.runtimeSessionService.listSessionEvents(sessionId)) {
      projectRealtimeResponseStepEvent(event, projectionState);
    }
    return this.runtimeSessionService.subscribeSession(sessionId, event => {
      listener(event);
      for (const projectedEvent of projectRealtimeResponseStepEvent(event, projectionState)) {
        listener(projectedEvent);
      }
    });
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
    const workflow = this.runtimeHost.platformRuntime.agentDependencies.resolveWorkflowPreset(goal);
    return workflow.preset.id === 'data-report' ? 'sandpack' : 'stream';
  }

  async generateSandpackPreview(dto: DirectChatRequestDto): Promise<SandpackFiles> {
    const resolve = this.runtimeHost.platformRuntime.agentDependencies.resolveWorkflowPreset;
    return generateSandpackPreview(dto, resolve as Parameters<typeof generateSandpackPreview>[1]);
  }

  async streamSandpackPreview(
    dto: DirectChatRequestDto,
    onEvent: (event: DirectChatSseEvent) => void
  ): Promise<SandpackFiles> {
    const resolve = this.runtimeHost.platformRuntime.agentDependencies.resolveWorkflowPreset;
    return streamSandpackPreview(dto, onEvent, resolve as Parameters<typeof streamSandpackPreview>[2]);
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
  ): Promise<DataReportBundleGenerateResult> {
    return streamReportSchema(this.runtimeHost, dto, onEvent);
  }

  private extractDirectGoal(dto: DirectChatRequestDto) {
    return extractDirectGoal(dto);
  }

  private resolveReportSchemaArtifactCacheKey(dto: DirectChatRequestDto) {
    return resolveReportSchemaArtifactCacheKey(this.runtimeHost, dto);
  }

  private tryHandleAgentToolApprovalReply(sessionId: string, message: string) {
    const request = this.agentToolsService
      ?.getProjection({ sessionId })
      .requests.slice()
      .reverse()
      .find(candidate => candidate.status === 'pending_approval' && candidate.sessionId === sessionId);
    if (!request) {
      return undefined;
    }

    const interactionId = `agent_tool:${request.requestId}`;
    const intent = interpretApprovalReply({
      interactionId,
      text: message,
      expectedActions: ['approve', 'reject', 'feedback'],
      requiredConfirmationPhrase: getAgentToolRequiredConfirmationPhrase(request.riskClass)
    });
    const action = intent.action;
    if (action === 'approve' || action === 'reject' || action === 'feedback') {
      this.agentToolsService?.resumeApproval(request.requestId, {
        sessionId,
        actor: 'agent-chat-user',
        reason: 'natural-language-chat-reply',
        interrupt: {
          action,
          requestId: request.requestId,
          approvalId: request.approvalId,
          interruptId: `interrupt_${request.requestId}`,
          feedback: intent.feedback
        }
      });
    }

    return {
      message: {
        id: `interaction_reply_${Date.now()}`,
        sessionId,
        role: 'user' as const,
        content: message,
        createdAt: new Date().toISOString()
      },
      handledAs: 'pending_interaction_reply' as const,
      interactionResolution: {
        interactionId,
        intent
      }
    };
  }
}

function getAgentToolRequiredConfirmationPhrase(riskClass?: string) {
  return riskClass === 'medium' || riskClass === 'high' || riskClass === 'critical' ? '确认执行' : undefined;
}
