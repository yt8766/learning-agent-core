import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';

import { AuthTokenVerifier, type KnowledgeAuthUser } from './auth-token-verifier';

export interface KnowledgeAuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  authUser?: KnowledgeAuthUser;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthTokenVerifier) private readonly verifier: AuthTokenVerifier) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<KnowledgeAuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const value = Array.isArray(authorization) ? authorization[0] : authorization;
    const token = value?.startsWith('Bearer ') ? value.slice('Bearer '.length) : undefined;

    if (!token) {
      throw new UnauthorizedException('auth_required');
    }

    try {
      request.authUser = this.verifier.verify(token);
      return true;
    } catch {
      throw new UnauthorizedException('auth_required');
    }
  }
}
