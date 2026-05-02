import { randomUUID } from 'node:crypto';
import type {
  KnowledgeBaseCreateRequest,
  KnowledgeBaseMemberCreateRequest,
  KnowledgeBaseMembersResponse,
  KnowledgeBaseResponse,
  KnowledgeBasesListResponse
} from '@agent/core';

import { KnowledgeServiceError } from './knowledge.errors';
import type { KnowledgeRepository } from './repositories/knowledge.repository';

export interface KnowledgeActor {
  userId: string;
}

export class KnowledgeService {
  constructor(private readonly repository: KnowledgeRepository) {}

  async createBase(actor: KnowledgeActor, input: KnowledgeBaseCreateRequest): Promise<KnowledgeBaseResponse['base']> {
    return this.repository.createBase({
      id: `kb_${randomUUID()}`,
      name: input.name,
      description: input.description ?? '',
      createdByUserId: actor.userId
    });
  }

  async listBases(actor: KnowledgeActor): Promise<KnowledgeBasesListResponse> {
    return { bases: await this.repository.listBasesForUser(actor.userId) };
  }

  async addMember(
    actor: KnowledgeActor,
    baseId: string,
    input: KnowledgeBaseMemberCreateRequest
  ): Promise<KnowledgeBaseMembersResponse['members'][number]> {
    await this.assertCanManageMembers(actor.userId, baseId);
    return this.repository.addMember({ knowledgeBaseId: baseId, userId: input.userId, role: input.role });
  }

  async listMembers(actor: KnowledgeActor, baseId: string): Promise<KnowledgeBaseMembersResponse> {
    await this.assertCanView(actor.userId, baseId);
    return { members: await this.repository.listMembers(baseId) };
  }

  private async assertCanView(userId: string, baseId: string): Promise<void> {
    const member = await this.repository.findMember(baseId, userId);
    if (!member) {
      throw new KnowledgeServiceError('knowledge_permission_denied', '无权访问该知识库');
    }
  }

  private async assertCanManageMembers(userId: string, baseId: string): Promise<void> {
    const member = await this.repository.findMember(baseId, userId);
    if (!member || member.role !== 'owner') {
      throw new KnowledgeServiceError('knowledge_permission_denied', '无权管理知识库成员');
    }
  }
}
