import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { AuthController } from './auth.controller';
import { AuthExceptionFilter } from './filters/auth-exception.filter';
import { AuthAdminGuard } from './guards/auth-admin.guard';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { AUTH_REPOSITORY } from './auth.tokens';
import { JwtProvider } from './jwt.provider';
import { PasswordHasherProvider } from './password-hasher.provider';
import type { AuthRepository } from './repositories/auth.repository';
import { createAuthRepositoryProvider } from './runtime/auth-repository.provider';
import { UserManagementController } from './user-management.controller';
import { UserManagementService } from './user-management.service';

@Module({
  controllers: [AuthController, UserManagementController],
  providers: [
    PasswordHasherProvider,
    {
      provide: JwtProvider,
      useFactory: () =>
        new JwtProvider({
          secret: process.env.AUTH_SERVER_JWT_SECRET ?? 'local-dev-auth-secret',
          issuer: 'auth-server'
        })
    },
    createAuthRepositoryProvider({ databaseUrl: process.env.DATABASE_URL }),
    {
      provide: AuthService,
      useFactory: (repository: AuthRepository, hasher: PasswordHasherProvider, jwt: JwtProvider) =>
        new AuthService(repository, hasher, jwt),
      inject: [AUTH_REPOSITORY, PasswordHasherProvider, JwtProvider]
    },
    {
      provide: UserManagementService,
      useFactory: (repository: AuthRepository, hasher: PasswordHasherProvider) =>
        new UserManagementService(repository, hasher),
      inject: [AUTH_REPOSITORY, PasswordHasherProvider]
    },
    AuthGuard,
    AuthAdminGuard,
    {
      provide: APP_FILTER,
      useClass: AuthExceptionFilter
    }
  ]
})
export class AuthModule {}
