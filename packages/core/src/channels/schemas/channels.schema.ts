import { z } from 'zod';

import { ApprovalScopeSchema, ChatRoleSchema, ExecutionPlanModeSchema } from '../../primitives';
import { ApprovalResumeInputSchema } from '../../tasking/schemas/governance-fields';
import {
  CapabilityAttachmentRecordSchema,
  CapabilityAugmentationRecordSchema,
  RequestedExecutionHintsSchema
} from '../../skills/schemas/capability';
import {
  ChannelIdentitySchema,
  ChatSessionCompressionRecordSchema,
  ChatSessionTitleSourceSchema
} from '../../tasking/schemas/session';
import { TaskLineageRecordSchema } from '../../tasking/schemas/task-lineage';
import { MemoryScopeTypeSchema, MemoryTypeSchema } from '../../tasking/schemas/memory-fields';

export const CreateTaskCounselorSelectorSchema = z.object({
  strategy: z.enum(['user-id', 'session-ratio', 'task-type', 'feature-flag', 'manual']),
  key: z.string().optional(),
  candidateIds: z.array(z.string()).optional(),
  weights: z.array(z.number()).optional(),
  featureFlag: z.string().optional(),
  fallbackCounselorId: z.string().optional()
});

export const CreateTaskImperialDirectIntentSchema = z.object({
  enabled: z.boolean(),
  trigger: z.enum(['slash-exec', 'explicit-direct-execution', 'known-capability']),
  requestedCapability: z.string().optional(),
  reason: z.string().optional()
});

export const CreateTaskRecentTurnSchema = z.object({
  role: ChatRoleSchema,
  content: z.string()
});

export const CreateTaskDtoSchema = z.object({
  goal: z.string(),
  context: z.string().optional(),
  constraints: z.array(z.string()).optional(),
  lineage: TaskLineageRecordSchema.optional(),
  sessionId: z.string().optional(),
  requestedMode: ExecutionPlanModeSchema.optional(),
  counselorSelector: CreateTaskCounselorSelectorSchema.optional(),
  imperialDirectIntent: CreateTaskImperialDirectIntentSchema.optional(),
  requestedHints: RequestedExecutionHintsSchema.optional(),
  capabilityAttachments: z.array(CapabilityAttachmentRecordSchema).optional(),
  capabilityAugmentations: z.array(CapabilityAugmentationRecordSchema).optional(),
  conversationSummary: z.string().optional(),
  conversationCompression: ChatSessionCompressionRecordSchema.optional(),
  recentTurns: z.array(CreateTaskRecentTurnSchema).optional(),
  relatedHistory: z.array(z.string()).optional()
});

export const CreateChatSessionDtoSchema = z.object({
  message: z.string().optional(),
  title: z.string().optional(),
  channelIdentity: ChannelIdentitySchema.optional()
});

export const UpdateChatSessionDtoSchema = z.object({
  title: z.string(),
  titleSource: ChatSessionTitleSourceSchema.optional()
});

export const AppendChatMessageDtoSchema = z.object({
  message: z.string(),
  modelId: z.string().optional(),
  channelIdentity: ChannelIdentitySchema.optional()
});

export const RecoverToCheckpointDtoSchema = z.object({
  sessionId: z.string(),
  checkpointCursor: z.number().optional(),
  checkpointId: z.string().optional(),
  reason: z.string().optional()
});

export const ApprovalActionDtoSchema = z.object({
  intent: z.string().optional(),
  reason: z.string().optional(),
  actor: z.string().optional(),
  feedback: z.string().optional(),
  interrupt: ApprovalResumeInputSchema.optional()
});

export const SessionApprovalDtoSchema = ApprovalActionDtoSchema.extend({
  sessionId: z.string(),
  approvalScope: ApprovalScopeSchema.optional()
});

export const SessionCancelDtoSchema = z.object({
  sessionId: z.string(),
  actor: z.string().optional(),
  reason: z.string().optional()
});

export const CreateAgentDiagnosisTaskDtoSchema = z.object({
  taskId: z.string(),
  errorCode: z.string(),
  message: z.string(),
  goal: z.string().optional(),
  ministry: z.string().optional(),
  diagnosisHint: z.string().optional(),
  recommendedAction: z.string().optional(),
  recoveryPlaybook: z.array(z.string()).optional(),
  stack: z.string().optional()
});

export const InboundChannelAttachmentSchema = z.object({
  type: z.enum(['image', 'file', 'link', 'unknown']),
  url: z.string().optional(),
  fileId: z.string().optional(),
  mimeType: z.string().optional(),
  title: z.string().optional()
});

export const InboundChannelMessageSchema = z.object({
  channel: ChannelIdentitySchema.shape.channel,
  channelUserId: z.string(),
  channelChatId: z.string(),
  messageId: z.string(),
  text: z.string(),
  command: z.string().optional(),
  attachments: z.array(InboundChannelAttachmentSchema).optional(),
  identity: ChannelIdentitySchema.optional()
});

export const ChannelOutboundMessageSchema = z.object({
  channel: ChannelIdentitySchema.shape.channel,
  channelChatId: z.string(),
  sessionId: z.string().optional(),
  taskId: z.string().optional(),
  segment: z.enum(['planning', 'approval', 'progress', 'final']),
  title: z.string(),
  content: z.string(),
  createdAt: z.string()
});

export const CreateDocumentLearningJobDtoSchema = z.object({
  documentUri: z.string(),
  title: z.string().optional()
});

export const CreateResearchLearningJobDtoSchema = z.object({
  goal: z.string(),
  title: z.string().optional(),
  workflowId: z.string().optional(),
  preferredUrls: z.array(z.string()).optional()
});

export const LearningConfirmationDtoSchema = z.object({
  sessionId: z.string(),
  candidateIds: z.array(z.string()).optional(),
  actor: z.string().optional()
});

export const SearchMemoryScopeContextSchema = z.object({
  actorRole: z.string().optional(),
  scopeType: MemoryScopeTypeSchema.optional(),
  allowedScopeTypes: z.array(MemoryScopeTypeSchema).optional(),
  userId: z.string().optional(),
  workspaceId: z.string().optional(),
  teamId: z.string().optional(),
  orgId: z.string().optional()
});

export const SearchMemoryEntityContextSchema = z.object({
  entityType: z.enum(['user', 'project', 'repo', 'workspace', 'tool', 'connector']),
  entityId: z.string()
});

export const SearchMemoryDtoSchema = z.object({
  query: z.string(),
  limit: z.number().optional(),
  scopeContext: SearchMemoryScopeContextSchema.optional(),
  entityContext: z.array(SearchMemoryEntityContextSchema).optional(),
  memoryTypes: z.array(MemoryTypeSchema).optional(),
  includeRules: z.boolean().optional(),
  includeReflections: z.boolean().optional()
});

export const InvalidateKnowledgeDtoSchema = z.object({
  reason: z.string()
});

export const SupersedeKnowledgeDtoSchema = z.object({
  replacementId: z.string(),
  reason: z.string()
});

export const RetireKnowledgeDtoSchema = z.object({
  reason: z.string()
});

export const OverrideMemoryDtoSchema = z.object({
  summary: z.string(),
  content: z.string(),
  tags: z.array(z.string()).optional(),
  reason: z.string(),
  actor: z.string().optional(),
  memoryType: MemoryTypeSchema.optional(),
  scopeType: MemoryScopeTypeSchema.optional()
});

export const RollbackMemoryDtoSchema = z.object({
  version: z.number(),
  actor: z.string().optional()
});

export const MemoryFeedbackDtoSchema = z.object({
  kind: z.enum(['retrieved', 'injected', 'adopted', 'dismissed', 'corrected']),
  at: z.string().optional()
});

export const PatchUserProfileDtoSchema = z.object({
  communicationStyle: z.string().optional(),
  executionStyle: z.string().optional(),
  approvalStyle: z.string().optional(),
  riskTolerance: z.string().optional(),
  codingPreferences: z.array(z.string()).optional(),
  toolPreferences: z.array(z.string()).optional(),
  productFocus: z.array(z.string()).optional(),
  doNotDo: z.array(z.string()).optional(),
  privacyFlags: z.array(z.string()).optional(),
  actor: z.string().optional()
});

export const ResolveResolutionCandidateDtoSchema = z.object({
  resolution: z.enum(['accepted', 'rejected'])
});
