import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { JwtProvider } from './jwt.provider';
import { PasswordHasherProvider } from './password-hasher.provider';
import { InMemoryAuthRepository } from './repositories/auth-memory.repository';
import type { AuthRepository } from './repositories/auth.repository';
import { UserManagementController } from './user-management.controller';
import { UserManagementService } from './user-management.service';

export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

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
    {
      provide: AUTH_REPOSITORY,
      useClass: InMemoryAuthRepository
    },
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
    AuthGuard
  ]
})
export class AuthModule {}
