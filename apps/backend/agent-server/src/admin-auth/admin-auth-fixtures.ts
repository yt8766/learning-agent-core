import type { PasswordHasherProvider } from './password-hasher.provider';
import type { AdminAuthMemoryFixtures } from './repositories/admin-auth-memory.repository';

export async function createDefaultAdminAuthFixtures(
  passwordHasher: PasswordHasherProvider
): Promise<AdminAuthMemoryFixtures> {
  const now = '2026-04-30T00:00:00.000Z';
  return {
    accounts: [
      {
        id: 'admin_001',
        username: 'admin',
        displayName: '平台管理员',
        roles: ['super_admin'],
        status: 'enabled',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'admin_002',
        username: 'developer',
        displayName: '开发者',
        roles: ['developer'],
        status: 'enabled',
        createdAt: now,
        updatedAt: now
      }
    ],
    credentials: [
      {
        id: 'cred_admin_001',
        accountId: 'admin_001',
        passwordHash: await passwordHasher.hashPassword('rust123@'),
        passwordVersion: 1,
        failedCount: 0,
        passwordUpdatedAt: now,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'cred_admin_002',
        accountId: 'admin_002',
        passwordHash: await passwordHasher.hashPassword('developer-password-123'),
        passwordVersion: 1,
        failedCount: 0,
        passwordUpdatedAt: now,
        createdAt: now,
        updatedAt: now
      }
    ]
  };
}
