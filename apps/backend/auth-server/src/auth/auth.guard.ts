import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { AuthServiceError } from './auth.errors';
import { JwtProvider } from './jwt.provider';

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  authUser?: ReturnType<JwtProvider['verify']>;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtProvider) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const value = Array.isArray(authorization) ? authorization[0] : authorization;
    const token = value?.startsWith('Bearer ') ? value.slice('Bearer '.length) : undefined;

    if (!token) {
      throw new AuthServiceError('access_token_missing', '缺少 Access Token');
    }

    try {
      request.authUser = this.jwt.verify(token);
      return true;
    } catch {
      throw new AuthServiceError('access_token_invalid', 'Access Token 无效');
    }
  }
}
