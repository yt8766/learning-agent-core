import { describe, expect, it, vi } from 'vitest';

import {
  IdentityPostgresRepository,
  type PostgresIdentityClient
} from '../../src/domains/identity/repositories/identity-postgres.repository';

function createMockClient(rows: Array<Record<string, unknown>> = []): PostgresIdentityClient {
  return {
    query: vi.fn().mockResolvedValue({ rows })
  };
}

describe('IdentityPostgresRepository', () => {
  describe('createUser', () => {
    it('inserts a user and returns the mapped record', async () => {
      const row = {
        id: 'u-1',
        username: 'alice',
        display_name: 'Alice',
        global_roles: '{admin}',
        status: 'enabled',
        password_hash: 'hashed'
      };
      const client = createMockClient([row]);
      const repo = new IdentityPostgresRepository(client);

      const result = await repo.createUser({
        id: 'u-1',
        username: 'alice',
        displayName: 'Alice',
        roles: ['admin'],
        status: 'enabled',
        passwordHash: 'hashed'
      });

      expect(result).toEqual({
        id: 'u-1',
        username: 'alice',
        displayName: 'Alice',
        roles: ['admin'],
        status: 'enabled',
        passwordHash: 'hashed'
      });
      expect(client.query).toHaveBeenCalledTimes(1);
    });

    it('throws when no row is returned', async () => {
      const client = createMockClient([]);
      const repo = new IdentityPostgresRepository(client);

      await expect(
        repo.createUser({
          id: 'u-1',
          username: 'alice',
          displayName: 'Alice',
          roles: ['admin'],
          status: 'enabled',
          passwordHash: 'hashed'
        })
      ).rejects.toThrow('Missing identity user row');
    });
  });

  describe('findUserByUsername', () => {
    it('returns a user when found', async () => {
      const row = {
        id: 'u-1',
        username: 'alice',
        display_name: 'Alice',
        global_roles: '{admin}',
        status: 'enabled',
        password_hash: 'hashed'
      };
      const client = createMockClient([row]);
      const repo = new IdentityPostgresRepository(client);

      const result = await repo.findUserByUsername('alice');

      expect(result).toBeDefined();
      expect(result!.username).toBe('alice');
    });

    it('returns undefined when not found', async () => {
      const client = createMockClient([]);
      const repo = new IdentityPostgresRepository(client);

      const result = await repo.findUserByUsername('missing');

      expect(result).toBeUndefined();
    });
  });

  describe('findUserById', () => {
    it('returns a user when found', async () => {
      const row = {
        id: 'u-1',
        username: 'alice',
        display_name: 'Alice',
        global_roles: '{admin}',
        status: 'enabled',
        password_hash: 'hashed'
      };
      const client = createMockClient([row]);
      const repo = new IdentityPostgresRepository(client);

      const result = await repo.findUserById('u-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('u-1');
    });

    it('returns undefined when not found', async () => {
      const client = createMockClient([]);
      const repo = new IdentityPostgresRepository(client);

      const result = await repo.findUserById('missing');

      expect(result).toBeUndefined();
    });
  });

  describe('listUsers', () => {
    it('returns all users', async () => {
      const rows = [
        {
          id: 'u-1',
          username: 'alice',
          display_name: 'Alice',
          global_roles: '{admin}',
          status: 'enabled',
          password_hash: 'h1'
        },
        {
          id: 'u-2',
          username: 'bob',
          display_name: 'Bob',
          global_roles: '{viewer}',
          status: 'enabled',
          password_hash: 'h2'
        }
      ];
      const client = createMockClient(rows);
      const repo = new IdentityPostgresRepository(client);

      const result = await repo.listUsers();

      expect(result).toHaveLength(2);
      expect(result[0].username).toBe('alice');
      expect(result[1].username).toBe('bob');
    });
  });

  describe('updateUserStatus', () => {
    it('updates status and returns the mapped record', async () => {
      const row = {
        id: 'u-1',
        username: 'alice',
        display_name: 'Alice',
        global_roles: '{admin}',
        status: 'disabled',
        password_hash: 'hashed'
      };
      const client = createMockClient([row]);
      const repo = new IdentityPostgresRepository(client);

      const result = await repo.updateUserStatus('u-1', 'disabled');

      expect(result.status).toBe('disabled');
    });
  });

  describe('updateUserPassword', () => {
    it('calls query to update password hash', async () => {
      const client = createMockClient();
      const repo = new IdentityPostgresRepository(client);

      await repo.updateUserPassword('u-1', 'new-hash');

      expect(client.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('createSession', () => {
    it('creates a session and returns the input', async () => {
      const client = createMockClient();
      const repo = new IdentityPostgresRepository(client);
      const input = { id: 's-1', userId: 'u-1', status: 'active' as const, expiresAt: '2026-06-01T00:00:00.000Z' };

      const result = await repo.createSession(input);

      expect(result).toEqual(input);
      expect(client.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('findSession', () => {
    it('returns a session when found', async () => {
      const row = { id: 's-1', user_id: 'u-1', status: 'active', expires_at: '2026-06-01T00:00:00.000Z' };
      const client = createMockClient([row]);
      const repo = new IdentityPostgresRepository(client);

      const result = await repo.findSession('s-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('s-1');
      expect(result!.userId).toBe('u-1');
    });

    it('returns undefined when not found', async () => {
      const client = createMockClient([]);
      const repo = new IdentityPostgresRepository(client);

      const result = await repo.findSession('missing');

      expect(result).toBeUndefined();
    });
  });

  describe('revokeSession', () => {
    it('calls query to revoke the session', async () => {
      const client = createMockClient();
      const repo = new IdentityPostgresRepository(client);

      await repo.revokeSession('s-1', 'logout');

      expect(client.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('createRefreshToken', () => {
    it('creates a refresh token and returns the input', async () => {
      const client = createMockClient();
      const repo = new IdentityPostgresRepository(client);
      const input = {
        id: 'rt-1',
        sessionId: 's-1',
        tokenHash: 'hash',
        status: 'active' as const,
        expiresAt: '2026-06-01T00:00:00.000Z'
      };

      const result = await repo.createRefreshToken(input);

      expect(result).toEqual(input);
    });
  });

  describe('findRefreshTokenByHash', () => {
    it('returns a refresh token when found', async () => {
      const row = {
        id: 'rt-1',
        session_id: 's-1',
        token_hash: 'hash',
        status: 'active',
        expires_at: '2026-06-01T00:00:00.000Z',
        replaced_by_token_id: null
      };
      const client = createMockClient([row]);
      const repo = new IdentityPostgresRepository(client);

      const result = await repo.findRefreshTokenByHash('hash');

      expect(result).toBeDefined();
      expect(result!.id).toBe('rt-1');
      expect(result!.replacedByTokenId).toBeUndefined();
    });

    it('returns undefined when not found', async () => {
      const client = createMockClient([]);
      const repo = new IdentityPostgresRepository(client);

      const result = await repo.findRefreshTokenByHash('missing');

      expect(result).toBeUndefined();
    });

    it('maps replaced_by_token_id when present', async () => {
      const row = {
        id: 'rt-1',
        session_id: 's-1',
        token_hash: 'hash',
        status: 'used',
        expires_at: '2026-06-01T00:00:00.000Z',
        replaced_by_token_id: 'rt-2'
      };
      const client = createMockClient([row]);
      const repo = new IdentityPostgresRepository(client);

      const result = await repo.findRefreshTokenByHash('hash');

      expect(result!.replacedByTokenId).toBe('rt-2');
    });
  });

  describe('markRefreshTokenUsed', () => {
    it('calls query to mark token as used', async () => {
      const client = createMockClient();
      const repo = new IdentityPostgresRepository(client);

      await repo.markRefreshTokenUsed('rt-1', 'rt-2');

      expect(client.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('mapRoles', () => {
    it('handles array role values', async () => {
      const row = {
        id: 'u-1',
        username: 'alice',
        display_name: 'Alice',
        global_roles: ['admin', 'developer'],
        status: 'enabled',
        password_hash: 'hashed'
      };
      const client = createMockClient([row]);
      const repo = new IdentityPostgresRepository(client);

      const result = await repo.findUserById('u-1');

      expect(result!.roles).toEqual(['admin', 'developer']);
    });

    it('handles postgres array string format', async () => {
      const row = {
        id: 'u-1',
        username: 'alice',
        display_name: 'Alice',
        global_roles: '{admin,developer}',
        status: 'enabled',
        password_hash: 'hashed'
      };
      const client = createMockClient([row]);
      const repo = new IdentityPostgresRepository(client);

      const result = await repo.findUserById('u-1');

      expect(result!.roles).toEqual(['admin', 'developer']);
    });
  });
});
