import { Module } from '@nestjs/common';

import { IdentityController } from '../../api/identity/identity.controller';
import { LegacyAuthController } from '../../api/identity/legacy-auth.controller';
import { IdentityAuthService } from './services/identity-auth.service';

@Module({
  controllers: [IdentityController, LegacyAuthController],
  providers: [IdentityAuthService],
  exports: [IdentityAuthService]
})
export class IdentityModule {}
