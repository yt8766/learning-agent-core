import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthExceptionFilter } from './filters/auth-exception.filter';
import { AuthAdminGuard } from './guards/auth-admin.guard';
import { AuthLocalGuard } from './guards/auth-local.guard';
import { AuthGuard } from './auth.guard';
import { AuthSeedService } from './auth-seed.service';
import { AuthService } from './auth.service';
import { AUTH_REPOSITORY } from './auth.tokens';
import { JwtProvider } from './jwt.provider';
import { PasswordHasherProvider } from './password-hasher.provider';
import type { AuthRepository } from './repositories/auth.repository';
import { createAuthRepositoryProvider } from './runtime/auth-repository.provider';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { UserManagementController } from './user-management.controller';
import { UserManagementService } from './user-management.service';

@Module({
  imports: [PassportModule],
  controllers: [AuthController, UserManagementController],
  providers: [
    PasswordHasherProvider,
    {
      provide: JwtProvider,
      useFactory: () =>
        new JwtProvider({
          secret: process.env.AUTH_SERVER_JWT_SECRET ?? 'local-dev-auth-secret',
          issuer: process.env.AUTH_SERVER_JWT_ISSUER ?? 'auth-server'
        })
    },
    createAuthRepositoryProvider(),
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
    {
      provide: AuthSeedService,
      useFactory: (repository: AuthRepository, hasher: PasswordHasherProvider) =>
        new AuthSeedService(repository, hasher, {
          adminUsername: process.env.AUTH_SEED_ADMIN_USERNAME ?? 'admin',
          adminPassword: process.env.AUTH_SEED_ADMIN_PASSWORD ?? '',
          adminDisplayName: process.env.AUTH_SEED_ADMIN_DISPLAY_NAME ?? 'Admin'
        }),
      inject: [AUTH_REPOSITORY, PasswordHasherProvider]
    },
    AuthGuard,
    AuthLocalGuard,
    AuthAdminGuard,
    LocalStrategy,
    JwtStrategy,
    {
      provide: APP_FILTER,
      useClass: AuthExceptionFilter
    }
  ]
})
export class AuthModule {}
