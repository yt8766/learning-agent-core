import { Injectable } from '@nestjs/common';
import {
  type DataReportBundleGenerateResult,
  type DataReportSandpackFiles
} from '../runtime/core/runtime-data-report-facade';
import {
  AppendChatMessageDto,
  ChatEventRecordSchema,
  CreateChatSessionDto,
  LearningConfirmationDto,
  RecoverToCheckpointDto,
  SessionApprovalDto,
  SessionCancelDto,
  UpdateChatSessionDto,
  type ChatEventRecord,
  type ChatResponseStepRecord,
  type ChatResponseStepSnapshot
} from '@agent/core';

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
import { buildChatResponseStepEvent, buildChatResponseStepSnapshot } from './chat-response-steps.adapter';

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
}

type ResponseStepProjectionState = {
  assistantMessageId?: string;
  stepsByMessageId: Record<string, ChatResponseStepRecord[]>;
};

function projectResponseStepEvents(events: ChatEventRecord[]): ChatEventRecord[] {
  const projectionState = createResponseStepProjectionState();
  return events.flatMap(event => [event, ...projectRealtimeResponseStepEvent(event, projectionState)]);
}

function createResponseStepProjectionState(): ResponseStepProjectionState {
  return {
    stepsByMessageId: {}
  };
}

function projectRealtimeResponseStepEvent(
  sourceEvent: ChatEventRecord,
  projectionState: ResponseStepProjectionState
): ChatEventRecord[] {
  if (sourceEvent.type === 'user_message') {
    projectionState.assistantMessageId = undefined;
    return [];
  }

  const messageId = readPayloadMessageId(sourceEvent) ?? projectionState.assistantMessageId;
  if (messageId) {
    projectionState.assistantMessageId = messageId;
  }

  if (sourceEvent.type === 'assistant_token') {
    return [];
  }

  if (!projectionState.assistantMessageId) {
    return [];
  }

  const projectedStep = buildChatResponseStepEvent(sourceEvent, {
    messageId: projectionState.assistantMessageId,
    sequence: projectionState.stepsByMessageId[projectionState.assistantMessageId]?.length ?? 0
  });
  if (!projectedStep) {
    return [];
  }

  const stepsForMessage = [
    ...(projectionState.stepsByMessageId[projectionState.assistantMessageId] ?? []),
    projectedStep.step
  ];
  projectionState.stepsByMessageId[projectionState.assistantMessageId] = stepsForMessage;

  const projectedEvents = [buildResponseStepChatEvent(sourceEvent, projectedStep)];
  const snapshotStatus = resolveSnapshotStatus(sourceEvent);
  if (snapshotStatus) {
    const snapshotSteps = resolveSnapshotSteps(stepsForMessage, snapshotStatus, sourceEvent.at);
    projectedEvents.push(
      buildResponseStepSnapshotChatEvent(sourceEvent, {
        sessionId: sourceEvent.sessionId,
        messageId: projectionState.assistantMessageId,
        status: snapshotStatus,
        steps: snapshotSteps,
        updatedAt: sourceEvent.at
      })
    );
    projectionState.stepsByMessageId[projectionState.assistantMessageId] = snapshotSteps;
  }

  return projectedEvents;
}

function buildResponseStepChatEvent(
  sourceEvent: ChatEventRecord,
  payload: NonNullable<ReturnType<typeof buildChatResponseStepEvent>>
): ChatEventRecord {
  return ChatEventRecordSchema.parse({
    id: `response-step-event-${sourceEvent.id}`,
    sessionId: sourceEvent.sessionId,
    type: 'node_progress',
    at: sourceEvent.at,
    payload
  });
}

function buildResponseStepSnapshotChatEvent(
  sourceEvent: ChatEventRecord,
  input: Parameters<typeof buildChatResponseStepSnapshot>[0]
): ChatEventRecord {
  return ChatEventRecordSchema.parse({
    id: `response-step-snapshot-${input.messageId}`,
    sessionId: sourceEvent.sessionId,
    type: 'node_progress',
    at: input.updatedAt,
    payload: buildChatResponseStepSnapshot(input)
  });
}

function resolveSnapshotStatus(sourceEvent: ChatEventRecord): ChatResponseStepSnapshot['status'] | null {
  if (sourceEvent.type === 'final_response_completed' || sourceEvent.type === 'session_finished') {
    return 'completed';
  }
  if (sourceEvent.type === 'session_failed') {
    return 'failed';
  }
  if (sourceEvent.type === 'run_cancelled') {
    return 'cancelled';
  }
  return null;
}

function readPayloadMessageId(sourceEvent: ChatEventRecord): string | undefined {
  const messageId = sourceEvent.payload?.messageId;
  return typeof messageId === 'string' && messageId.length > 0 ? messageId : undefined;
}

function resolveSnapshotSteps(
  steps: ChatResponseStepRecord[],
  status: ChatResponseStepSnapshot['status'],
  completedAt: string
): ChatResponseStepRecord[] {
  if (status !== 'completed') {
    return steps;
  }

  return steps.map(step =>
    step.status === 'queued' || step.status === 'running'
      ? {
          ...step,
          status: 'completed',
          completedAt: step.completedAt ?? completedAt
        }
      : step
  );
}
