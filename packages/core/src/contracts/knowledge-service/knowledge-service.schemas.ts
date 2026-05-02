import { z } from 'zod';

export const KnowledgeBaseStatusSchema = z.enum(['active', 'archived']);

export const KnowledgeBaseMemberRoleSchema = z.enum(['owner', 'editor', 'viewer']);

export const KnowledgeServiceUserSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  displayName: z.string().min(1)
});

export const KnowledgeBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  createdByUserId: z.string().min(1),
  status: KnowledgeBaseStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const KnowledgeBaseCreateRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default('')
});

export const KnowledgeBaseMemberSchema = z.object({
  knowledgeBaseId: z.string().min(1),
  userId: z.string().min(1),
  role: KnowledgeBaseMemberRoleSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const KnowledgeBaseMemberCreateRequestSchema = z.object({
  userId: z.string().min(1),
  role: KnowledgeBaseMemberRoleSchema
});

export const KnowledgeBaseMemberUpdateRequestSchema = z.object({
  role: KnowledgeBaseMemberRoleSchema
});

export const KnowledgeMeResponseSchema = z.object({
  user: KnowledgeServiceUserSchema
});

export const KnowledgeBasesListResponseSchema = z.object({
  bases: z.array(KnowledgeBaseSchema)
});

export const KnowledgeBaseResponseSchema = z.object({
  base: KnowledgeBaseSchema
});

export const KnowledgeBaseMembersResponseSchema = z.object({
  members: z.array(KnowledgeBaseMemberSchema)
});

export const KnowledgeServiceErrorCodeSchema = z.enum([
  'auth_required',
  'knowledge_base_not_found',
  'knowledge_permission_denied',
  'member_not_found',
  'invalid_member_role',
  'internal_error'
]);

export const KnowledgeServiceErrorResponseSchema = z.object({
  error: z.object({
    code: KnowledgeServiceErrorCodeSchema,
    message: z.string().min(1),
    requestId: z.string().min(1)
  })
});
