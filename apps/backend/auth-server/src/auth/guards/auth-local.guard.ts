import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';

import { AuthServiceError } from '../auth.errors';

@Injectable()
export class AuthLocalGuard extends PassportAuthGuard('local') {
  handleRequest<TUser = unknown>(error: unknown, user: TUser | false): TUser {
    if (error) {
      throw error;
    }
    if (!user) {
      throw new AuthServiceError('invalid_credentials', '账号或密码错误');
    }
    return user;
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
