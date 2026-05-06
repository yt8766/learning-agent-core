import { randomUUID } from 'node:crypto';
import type { AuthAccount, AuthUserCreateRequest, AuthUsersListResponse } from '@agent/core';

import { PasswordHasherProvider } from './password-hasher.provider';
import type { AuthRepository, AuthUserRecord } from './repositories/auth.repository';

export class UserManagementService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly hasher: PasswordHasherProvider
  ) {}

  async listUsers(): Promise<AuthUsersListResponse> {
    const users = await this.repository.listUsers();
    return { users: users.map(toAccount) };
  }

  async createUser(input: AuthUserCreateRequest): Promise<AuthAccount> {
    const user = await this.repository.createUser({
      id: `user_${randomUUID()}`,
      username: input.username,
      displayName: input.displayName,
      roles: input.roles,
      status: 'enabled',
      passwordHash: await this.hasher.hash(input.password)
    });
    return toAccount(user);
  }

  async disableUser(userId: string): Promise<AuthAccount> {
    return toAccount(await this.repository.updateUserStatus(userId, 'disabled'));
  }

  async enableUser(userId: string): Promise<AuthAccount> {
    return toAccount(await this.repository.updateUserStatus(userId, 'enabled'));
  }
}

function toAccount(user: AuthUserRecord): AuthAccount {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    roles: user.roles,
    status: user.status
  };
}
