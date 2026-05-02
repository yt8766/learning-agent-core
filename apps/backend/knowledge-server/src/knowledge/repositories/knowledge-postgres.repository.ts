import type {
  KnowledgeBase,
  KnowledgeBaseCreateRequest,
  KnowledgeBaseMember,
  KnowledgeBaseMemberCreateRequest,
  KnowledgeBaseMemberRole
} from '@agent/core';

import type { KnowledgeRepository } from './knowledge.repository';

export interface PostgresKnowledgeClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

export class PostgresKnowledgeRepository implements KnowledgeRepository {
  constructor(private readonly client: PostgresKnowledgeClient) {}

  async createBase(
    input: KnowledgeBaseCreateRequest & { id: string; createdByUserId: string }
  ): Promise<KnowledgeBase> {
    const result = await this.client.query(
      `insert into knowledge_bases (id, name, description, created_by_user_id, status)
       values ($1, $2, $3, $4, 'active')
       returning id, name, description, created_by_user_id, status, created_at, updated_at`,
      [input.id, input.name, input.description ?? '', input.createdByUserId]
    );
    const base = mapBase(requiredRow(result.rows[0], 'knowledge base'));
    await this.addMember({ knowledgeBaseId: base.id, userId: input.createdByUserId, role: 'owner' });
    return base;
  }

  async listBasesForUser(userId: string): Promise<KnowledgeBase[]> {
    const result = await this.client.query(
      `select b.id, b.name, b.description, b.created_by_user_id, b.status, b.created_at, b.updated_at
       from knowledge_bases b
       join knowledge_base_members m on m.knowledge_base_id = b.id
       where m.user_id = $1
       order by b.updated_at desc`,
      [userId]
    );
    return result.rows.map(mapBase);
  }

  async findBase(baseId: string): Promise<KnowledgeBase | undefined> {
    const result = await this.client.query(
      `select id, name, description, created_by_user_id, status, created_at, updated_at
       from knowledge_bases
       where id = $1
       limit 1`,
      [baseId]
    );
    return result.rows[0] ? mapBase(result.rows[0]) : undefined;
  }

  async addMember(input: KnowledgeBaseMemberCreateRequest & { knowledgeBaseId: string }): Promise<KnowledgeBaseMember> {
    const result = await this.client.query(
      `insert into knowledge_base_members (knowledge_base_id, user_id, role)
       values ($1, $2, $3)
       on conflict (knowledge_base_id, user_id) do update set role = excluded.role, updated_at = now()
       returning knowledge_base_id, user_id, role, created_at, updated_at`,
      [input.knowledgeBaseId, input.userId, input.role]
    );
    return mapMember(requiredRow(result.rows[0], 'knowledge base member'));
  }

  async findMember(baseId: string, userId: string): Promise<KnowledgeBaseMember | undefined> {
    const result = await this.client.query(
      `select knowledge_base_id, user_id, role, created_at, updated_at
       from knowledge_base_members
       where knowledge_base_id = $1 and user_id = $2
       limit 1`,
      [baseId, userId]
    );
    return result.rows[0] ? mapMember(result.rows[0]) : undefined;
  }

  async listMembers(baseId: string): Promise<KnowledgeBaseMember[]> {
    const result = await this.client.query(
      `select knowledge_base_id, user_id, role, created_at, updated_at
       from knowledge_base_members
       where knowledge_base_id = $1
       order by user_id`,
      [baseId]
    );
    return result.rows.map(mapMember);
  }
}

function mapBase(row: Record<string, unknown>): KnowledgeBase {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? ''),
    createdByUserId: String(row.created_by_user_id),
    status: row.status as KnowledgeBase['status'],
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function mapMember(row: Record<string, unknown>): KnowledgeBaseMember {
  return {
    knowledgeBaseId: String(row.knowledge_base_id),
    userId: String(row.user_id),
    role: row.role as KnowledgeBaseMemberRole,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function toIsoString(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

function requiredRow(row: Record<string, unknown> | undefined, name: string): Record<string, unknown> {
  if (!row) {
    throw new Error(`Missing ${name} row`);
  }
  return row;
}
