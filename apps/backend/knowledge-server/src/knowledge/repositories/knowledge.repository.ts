import type {
  KnowledgeBase,
  KnowledgeBaseCreateRequest,
  KnowledgeBaseMember,
  KnowledgeBaseMemberCreateRequest
} from '@agent/core';

export interface KnowledgeRepository {
  createBase(input: KnowledgeBaseCreateRequest & { id: string; createdByUserId: string }): Promise<KnowledgeBase>;
  listBasesForUser(userId: string): Promise<KnowledgeBase[]>;
  findBase(baseId: string): Promise<KnowledgeBase | undefined>;
  addMember(input: KnowledgeBaseMemberCreateRequest & { knowledgeBaseId: string }): Promise<KnowledgeBaseMember>;
  findMember(baseId: string, userId: string): Promise<KnowledgeBaseMember | undefined>;
  listMembers(baseId: string): Promise<KnowledgeBaseMember[]>;
}
