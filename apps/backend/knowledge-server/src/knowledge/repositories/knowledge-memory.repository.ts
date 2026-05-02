import { Injectable } from '@nestjs/common';
import type {
  KnowledgeBase,
  KnowledgeBaseCreateRequest,
  KnowledgeBaseMember,
  KnowledgeBaseMemberCreateRequest
} from '@agent/core';

import type { KnowledgeRepository } from './knowledge.repository';

@Injectable()
export class InMemoryKnowledgeRepository implements KnowledgeRepository {
  private readonly bases = new Map<string, KnowledgeBase>();
  private readonly members = new Map<string, KnowledgeBaseMember>();

  async createBase(
    input: KnowledgeBaseCreateRequest & { id: string; createdByUserId: string }
  ): Promise<KnowledgeBase> {
    const now = new Date().toISOString();
    const base: KnowledgeBase = {
      id: input.id,
      name: input.name,
      description: input.description ?? '',
      createdByUserId: input.createdByUserId,
      status: 'active',
      createdAt: now,
      updatedAt: now
    };
    this.bases.set(base.id, base);
    await this.addMember({ knowledgeBaseId: base.id, userId: input.createdByUserId, role: 'owner' });
    return base;
  }

  async listBasesForUser(userId: string): Promise<KnowledgeBase[]> {
    const baseIds = [...this.members.values()]
      .filter(member => member.userId === userId)
      .map(member => member.knowledgeBaseId);
    return baseIds.map(baseId => this.bases.get(baseId)).filter((base): base is KnowledgeBase => Boolean(base));
  }

  async findBase(baseId: string): Promise<KnowledgeBase | undefined> {
    return this.bases.get(baseId);
  }

  async addMember(input: KnowledgeBaseMemberCreateRequest & { knowledgeBaseId: string }): Promise<KnowledgeBaseMember> {
    const now = new Date().toISOString();
    const member: KnowledgeBaseMember = {
      knowledgeBaseId: input.knowledgeBaseId,
      userId: input.userId,
      role: input.role,
      createdAt: now,
      updatedAt: now
    };
    this.members.set(`${member.knowledgeBaseId}:${member.userId}`, member);
    return member;
  }

  async findMember(baseId: string, userId: string): Promise<KnowledgeBaseMember | undefined> {
    return this.members.get(`${baseId}:${userId}`);
  }

  async listMembers(baseId: string): Promise<KnowledgeBaseMember[]> {
    return [...this.members.values()].filter(member => member.knowledgeBaseId === baseId);
  }
}
