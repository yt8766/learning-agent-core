import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';

import { AuthServiceError } from './auth.errors';
import type { AuthJwtPayload } from './jwt.provider';

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthJwtPayload;
}

@Injectable()
export class AuthGuard extends PassportAuthGuard('jwt') {
  handleRequest<TUser = AuthJwtPayload>(error: unknown, user: AuthJwtPayload | false): TUser {
    if (error) {
      throw error;
    }
    if (!user) {
      throw new AuthServiceError('access_token_invalid', 'Access Token 无效');
    }
    return user as TUser;
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const value = Array.isArray(authorization) ? authorization[0] : authorization;
    if (!value?.startsWith('Bearer ')) {
      throw new AuthServiceError('access_token_missing', '缺少 Access Token');
    }
    return super.canActivate(context);
  }
}
