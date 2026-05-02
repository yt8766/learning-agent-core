import type { z } from 'zod';

import type {
  KnowledgeBaseCreateRequestSchema,
  KnowledgeBaseMemberCreateRequestSchema,
  KnowledgeBaseMemberRoleSchema,
  KnowledgeBaseMemberSchema,
  KnowledgeBaseMembersResponseSchema,
  KnowledgeBaseMemberUpdateRequestSchema,
  KnowledgeBaseResponseSchema,
  KnowledgeBasesListResponseSchema,
  KnowledgeBaseSchema,
  KnowledgeBaseStatusSchema,
  KnowledgeMeResponseSchema,
  KnowledgeServiceErrorCodeSchema,
  KnowledgeServiceErrorResponseSchema,
  KnowledgeServiceUserSchema
} from './knowledge-service.schemas';

export type KnowledgeBaseStatus = z.infer<typeof KnowledgeBaseStatusSchema>;
export type KnowledgeBaseMemberRole = z.infer<typeof KnowledgeBaseMemberRoleSchema>;
export type KnowledgeServiceUser = z.infer<typeof KnowledgeServiceUserSchema>;
export type KnowledgeBase = z.infer<typeof KnowledgeBaseSchema>;
export type KnowledgeBaseCreateRequest = z.infer<typeof KnowledgeBaseCreateRequestSchema>;
export type KnowledgeBaseMember = z.infer<typeof KnowledgeBaseMemberSchema>;
export type KnowledgeBaseMemberCreateRequest = z.infer<typeof KnowledgeBaseMemberCreateRequestSchema>;
export type KnowledgeBaseMemberUpdateRequest = z.infer<typeof KnowledgeBaseMemberUpdateRequestSchema>;
export type KnowledgeMeResponse = z.infer<typeof KnowledgeMeResponseSchema>;
export type KnowledgeBasesListResponse = z.infer<typeof KnowledgeBasesListResponseSchema>;
export type KnowledgeBaseResponse = z.infer<typeof KnowledgeBaseResponseSchema>;
export type KnowledgeBaseMembersResponse = z.infer<typeof KnowledgeBaseMembersResponseSchema>;
export type KnowledgeServiceErrorCode = z.infer<typeof KnowledgeServiceErrorCodeSchema>;
export type KnowledgeServiceErrorResponse = z.infer<typeof KnowledgeServiceErrorResponseSchema>;
