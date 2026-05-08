import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Optional } from '@nestjs/common';
import type {
  KnowledgeBaseCreateRequest,
  KnowledgeBaseMemberCreateRequest,
  KnowledgeBaseMembersResponse,
  KnowledgeBaseResponse,
  KnowledgeBasesListResponse
} from '@agent/core';

import { KNOWLEDGE_REPOSITORY } from '../knowledge-domain.tokens';
import type { KnowledgeRepository } from '../repositories/knowledge.repository';
import { KnowledgeMemoryRepository } from '../repositories/knowledge-memory.repository';
import { KnowledgeServiceError } from './knowledge-service.error';

export interface KnowledgeActor {
  userId: string;
}

@Injectable()
export class KnowledgeBaseService {
  constructor(
    @Optional()
    @Inject(KNOWLEDGE_REPOSITORY)
    private readonly repository: KnowledgeRepository = new KnowledgeMemoryRepository()
  ) {}

  async createBase(actor: KnowledgeActor, input: KnowledgeBaseCreateRequest): Promise<KnowledgeBaseResponse['base']> {
    return this.repository.createBase({
      id: `kb_${randomUUID()}`,
      name: input.name,
      description: input.description ?? '',
      createdByUserId: actor.userId
    });
  }

  async listBases(actor?: KnowledgeActor): Promise<KnowledgeBasesListResponse['bases']> {
    if (!actor) {
      return [];
    }

    return this.repository.listBases({ userId: actor.userId });
  }

  async listBasesResponse(actor: KnowledgeActor): Promise<KnowledgeBasesListResponse> {
    return { bases: await this.repository.listBases({ userId: actor.userId }) };
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
