import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';

import { IDENTITY_REPOSITORY, type IdentityRepository } from '../repositories/identity.repository';
import { IdentityPasswordService } from './identity-password.service';

export const IDENTITY_SEED_OPTIONS = Symbol('IdentitySeedOptions');

export interface IdentitySeedOptions {
  adminUsername: string;
  adminPassword: string;
  adminDisplayName: string;
}

@Injectable()
export class IdentitySeedService implements OnModuleInit {
  constructor(
    @Inject(IDENTITY_REPOSITORY) private readonly repository: IdentityRepository,
    private readonly password: IdentityPasswordService,
    @Inject(IDENTITY_SEED_OPTIONS) private readonly options: IdentitySeedOptions
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
      passwordHash: await this.password.hash(password)
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
