import { describe, expect, it } from 'vitest';

import {
  AuthGlobalRoleSchema,
  AuthLoginResponseSchema,
  AuthUserCreateRequestSchema,
  KnowledgeBaseMemberRoleSchema,
  KnowledgeBaseMemberSchema,
  KnowledgeBaseSchema
} from '../src';

describe('auth and knowledge service contracts', () => {
  it('parses auth login responses without business-domain permissions', () => {
    const parsed = AuthLoginResponseSchema.parse({
      account: {
        id: 'user_123',
        username: 'alice',
        displayName: 'Alice',
        roles: ['admin'],
        status: 'enabled',
        permissions: ['knowledge:bases:manage'],
        knowledgeBaseRoles: [{ knowledgeBaseId: 'kb_123', role: 'owner' }]
      },
      session: {
        id: 'sess_123',
        expiresAt: '2026-05-30T12:00:00.000Z'
      },
      tokens: {
        tokenType: 'Bearer',
        accessToken: 'access.jwt.value',
        accessTokenExpiresAt: '2026-05-02T12:15:00.000Z',
        refreshToken: 'refresh-token',
        refreshTokenExpiresAt: '2026-05-30T12:00:00.000Z'
      }
    });

    expect(parsed.account.roles).toEqual(['admin']);
    expect('permissions' in parsed.account).toBe(false);
    expect('knowledgeBaseRoles' in parsed.account).toBe(false);
  });

  it('parses user creation requests for admin-managed identity', () => {
    expect(
      AuthUserCreateRequestSchema.parse({
        username: 'bob',
        displayName: 'Bob',
        password: 'local-password',
        roles: ['knowledge_user']
      })
    ).toMatchObject({ username: 'bob' });
  });

  it('parses knowledge bases and membership roles separately from auth roles', () => {
    expect(
      KnowledgeBaseSchema.parse({
        id: 'kb_123',
        name: 'Engineering KB',
        description: 'Internal engineering notes',
        createdByUserId: 'user_123',
        status: 'active',
        createdAt: '2026-05-02T12:00:00.000Z',
        updatedAt: '2026-05-02T12:00:00.000Z'
      })
    ).toMatchObject({ id: 'kb_123' });

    expect(
      KnowledgeBaseMemberSchema.parse({
        knowledgeBaseId: 'kb_123',
        userId: 'user_456',
        role: 'viewer',
        createdAt: '2026-05-02T12:00:00.000Z',
        updatedAt: '2026-05-02T12:00:00.000Z'
      })
    ).toMatchObject({ role: 'viewer' });
  });

  it('rejects knowledge member roles from auth global roles', () => {
    for (const role of ['owner', 'editor', 'viewer']) {
      expect(AuthGlobalRoleSchema.safeParse(role).success).toBe(false);
    }
  });

  it('rejects auth global roles from knowledge member roles', () => {
    for (const role of ['admin', 'knowledge_user', 'super_admin']) {
      expect(KnowledgeBaseMemberRoleSchema.safeParse(role).success).toBe(false);
    }
  });
});
