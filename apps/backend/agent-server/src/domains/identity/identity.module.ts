import { Module } from '@nestjs/common';

import { IdentityController } from '../../api/identity/identity.controller';
import { LegacyAuthController } from '../../api/identity/legacy-auth.controller';
import { IDENTITY_REPOSITORY } from './repositories/identity.repository';
import { IdentityMemoryRepository } from './repositories/identity-memory.repository';
import { IdentityAuthService } from './services/identity-auth.service';
import { IDENTITY_JWT_OPTIONS, IdentityJwtProvider } from './services/identity-jwt.provider';
import { IdentityPasswordService } from './services/identity-password.service';
import { IDENTITY_SEED_OPTIONS, IdentitySeedService } from './services/identity-seed.service';
import { IdentityUserService } from './services/identity-user.service';

@Module({
  controllers: [IdentityController, LegacyAuthController],
  providers: [
    { provide: IDENTITY_REPOSITORY, useClass: IdentityMemoryRepository },
    IdentityAuthService,
    IdentityUserService,
    IdentityPasswordService,
    IdentityJwtProvider,
    IdentitySeedService,
    {
      provide: IDENTITY_JWT_OPTIONS,
      useFactory: () => ({
        secret: process.env.IDENTITY_JWT_SECRET ?? process.env.AUTH_JWT_SECRET ?? 'dev-identity-secret',
        issuer: process.env.IDENTITY_JWT_ISSUER ?? 'agent-server-identity'
      })
    },
    {
      provide: IDENTITY_SEED_OPTIONS,
      useFactory: () => ({
        adminUsername: process.env.IDENTITY_ADMIN_USERNAME ?? process.env.AUTH_ADMIN_USERNAME ?? '',
        adminPassword: process.env.IDENTITY_ADMIN_PASSWORD ?? process.env.AUTH_ADMIN_PASSWORD ?? '',
        adminDisplayName: process.env.IDENTITY_ADMIN_DISPLAY_NAME ?? process.env.AUTH_ADMIN_DISPLAY_NAME ?? ''
      })
    }
  ],
  exports: [IdentityAuthService, IdentityUserService]
})
export class IdentityModule {}
