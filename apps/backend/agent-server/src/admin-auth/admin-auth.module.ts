import { Module } from '@nestjs/common';

import { AdminAuthController } from './admin-auth.controller';
import { createDefaultAdminAuthFixtures } from './admin-auth-fixtures';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtProvider } from './admin-jwt.provider';
import { PasswordHasherProvider } from './password-hasher.provider';
import { AdminAuthMemoryRepository } from './repositories/admin-auth-memory.repository';
import { AdminAuthRepository } from './repositories/admin-auth.repository';

@Module({
  controllers: [AdminAuthController],
  providers: [
    AdminAuthGuard,
    AdminAuthService,
    AdminJwtProvider,
    PasswordHasherProvider,
    {
      provide: AdminAuthRepository,
      useFactory: async (passwordHasher: PasswordHasherProvider) =>
        new AdminAuthMemoryRepository(await createDefaultAdminAuthFixtures(passwordHasher)),
      inject: [PasswordHasherProvider]
    }
  ],
  exports: [AdminAuthService]
})
export class AdminAuthModule {}
