import { Injectable, type OnModuleInit } from '@nestjs/common';

import { PasswordHasherProvider } from './password-hasher.provider';
import type { AuthRepository } from './repositories/auth.repository';

export interface AuthSeedOptions {
  adminUsername: string;
  adminPassword: string;
  adminDisplayName: string;
}

@Injectable()
export class AuthSeedService implements OnModuleInit {
  constructor(
    private readonly repository: AuthRepository,
    private readonly hasher: PasswordHasherProvider,
    private readonly options: AuthSeedOptions
  ) {}

  async onModuleInit(): Promise<void> {
    const username = this.options.adminUsername.trim();
    const password = this.options.adminPassword;
    if (!username || !password) {
      return;
    }

    const existing = await this.repository.findUserByUsername(username);
    if (existing) {
      return;
    }

    await this.repository.createUser({
      id: createSeedUserId(username),
      username,
      displayName: this.options.adminDisplayName.trim() || username,
      roles: ['admin'],
      status: 'enabled',
      passwordHash: await this.hasher.hash(password)
    });
  }
}

function createSeedUserId(username: string): string {
  return `user_${
    username
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'admin'
  }`;
}
