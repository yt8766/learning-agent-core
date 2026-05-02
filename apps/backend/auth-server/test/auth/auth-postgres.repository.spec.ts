import { describe, expect, it } from 'vitest';

import { PostgresAuthRepository } from '../../src/auth/repositories/auth-postgres.repository';

describe('PostgresAuthRepository', () => {
  it('maps auth users from database rows', async () => {
    const repository = new PostgresAuthRepository({
      query: async () => ({
        rows: [
          {
            id: 'user_1',
            username: 'admin',
            display_name: 'Admin',
            global_roles: ['admin'],
            status: 'enabled',
            password_hash: 'salt:hash'
          }
        ]
      })
    });

    await expect(repository.findUserByUsername('admin')).resolves.toMatchObject({
      id: 'user_1',
      displayName: 'Admin',
      roles: ['admin']
    });
  });
});
