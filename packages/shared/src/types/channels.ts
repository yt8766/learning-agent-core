import type { ActionIntent, ChatRole, ExecutionPlanMode } from './primitives';
import type { ApprovalResumeInput } from './governance';
import type { CapabilityAttachmentRecord, CapabilityAugmentationRecord, RequestedExecutionHints } from './skills';

export interface CreateTaskDto {
  goal: string;
  context?: string;
  constraints?: string[];
  sessionId?: string;
  requestedMode?: ExecutionPlanMode;
  counselorSelector?: {
    strategy: 'user-id' | 'session-ratio' | 'task-type' | 'feature-flag' | 'manual';
    key?: string;
    candidateIds?: string[];
    weights?: number[];
    featureFlag?: string;
    fallbackCounselorId?: string;
  };
  imperialDirectIntent?: {
    enabled: boolean;
    trigger: 'slash-exec' | 'explicit-direct-execution' | 'known-capability';
    requestedCapability?: string;
    reason?: string;
  };
  requestedHints?: RequestedExecutionHints;
  capabilityAttachments?: CapabilityAttachmentRecord[];
  capabilityAugmentations?: CapabilityAugmentationRecord[];
  conversationSummary?: string;
  recentTurns?: Array<{
    role: ChatRole;
    content: string;
  }>;
  relatedHistory?: string[];
}

export interface CreateAgentDiagnosisTaskDto {
  taskId: string;
  errorCode: string;
  message: string;
  goal?: string;
  ministry?: string;
  diagnosisHint?: string;
  recommendedAction?: string;
  recoveryPlaybook?: string[];
  stack?: string;
}

export type ChannelKind = 'web' | 'telegram' | 'feishu' | 'wechat';

export interface ChannelIdentity {
  channel: ChannelKind;
  channelUserId?: string;
  channelChatId?: string;
  messageId?: string;
  displayName?: string;
}

export interface InboundChannelAttachment {
  type: 'image' | 'file' | 'link' | 'unknown';
  url?: string;
  fileId?: string;
  mimeType?: string;
  title?: string;
}

export interface InboundChannelMessage {
  channel: ChannelKind;
  channelUserId: string;
  channelChatId: string;
  messageId: string;
  text: string;
  command?: string;
  attachments?: InboundChannelAttachment[];
  identity?: ChannelIdentity;
}

export interface ChannelOutboundMessage {
  channel: ChannelKind;
  channelChatId: string;
  sessionId?: string;
  taskId?: string;
  segment: 'planning' | 'approval' | 'progress' | 'final';
  title: string;
  content: string;
  createdAt: string;
}

export interface CreateChatSessionDto {
  message?: string;
  title?: string;
  channelIdentity?: ChannelIdentity;
}

export interface UpdateChatSessionDto {
  title: string;
}

export interface AppendChatMessageDto {
  message: string;
  channelIdentity?: ChannelIdentity;
}

export interface RecoverToCheckpointDto {
  sessionId: string;
  checkpointCursor?: number;
  checkpointId?: string;
  reason?: string;
}

export interface SearchMemoryDto {
  query: string;
  limit?: number;
}

export interface InvalidateKnowledgeDto {
  reason: string;
}

export interface SupersedeKnowledgeDto {
  replacementId: string;
  reason: string;
}

export interface RetireKnowledgeDto {
  reason: string;
}

export interface CreateDocumentLearningJobDto {
  documentUri: string;
  title?: string;
}

export interface CreateResearchLearningJobDto {
  goal: string;
  title?: string;
  workflowId?: string;
  preferredUrls?: string[];
}

export interface ApprovalActionDto {
  intent?: ActionIntent | string;
  reason?: string;
  actor?: string;
  feedback?: string;
  interrupt?: ApprovalResumeInput;
}

export interface SessionApprovalDto extends ApprovalActionDto {
  sessionId: string;
}

export interface SessionCancelDto {
  sessionId: string;
  actor?: string;
  reason?: string;
}

export interface LearningConfirmationDto {
  sessionId: string;
  candidateIds?: string[];
  actor?: string;
}
