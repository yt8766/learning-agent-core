import { z } from 'zod';

import {
  ApprovalActionDtoSchema,
  AppendChatMessageDtoSchema,
  ChannelOutboundMessageSchema,
  CreateChatSessionDtoSchema,
  CreateAgentDiagnosisTaskDtoSchema,
  CreateDocumentLearningJobDtoSchema,
  CreateResearchLearningJobDtoSchema,
  CreateTaskCounselorSelectorSchema,
  CreateTaskDtoSchema,
  CreateTaskImperialDirectIntentSchema,
  CreateTaskRecentTurnSchema,
  InboundChannelAttachmentSchema,
  InboundChannelMessageSchema,
  LearningConfirmationDtoSchema,
  InvalidateKnowledgeDtoSchema,
  MemoryFeedbackDtoSchema,
  OverrideMemoryDtoSchema,
  PatchUserProfileDtoSchema,
  RecoverToCheckpointDtoSchema,
  ResolveResolutionCandidateDtoSchema,
  RetireKnowledgeDtoSchema,
  RollbackMemoryDtoSchema,
  SearchMemoryDtoSchema,
  SearchMemoryEntityContextSchema,
  SearchMemoryScopeContextSchema,
  SessionApprovalDtoSchema,
  SessionCancelDtoSchema,
  SupersedeKnowledgeDtoSchema,
  UpdateChatSessionDtoSchema
} from '../schemas/channels.schema';

export type CreateTaskCounselorSelector = z.infer<typeof CreateTaskCounselorSelectorSchema>;
export type CreateTaskImperialDirectIntent = z.infer<typeof CreateTaskImperialDirectIntentSchema>;
export type CreateTaskRecentTurn = z.infer<typeof CreateTaskRecentTurnSchema>;
export type CreateTaskDto = z.infer<typeof CreateTaskDtoSchema>;
export type CreateAgentDiagnosisTaskDto = z.infer<typeof CreateAgentDiagnosisTaskDtoSchema>;
export type CreateChatSessionDto = z.infer<typeof CreateChatSessionDtoSchema>;
export type UpdateChatSessionDto = z.infer<typeof UpdateChatSessionDtoSchema>;
export type AppendChatMessageDto = z.infer<typeof AppendChatMessageDtoSchema>;
export type InboundChannelAttachment = z.infer<typeof InboundChannelAttachmentSchema>;
export type InboundChannelMessage = z.infer<typeof InboundChannelMessageSchema>;
export type ChannelOutboundMessage = z.infer<typeof ChannelOutboundMessageSchema>;
export type RecoverToCheckpointDto = z.infer<typeof RecoverToCheckpointDtoSchema>;
export type ApprovalActionDto = z.infer<typeof ApprovalActionDtoSchema>;
export type SessionApprovalDto = z.infer<typeof SessionApprovalDtoSchema>;
export type SessionCancelDto = z.infer<typeof SessionCancelDtoSchema>;
export type CreateDocumentLearningJobDto = z.infer<typeof CreateDocumentLearningJobDtoSchema>;
export type CreateResearchLearningJobDto = z.infer<typeof CreateResearchLearningJobDtoSchema>;
export type LearningConfirmationDto = z.infer<typeof LearningConfirmationDtoSchema>;
export type SearchMemoryScopeContext = z.infer<typeof SearchMemoryScopeContextSchema>;
export type SearchMemoryEntityContext = z.infer<typeof SearchMemoryEntityContextSchema>;
export type SearchMemoryDto = z.infer<typeof SearchMemoryDtoSchema>;
export type InvalidateKnowledgeDto = z.infer<typeof InvalidateKnowledgeDtoSchema>;
export type SupersedeKnowledgeDto = z.infer<typeof SupersedeKnowledgeDtoSchema>;
export type RetireKnowledgeDto = z.infer<typeof RetireKnowledgeDtoSchema>;
export type OverrideMemoryDto = z.infer<typeof OverrideMemoryDtoSchema>;
export type RollbackMemoryDto = z.infer<typeof RollbackMemoryDtoSchema>;
export type MemoryFeedbackDto = z.infer<typeof MemoryFeedbackDtoSchema>;
export type PatchUserProfileDto = z.infer<typeof PatchUserProfileDtoSchema>;
export type ResolveResolutionCandidateDto = z.infer<typeof ResolveResolutionCandidateDtoSchema>;
