import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { AuthAccount, AuthUserCreateRequest, AuthUsersListResponse } from '@agent/core';

import {
  IDENTITY_REPOSITORY,
  type IdentityRepository,
  type IdentityUserRecord
} from '../repositories/identity.repository';
import { IdentityPasswordService } from './identity-password.service';

@Injectable()
export class IdentityUserService {
  constructor(
    @Inject(IDENTITY_REPOSITORY) private readonly repository: IdentityRepository,
    private readonly password: IdentityPasswordService
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
      passwordHash: await this.password.hash(input.password)
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

function toAccount(user: IdentityUserRecord): AuthAccount {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    roles: user.roles,
    status: user.status
  };
}
